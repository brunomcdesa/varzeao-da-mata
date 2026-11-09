# Página de Carreira

A partir da Temporada 2, cada Jogador ganha uma Página de Carreira no site (`#/carreira/<id>`). Ela mostra uma Temporada por bloco, da mais recente para a mais antiga. Cada bloco traz:

- o Time (e a Série) pelo qual ele jogou, com uma seta quando houve Transferência no meio da Temporada;
- jogos, V-E-D, gols, assistências e Nota média;
- o OVR do começo e do fim da Temporada;
- os cartões (só existem na T2, ADR-0021);
- os troféus da Temporada.

O cabeçalho mostra a Especialização e o Treino atuais (ADR-0023).

Motivo: com Carreiras persistentes (ADR-0001), a segunda Temporada é o primeiro momento em que dá para comparar uma Temporada com outra. A página do Jogador continua sendo o retrato de agora, e a Carreira vira a linha do tempo.

## Regras

- **Só na T2 em diante:** na Temporada 1 a rota responde "Página não encontrada" e a página do Jogador não mostra o link. O site da T1 não mostra nada da T2.
- **Dados:** a página é montada no navegador a partir de `jogadores.json`. O histórico de cada jogo passa a levar o Time, as assistências, a Série (quando a Temporada tem Séries) e, só nas Partidas da T2, os amarelos e a expulsão. A Especialização e o Treino só são exportados quando a Temporada atual tem as regras da T2. O Canto do pênalti nunca vai para o site público.
- **OVR do começo:** é o OVR depois do último jogo da Temporada anterior, ou o OVR inicial na primeira Temporada do Jogador.

## Considered Options

- **Uma seção a mais na página do Jogador:** rejeitado. A página já é longa no celular, e o "Números" dela já alterna entre Temporada e Carreira.
- **Gerar um JSON por Jogador no worker:** rejeitado por enquanto. O histórico já vem em `jogadores.json`, e agrupar no navegador é barato.

## Consequences

- `jogadores.json` cresce um pouco por jogo (Time e assistências).
- Transferências feitas antes da T2 aparecem só pelo Time de cada jogo.
