# Ritmo da Partida

A partir da `VERSAO_SIM` 5, o número de lances de ataque de cada Partida deixa de ser fixo em 20 e passa a variar entre 6 e 34, numa curva em sino com média perto de 20, sorteada pela semente da Partida. Jogo travado tem poucos lances e pode sair 0 a 0; jogo aberto tem muitos e pode virar goleada. Cada Duelo continua decidido pelas Habilidades, então o OVR pesa em todo lance.

Motivo: o dono queria placares mais realistas, de 0 a 0 a goleadas históricas, já na Temporada 1, sem que as Habilidades deixassem de decidir. Com 20 lances fixos, entre Times de OVR 70, só 1,4% dos jogos saíam 0 a 0 e 7% tinham 7 gols ou mais.

## Medições (12 mil Partidas por linha, Times de OVR 70; força com 80 × 65)

| Lances por Partida | média de gols | 0 a 0 | até 1 gol | 7+ gols | forte vence | goleada por 5+ |
|---|---|---|---|---|---|---|
| sempre 20 (versão 4) | 3,9 | 1,4% | 7% | 7% | 66% | 5% |
| 6 a 34 (escolhida) | 4,0 | 2,3% | 10,7% | 12,4% | 65% | 6% |

## Regras

- **Sorteio próprio:** o Ritmo tem um sorteio separado, como as bolas paradas e o contra-ataque. Os primeiros lances de uma Partida saem iguais aos da versão 4.
- **Minutos:** os lances continuam espalhados pelos 90 minutos. Com poucos lances, ficam mais espaçados; com muitos, mais juntos.
- **Nota da Partida:** a expectativa de cada Jogador (ADR-0004) é multiplicada pelo Ritmo (lances da Partida dividido por 20). As mesmas ações valem mais num jogo travado, e a Nota média fica igual em jogo travado ou aberto.

## Considered Options

- **10 a 30 lances:** varia pouco (0 a 0 em 1,6%).
- **4 a 36 lances:** mais extremos (0 a 0 em 2,8%), mas um jogo de 4 lances deixa o Ao Vivo de 90 minutos quase sem ataque.
- **Mais sorte nos Duelos:** rejeitada. Tiraria peso do OVR.
- **Converter menos gols por lance nos jogos travados:** rejeitada. Também é sorte, não Habilidade. É o que impede o 0 a 0 de ficar mais comum: cada lance de ataque vira gol em cerca de 20% das vezes.

## Consequences

- O Reels de um jogo travado fica curto (um 0 a 0 de 6 lances deu 12 s), e o de uma goleada passa dos 75 s, porque o Roteiro nunca corta gol (ADR-0006): um 5 a 6 deu 95 s. A API aceita os dois.
- A narração do Ao Vivo acompanha o número de lances, então jogos abertos fazem mais pedidos ao Gemini.
- Na Temporada 2, a Postura dos Capitães também puxa o Ritmo (ADR da Postura).
- `scripts/placares.ts`, no pacote `sim`, mede a distribuição dos placares e a Nota média por Ritmo.
