# Página da Temporada

O site ganha a Página da Temporada (`#/temporada`, item "Temporada" no menu, logo depois de "Rodada"). Ela é o panorama da Temporada atual, enquanto a página da Rodada é o retrato do dia. Mostra:

- o placar da Temporada: jogos disputados, gols, média de gols por jogo e Rodadas completas;
- o líder de cada Série (o campeão, depois da Final), com pontos, V–E–D, gols, aproveitamento e forma;
- os últimos jogos encerrados (6 sem Séries, 4 de cada Série com Séries);
- Artilharia e Assistências (top 5) e Goleiros (top 3);
- Números dos Times: melhor ataque, melhor defesa, maior goleada e os Craques das Rodadas.

Repetir parte da página da Rodada (tabela, jogos recentes) é aceito: cada página precisa fazer sentido sozinha.

## Regras

- **Vale desde a Temporada 1.** A página só lê a Temporada atual de `liga.json` e o `nestaTemporada` de `jogadores.json`. O worker escolhe como atual a última Temporada que já começou, então uma Temporada criada e ainda não começada (a T2 antes da estreia) não aparece aqui; só o aviso de `proximaTemporada` na página da Rodada fala dela.
- **Nada antes da hora:** só entram Partidas encerradas pelo relógio de quem vê; um jogo Ao Vivo entra quando o Ao Vivo acaba.
- **Artilharia e Assistências:** mais gols (ou assistências); desempate por menos jogos, depois por quem se inscreveu antes. É o mesmo critério do artilheiro da História.
- **Goleiros:** Jogadores que hoje são goleiros, com pelo menos 3 jogos na Temporada; maior nota média, desempate por menos gols sofridos por jogo. É a regra do melhor goleiro da História.
- **Com Séries:** os rankings de Jogadores são da Liga inteira, com a Série ao lado do nome; líder, últimos jogos e Números dos Times são de cada Série.

## Considered Options

- **O worker publicar os rankings prontos:** rejeitado por enquanto. Os números já estão em `jogadores.json`, e calcular no navegador não exige deploy do worker.
- **Um ranking por Série:** rejeitado por enquanto; dobra o tamanho da página no celular.

## Consequences

- Um Jogador que trocou de Posição no meio da Temporada (ADR-0030) entra ou sai do ranking de Goleiros pela Posição de hoje, com a nota média de todos os jogos dele na Temporada. Nesse caso raro, o ranking pode diferir do melhor goleiro da História, que conta só os jogos no gol.
- No celular, o menu tem 7 itens e rola para o lado.
