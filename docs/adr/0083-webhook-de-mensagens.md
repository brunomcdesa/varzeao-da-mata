# 0083 — Webhook de mensagens do Instagram

- Status: aceito
- Data: 2026-11-17

## Contexto

O Link de Vínculo (ADR-0082) é a primeira DM que a Liga manda pela API, e todo envio voltou com 10/2534022 ("fora do período permitido"), mesmo minutos depois de a pessoa escrever. A confirmação "Pronto, @…!" do vínculo por código (ADR-0013) também nunca tinha chegado: a borda ignora o erro. A leitura das DMs funciona porque usa a API de conversas, mas a conta nunca foi inscrita no campo `messages` do webhook. Sem essa inscrição, a Meta não abre a janela de 24 h para o app.

## Decisão

- A borda responde em `/webhook/instagram`:
  - GET: a verificação da Meta, com o token `IG_WEBHOOK_TOKEN`;
  - POST: os eventos, conferindo a assinatura com `IG_APP_SECRET` e respondendo 200.

  Os eventos não são usados: a Liga continua lendo as DMs como antes.
- O dono cadastra a URL e o token no painel do app da Meta (Webhooks, objeto Instagram, campo `messages`) e roda o workflow manual **webhook-mensagens**, que inscreve a conta (`POST /<conta>/subscribed_apps`, `subscribed_fields=messages`) e mostra as inscrições.

## Consequências

- Com a inscrição, a Liga pode mandar DM para quem escreveu nas últimas 24 h: o Link de Vínculo e a confirmação do vínculo por código.
- Os segredos ficam na Cloudflare (`wrangler secret put`) e nos segredos do GitHub. Nada vai para o repositório.
