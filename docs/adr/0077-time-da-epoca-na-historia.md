# 0077 — Time da época na História

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-17

## Contexto

O Rebalanceamento da T2 (ADR-0036/0058) levou 64 Jogadores para os Times Primos. O site mostrava a História de cada Temporada com o Time *atual* do Jogador: o Craque da Temporada 1 apareceu como "do Besouro", um Time que nem existia na T1. Com o artilheiro, o melhor goleiro, os Candidatos e os Craques de cada Rodada, e os troféus na Carreira, acontecia o mesmo. O mesmo problema voltaria a cada Janela de Transferências.

## Decisão

O site mostra o Time pelo qual o Jogador jogou naquela Rodada ou Temporada, lido das Escalações:

- **Candidatos e Craque da Rodada:** o Time da Escalação naquela Rodada.
- **Craque da Temporada, artilheiro e melhor goleiro (História):** o último Time pelo qual ele jogou naquela Temporada.
- **Troféus da Carreira (Craque da Rodada e da Temporada):** seguem os dois itens acima. O troféu de campeão e a Seleção já usavam o Time da Partida.
- Quem ainda não jogou continua aparecendo com o Time atual.

O Reels do Resumo da Temporada 1 já tinha saído, e o dono decidiu não corrigi-lo. Esta mudança vale só para o site.

## Consequences

- O card do Jogador, o Elenco e a página do Time continuam mostrando o Time atual.
- Não muda a simulação.
