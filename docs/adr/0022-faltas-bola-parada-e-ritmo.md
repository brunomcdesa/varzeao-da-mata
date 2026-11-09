# Faltas, bola parada e Ritmo da Partida

Na Temporada 2, a simulação passa a ter faltas e um Ritmo que varia de Partida para Partida. Até aqui, toda Partida tinha exatamente 20 lances de ataque, e a bola parada se resumia ao escanteio (lance de verdade) e ao lateral (só desenho).

Motivo: o dono quer gols de falta e de pênalti, com barreira e jogadas ensaiadas, e placares mais variados, de 0 a 0 até goleadas históricas, sem que o OVR deixe de decidir. Em 20 mil Partidas por confronto, a simulação de hoje dava 0 a 0 em só 1,4% dos jogos entre Times de OVR 70, e o maior placar entre iguais foi 6 × 5.

## Regras

- **Origem da falta:** parte dos desarmes vira falta, quando o zagueiro para o drible ou corta a criação. O lugar da falta decide a cobrança:
  - **dentro da área:** pênalti;
  - **na entrada da área:** chute direto, que passa antes pela **barreira** (Finalização do cobrador contra a Defesa da barreira) e depois pelo goleiro;
  - **mais longe:** jogada ensaiada, que pode ser um cruzamento para cabeçada (como o escanteio) ou um toque curto que vira jogada.
- **Cobrador:** o melhor do Time em campo para cada cobrança. No chute direto, o de maior Finalização; no cruzamento, o de maior Passe.
- **Pênalti no jogo:** usa o Canto escolhido pelo site até o Corte, o mesmo da disputa do Mata-mata (ADR-0021). Sem escolha, o Canto é sorteado pela semente.
- **Cartão na falta:** às vezes amarelo; vermelho só quando a falta impede um gol claro, como o pênalti cometido pelo último homem (ADR-0019).
- **Ritmo:** o número de lances de ataque varia por Partida, sorteado pela semente, mais ou menos entre 13 e 28. A Postura dos dois Capitães (ADR-0018) puxa o Ritmo um pouco: dois Times Ofensivos deixam o jogo mais aberto; dois Defensivos, mais travado. Cada Duelo continua decidido pelas Habilidades, então o OVR segue pesando em todo lance.
- **Média de gols:** pode subir para cerca de 4 por jogo, com mais variação entre Partidas.
- **Sorteio próprio:** faltas, como os escanteios, usam um sorteio separado do resto do jogo.

## Considered Options

- **Falta sorteada à parte em cada lance:** rejeitada. A falta ficaria sem causa e sem ligação com quem marcou.
- **Toda falta com chute direto:** rejeitada. Toda falta pareceria igual.
- **Barreira só no desenho:** rejeitada. O Narrador só comenta o que aparece na tela, e a barreira precisa fazer diferença no lance.
- **Mais sorte nos Duelos para variar os placares:** rejeitada. Tiraria peso do OVR, ao contrário do que o dono pediu.
- **Manter a média em cerca de 3,75:** rejeitada. Na vida real há jogos sem gol e goleadas, e a Liga deve ter os dois.
- **Cobrador escolhido pelo Capitão, ou sorteado:** rejeitadas. A Habilidade deve decidir.

## Consequences

- Entra na `VERSAO_SIM` 4, com a Postura (ADR-0018), os cartões (ADR-0019), a Especialização e o Pênalti com canto (ADR-0021). Partidas já jogadas não mudam.
- O renderer ganha a coreografia de falta, barreira e jogada ensaiada, com prévia antes de ir para o master. O Ao Vivo continua com 90 minutos de jogo: com mais lances, eles ficam mais próximos uns dos outros.
- O Roteiro do Reels já tira chutes para fora e defesas quando passa de 75 s (ADR-0006). Com mais gols, o corte fica mais frequente.
- A calibração (`pnpm calibrar`) passa a medir também a distribuição dos placares (0 a 0, goleadas) e a parte dos gols que vem de bola parada.
