# Jogadas coreografadas no renderer e visual de várzea em pixel art

A sim decide só quem criou, quem finalizou e quem defendeu cada lance. A forma de mostrar a jogada fica no renderer (`src/jogada.ts`). O estilo é sorteado pelo seed da Partida e pelo número do lance: tabela, chute de longe, lançamento, cruzamento com cabeçada, jogada individual e desarme. Cada estilo define a trilha dos Jogadores envolvidos e os trechos da bola (posse, passe, chute e bola parada). A bola sempre sai e chega no pé de alguém.

Escolhemos isso em vez de pôr a jogada na sim para não mexer na calibração nem subir `VERSAO_SIM`. A jogada é cosmética e não muda placar, Notas nem OVR.

O visual segue a várzea: placar de tábua com plaquinhas penduradas, campo com terrão e cal, mata em volta, faixa de torcida no gol e bonecos em pixel art 12×16, com pele e cabelo derivados do @. As fontes são Jersey 10 nos números e letreiros e Pixelify Sans nos nomes.

## Consequences

- Mudar a coreografia muda o que o Replay mostra de Partidas antigas (o resultado continua o mesmo). Se um dia isso importar, versionar o renderer junto com a Partida.
- O vídeo, o Ao Vivo e o Replay continuam idênticos entre si, porque tudo sai da mesma função pura de t.
- `pnpm gravar --previa <pasta>` salva os quadros-chave para revisar o visual sem gerar o MP4.
