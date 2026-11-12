# 0050 — Com duas Séries, um jogo por hora (a B antes da A)

- Status: aceito
- Data: 2026-11-12
- Substitui, em parte: ADR-0017 (A e B no mesmo horário)

## Contexto

O ADR-0017 pôs a Série A e a Série B nos mesmos horários (12h, 14h, 16h e 18h), com duas Partidas por horário. Cada Partida já tem o seu Reels e a sua narração, então separar os horários não gasta mais cota do Gemini, e cada jogo ganha um horário só dele, sem dividir a atenção com outro no Ao Vivo e no feed.

## Decisão

Com duas Séries, cada Partida tem o seu horário, de hora em hora, e a Série B joga antes:

| Etapa | Série B | Série A |
|---|---|---|
| Fase de Liga | 11h, 12h, 13h e 14h | 15h, 16h, 17h e 18h |
| Semifinais | 13h e 14h | 15h e 16h |
| Final | 16h | 18h |

- O Resumo continua às 19h, e a Série A continua fechando o dia às 18h.
- O Corte continua 30 minutos antes de cada Apito Inicial.
- Com uma Série só (Temporada 1), nada muda: 12h, 14h, 16h e 18h; Semifinais às 14h e 16h; Final às 18h.
- O subtítulo do Reels ("Rodada 3, jogo das 13h") vale para qualquer horário da Fase de Liga.

## Consequências

- Os horários ficam em `horariosDaLiga`, `horariosDasSemifinais` e `horarioDaFinal` (worker). O calendário é gravado na criação da Temporada, então só vale para Temporadas criadas depois desta mudança.
- O cron da borda roda a cada minuto e segue a agenda gravada: horário novo não precisa de mudança na Cloudflare.
- Não muda a simulação; a versão da simulação continua a mesma.
