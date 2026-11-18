# 0082 — O site vira para a próxima Temporada já na Pré-temporada

- Status: aceito
- Data: 2026-11-17

## Contexto

O site escolhia como Temporada "atual" a última cujo dia de início já passou. Com a T2 criada e aberta para Inscrição (ADR-0068), mas só estreando na quinta, Jogos, Rodada, Temporada, Times e Jogadores seguiam como T1 até o dia da estreia. A Tabela já tinha ganhado os Grupos zerados (ADR-0081).

## Decisão

- A Temporada atual do site é a que aceita Inscrição (a em andamento ou, entre o fim de uma e o início da outra, a nova em Pré-temporada). Sem ela, vale a regra antiga.
- Na Pré-temporada o liga.json mantém `proximaTemporada` com o dia da estreia, para o aviso no Início, em Jogos e na Tabela. Quando o Apito Inicial passa, o aviso some sem mais nada a fazer.
- A Temporada que acabou segue inteira na História (campeão, Final, Craque, artilharia, tabela) e nas Carreiras.
- A História mostra a Temporada nova como "Pré-temporada, começa em…" e não mostra líder enquanto a tabela está zerada.
- O chaveamento com Grupos (ADR-0064) projeta o cruzamento certo (1º do Barro × 2º do Galho, 1º do Galho × 2º do Barro) e, antes do primeiro jogo, só as posições, sem Time (a ordem zerada é só a sigla).

## Consequências

- O card do campeão e do Craque da T1 sai do Início (continua na História).
- Selo da Temporada 1 e Fundador (ADR-0036, ADR-0047), que só aparecem no site da T2, passam a aparecer já na Pré-temporada.
