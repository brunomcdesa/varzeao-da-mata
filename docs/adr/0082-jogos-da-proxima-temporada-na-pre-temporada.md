# 0082 — Jogos da próxima Temporada já na Pré-temporada

- Status: proposto
- Data: 2026-11-17

## Contexto

Com a T2 aberta para Inscrição (ADR-0068, ADR-0081), a página Jogos seguia mostrando o calendário da T1, porque o `calendario` do liga.json é o da Temporada atual do site, que só vira a 2 no dia da estreia.

## Decisão

- O liga.json traz `calendarioDaProxima` (Temporada e Partidas já marcadas) enquanto a Temporada que aceita Inscrição não é a atual. `calendario` não muda.
- A página Jogos usa esse calendário: "Jogos da Temporada 2", aviso com o dia da estreia, Rodadas e o Mata-mata projetado.
- Mata-mata com Grupos (ADR-0064): as Semifinais cruzam os Grupos (1º do Barro × 2º do Galho, 1º do Galho × 2º do Barro). Antes do primeiro jogo mostra só as posições ("1º do Barro"), sem Time, porque com tudo zerado a ordem é só a sigla. Depois do primeiro jogo vira "se a Fase de Liga acabasse hoje", como já era.
- Corrige junto o chaveamento da T2, que projetava 1º × 4º e 2º × 3º em vez do cruzamento dos Grupos.

## Consequências

Quando a T2 começa, o `calendario` e o `calendarioDaProxima` deixam de coexistir e a página volta ao fluxo normal.
