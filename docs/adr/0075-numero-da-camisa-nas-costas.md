# Número da camisa nas costas dos bonecos

O Jogador já escolhia o número da camisa no site (1 a 99, sem repetir no Time), mas o número não aparecia no jogo. A ideia veio de um seguidor: ver o próprio número nas costas do boneco ajuda a pessoa a se achar em campo.

## Regras

- **Só nas costas.** O número aparece quando o boneco está de costas (parado ou correndo). De frente, de lado, comemorando e no mergulho do goleiro, não aparece.
- **Meio pixel.** O boneco tem 12×16 pixels e não cabem dois algarismos na grade dele. Por isso, o número é desenhado com algarismos de 3×5 pontos, cada ponto com metade do tamanho de um pixel do boneco (3 px no vídeo de 1080, 4,5 px com a câmera do Reels). A faixa de detalhe das costas sai para dar lugar ao número.
- **Cor.** O número usa a segunda cor do uniforme que está em campo (inclusive o Segundo uniforme). Se ela se confunde com a camisa (distância de cor abaixo de 90, como no Tatu), o número sai em branco ou escuro, o que contrastar mais.
- **Camisa lisa.** Quem não escolheu número, e o Jogador da Base, joga sem número. O sistema não sorteia número.
- **Espelhamento.** Quem corre para a esquerda tem o boneco virado no próprio desenho, e não no canvas, para o número não sair invertido.
- **Número da época do jogo.** A Escalação guarda o número na hora em que a Partida é escalada (coluna `escalacao.numero`), como o apelido (ADR-0014). Trocar de número depois não muda Partidas já escaladas. Partidas escaladas antes desta mudança ficam de camisa lisa.
- Vale no Reels, no Ao Vivo e no Replay do site. Não muda a simulação (VERSAO_SIM continua igual).

## Considered Options

- **Número no peito também:** rejeitada. Na frente o número fica menor ainda e vira borrão.
- **Número só nos closes (gol, Craque, apresentação):** rejeitada. Aparece pouco durante o jogo, que é onde a pessoa procura o próprio boneco.
- **Etiqueta com o número acima do boneco:** rejeitada. Foge da ideia de camisa e polui o campo, que já tem os @.
- **Sortear número para quem não escolheu:** rejeitada. Ocuparia números que outros Jogadores querem e inventaria uma escolha que a pessoa não fez.

## Consequences

- O número quebra um pouco a grade do pixel art (é desenhado em meio pixel). Na prévia aprovada isso não incomodou e o número ficou legível com a câmera do Reels.
- O sprite de costas com número é pintado em dobro (24×32). Quem desenha sempre passa o tamanho final, então o resto do renderer não muda. O cache de sprites ganha uma variação por número e por lado.
