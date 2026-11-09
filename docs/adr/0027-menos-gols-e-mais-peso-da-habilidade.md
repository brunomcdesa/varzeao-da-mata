# Menos gols e mais peso da Habilidade

A Partida passa a ter cerca de 3,1 gols em média com as regras da Temporada 1 (eram 4,0) e 3,5 com as da Temporada 2 (eram 4,4). A Habilidade pesa mais em cada Duelo (`forcaHabilidade` 0,20; era 0,15). Vale para as duas Temporadas a partir do próximo jogo escalado.

Motivo: o 5×1 da Arara Azul sobre a Onça (Rodada 2, Temporada 1) saiu entre Times de força quase igual. O dono achou que a Goleada (ADR-0026) estava saindo fácil demais e que o resultado dependia demais de sorte. Nas medições, 15% dos jogos entre Times iguais terminavam em Goleada.

## Versões

- Regras da Temporada 1: `VERSAO_SIM_T1` vai de 5 para 7. A trava da T1 (`test/regressao-t1.json`) foi refeita com a versão 7.
- Regras da Temporada 2: `VERSAO_SIM` vai de 6 para 8.
- Como a versão da T1 passou de 6, o número deixa de dizer se a Partida é da T2. Quem precisa saber (Arquibancada, Clima, segundo uniforme) olha a Postura guardada no resultado, que só existe com as regras da T2.

## Medições (8 mil Partidas por linha)

| Regras da Temporada 1 | Versão 5 | Versão 7 |
|---|---|---|
| Gols por jogo (OVR 70 × 70) | 4,0 | 3,1 |
| Goleada entre iguais | 15% | 9% |
| Goleada com +10 de OVR (75 × 65) | 20% | 14% |
| +15 de OVR (80 × 65): forte vence | 66% | 69% |
| +25 de OVR (85 × 60): forte vence | 79% | 85% |
| Empates entre iguais | 22% | 24% |

| Regras da Temporada 2 | Versão 6 | Versão 8 |
|---|---|---|
| Gols por jogo (OVR 70 × 70) | 4,4 | 3,5 |
| Goleada entre iguais | 18% | 12% |
| +15 de OVR (80 × 65): forte vence | 66% | 70% |

## O que mudou

- **Chutes:** chute livre 0,62 (era 0,78), chute marcado 0,50 (era 0,66), cabeceio 0,48 (era 0,60); chance de ir para fora entre 0,38 e 0,25 conforme a Finalização (era 0,35 a 0,22).
- **Peso da Habilidade:** 0,20. A meta do ADR-0004 ("um Time bem mais forte vence 60–65%") passa a ser 68–72% com +15 de OVR. A zebra continua: +25 de OVR ainda perde ou empata em 15% dos jogos.
- **Ações (ADR-0010):** com mais defesas e menos gols, a Habilidade Goleiro subiria cerca de 0,5 por jogo. Novos valores: defesa do goleiro +0,28, jogo sem sofrer gol +0,4, chute defendido −0,42, pra fora −0,4, bloqueado −0,48, gol +0,75, ganhou a posse +0,2, assistência +0,85. Com as regras da T1, cada Habilidade volta a ficar perto de zero por Partida entre Times iguais (`pnpm calibrar`).
- **Nota da Partida:** as retas de expectativa foram recalculadas pelo mesmo script.

## Considered Options

- **Só aumentar o peso da Habilidade:** não reduz a Goleada entre iguais (continua em 15% com 0,30 ou 0,45) e aumenta muito a do favorito (58% com peso 0,45 e +15 de OVR).
- **Quem vence por 3 gols fica menos com a bola:** não mudou a taxa de Goleada.
- **Só menos gols:** reduz a Goleada, mas a sorte pesa o mesmo.
- **Só na Temporada 2, mantendo a trava da T1 na versão 5:** o dono preferiu que valesse já.

## Consequences

- Menos gritos de gol por Reel: cerca de 1 gol a menos por Partida.
- O resto da Temporada 1 tem menos gols que as primeiras Rodadas. Partidas já jogadas não mudam.
- Pendência que já existia na versão 6 e não foi tratada aqui: com as regras da T2, a Defesa dos zagueiros cai cerca de 0,24 por Partida e o Passe dos meias sobe 0,12 (efeito das faltas). Precisa de uma calibração própria antes de a T2 começar.
