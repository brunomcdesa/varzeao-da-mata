# Menos gols e mais peso da Habilidade

A partir da `VERSAO_SIM` 6, a Partida tem cerca de 3,1 gols em média (eram 4,0) e a Habilidade pesa mais em cada Duelo (`forcaHabilidade` 0,20; era 0,15).

Motivo: o 5×1 da Arara Azul sobre a Onça (Rodada 2, Temporada 1) saiu entre Times de força quase igual. O dono achou que a Goleada estava saindo fácil demais e que o resultado dependia demais de sorte. As medições mostraram que 15% dos jogos entre Times iguais terminavam em Goleada.

## Medições (8 mil Partidas por linha)

| | Versão 5 | Só menos gols | Versão 6 (escolhida) |
|---|---|---|---|
| Gols por jogo (OVR 70 × 70) | 4,0 | 3,1 | 3,1 |
| Goleada entre iguais | 15% | 9% | 9% |
| Goleada com +10 de OVR (75 × 65) | 20% | 12% | 14% |
| +15 de OVR (80 × 65): forte vence | 66% | 63% | 70% |
| +25 de OVR (85 × 60): forte vence | 79% | 77% | 85% |
| Empates entre iguais | 22% | 24% | 24% |

## O que mudou

- **Chutes:** chute livre 0,62 (era 0,78), chute marcado 0,50 (era 0,66), cabeceio 0,48 (era 0,60); chance de ir para fora entre 0,38 e 0,25 conforme a Finalização (era 0,35 a 0,22).
- **Peso da Habilidade:** 0,20. A meta do ADR-0004 ("um Time bem mais forte vence 60–65%") passa a ser 68–72% com +15 de OVR. A zebra continua: +25 de OVR ainda perde ou empata em 15% dos jogos.
- **Ações (ADR-0010):** com mais defesas e menos gols, a Habilidade Goleiro subiria cerca de 0,5 por jogo. Novos valores: defesa do goleiro +0,28, jogo sem sofrer gol +0,4, chute defendido −0,42, pra fora −0,4, bloqueado −0,48, gol +0,75, ganhou a posse +0,2, assistência +0,85. Cada Habilidade volta a ficar perto de zero por Partida entre Times iguais (`pnpm calibrar`).
- **Nota da Partida:** as retas de expectativa foram recalculadas pelo mesmo script.

## Considered Options

- **Só aumentar o peso da Habilidade:** não reduz a Goleada entre iguais (continua em 15% com 0,30 ou 0,45) e aumenta muito a do favorito (58% com peso 0,45 e +15 de OVR).
- **Quem vence por 3 gols fica menos com a bola:** não mudou a taxa de Goleada.
- **Só menos gols:** reduz a Goleada, mas a sorte pesa o mesmo.

## Consequences

- Menos gritos de gol por Reel: cerca de 1 gol a menos por Partida.
- O favorito vence mais, então Times com Jogadores mais fortes se destacam mais na tabela.
- Vale a partir do próximo jogo escalado. Partidas já jogadas não mudam.
