# 0105 — Ações principais protegem o OVR

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-23
- Muda o ADR-0010 (evolução, só na T2) e convive com o ADR-0055 (pontos por ação da T2) e o ADR-0056 (Ganho maior)

## Contexto

O dono viu um Jogador fazer 2 ou 3 gols e perder OVR. Na evolução do ADR-0010, cada ação soma pontos numa Habilidade só, e o OVR é a média das Habilidades com os pesos da Posição. O resultado do jogo não entra na conta, e o "jogo bom" como um todo também não. Em 20 mil Partidas simuladas com as regras da T2 (Formações, Posturas e Clássicos variados):

- **Zagueiro:** o gol vai para Finalização, que pesa 5% no OVR dele. Cada gol sofrido tira Defesa, que pesa 75%. 27,5% dos zagueiros que fazem gol perdem OVR (36% no Clássico).
- **Meia:** Finalização pesa 15%. Ele faz gol, mas perde posses, e o Passe (45%) puxa o OVR para baixo. 3,7% dos que marcam caem.
- **Atacante:** cada chute errado tira −0,4 e o gol dá +0,75, então dois erros anulam um gol. 3,6% dos que marcam caem.
- **Goleiro:** 3,7% dos que fazem 4 defesas ou mais caem pelos gols sofridos.
- O Clássico dobra tudo, inclusive as perdas.

Mudar só o valor dos pontos não resolve: dar mais peso ao gol infla o OVR do atacante, e nada muda o zagueiro, porque a Finalização pesa pouco no OVR dele. O dono quer que a evolução pese muito mais que a queda ("uma melhoria perdura").

## Decisão

Com as regras da T2 (e da T3):

- Cada ação principal da Posição em que o Jogador jogou (a vaga, como no OVR da Partida) rende **pontos de Proteção** (`PROTECAO`):
  - ATA e MEI: gol 1,5, assistência 1
  - ZAG: gol 1,5, assistência 1, desarme 0,3, bloqueio 0,3
  - GOL: defesa 0,3, pênalti pego 1, jogo sem sofrer gol 0,5
  - Desarme e defesa começaram em 0,15. O dono escolheu 0,3 porque zagueiro e goleiro perdem pelo gol sofrido, que é do Time todo, e com 0,15 ainda ficavam atrás de atacante e meia.
- No fim da Partida, a Proteção cancela pontos negativos de Habilidade, primeiro na Habilidade que mais pesa no OVR da Posição e depois nas outras (`protegerPerdas`). Ela **nunca vira ganho** e não mexe no que já era positivo. Depois vêm o Clássico, o Treino, o Ganho maior e o limite por Partida, como antes.
- **Sem compensação:** quem não fez ação principal cai igual a hoje. A Liga sobe um pouco mais rápido (cerca de +0,6 de OVR por Temporada na média), e isso foi escolha do dono.
- Vale também na T3, que usa as regras da T2 por baixo. Simulação na **VERSAO_SIM 20** (T2) e **VERSAO_SIM_T3 21** (a 19 já era da T3). A T1 continua na VERSAO_SIM_T1 12. Nenhuma Partida já jogada muda. Placar, lances e Nota não mudam: muda só a evolução.

## Medições

12 mil Partidas com as regras da T2 (Formações, Posturas e Clássicos variados, OVR de 58 a 75). Entre parênteses, a variação média de OVR por jogo.

| Posição e ação | Caiu de OVR antes | Depois |
|---|---|---|
| ATA com gol | 3,6% (+0,56) | 0,1% (+0,63) |
| ATA com 2+ gols | 0,6% | 0% |
| ATA com assistência | 7,2% | 0,7% |
| ATA sem gol nem assistência | 29,3% (−0,31) | igual |
| MEI com gol | 3,7% (+0,35) | 0% (+0,50) |
| MEI com assistência | 1,4% | 0,1% |
| MEI sem gol nem assistência | 22,9% (−0,23) | igual |
| ZAG com gol | 27,5% (+0,21) | 1,2% (+0,53) |
| ZAG com assistência | 23,3% | 2,5% |
| ZAG com 3+ desarmes | 6,3% | 0,7% |
| ZAG com 1–2 desarmes | 29,5% (−0,11) | 14,5% (+0,07) |
| ZAG sem desarme, gol ou assistência | 62,7% (−0,76) | 58,7% (−0,71) |
| GOL sem sofrer gol | 0% | 0% |
| GOL com 4+ defesas | 3,7% | 0,1% |
| GOL com 2–3 defesas | 19,6% (+0,22) | 3,0% (+0,40) |
| GOL que sofreu 3+ gols | 68,6% (−0,79) | 36,9% (−0,39) |

Média de OVR por jogo: ATA +0,20→+0,25, MEI +0,16→+0,23, ZAG +0,17→+0,30, GOL +0,23→+0,35.

## Consequências

- O Reels/explicação do OVR ganha uma frase: "fez gol, assistência ou foi a muralha do jogo? Não cai".
- Decidido pelo dono (23/11/2026): na T3 a queda de OVR sai de vez (ADR-0120). A Proteção vale já na T2.
