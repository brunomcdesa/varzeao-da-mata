# T2 em dois Grupos de 8: Grupo do Chão e Grupo da Copa

Status: decidido em 16/11/2026. Complementa o ADR-0062.

Com os 16 Times em turno único, a T2 duraria 17 dias. A T1 durou 9 (7 Rodadas, Semifinais e
Final), e o ritmo de cerca de uma Temporada por semana mantém o interesse, as Janelas e os
Títulos frequentes.

## Decisões

- **Dois Grupos de 8**, com os Clássicos juntos e cada fundador no Grupo do seu Time Primo:
  - **Grupo do Chão:** Capivara, Onça, Tatu, Tamanduá, Jacaré, Sucuri, Lobo-guará e Cachorro-do-mato.
  - **Grupo da Copa:** Preguiça, Sagui, Tucano, Arara, Coruja, Morcego, Boto e Pirarucu.
- **Turno único dentro de cada Grupo:** 7 Rodadas, 8 jogos por dia (4 de cada Grupo, alternados),
  um por hora das 11h às 18h. Gravado em `serie_do_time.grupo`.
- **Semifinais cruzadas:** 1º do Chão × 2º da Copa e 1º da Copa × 2º do Chão, com mando do 1º.
  Final no dia seguinte, com mando de quem fez mais pontos na Fase de Liga. Rodadas 8 e 9.
- **Caem 4 de cada Grupo** (`CAEM_POR_GRUPO`): os 8 formam a Série B da T3.
- **Briga da última Rodada:** dentro do Grupo, com 2 vagas.
- **T3 em diante:** A e B com 8 Times em turno único (7 Rodadas), como a T1; 2 sobem e 2 descem.
- A T2 dura 9 dias: Rodadas de quinta 19/11 a quarta 25/11, Semifinais na quinta 26/11 e Final na sexta 27/11.

## Considered Options

- **Duas Rodadas por dia (todos contra todos em 10 dias):** rejeitada. Dobra Reels e pedidos de voz.
- **Sistema suíço em 7 Rodadas:** rejeitada. O calendário não fica pronto com antecedência.
- **Clássicos separados entre os Grupos:** rejeitada. Nenhum Clássico aconteceria na Fase de Liga.

## Consequências

- Cada Time enfrenta 7 dos 15 adversários; um Grupo pode ficar mais forte que o outro.
- A tabela no site e no Resumo aparece por Grupo, com os 2 primeiros em verde e os 4 últimos em
  vermelho.
