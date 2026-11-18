# 0081 — Tabela dos Grupos já na Pré-temporada

- Status: proposto
- Data: 2026-11-17

## Contexto

Na Pré-temporada da T2 o site já lista os 16 Times e os Grupos (ADR-0068), mas a Tabela (no Início e na página Tabela, no site e no App) seguia só com os 8 Times da T1. Os `grupos` do liga.json só eram gerados para a Temporada atual do site, que até o Apito Inicial da T2 ainda é a 1.

## Decisão

- Na Pré-temporada, o liga.json já traz os `grupos` da Temporada que aceita Inscrição, zerados, com `gruposDaTemporada` dizendo de qual Temporada são. `temporada` e `tabela` seguem sendo da que acabou.
- A página Tabela mostra "Tabela da Temporada 2" com o Grupo do Barro e o Grupo do Galho (zona de classificação e de queda marcadas, sem a coluna Forma). A tabela da T1 não aparece mais ali (fica na História).
- O Início mostra a tabela dos dois Grupos com o título "Tabela da Temporada 2".
- Quando a T2 começa, tudo volta ao normal: os Grupos passam a ser da Temporada atual.
- Junto: o placar que chega pelo relógio de quem está vendo (fim do Ao Vivo antes da publicação) também reordena as tabelas dos Grupos, e não só a tabela geral.

## Consequências

Com tudo zerado, a ordem dentro de cada Grupo é a do desempate final (sigla), até o primeiro jogo.
