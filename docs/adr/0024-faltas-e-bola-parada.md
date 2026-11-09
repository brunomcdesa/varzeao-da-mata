# Faltas e bola parada

Na Temporada 2, a simulação passa a ter faltas. Até aqui, a bola parada se resumia ao escanteio (lance de verdade) e ao lateral (só desenho). A variação no número de lances por Partida (Ritmo) já entrou na Temporada 1, pelo ADR-0016.

Motivo: o dono quer gols de falta e de pênalti, com barreira e jogadas ensaiadas, sem que o OVR deixe de decidir.

## Regras

- **Origem da falta:** parte dos desarmes vira falta, quando o zagueiro para o drible ou corta a criação. O lugar da falta decide a cobrança:
  - **dentro da área:** pênalti;
  - **na entrada da área:** chute direto, que passa antes pela **barreira** (Finalização do cobrador contra a Defesa da barreira) e depois pelo goleiro;
  - **mais longe:** jogada ensaiada, que pode ser um cruzamento para cabeçada (como o escanteio) ou um toque curto que vira jogada.
- **Cobrador:** o melhor do Time em campo para cada cobrança. No chute direto, o de maior Finalização; no cruzamento, o de maior Passe.
- **Pênalti no jogo:** usa o Canto escolhido pelo site até o Corte, o mesmo da disputa do Mata-mata (ADR-0023). Sem escolha, o Canto é sorteado pela semente.
- **Cartão na falta:** às vezes amarelo; vermelho só quando a falta impede um gol claro, como o pênalti cometido pelo último homem (ADR-0021).
- **Média de gols:** já está em cerca de 4 com o Ritmo (ADR-0016). As faltas podem somar um pouco mais; a calibração confere que o Time mais forte continua vencendo na mesma proporção.
- **Sorteio próprio:** faltas, como os escanteios, usam um sorteio separado do resto do jogo.

## Considered Options

- **Falta sorteada à parte em cada lance:** rejeitada. A falta ficaria sem causa e sem ligação com quem marcou.
- **Toda falta com chute direto:** rejeitada. Toda falta pareceria igual.
- **Barreira só no desenho:** rejeitada. O Narrador só comenta o que aparece na tela, e a barreira precisa fazer diferença no lance.
- **Cobrador escolhido pelo Capitão, ou sorteado:** rejeitadas. A Habilidade deve decidir.

## Consequences

- Entra na `VERSAO_SIM` 6, com a Postura (ADR-0020), os cartões (ADR-0021), a Especialização e o Pênalti com canto (ADR-0023). Partidas já jogadas não mudam.
- O renderer ganha a coreografia de falta, barreira e jogada ensaiada, com prévia antes de ir para o master. 
- O Roteiro do Reels já tira chutes para fora e defesas quando passa de 75 s (ADR-0006). Com mais gols, o corte fica mais frequente.
- A calibração (`pnpm calibrar` e `scripts/placares.ts`) passa a medir também a parte dos gols que vem de bola parada.
