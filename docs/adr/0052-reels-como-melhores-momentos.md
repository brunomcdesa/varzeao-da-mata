# Reels da Partida como melhores momentos

O Reels de cada Partida mostra só os melhores momentos (o Roteiro escolhe os lances), mas nada no vídeo dizia isso. A abertura ("Bola rolando no Varzeão da Mata!") dava a impressão de jogo começando, e o fim só pedia para compartilhar. Quem via o Reels não ficava sabendo que o jogo completo passa Ao Vivo no site, com Replay.

## Regras

- **Selo na abertura:** placa amarela "Melhores momentos" no topo da cartela de abertura do Reels.
- **Chamada no fim:** a cartela de fim troca o escudo da Liga por uma placa "Jogo completo no site" (na T2, "no site e no app"), com "Ao Vivo e Replay · link na bio".
- **Narrador (só no Reels):** a abertura diz "Melhores momentos do Varzeão da Mata!" (ou "do Clássico…"; no Mata-mata, "Melhores momentos!" antes da frase da etapa). No fim, o "Curtiu? Compartilha com a galera!" vira "O jogo completo, Ao Vivo e no Replay, tá no site do Varzeão!" (na T2, "no site e no app do Varzeão"). O Narrador só fala do que está na tela, e o selo e a placa aparecem junto com as falas.
- **Ao Vivo sem mudança:** a narração do Ao Vivo usa a mesma função (`montarNarracao`), agora com `aoVivo: true`, e continua igual.
- Vale já na Temporada 1, a partir do próximo Reels gravado. Não muda a simulação (VERSAO_SIM continua igual). Reels já publicados não mudam.

## Considered Options

- **Só na tela, sem fala:** rejeitada. Passa batido para quem ouve sem olhar a cartela.
- **Só no fim:** rejeitada. A abertura continuaria dando a impressão de jogo ao vivo.
- **Sempre "no site", mesmo na T2:** rejeitada. O App (PWA) chega na T2 e o Reels ajuda a divulgá-lo.

## Consequences

- A fala do fim fica com mais uma frase; o corte seguro (ADR-0049) segue valendo.
- A abertura e o fim do Reels têm texto novo, então o áudio delas não vem do cache nas primeiras Partidas (já variava por Times e placar).
