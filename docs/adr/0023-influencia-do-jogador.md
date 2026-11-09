# Influência do Jogador na Partida: Presença, Especialização, Treino e Pênalti com canto

Na Temporada 2, o Jogador passa a influenciar as próprias Partidas de quatro jeitos. Até aqui, ele não decidia nada: entrava pelo rodízio (quem jogou menos joga antes) e a simulação escolhia, pelas Habilidades dele, se driblava ou chutava.

Motivo: dar a quem acompanha a Liga decisões de verdade, sem que a sorte ou o OVR deixem de pesar e sem bagunçar o equilíbrio entre os Times.

## Regras

- **Presença:** o Jogador confirma pelo site, ou comentando CONFIRMO, até o Corte do próximo jogo do Time. Quem confirmou passa na frente no rodízio da Escalação, logo depois do Craque da Rodada anterior. Quem não confirmou continua no rodízio, depois dos confirmados. A confirmação vale só para aquele jogo.
- **Especialização:** 3 por Posição, escolhida pelo site com o Vínculo. Pode ser trocada uma vez por Rodada, e vale no máximo uma Especialização por jogo. Sem escolha, o Jogador joga como hoje. Cada Especialização dá um bônus num Duelo e um custo pequeno em outro, para o OVR continuar valendo:
  - ATA: **Artilheiro** (chuta mais e finaliza melhor, dribla pior), **Driblador** (dribla mais e melhor, chuta marcado pior), **Oportunista** (finaliza mais vezes, com menos precisão).
  - MEI: **Armador** (cria melhor, defende pior na posse), **Volante** (rouba mais a posse, cria pior), **Meia-atacante** (finaliza mais vezes, cria pior).
  - ZAG: **Xerife** (segura o drible, bloqueia pior), **Bloqueador** (trava o chute, segura pior o drible), **Antecipação** (corta melhor a criação, marca pior o finalizador).
  - GOL: **Paredão** (melhor no chute apertado, pior no livre), **Gato** (melhor no chute livre, pior no apertado), **Pegador de pênalti** (melhor nos pênaltis, um pouco pior no jogo).
- **Treino:** o Jogador escolhe pelo site uma Habilidade de foco. Os ganhos dela sobem 50% mais rápido, sem tirar das outras e sem passar do limite de 2 pontos por Partida (4 no Clássico).
- **Pênalti com canto:** no Mata-mata, batedores e goleiros escolhem o canto pelo site até o Corte. Acertar o canto ajuda o goleiro; errar ajuda o batedor. Quem não escolhe tem o canto sorteado pela semente da Partida, e o Replay mostra os cantos.

## Considered Options

- **Só joga quem confirmou:** rejeitada. Vagas virariam Jogador da Base com facilidade.
- **Estilo genérico (Finalizador, Driblador, Garçom) só para ATA e MEI:** trocado pela Especialização em todas as Posições, a pedido do dono.
- **Treino como +1 fixo por Partida:** rejeitada. Inflaria o OVR de quem joga muito.
- **Treino e Especialização por comentário:** rejeitada. Ficam só no site, como o apelido e a Transferência, para não encher os comentários de Comandos novos. A Presença é a exceção, porque precisa ser fácil todo dia.
- **Sem canto, vale a regra de hoje:** rejeitada. A escolha viraria vantagem só de quem usa o site.

## Consequences

- Especialização e Pênalti com canto mudam a simulação e entram na `VERSAO_SIM` 6, junto com a Postura do Capitão (ADR-0020) e os cartões (ADR-0021). Treino muda só a evolução das Habilidades. Presença muda só a Escalação.
- Os valores dos bônus e custos saem da calibração, mantendo a média de cerca de 3,75 gols por jogo.
- A Escalação passa a guardar a Especialização e o canto de cada lugar, para o Replay mostrar a mesma Partida.
- "CONFIRMO" é um Comando novo e precisa de frases e testes em `worker/src/comandos.ts`.
