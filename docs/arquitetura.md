# Arquitetura — Varzeão da Mata

Visão técnica do sistema. Os termos de domínio estão em [`GLOSSARY.md`](../GLOSSARY.md), e as decisões estruturais em [`docs/adr/`](./adr/).

## Visão geral

```mermaid
flowchart LR
  IG[(Instagram)] -- comentários --> C[Actions: coletar<br/>a cada hora]
  C --> DB[(PostgreSQL)]
  P[Actions: partida<br/>no Corte, H−30] --> DB
  P --> SIM[sim]
  P --> REN[renderer headless]
  REN -- mp4 --> R2P[(R2 público: vídeos e JSON do site)]
  P -- lances --> R2S[(R2 privado: lances)]
  P -- agenda + container --> KV[(Workers KV)]
  W[Cloudflare Worker<br/>cron de 1 min] -- lê --> KV
  W -- media_publish --> IG
  W -- libera lances no Apito Inicial --> SITE
  R2S --> W
  SITE[site estático<br/>Cloudflare Pages + renderer] -- lê --> R2P
```

O **GitHub Actions** (repositório privado) faz o trabalho pesado sem pressa. O **Cloudflare Worker** faz o que precisa de horário exato: liberar os lances no Apito Inicial e publicar os Reels (ADR-0005). Não há servidor sempre ligado.

## O dia de uma Rodada

| Horário | Quem | O quê |
|---|---|---|
| a cada hora (:17) | Actions `coletar` | Lê Comandos, cria Jogadores, registra votos, atualiza o JSON do site |
| 11h30 | Actions `partida` | Fecha a votação do Craque da Rodada anterior. Corte, simulação e render da Partida das 12h (o Reels abre com a revelação do Craque) |
| 12h00 | Worker | Libera os lances; a Partida começa Ao Vivo no site |
| 12h06 | Worker | Publica o Reels da Partida |
| 13h30 · 15h30 · 17h30 | Actions `partida` | O mesmo ciclo para as Partidas das 14h, 16h e 18h |
| 18h10 | Actions `resumo` | Tabela, Candidatos a Craque e render do Resumo; cria o container |
| 19h00 | Worker | Publica o Resumo da Rodada; a votação do Craque começa |

No Mata-mata, as Partidas ocupam os últimos horários: semifinais às 16h e 18h, final às 18h.

## Monorepo (pnpm workspaces)

| Pacote | Responsabilidade |
|---|---|
| `shared` | Tipos de domínio, Times, Clássicos, regras puras (rodízio, tabela, Vantagem do Empate) e parser de Comandos |
| `sim` | Motor determinístico: recebe Escalações, seed e fase; devolve lances, placar, pênaltis e Notas. Sem `Math.random` nem relógio |
| `renderer` | Animação 2D (Canvas/Phaser) que reproduz os lances da `sim`. Roda em dois modos: **quadro a quadro**, no Actions, para o vídeo, e **tempo de relógio**, no site, para Ao Vivo e Replay |
| `worker` (Actions) | Jobs `coletar`, `partida` e `resumo`: banco, Graph API, Playwright, ffmpeg, Azure Speech, R2 e KV |
| `edge` (Cloudflare Worker) | Cron de 1 minuto que lê a agenda e publica Reels; endpoint `GET /partidas/:id/lances` que só responde depois do Apito Inicial |
| `site` | Site estático: tabela, artilharia, busca do Card, Ao Vivo e Replay |

## Modelo de dados

```mermaid
erDiagram
  TEMPORADA ||--o{ RODADA : tem
  TIME ||--o{ JOGADOR : elenco
  RODADA ||--o{ PARTIDA : tem
  PARTIDA ||--o{ ESCALACAO : tem
  JOGADOR ||--o{ ESCALACAO : joga
  RODADA ||--o{ CANDIDATO : tem
  RODADA ||--o{ VOTO : recebe
```

- **temporada**: numero, status (PRE_TEMPORADA, EM_ANDAMENTO, ENCERRADA), inicio.
- **time**: id (CAP, ONC, …), nome, apelidos[] (usados pelo parser), cores.
- **jogador**: `ig_user_id` (único, chave estável), `username` (atualizado a cada comentário), time_id, posicao, ovr, banido, inscrito_em.
- **comando**: `ig_comment_id` (único, garante idempotência), ig_media_id, ig_user_id, texto, tipo (INSCRICAO, VOTO, INVALIDO), resultado.
- **rodada**: temporada_id, numero, fase (LIGA, MATA_MATA), data, resumo_status (PENDENTE → RENDERIZADO → AGENDADO → PUBLICADO), resumo_ig_media_id.
- **partida**: rodada_id, mandante_id, visitante_id, **apito_inicial**, vantagem_do_empate, **status** (PENDENTE → SIMULADA → RENDERIZADA → AGENDADA → PUBLICADA), **seed**, **versao_sim**, gols, penaltis, lances (jsonb), video_url, ig_container_id, ig_media_id.
- **escalacao**: partida_id, time_id, jogador_id (nulo = Jogador da Base), posicao, nota, ovr_antes, ovr_depois.
- **candidato**: rodada_id, jogador_id, nota.
- **voto**: rodada_id, ig_user_id, jogador_id; único por (rodada_id, ig_user_id), e o último voto antes do fechamento vale.
- **config**: token do Instagram e data de expiração (espelhados no Workers KV para o Worker).

