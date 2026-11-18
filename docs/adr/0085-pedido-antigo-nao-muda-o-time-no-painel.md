# 0085 — Pedido antigo de Transferência não muda o Time no painel

- Status: aceito
- Data: 2026-11-18

## Contexto

Um Jogador remanejado para a Sucuri no Rebalanceamento da T2 via a Sucuri na página dele, mas, ao vincular o navegador, o painel dizia que ele era Capitão do Tatu.

O painel "Seu personagem" (ADR-0013) lê o último pedido de Transferência na borda (`pedido-site/<jogadorId>`, guardado por 7 dias). Quando o pedido estava como TRANSFERIDO e o jogadores.json ainda não marcava a Transferência como usada, o site aplicava o Time do pedido localmente, para mostrar a mudança antes da republicação (1 ou 2 minutos). Com a T2, `transferenciaUsada` voltou a ser falso para todos, e o pedido de Transferência para o Tatu feito na T1 voltou a valer: a cada visita o site trocava o Time de volta para o Tatu neste navegador, e o painel também dizia "já usada nesta temporada".

## Decisão

- Pedido pendente vale sempre.
- Pedido já processado só vale no painel por 15 minutos (a mesma validade do ajuste local). Depois disso, Time, Posição e Transferência usada vêm do jogadores.json.
- A borda e o banco não mudam: o Jogador estava certo na Sucuri o tempo todo, e o Capitão também era calculado pelo Time certo.

## Consequências

- Um Jogador que pediu a Transferência na Temporada anterior volta a ver a Transferência da Temporada nova disponível.
- A mensagem do resultado do pedido some do painel 15 minutos depois de processado.
- Não muda a simulação.
