# T2: o Narrador fala o apelido sempre que der

Status: decidido em 16/11/2026. Vale a partir da Temporada 2. Implementado no branch `narrador-fala-apelido`.

Muda a regra de narração do ADR-0014, que só falava o apelido nos gols e no Craque. O dono quer
que quem assiste ouça o nome dos Jogadores no jogo todo, não só quando sai gol.

## Decisões

- **Toda fala de Jogador:** construção da jogada, defesa, bloqueio, desarme, falta, cartão,
  cobranças e gols. Vale no Reels e no Ao Vivo.
- **Primeira vez com a Posição e o Time:** "Bruninho, atacante da Onça, vai no drible...". Depois,
  na mesma Partida, só "Bruninho". Quando o Time já foi dito na frase, a primeira vez é
  "Bruninho, o meia,". Reels e Ao Vivo contam a primeira vez cada um por si.
- **Sem artigo antes do apelido:** "de Bruninho", "pra Bruninho", "em Bruninho". O jogo não sabe
  o gênero de quem escolheu o apelido.
- **Sem apelido ou com apelido que não dá para falar:** continua pela Posição e pelo Time. O @
  nunca é falado.
- **Falas de enchimento do Ao Vivo** ("o meia da Capivara pede a bola") continuam genéricas: não
  apontam um Jogador da tela.
- **Só na T2:** a T1 continua com o apelido só nos gols. Partidas já narradas não mudam.

## Cota do Gemini

Fala com apelido é única e não vem do cache (ADR-0018). Um Ao Vivo tem cerca de 117 falas, e
cerca de 40 citam um Jogador. Antes, o Ao Vivo pedia de 20 em 20 falas na ordem do jogo, e um
apelido em cada trecho faria quase todo trecho virar pedido (cerca de 6 por Partida). Agora só as
falas que faltam no cache vão, juntas, em pedidos de até 20: cerca de 2 a 3 pedidos por Ao Vivo,
mais 1 do Reels.

## Considered Options

- **Só em quem finaliza e defende:** rejeitada. Gasta menos cota, mas o apelido apareceria pouco.
- **Só no Reels:** rejeitada. O Ao Vivo é onde o Jogador mais assiste.
- **Sempre só o apelido / sempre apelido + Time:** rejeitadas. A primeira forma não diz o Time; a
  segunda fica repetitiva.
