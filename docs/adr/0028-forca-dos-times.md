# Força dos Times (OVR do Time)

O site mostra a força de cada Time como no EA FC: um OVR geral e mais três números, para Ataque (atacantes), Meio (meias) e Defesa (zagueiros e goleiro). Cada número é a média de OVR do setor. Uma vaga sem inscrito conta como o Jogador da Base (OVR 55).

- **Times e Página do Time:** a força é a da escalação provável do próximo jogo, montada pela regra do rodízio: em cada posição entra quem jogou menos na Temporada, e no empate, quem se inscreveu antes. É uma aproximação, porque o Craque da Rodada e a Presença confirmada (T2) também furam a fila. Por isso o número muda de um jogo para o outro, conforme o rodízio.
- **Partida:** "Força em campo" compara as duas escalações de verdade, com o OVR de antes do jogo.

O cálculo fica em `shared/src/forca.ts` e o site faz a conta sozinho, com os dados que já recebe.
