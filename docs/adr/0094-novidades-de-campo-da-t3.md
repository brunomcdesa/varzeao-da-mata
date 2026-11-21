# 0094 — Novidades de campo da T3

- Status: aceito
- Data: 2026-11-20

## Contexto

Hoje um lance termina em Desarme, Bloqueio, Defesa, Fora, Gol ou Falta. Não existem trave, rebote nem chute de longe de verdade: o "chute de longe" que aparece é só um estilo de desenho sorteado no renderer (20% das finalizações), e na simulação o lance passou pelo Duelo atacante × zagueiro como qualquer outro. O Juiz da T2 é só visual. O placar não muda o comportamento dos Times no fim do jogo.

## Decisão

Tudo entra numa VERSAO_SIM nova, na abertura da T3 (a Copa já usa), calibrada com centenas de Ligas simuladas para manter perto da atual a média de gols e de Goleadas por Partida.

- **Trave:** um chute pode bater na trave e não entrar.
- **Rebote:** uma Defesa do goleiro pode soltar a bola. Um atacante do Time disputa com um zagueiro rival (Finalização × Defesa): se o atacante vence, chuta de novo contra o goleiro; se o zagueiro vence, afasta.
- **Chute de longe:** o meia (ou, bem mais raro, o zagueiro) arrisca de fora da área em vez de criar, sem passar pelo Duelo com o zagueiro: Finalização do chutador × Goleiro. Fica mais provável com Finalização alta e Postura Ofensiva.
  - O estilo de desenho "chute de longe" deixa de ser sorteado nas Partidas da versão nova (o peso vai para os outros estilos): só o chute de longe real é desenhado de longe e narrado assim.
  - Partidas de versões anteriores guardam o desenho e as falas de antes. Partidas já jogadas nunca mudam.
  - A falta de longe (jogada ensaiada com toque curto, T2) continua igual.
- **Pressão final:** nos últimos 15 minutos, o Time que perde por 1 ou 2 gols se lança: mais lances de ataque dele e mais Contra-ataques do rival. No Mata-mata e na Copa, quem está empatado também se lança. A Postura Defensiva segura um pouco.
- **Acréscimos:** de 1 a 4 minutos no fim do segundo tempo, mostrados na tela e anunciados pelo Narrador.
- **Perfil do Juiz:** Rigoroso, Normal ou Deixa jogar, sorteado pela semente da Partida. Muda a chance de Falta e de Cartão. Aparece na Escalação e o Narrador comenta no Apito Inicial.
- **Gol de placa:** o gol com drible no marcador que ainda vence a Cobertura, ou o chute de longe muito acima do Goleiro, é marcado como Gol de placa: câmera lenta e fala especial. Não muda a chance de gol. O primeiro Gol de placa de cada Jogador é uma Conquista média (10 Moedas, ADR-0090).
- **Divulgação:** Reels "Dentro de campo" na série de novidades da T3 (ADR-0092), com lances de exemplo.

## Considered Options

- **Impedimento, gol contra, clima com efeito, fôlego, mando de campo, VAR e lesão:** não escolhidas agora.
- **Rebote sempre do atacante:** rejeitada. Viraria quase meio gol e subiria a média.
- **Só perdendo por 1 na Pressão final:** rejeitada. Menos emoção no fim.
- **Perfil do Juiz conhecido antes do Corte:** rejeitada. Revelaria o Juiz cedo demais.
- **Gol de placa como lance novo:** rejeitada. Precisaria de outra calibração; a classificação de lances que já existem basta.
- **Manter o estilo de desenho junto com o chute real:** rejeitada. Metade dos chutes "de longe" seria só aparência.

## Consequências

- Muda a simulação, o renderer (trave, rebote, acréscimos, Gol de placa, plaquinha do Juiz) e as falas do Narrador; todas com teste.
- O renderer passa a escolher os estilos pela versão da Partida, para o Replay antigo não mudar.
- Novos tipos de lance entram no extrato de ações que fazem a Habilidade evoluir (por exemplo, o rebote vencido conta para Finalização ou Defesa).
