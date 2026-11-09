# Capitão e Postura

Cada Time tem um Capitão: o Jogador com mais Partidas por aquele Time. Antes de cada Partida, ele escolhe a Postura do Time (Ofensiva, Equilibrada ou Defensiva) pelo site, usando o Vínculo, até o Corte. Se ele não escolher, a Postura é Equilibrada. A Postura muda um pouco os Duelos daquela Partida.

Motivo: dá aos Jogadores uma decisão de verdade antes do jogo, sem precisar de uma votação. A regra das Partidas premia quem está há mais tempo no Time.

## Regras

- **Quem é:** o Jogador com mais Partidas pelo Time. Se o Capitão não tem Vínculo ou está suspenso, a faixa passa para o próximo da lista que tenha Vínculo. Se ninguém tiver Vínculo, a Postura fica Equilibrada.
- **Por que pelo site:** a escolha é privada. Um Comando nos comentários entregaria a tática ao rival antes do jogo.
- **Simulação:** a Postura entra na simulação e sobe a `VERSAO_SIM` para 6, junto com a Especialização e o Pênalti com canto (ADR-0023), as faltas (ADR-0024) e os cartões (ADR-0021). A Postura dos dois Times também puxa um pouco o Ritmo da Partida (ADR-0016): dois Times Ofensivos deixam o jogo mais aberto, dois Defensivos o deixam mais travado. Só vale para Partidas escaladas depois da subida.

## Considered Options

- **Votação do Elenco:** rejeitada por enquanto. Pediria um Comando novo e uma votação a mais.
- **Maior OVR:** rejeitada. O Capitão mudaria toda vez que as Habilidades mudassem.
- **Capitão só simbólico:** rejeitado. Sem decisão, não engaja.
- **Capitão também escolhe quem bate os pênaltis:** rejeitado. Fica para depois.
