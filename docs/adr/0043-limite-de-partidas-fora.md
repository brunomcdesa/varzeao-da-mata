# 0043 — Limite de Partidas Fora

## Contexto
O rodízio da Escalação põe na frente quem jogou menos na Temporada. Quem se inscreve no meio da Temporada chega com 0 jogos e passa na frente de todo mundo até alcançar os outros. Num Time com 6 atacantes e 2 vagas (caso da Preguiça), os veteranos ficavam 3 ou mais Partidas seguidas fora, o que pesa muito numa Temporada de 7 Rodadas.

## Decisão
- Quem ficou **2 Partidas seguidas do próprio Time** fora da Escalação passa na frente no rodízio, no **mesmo nível da Presença** (e da Resenha no Clássico), logo depois do Craque da Rodada anterior. Entre os que têm prioridade, segue o rodízio de sempre (jogou menos, jogou há mais tempo, inscreveu antes).
- Só contam Partidas **depois da Inscrição** (as que o Jogador poderia ter jogado: Corte depois da Inscrição) e já escaladas.
- Vale nas duas Temporadas e no Mata-mata, a partir da próxima Partida escalada. Não é mudança na simulação: não sobe a VERSAO_SIM.

## Consequências
- Ninguém fica mais de 2 Partidas seguidas fora, salvo quando há mais Jogadores com prioridade do que vagas na Posição.
- O critério "jogou menos" continua valendo para quem não estourou o limite.
