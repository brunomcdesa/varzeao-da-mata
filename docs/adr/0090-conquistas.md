# 0090 — Conquistas

- Status: aceito
- Data: 2026-11-20

## Contexto

O novato da T3 começa com 0 Moedas e precisa de marcos curtos que o ajudem a juntar para o primeiro Item (ADR-0087), e a Carreira ganha mais o que mostrar.

## Decisão

- **Conquista:** marco da Carreira do Jogador, ganho uma vez só, que vira selo na página de Carreira e paga Moedas pela dificuldade:
  - fácil, 5 Moedas (exemplos: primeira Partida, primeiro gol, primeira assistência);
  - média, 10 Moedas (exemplos: hat-trick, 5 gols na Carreira, primeiro Clássico vencido);
  - difícil, 20 Moedas (exemplos: 20 gols na Carreira, 3 Títulos).
- A lista fechada de Conquistas é definida na implementação, com prévia para aprovação.
- **Retroativo:** o que o Jogador já fez na T1 e na T2 dá o selo, mas não paga Moedas (os veteranos já têm o bônus de largada). Moedas só por Conquista feita da T3 em diante, incluindo a Copa.

## Considered Options

- **Tudo 10 Moedas:** rejeitada. A fácil ficaria cara demais e a difícil barata demais.
- **Só selo:** rejeitada. Não ajudaria o novato a chegar no primeiro Item.
- **Retroativo com Moedas:** rejeitada. Os veteranos começariam a T3 com muitas Moedas, contra o bônus de largada.

## Consequências

- O extrato de Moedas ganha o lançamento "Conquista".
- Cada Conquista nova ganha teste.
