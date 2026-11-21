# Janela pela hora do pedido

A troca de Time na Janela de Transferências (ADR-0022) é decidida pela hora em que o Jogador pediu, e não pela hora em que a coleta processou o pedido. A Janela vai até o Corte do primeiro jogo da Temporada. Antes de existir jogo marcado, vale o status da Temporada (Pré-temporada).

O site só mostra a Transferência como "já usada" quando o Jogador gastou a Transferência da Temporada. A troca da Janela não conta, e a resposta da troca da Janela avisa que durante a Temporada ainda vale uma Transferência.

Motivo: Jogadores que trocaram na Pré-temporada da T2 apareciam no site como se já tivessem usado a Transferência da Temporada, e o formulário sumia. Além disso, a regra antiga olhava o status da Temporada na hora do processamento, então um pedido feito na Pré-temporada e lido depois da virada gastava a Transferência da Temporada.

## Considered Options

- **Status da Temporada na hora do processamento (como era):** rejeitada. Depende de quando a coleta roda, e o status só vira depois do primeiro resultado, deixando a Janela aberta durante a primeira Rodada.

## Consequences

- A migração 025 corrige os registros já gravados: troca feita antes do Corte do primeiro jogo da T2 passa a ser da Janela, a não ser que o Jogador já tenha outra troca da Janela na mesma Temporada.
- Quem trocou na Pré-temporada da T2 pode pedir a Transferência da Temporada normalmente, pelo comentário ou pelo site.
