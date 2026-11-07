# Implantação

Do zero até a Liga rodando sozinha. São cinco contas e cerca de 1 hora de trabalho. Tudo
cabe nos planos grátis, com duas exceções: o Gemini TTS, que é pré-pago, e os minutos do
Actions, que dependem de o repositório ser público ou privado (veja o fim).

**Regra de ouro dos segredos.** Token, senha e chave vão só para o `.env`, que não sobe
para o git, e para os Secrets do GitHub. Nunca cole um segredo em chat, issue ou commit.
Para o GitHub, prefira `gh secret set NOME`: ele pergunta o valor sem mostrar na tela.

Ordem sugerida: banco → Cloudflare → Instagram → conferir → GitHub → ligar.

## 1. Banco (Neon)

1. Crie um projeto em [neon.tech](https://neon.tech) (região São Paulo, se houver; senão a mais próxima).
2. Em **Connection string**, copie a versão com pooling (`...-pooler...`), que termina em `?sslmode=require`.
3. No `.env`: `DATABASE_URL=postgres://...`.
4. Crie a Temporada (isso também cria as tabelas):

   ```
   pnpm liga temporada --inicio 2026-11-16
   ```

   A Fase de Liga tem 7 Rodadas, uma por dia, com jogos às 12h, 14h, 16h e 18h. Escolha
   um início com alguns dias de folga para juntar inscrições.

## 2. Cloudflare

Tudo no painel [dash.cloudflare.com](https://dash.cloudflare.com). O **Account ID** aparece
na lateral da página inicial da conta: `CF_ACCOUNT_ID`.

### R2 (arquivos)

1. **R2 → Create bucket**: `varzeao-publico` e `varzeao-privado`.
2. No `varzeao-publico`: **Settings → Public Development URL → Enable**. O endereço
   `https://pub-....r2.dev` vai em `R2_URL_PUBLICA`. É de lá que o Instagram baixa os vídeos.
   O `varzeao-privado` fica **sem** acesso público.
3. **R2 → Manage API tokens → Create API token**: permissão *Object Read & Write*, só para
   os dois buckets. Guarde `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`. O segredo aparece uma vez só.

### KV (agenda de publicação)

```
pnpm --filter @liga/edge exec wrangler login
pnpm --filter @liga/edge exec wrangler kv namespace create AGENDA
```

O comando mostra um `id`, que vai em `CF_KV_NAMESPACE_ID` e no `packages/edge/wrangler.toml`.

### Tokens da API

Em **My Profile → API Tokens → Create Token → Custom token**:

- `CF_API_TOKEN`: *Account → Workers KV Storage → Edit*. Os jobs gravam a agenda e o token do Instagram.
- `CF_DEPLOY_TOKEN`: *Account → Cloudflare Pages → Edit*. O workflow publica o site.

### Worker na borda

1. No `packages/edge/wrangler.toml`, troque `TROQUE_PELO_ID_DO_KV` e `TROQUE_PELO_IG_USER_ID`.
   O `IG_USER_ID` sai do passo 3; nenhum dos dois é segredo.
2. `pnpm edge:deploy`. No fim aparece o endereço `https://varzeao-edge.<sua-conta>.workers.dev`,
   que vai na variável `LIGA_EDGE_URL` do GitHub.

### Pages (site)

```
pnpm --filter @liga/edge exec wrangler pages project create varzeao-da-mata --production-branch master
```

O nome vai na variável `CF_PAGES_PROJETO`. O site fica em `https://varzeao-da-mata.pages.dev`.

### Anti-robô do voto no site (opcional)

Em **Turnstile → Add widget**, domínio `varzeao-da-mata.pages.dev`, modo *Managed*. A **Site Key** é pública e vai na variável `LIGA_TURNSTILE_SITEKEY`. A **Secret Key** é segredo e vai só na borda:
`pnpm --filter @liga/edge exec wrangler secret put TURNSTILE_SECRET` (cole quando ele pedir; não mande em chat). Sem os dois, o voto no site funciona sem o desafio, só com o limite por aparelho e por rede.
Esse link vai na bio do Instagram.

## 3. Instagram

O perfil da Liga precisa ser **profissional** (Criador de conteúdo ou Empresa). No app,
abra **Configurações → Tipo de conta e ferramentas → Mudar para conta profissional**.

1. Em [developers.facebook.com/apps](https://developers.facebook.com/apps), crie um app e
   escolha o caso de uso **Gerenciar mensagens e conteúdo no Instagram**.
2. Apps criados a partir de 2026 só têm **API setup with Unified login** (login unificado);
   a "API com login do Instagram" não aparece mais. O projeto funciona com os dois.
3. Em **Permissões e recursos**, garanta `instagram_basic`, `instagram_manage_comments` e
   `instagram_content_publish` (no login antigo: as versões `instagram_business_*`).
4. Em **Funções do app → Funções**, ponha o perfil da Liga como **Testador do Instagram** e
   aceite o convite no Instagram (Configurações → Apps e sites → Convites de testador).
5. Em **Gerar tokens de acesso → Adicionar conta**, entre com o perfil da Liga. O número
   embaixo do @ (começa com `1784`) vai em `IG_USER_ID`. **Gerar token** dá o
   `IG_ACCESS_TOKEN`: `EAA…` no login unificado, `IG…` no antigo.
6. Login unificado: `IG_APP_ID` (id do app) e `IG_APP_SECRET` (Configurações do app → Básico),
   para o job trocar o token antes de vencer. Token que não vence dispensa.
7. `pnpm verificar` confere tudo sem publicar nada.

## 4. Conferir tudo de casa

Com o `.env` preenchido (veja `.env.example`):

```
pnpm verificar
```

Ele confere, sem publicar nada:

- se o token é válido e de qual @ é;
- se o `IG_USER_ID` bate com o do token;
- se dá para ler os comentários;
- se dá para gravar nos dois buckets e se o público abre pela internet;
- se dá para gravar e ler no KV.

Para ver um job inteiro rodando com os dados reais (cuidado: este **agenda Reels de verdade**
se houver jogo na próxima hora):

```
pnpm job coletar
```

## 5. GitHub

Em **Settings → Environments → New environment**, crie o ambiente **`PROD`** e cadastre nele os Secrets e as Variables abaixo. Os workflows rodam com `environment: PROD`.

A única exceção é `LIGA_ATIVA`, o interruptor da Liga: ela fica em **Settings → Secrets and variables → Actions → Variables** (do repositório), porque o `if` de um job não enxerga as variáveis de ambiente.

**Secrets** (ou `gh secret set NOME`):

| Nome | De onde vem |
|---|---|
| `DATABASE_URL` | Neon |
| `IG_USER_ID`, `IG_ACCESS_TOKEN` | Meta, passo 3 |
| `GEMINI_API_KEY` | aistudio.google.com/apikey |
| `CF_ACCOUNT_ID` | Cloudflare |
| `CF_API_TOKEN`, `CF_DEPLOY_TOKEN` | Cloudflare, tokens |
| `CF_KV_NAMESPACE_ID` | `wrangler kv namespace create` |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2, token da API |

**Variables** (ou `gh variable set NOME`):

| Nome | Valor |
|---|---|
| `R2_BUCKET_PUBLICO` | `varzeao-publico` |
| `R2_BUCKET_PRIVADO` | `varzeao-privado` |
| `R2_URL_PUBLICA` | `https://pub-....r2.dev` |
| `LIGA_EDGE_URL` | `https://varzeao-edge.<sua-conta>.workers.dev` |
| `CF_PAGES_PROJETO` | `varzeao-da-mata` |
| `LIGA_INSTAGRAM` | o @ da Liga, sem @ (aparece no site) |
| `LIGA_TURNSTILE_SITEKEY` | Site Key do Turnstile (opcional) |
| `GEMINI_TTS_VOZ` | `Lumi` (opcional) |
| `GEMINI_TTS_RPM` | `10` com faturamento ativo (opcional) |

Depois, em **Actions → site → Run workflow**, publique o site.

## 6. Ligar

Crie a variável `LIGA_ATIVA` com o valor `sim`. A partir daí:

| Workflow | Quando (Brasília) | O que faz |
|---|---|---|
| `coletar` | toda hora, :17 | renova o token, lê ENTRO/CRAQUE, atualiza o site |
| `partida` | 11h25, 13h25, 15h25, 17h25 | espera o Corte, escala, simula, grava e agenda o Reels |
| `resumo` | 18h10 | fecha a Rodada, grava o Resumo e agenda para as 19h |
| borda (Cloudflare) | todo minuto | publica o que venceu: Reels às hh:06 e Resumo às 19h |

Para pausar tudo, troque `LIGA_ATIVA` para `nao`. Falhas chegam por e-mail do GitHub. Na
aba Actions dá para rodar de novo: os jobs retomam de onde pararam e não publicam duas vezes.

Para testar fora do horário, use **Run workflow** no `coletar` (seguro). O `partida` também
pode ser rodado à mão: ele processa só jogos com apito na próxima hora.

## Minutos do Actions

O repositório **privado** tem 2.000 minutos por mês no plano grátis, e a Liga usa cerca de
2.400 numa Temporada (`docs/arquitetura.md`). Há duas saídas:

- deixar o repositório **público**: minutos ilimitados, e os segredos continuam protegidos nos Secrets;
- desligar a Liga (`LIGA_ATIVA=nao`) entre Temporadas e aceitar alguns dias acima da cota, a US$ 0,008 por minuto.

## Custos esperados por Temporada (estimativa)

| Serviço | Custo |
|---|---|
| Gemini TTS | cerca de US$ 2–3, pré-pago |
| Neon, Cloudflare (R2, KV, Workers, Pages) | dentro do grátis |
| Instagram API | grátis |