## Job `coletar` (a cada hora, minuto :17)

1. Lista os Reels da Liga ainda abertos e busca comentários novos via `/{media-id}/comments` (campos `id`, `text`, `from`, `timestamp`).
2. Grava cada comentário em `comando`; um `ig_comment_id` repetido é ignorado.
3. Normaliza o texto (maiúsculas, acentos, emojis) e interpreta:
   - `ENTRO <time|apelido> <posição|sinônimo>` cria o Jogador com OVR sorteado, respeitando o limite de equilíbrio entre Times.
   - `CRAQUE @fulano` registra o voto, apenas em Candidatos a Craque da Rodada anterior.
4. Aplica o filtro de @ e texto ofensivo; banidos são ignorados.
5. Exporta o JSON público do site (tabela, Cards, calendário com Apitos Iniciais) para o R2.

## Job `partida` (no Corte, 30 min antes de cada Apito Inicial)

Cada etapa só roda se o status da Partida ainda não passou dela; reexecutar retoma de onde parou. O orçamento é de 36 minutos até o Worker publicar o Reels.

1. **Coletar e escalar**: coleta final; monta as duas Escalações (rodízio priorizando quem não jogou, Craque anterior garantido, Base completando vagas).
2. **Simular** (→ SIMULADA): sorteia e salva o seed, roda a `sim`, grava lances, Notas e OVRs novos. Os lances vão para o **R2 privado**.
3. **Renderizar** (→ RENDERIZADA):
   - O roteiro sai de templates por tipo de evento e por bordão de Time, com variações sorteadas pelo seed.
   - O Azure Speech gera a narração do Locutor da Liga. A voz fala Posição e Time, e o @ aparece só na tela.
   - O Playwright abre o `renderer` em modo quadro a quadro e salva PNGs, com texto animado sincronizado à narração.
   - O ffmpeg mistura narração, hino royalty-free e efeitos (torcida, apito) e monta o MP4 1080×1920, que sobe para o R2 público.
4. **Agendar** (→ AGENDADA): cria o container `REELS` com `video_url`, espera `status_code = FINISHED` e grava no KV `{partidaId, apitoInicial, publicarEm: apito + 6 min, containerId}`.

## Job `resumo` (18h10)

Calcula tabela e Candidatos a Craque, renderiza o Resumo da Rodada (placares, tabela, Novos Contratados, 5 Candidatos, chamada "comente ENTRO / CRAQUE"), cria o container e agenda no KV para as 19h.

## Worker `edge` (Cloudflare)

- **Cron a cada minuto**: lê a agenda no KV; para cada item com `publicarEm` vencido e ainda não publicado, chama `media_publish`, marca como publicado no KV e avisa o banco via o próximo `coletar`. É idempotente: um item publicado nunca é publicado de novo.
- **`GET /partidas/:id/lances`**: compara o horário do servidor com o Apito Inicial. Antes dele responde `425 Too Early` com o horário. Depois, entrega os lances do R2 privado, com cache longo.
- Horários do cron são UTC. Brasília é UTC−3, sem horário de verão.

## Site (Ao Vivo e Replay)

- **Ao Vivo**: no Apito Inicial, o site busca os lances e posiciona o `renderer` em `(agora − apito) × 15`. Quem entra no meio pega o jogo em andamento, com placar correto. A Partida dura cerca de 6 minutos.
- **Replay**: qualquer Partida terminada é reproduzida do início, com controles de pausa e velocidade.
- **Antes do Apito**: contagem regressiva e as Escalações, sem resultado.

## Segredos

- **GitHub Actions**: `DATABASE_URL`, `IG_USER_ID`, `IG_APP_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PUBLICO`, `R2_BUCKET_PRIVADO`, `CF_API_TOKEN` (para escrever no KV), `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`.
- **Worker**: vínculos com o KV e o bucket privado. O token do Instagram é lido do KV, que o Actions atualiza ao renová-lo.

Falhas do Actions chegam pelo e-mail padrão do GitHub e podem ser reexecutadas pela aba Actions.

## Orçamento de minutos do Actions (estimativa)

Cerca de 720 execuções curtas do `coletar` (~720 min), 4 jobs `partida` de 10–12 min por dia (~1.400 min) e 1 `resumo` de ~10 min por dia (~300 min) somam **~2.400 min/mês, acima dos 2.000 gratuitos** de repositório privado.

Para caber, há duas saídas: pausar o `coletar` fora da Temporada e de madrugada, ou rodar o render num runner próprio.
