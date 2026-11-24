# 0107 — Abertura do Reels de Partida igual à capa, com movimento

- Status: proposto (aguardando aprovação da prévia)
- Data: 2026-11-24

## Contexto

Com a capa nova (ADR-0106), quem tocava na capa caía numa abertura diferente: as faixas de torcida tremulando com os nomes completos dos Times. O dono quis que a abertura fosse a própria capa.

## Decisão

1. A capa e a abertura desenham o mesmo Confronto (`desenharConfronto`): selo "Melhores momentos", escudo da Liga, Rodada e horário, Grupo, escudos frente a frente, nomes, selos e, na última Rodada, a Briga.
2. Na abertura a capa ganha vida, com os tempos em segundos de vídeo (`entradaDoConfronto`), para caber mesmo na abertura mais curta (3 s): o topo aparece até 0,4 s; o escudo do mandante entra pela esquerda (0,3 a 0,8 s) e o do visitante pela direita (0,6 a 1,1 s); na batida (1,1 s) o "x" surge maior e assenta, com um tremor curto da tela; depois vêm os nomes, os selos (1,4 a 1,7 s) e as plaquinhas da Briga (1,7 a 2,2 s). A abertura some nos últimos 15%.
3. Na última Rodada, a plaquinha de cada Time ("Empate basta", "Já garantido"…) fica embaixo do nome dele, e "Já garantidos: …" embaixo dos selos.
4. As faixas de torcida saem do Reels de Partida (continuam em outras cartelas que as usam).

## Consequências

- Vale para os Reels gravados depois do merge. Nada muda na simulação nem em Partidas já jogadas.
