# Habilidades: o OVR passa a ser derivado das ações

Cada Jogador tem cinco Habilidades de 1 a 99 (Finalização, Passe, Drible, Defesa, Goleiro) e o OVR vira a média delas com pesos da Posição, como no EA FC. Os Duelos usam as Habilidades, e cada uma muda com as ações do próprio Jogador na Partida. A Nota da Partida continua existindo, mas só para o Craque: deixa de mover o OVR. Substitui a parte do ADR-0004 em que a Nota movia o OVR; os Duelos com uma dose moderada de sorte continuam.

Motivo: dar identidade aos Jogadores ("o zagueiro que faz gol", "o atacante driblador") e fazer o OVR refletir o que a pessoa fez em campo, não só o resultado do Time.

## A jogada

1. Posse: Passe do meia com a bola × Defesa do meia rival.
2. Criação: Passe do meia × Defesa de um zagueiro (perder = desarme).
3. Atacante × o outro zagueiro (novo): o atacante tenta Drible ou chute conforme a melhor Habilidade (com sorte). Resultados: desarme, Bloqueio (lance novo), Drible (chuta livre, chance maior) ou chute marcado (Finalização × Defesa; se passar, chance menor contra o goleiro).
4. Finalização × Goleiro; depois de vencer o goleiro a bola ainda pode ir pra fora, com chance menor para Finalização alta.

Pênalti: Finalização × Goleiro.

## Evolução

Tabela de ações (ponto de partida, calibrada por simulação): Finalização gol +1,0, chute defendido −0,4, pra fora −0,3, bloqueado −0,3, venceu chute marcado +0,2, pênalti convertido +0,5, perdido −0,6; Passe assistência +0,8, ganhou a posse +0,2, perdeu a posse −0,15, desarmado −0,3; Drible driblou +0,5, desarmado no drible −0,3; Defesa desarme +0,6, roubou a posse +0,3, superado na criação −0,25, driblado −0,3, bloqueio +0,5, gol sofrido (ZAG) −0,2; Goleiro defesa +0,6, pênalti pego +1,0, gol sofrido −0,4, jogo sem sofrer gol +0,5.

Teto de ±2 por Habilidade por Partida (±4 no Clássico, onde as ações valem o dobro). Ganho encolhe perto de 99 e perda encolhe perto de 40. Quem não joga não perde nada. Valores guardados com uma casa decimal; o site mostra inteiros.

### Calibração (VERSAO_SIM 2)

Valores finais, ajustados para que cada Habilidade fique perto de zero por Partida num Jogador de OVR 65 entre times iguais (`pnpm calibrar`): gol +0,7; chute defendido −0,55, pra fora −0,5, bloqueado −0,5; ganhou a posse +0,17; driblou +0,4, desarmado no drible −0,4; desarme +0,42, superado na criação −0,3; defesa do goleiro +0,65. Entrou uma ação nova, "superado na posse" (Defesa −0,28), para o meia que perde a disputa de posse sem a bola: sem ela a Defesa dos meias só subia. O ritmo usa fator de ganho (99 − h)/37 e de perda (h − 40)/22, entre 0,1 e 1, o que puxa de leve para perto de 62–65.

Resultado: 70×70 dá 3,5 gols por jogo; +15 de OVR vence 64,5%; +25 vence 78%. Duas Temporadas simuladas com 110 Jogadores: OVR médio 64,8 → 64,8.

## Consequências

- Sem a expectativa relativa ao OVR do ADR-0004, quem é forte vence mais Duelos e acumula mais ações: a bola de neve volta a ser um risco. O freio é o ritmo decrescente, as perdas por ações malsucedidas e a calibração, cuja meta é manter a média de gols por jogo e o OVR médio da Liga estáveis entre Temporadas.
- Jogador novo: OVR sorteado entre 60 e 70 como antes; as Habilidades seguem o perfil da Posição com pequena variação, de modo que o OVR calculado dê o sorteado. Base: o mesmo perfil com OVR 55, sem evoluir.
- Mudar o motor exige subir VERSAO_SIM (ADR-0002).

## Considered Options

- Quatro Habilidades (sem Drible): rejeitado quando entrou o confronto atacante × zagueiro.
- Seis como no EA FC (Velocidade, Físico): rejeitado porque nenhuma ação do nosso jogo as exercita.
- Só subir (experiência): rejeitado porque inflaria o OVR de todos com o tempo.
- Nota distribuída entre as Habilidades: rejeitado; a pessoa entende melhor "fiz gol, subiu Finalização".
