# 0099 — OVR da Escalação no site pelas Habilidades

- Status: proposto (aguarda aprovação do dono)
- Data: 2026-11-23

## Contexto

Pelo bug corrigido na ADR-0098, quem jogava fora de posição ficava com o OVR da vaga gravado até o próximo jogo. Se esse próximo jogo foi escalado nesse meio-tempo, a Escalação guardou o OVR errado (`ovr_antes`). Na Partida 48, por exemplo, o @jvitordcs_ aparece de atacante com 47, mas as Habilidades dele davam 65. A simulação não usa esse número (Duelos, Nota e evolução saem das Habilidades), então o resultado está certo. Só a exibição está errada.

## Decisão

1. No site, o OVR de cada linha da Escalação (titulares e banco) é o das Habilidades gravadas na Escalação, com os pesos da Posição em que ele jogou. Para quem jogou na Posição dele, é o OVR certo. Para quem jogou fora de posição, continua o OVR da vaga (ADR-0044). Sem Habilidades gravadas, fica o número gravado.
2. O card do Jogador durante uma Partida ainda não encerrada usa o OVR da Posição dele, pelas mesmas Habilidades.
3. Nada é regravado no banco: a Escalação, o resultado e a VERSAO_SIM ficam iguais. A força do Time na página da Partida passa a usar o OVR corrigido. Os Reels já publicados não mudam.
