# Limite por Posição

Cada Time aceita até o dobro das vagas da Escalação em cada Posição: 2 goleiros, 4 zagueiros, 4 meias e 4 atacantes (`LIMITE_POR_POSICAO`). A regra vale para novas Inscrições e Transferências, já na Temporada 1. Quem já passou do limite fica onde está.

Motivo: a Inscrição só limitava o tamanho do Elenco (ADR-0012), não a Posição. A Capivara juntou 6 atacantes e nenhum zagueiro, e o rodízio deixava atacante no banco enquanto o Jogador da Base jogava na zaga.

## Regras

- **Posição cheia no Time pedido:** a pessoa entra no Time com menos gente na Posição pedida (no empate, o Elenco menor), respeitando a folga de Elenco. A Posição nunca muda sozinha. A resposta explica que o Time pedido já tinha gente demais na Posição.
- **Cheia em todos os Times:** o pedido fica como `POSICAO_CHEIA` e é relido a cada coleta, como o Time cheio e o Time estreante. A pessoa recebe um aviso só na primeira leitura, com as Posições que ainda têm vaga. Quando abre vaga (por exemplo, com a Série B na T2), ela entra sozinha e recebe a confirmação de sempre.
- **Transferência:** o destino precisa ter vaga na Posição. Isso vale também para trocar de Posição no próprio Time. Se não houver vaga, a resposta lista os Times com vaga nessa Posição, e a Transferência não é gasta.
- **Inscrição manual do dono** (workflow inscrever-jogador, ADR-0029): passa por cima do limite.
- Não muda a simulação nem as Partidas já jogadas.

## Considered Options

- **4 em todas as Posições:** rejeitada. Daria 4 goleiros para 1 vaga.
- **Mesmo Time, outra Posição:** rejeitada. Mudar a Posição de quem pediu atacante gera frustração.
- **Recusar e descartar o pedido:** rejeitada. A pessoa teria que comentar de novo.
- **Entrar mesmo assim quando tudo estiver cheio:** rejeitada. A trava deixaria de existir justo quando importa.
- **Só a partir da T2:** rejeitada. Até lá, os Times desequilibrados continuariam recebendo gente na mesma Posição.

## Consequences

- Com 8 Times, a Liga comporta 16 goleiros e 32 jogadores em cada outra Posição. Os atacantes já passam disso, então novos atacantes ficam esperando até a T2, quando os 16 Times dobram as vagas.
- O Rebalanceamento da T2 (ADR-0036) já tira primeiro as Posições que sobram, então ajuda a cumprir o limite.
