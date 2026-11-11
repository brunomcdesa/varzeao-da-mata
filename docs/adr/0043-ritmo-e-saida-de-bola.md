# Ritmo da Partida: saída de bola, lances até o 90' e marcação dupla

A partir da VERSAO_SIM 11 (Temporada 1) e 12 (Temporada 2), três regras novas na simulação. Partidas já jogadas não mudam: o resultado delas está guardado e segue com a versão em que foi simulado.

## Saída de bola depois do gol

Antes, o lance seguinte a um gol sorteava 50/50 quem estava com a bola. Muitas vezes quem marcou saía jogando.

Agora quem sofreu o gol dá a saída. O duelo de Posse continua, mas com a vantagem de quem tem a bola: `basePosseNaSaida` = 0,8 (o normal é `basePosse` = 0,5). Quem sofreu ataca o lance seguinte em cerca de 80% das vezes. No resto, o time que marcou rouba a bola logo depois da saída. As Habilidades (Passe × Defesa dos meias) continuam pesando.

O sorteio de antes continua sendo feito (e ignorado depois de gol), para o resto da Partida não mudar.

## Lances até o 90'

Antes, o lance `n` de `N` caía em `⌊(n−1)·90/N⌋ + 1 + (0 a 2)`. O último saía entre o 76' (jogo travado, 6 lances) e o 88'. Dali até o apito a Partida ficava sem lance, e no Ao Vivo a bola parava no meio.

Agora cada lance cai num ponto sorteado da sua fatia de `90/N` minutos: `⌊(n − 1 + p)·90/N⌋ + 1`, com `p` em {1/6, 1/2, 5/6} (mesmo sorteio de antes). O último lance cai perto do apito, e pode sair gol entre o 82' e o 90'.

## Marcação dupla

Antes, só o marcador (o 2º zagueiro) duelava com o finalizador. O 1º zagueiro, que duelou com o meia na criação, saía da jogada.

Agora, em cerca de 1 a cada 4 lances que chegam ao duelo com a zaga (`chanceMarcacaoDupla` = 0,25), o 1º zagueiro volta e dobra a marcação. Não vale no contra-ataque sem recomposição nem com um zagueiro expulso. Sorteio próprio.

- **Dobra:** o duelo do finalizador (drible ou chute marcado) vale contra a melhor Defesa dos dois zagueiros e perde `penalidadeMarcacaoDupla` = 0,15 de chance.
- **Saída da dobra:** antes do duelo, o finalizador tenta achar o companheiro livre (Passe × Defesa do zagueiro, base `baseSaidaDaDobra` = 0,35). Se acha, o companheiro (de preferência o outro atacante) chuta livre, sem marcador, e quem passou leva a assistência se sair gol.
- O lance guarda `dobra: { zagueiro, sobre, passe? }` para o desenho e a narração.

## Equilíbrio

Calibragem (`pnpm calibrar`) entre times iguais (OVR 70 × 70): 3,06 gols por jogo (antes 2,99), 25,9% de empates (antes 24,9%). Nas outras faixas de OVR a vitória do mais forte varia menos de 1 ponto.

## Consequências

- A trava da Temporada 1 (`regressao-t1.json`, ADR-0027) foi refeita para a VERSAO_SIM_T1 11.
- O desenho do Ao Vivo, do Replay e do Reels (o ritmo da jogada, o toque de bola entre os lances, a saída de bola com o Jogador tocando na bola e o 2º zagueiro em campo) vem no mesmo branch e só vale para partidas da versão nova.
