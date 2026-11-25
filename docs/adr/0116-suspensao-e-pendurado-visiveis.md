# ADR-0116: Suspensão e Pendurado visíveis no site e na transmissão

**Status:** aceito (25/11/2026)

## Contexto

A Suspensão (ADR-0021) já tirava o Jogador da Escalação, mas não aparecia em lugar nenhum. No
Boto × Sagui, o Thiago (único zagueiro do Boto) cumpria Suspensão pelo 2º amarelo: sumiu do campo
e do Banco, dois atacantes jogaram de zagueiro e pareceu erro da Escalação.

## Decisão

- **Regra num lugar só:** `shared/src/cartoes.ts` (a cada dois amarelos na Temporada, um jogo
  fora; vermelho tira sozinho; amarelo do jogo da expulsão não conta). A Escalação, o site e a
  transmissão usam a mesma conta.
- **Pendurado:** quem tem amarelos ímpares na Temporada. Mais um e fica fora do jogo seguinte.
- **Site:**
  - Elenco do Time: selo vermelho "Suspenso" (fora do próximo jogo) ou "Pendurado" (tracejado).
  - Página do Jogador: aviso com o motivo ("levou o 2º amarelo da Temporada no último jogo").
  - Página da Partida: bloco "Suspensos" abaixo do Banco, com o motivo, e a marca "pendurado"
    em quem entra pendurado.
  - Escalação provável: o suspenso fica de fora, como na Escalação. Sem Formação escolhida, a
    T2 em diante usa o 2-2-2 com fora de posição (como a Escalação), e não mais a Base.
- **Transmissão (Ao Vivo, Replay e Reels):** o cartão que tira do próximo jogo (vermelho, ou
  amarelo de quem chegou pendurado) mostra a placa "Fora do próximo jogo" no cartão gigante, e o
  Narrador fala junto ("Tava pendurado: tá fora do próximo jogo!" ou "E tá fora do próximo
  jogo!"). Na Final não há próximo jogo, então nada muda.
- **Sem estragar o Ao Vivo:** os cartões só contam no site depois que o Ao Vivo da Partida acabou.

## Consequências

- Só a apresentação muda: a simulação e a Escalação seguem iguais (sem VERSAO_SIM nova).
- A narração e o Reels gravados antes não mudam. O cartão gigante do Replay das Partidas antigas
  da T2 passa a mostrar a placa, porque a Escalação pública agora diz quem chegou pendurado.
- O site só atualiza com a publicação dos dados (de hora em hora): o selo aparece depois dela.
