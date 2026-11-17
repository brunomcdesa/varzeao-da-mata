# 0078 — Piso da Temporada 1 no gráfico do OVR

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-17

## Contexto

O gráfico "OVR jogo a jogo" da página do Jogador desenha a estreia e o OVR depois de cada jogo. O Piso da Temporada 1 (ADR-0047/0056) sobe o OVR fora de um jogo. Quem subiu pelo Piso via 65 no card, mas o gráfico terminava no OVR do último jogo da T1, por exemplo 62.

## Decisão

- O site recebe `pisoT1` (OVR antes e depois) só para quem subiu pelo Piso.
- O gráfico ganha um ponto a mais logo depois do último jogo da T1: um círculo vazado com a palavra "Piso". Ele é ligado por um trecho tracejado, porque não foi um jogo.
- Antes da estreia na T2, o gráfico termina no mesmo OVR do card. Depois, os jogos da T2 seguem a partir do Piso.
- Quem estava no Piso ou acima dele não ganha esse ponto.
