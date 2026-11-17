# Destaque dos cartões

Pelo retorno do pessoal, o cartão passava batido. O juiz levantava um cartão pequeno (5×8 pixels), entrava a tábua de sempre com "Amarelo!" ou "Expulso!" e o Narrador falava, mas nada ficava marcado depois do lance.

## Regras

- **Cartão gigante (só no Reels).** Na falta com cartão, quando o juiz já está com o cartão no ar, um cartão amarelo ou vermelho grande entra no alto da tela como um carimbo: grande e inclinado, assentando no lugar. Embaixo vêm "Amarelo!" ou "Expulso!" e o @ de quem levou. Fica 1,4 s. Nesse tempo, a tábua de sempre sai da tela para não repetir.
- **Close no juiz (só no Reels).** Durante o cartão gigante, a câmera fecha em 2×, com o juiz e quem levou o cartão na parte de baixo da tela. Com 2×, um pixel lógico vira 8 px no vídeo de 1080, então a imagem continua nítida. O lance quase para (10% da velocidade) e depois anda um pouco mais rápido, para o trecho terminar no mesmo instante de jogo de sempre.
- **Tempo para o cartão.** A falta com cartão ganha 2 s a mais de vídeo depois do apito (`TEMPO_DO_CARTAO`), para o juiz chegar e a pausa caber.
- **Cartões no placar (Reels e site).** Embaixo do placar, do lado de cada Time, aparecem os cartões que ele levou na Partida, na ordem.
- **Cartãozinho no @ (Reels e site).** Quem levou cartão fica com um cartãozinho antes do @ até o fim do jogo, vermelho se tiver sido expulso.
- **Quando o cartão passa a contar.** No placar e no @, o cartão conta a partir de quando o juiz já está com ele no ar (20% do letreiro da falta, `CARTAO_NO_AR`).
- Não muda a simulação (VERSAO_SIM continua igual). Vale para os Reels gravados a partir daqui. No site (Ao Vivo e Replay), as marcas aparecem também nas Partidas já jogadas da T2, porque elas são desenhadas na hora a partir dos lances.

## Considered Options

- **Placa na cor do cartão, no lugar da tábua de madeira:** não escolhida desta vez.
- **Pausa total (congelar o quadro):** rejeitada. O lance pularia de uma vez quando voltasse. O "quase parado" com recuperação depois mantém o movimento contínuo.
- **Cartão gigante no meio da tela:** rejeitada na prévia, porque cobria o juiz e quem levou o cartão. Foi para o alto da tela, com o close deixando os dois embaixo.

## Consequences

- Um Reels com cartões fica 2 s mais longo por cartão. O teto pelo vídeo final (ADR-0073) já conta com isso.
- Se o trecho da falta for curto demais (encostado no lance seguinte), o cartão gigante e o close não aparecem. O cartão continua marcado no placar e no @.
