# Varzeão da Mata

Jogo de futebol interativo no Instagram: seguidores se inscrevem pelos comentários, viram Jogadores de 8 Times de bichos brasileiros e acompanham as Partidas simuladas em Reels diários.

- Vocabulário: [`GLOSSARY.md`](./GLOSSARY.md)
- Arquitetura: [`docs/arquitetura.md`](./docs/arquitetura.md)
- Times e Clássicos: [`docs/times.md`](./docs/times.md)
- Decisões: [`docs/adr/`](./docs/adr/)
- Colocar no ar: [`docs/implantacao.md`](./docs/implantacao.md)

## Pacotes

| Pacote | Estado |
|---|---|
| `packages/shared` | Tipos de domínio, Times, Clássicos, limites de OVR |
| `packages/sim` | Motor determinístico com testes e calibração |
| `packages/renderer` | Linha do tempo pura, desenho em Canvas 9:16, página de Replay (`pnpm demo`) e gravação do Reels em MP4 (`pnpm gravar`) |
| `packages/worker` | Banco (PostgreSQL), Comandos (ENTRO / CRAQUE), Inscrições, votos, Escalações com rodízio, calendário, clientes do Instagram/R2/KV, jobs `coletar`, `partida` e `resumo`, exportação dos dados do site |
| `packages/edge` | Worker da Cloudflare: publica os Reels no minuto certo e entrega a Partida só depois do Apito |
| `packages/site` | Site estático: Rodada, Ao Vivo e Replay, jogos, tabela, Times, ranking, Card do Jogador e comparação |

## Comandos

Precisa de Node 18+ e pnpm. Se o pnpm não estiver instalado: `corepack enable` (vem com o Node) ou `npm i -g pnpm`.

```bash
pnpm install
pnpm test        # testes de todos os pacotes
pnpm typecheck
pnpm calibrar    # roda 20 mil Partidas e imprime as métricas de calibração
pnpm demo        # gera a página de Replay em packages/renderer/dist/demo/index.html
pnpm --filter @liga/renderer demo --servir   # mesmo, com servidor em localhost:5173 e rebuild automático
pnpm gravar --seed 42 --mandante CAP --visitante ONC --saida ~/reels.mp4   # grava um Reels de teste
pnpm gravar --seed 42 --previa ~/previa   # só os quadros-chave, para revisar o visual
pnpm liga ...    # a Liga inteira no seu computador (veja o topo de packages/worker/scripts/liga.ts)
pnpm liga site   # exporta os dados do site a partir do banco local
pnpm site        # site em localhost:5174
pnpm verificar   # confere as credenciais do .env sem publicar nada
pnpm job coletar | partida | resumo   # os jobs do Actions, na mão
```

Para gravar, instale uma vez o ffmpeg e o Chromium do Playwright (e, opcionalmente, o espeak-ng como voz de teste):

```bash
sudo apt install ffmpeg espeak-ng
pnpm --filter @liga/renderer exec playwright install chromium
```

## Calibração atual da sim (VERSAO_SIM 1)

| Confronto (OVR) | Forte vence | Empate | Gols/jogo |
|---|---|---|---|
| 70 × 70 | 39% | 22% | 3,5 |
| 75 × 65 | 57% | 20% | 3,6 |
| 80 × 65 | 64% | 18% | 3,6 |
| 85 × 60 | 73% | 14% | 3,8 |

A variação média de OVR por Partida fica entre 0,00 e 0,03 em todas as faixas, então não há bola de neve. Qualquer mudança em `src/parametros.ts` exige subir `VERSAO_SIM` (ADR-0002).

## A Liga no seu computador

Sem Instagram e sem servidor: o banco fica em `.cache/liga-local` (Postgres embutido) e os vídeos vão para `~/varzeao-videos`.

```bash
pnpm liga temporada --inicio 2026-11-09     # cria a Temporada (7 Rodadas, jogos às 12h, 14h, 16h e 18h)
pnpm liga inscricoes-de-teste --quantidade 60   # "comentários" ENTRO de seguidores fictícios
pnpm liga comentar --de rafa "ENTRO CAPIVARA ATA"
pnpm liga jogar                              # joga a próxima Rodada e grava os 4 Reels (--sem-video para só simular)
pnpm liga resumo                             # grava o Reels do Resumo da Rodada
pnpm liga comentar --de fa1 "CRAQUE @fulano"   # vota no Craque (vale até a próxima Rodada começar)
pnpm liga tabela | elencos | status
```

Para recomeçar do zero, apague a pasta `.cache/liga-local`.

## Voz do Locutor (Gemini TTS)

```bash
cp .env.example .env                  # preencha GEMINI_API_KEY (o .env não vai para o git)
pnpm vozes --gemini Lumi              # confere o identificador da voz no Gemini
pnpm gravar --seed 42 --saida ~/reels.mp4
```

A chave sai em https://aistudio.google.com/apikey. Sem ela, o gravador tenta o Azure Speech (`pnpm vozes` lista as vozes e `pnpm testar-grito` compara gritos), depois o espeak-ng, e por fim grava sem voz. Veja os ADRs 0008 e 0009.
