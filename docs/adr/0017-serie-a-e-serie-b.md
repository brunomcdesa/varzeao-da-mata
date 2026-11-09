# Série A e Série B, com Acesso e Rebaixamento

A partir da Temporada 2, a Liga passa a ter 16 Times divididos em duas séries de 8. Os 8 Times da Temporada 1 formam a Série A. Oito Times novos formam a Série B, em 4 Clássicos: Jacaré × Sucuri, Lobo-guará × Cachorro-do-mato, Boto × Pirarucu e Gavião × Urubu.

Cada série tem a sua Fase de Liga (7 Rodadas) e o seu Mata-mata. A cada Temporada, os 2 últimos da Fase de Liga da Série A descem, e os 2 finalistas do Mata-mata da Série B sobem.

Motivo: a ideia veio de um seguidor. As séries dão peso aos jogos do meio e do fim da tabela, porque fugir do Rebaixamento vira objetivo, e abrem espaço para mais Jogadores. Na primeira Temporada com séries, os Times atuais ficam na A para que ninguém que já joga caia de série sem ter jogado.

## Regras

- **Horários:** as Partidas da A e da B acontecem nos mesmos horários (12h, 14h, 16h e 18h). Cada Rodada passa a ter 8 Partidas, duas por horário.
- **Reels:** cada Partida, das duas séries, ganha o seu Reels. O Resumo da Rodada continua um só, às 19h, com as duas tabelas.
- **Craque:** o Craque da Rodada e o Craque da Temporada são escolhidos por série, com 5 Candidatos em cada uma. O voto leva a letra da série ("A3", "B3").
- **Acesso pela final da B:** quem sobe são os dois finalistas do Mata-mata da B, e não os dois primeiros da Fase de Liga. A escolha troca justiça por emoção, porque a semifinal da B passa a valer o Acesso.
- **Carreira:** o Jogador pertence ao Time. Quando o Time sobe ou desce, ele vai junto (ADR-0001).
- **Inscrição:** continua livre entre os 16 Times, com a mesma regra de equilíbrio.

## Considered Options

- **Adiar até haver Jogadores suficientes:** rejeitada. Com 16 Times, os Elencos ficam menores e mais vagas viram Jogador da Base.
- **8 Times em duas séries de 4:** rejeitada. Daria só 3 Rodadas por série.
- **Série B só no site e no Resumo:** rejeitada. A B ficaria sem visibilidade, e a cota do Gemini é tratada pelo cache de falas (ADR-0018).
- **Formação inicial pela classificação da T1, ou por sorteio:** rejeitadas. Rebaixariam Jogadores da T1 sem que tivessem jogado a T2.

## Consequences

- `TIMES` passa a ter 16 identidades, cada uma com escudo, cores, fala do Narrador e Clássico. O mais provável é a série virar um dado da Temporada, e não do Time.
- A Rodada dobra: são 8 simulações, 8 renderizações e 8 Reels por dia. O tempo do Actions e a cota do Gemini precisam caber nisso.
- Duas Partidas Ao Vivo ao mesmo tempo pedem que o site deixe escolher qual assistir.
- O Resumo precisa caber com duas tabelas e 10 Candidatos.
