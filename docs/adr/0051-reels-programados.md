# 0051 — Reels Programados: anúncios com dia e hora que saem sozinhos

- Status: aceito
- Data: 2026-11-12

## Contexto

A série de Reels da Temporada 2 (Abertura, Agradecimento e Rebalanceamento, novidades) tem dia e hora marcados entre o fim da T1 e a estreia da T2. Até aqui, Reels de anúncio (apresentação, explicações, agradecimento) eram gravados e agendados à mão, por script ou workflow manual. O dono opera tudo sozinho e pode esquecer ou não estar disponível na hora: esses Reels precisam sair automaticamente, como os de Partida e de Resumo.

## Decisão

- A lista `REELS_PROGRAMADOS` (`packages/shared/src/programados.ts`) guarda cada Reels Programado: um id, um número na agenda e o horário de publicação.
- A borda dispara o workflow `programados` 90 e 60 minutos antes de cada horário (o segundo é a reserva). O cron do GitHub cobre só o dia de cada Programado.
- O job `programados` grava o vídeo (com a voz do Narrador), sobe para o R2, cria o container e põe na agenda da borda, que publica na hora. Se a gravação terminar depois do horário, publica no minuto seguinte. A janela vai de 2 h antes a 1 h depois.
- O job é retomável: a marca `programados/<id>` na agenda diz que já foi agendado, e a chave da agenda é a mesma em toda tentativa, então nunca publica duas vezes.
- O post entra como `APRESENTACAO`: o coletar passa a ler os comentários dele como Inscrições.
- A aprovação do dono é dada uma vez, na prévia, antes de o Programado entrar na lista. Depois disso, ele sai sem nova confirmação.

O primeiro Programado é a Abertura da Temporada 2: terça, 17/11, às 12h.

## Consequências

- Programado novo = item na lista, gravação no `job.ts` (`pnpm job programados`), legenda e teste. Mudar a lista republica a borda (o workflow `borda` observa o arquivo).
- A narração usa a cota do Gemini no dia do post (uma Abertura tem 7 falas).
- Se o horário estiver a mais de 24 h, o container do Instagram vence; por isso o job só grava dentro da janela.
