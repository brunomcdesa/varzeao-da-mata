# Pipeline diário 100% automático via Graph API

Todo dia o sistema faz o ciclo completo sem intervenção humana:

1. Lê os Comandos pela Instagram Graph API, com Business Login for Instagram. Como o app serve apenas a própria conta profissional, basta o acesso padrão, sem App Review.
2. Simula a Rodada no Corte das 18h.
3. Renderiza o vídeo de forma headless.
4. Publica o Reels às 19h pela Content Publishing API.

Escolhemos automação total desde o início, em vez de gravar e postar manualmente, para manter o ritmo de uma Rodada por dia sem depender de presença humana.

O job roda em GitHub Actions agendado, num repositório privado. Escolhemos isso em vez de Render Cron ou VPS porque o Actions já traz Chromium e ffmpeg, é gratuito na escala do projeto e permite reexecução manual. Mantivemos o Business Login for Instagram, que dispensa Página do Facebook. Como ele não aceita upload direto de arquivo para Reels, o vídeo é publicado a partir de uma URL pública no Cloudflare R2.

## Consequences

- Os Reels publicados pela API não usam os áudios em alta do app, então a trilha precisa ser própria ou livre de direitos e ir embutida no vídeo.
- Nada passa por revisão humana antes de ir ao ar. Por isso a moderação combina um filtro automático de @ e texto ofensivo com um painel de banimento manual.
- O formato dos Comandos ("ENTRO", "CRAQUE") vira um contrato público e não pode mudar sem aviso.
- A API não permite curtir comentários, então a confirmação da Inscrição aparece no Reels (Novos Contratados) e no site, nunca no comentário.
- Agendamentos do Actions podem atrasar na virada da hora, então o job da Rodada começa às 18h07 e publica assim que termina.
- Cada etapa da Rodada grava seu status no banco, e reexecutar o job retoma da etapa que falhou sem duplicar simulação ou publicação.
