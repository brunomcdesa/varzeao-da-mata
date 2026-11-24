# 0106 — Capa do Reels de Partida com escudos frente a frente

- Status: aceito (prévia aprovada pelo dono em 24/11/2026)
- Data: 2026-11-23

## Contexto

A capa do Reels de Partida era a abertura parada: o escudo grande da Liga no alto e as duas faixas de torcida com os nomes completos dos Times. Na grade do perfil, o Instagram mostra só o recorte 3:4 do meio (linhas 60 a 420 da tela de 270 x 480) e põe o contador de visualizações no canto de baixo. O contador cobria a faixa do Time visitante, o escudo da Liga ocupava metade do recorte e a linha "Rodada 5, jogo das 17h" ficava pequena demais para ler.

## Decisão

1. A capa (`desenharCapa`) ganha um desenho próprio, separado da abertura do vídeo. De cima para baixo: o selo "Melhores momentos", o escudo da Liga pequeno, a Rodada e o horário em letra grande ("Rodada 5 · 18h"), o Grupo ("Grupo do Barro"), os dois escudos dos Times grandes frente a frente com o "x" no meio, o nome curto de cada Time embaixo e uma fila de selos.
2. Selos: "Clássico"; e, quando a Partida decide algo de verdade, "Vale a Semifinal" (última Rodada da Fase de Liga, ADR-0053), "Vale a Final" (Semifinal) ou "Vale o título" (Final).
3. **A capa nunca mostra o placar**, para não estragar a surpresa de quem ainda vai ver o Reels.
4. Tudo o que importa fica dentro do recorte 3:4 e fora do canto do contador. Narrador e Juiz vão para baixo do recorte (aparecem só na capa inteira).
5. O worker manda o Grupo da Partida (`grupo`) nos dados do vídeo, só na Fase de Liga com Grupos.

## Consequências

- Vale para os Reels gravados depois do merge. Os Reels já publicados ficam com a capa antiga (a API não troca a capa de um Reels publicado).
- A Temporada sem Grupos (T1 e T3 em diante) fica sem a linha do Grupo.
