# Câmera do Reels e efeitos de momento

O Reels mostrava o campo inteiro o tempo todo. No celular, os bonecos e a bola ficavam pequenos, a jogada acontecia num canto da tela e os @ de todos os Jogadores se amontoavam onde a jogada apertava.

## Regras

- **Câmera que segue a jogada (só no Reels).** Nos lances, a imagem fica com zoom de 1,5×. Um pixel lógico vira 6 px no vídeo de 1080, então o pixel continua nítido. A câmera segue a média da posição da bola em ±1,2 s de vídeo, um pouco acima dela por causa do placar, sem sair do cenário. Cartelas, Substituição e pênaltis continuam com o campo inteiro. A troca de zoom acontece no escurecimento do corte.
- **@ sem bagunça (só no Reels; substituída pelo ADR-0073, que voltou o @ de todos).** O @ aparecia só em quem está no lance, nesta ordem: quem está com a bola, finalizador, criador, defensor, cobrador, apoio, marcador, zagueiro da dobra e cobertura. Ele fica fora da câmera, em tamanho fixo. Se um nome cairia em cima de outro, vai para cima da cabeça. Se ainda bater, não aparece.
- **Bola mais legível.** A sombra no chão já mostra a altura. Agora a bola também deixa um rastro curto (0,2 s) quando anda rápido: passe longo, cruzamento ou chute.
- **Efeitos de momento (só no Reels):**
  - no gol, a imagem treme por 0,5 s e clareia por 0,3 s;
  - a rede estufa e balança logo depois do gol;
  - o carrinho levanta poeira de terra.
- **Site sem câmera.** Ao Vivo e Replay continuam com o campo inteiro e todos os @, porque lá cada um procura o próprio boneco. (Os efeitos de momento chegaram ao site no ADR-0094.)
- Não muda a simulação (VERSAO_SIM continua igual). Vale para os Reels gravados a partir daqui. Reels já publicados não mudam.

## Considered Options

- **Zoom de 2×:** rejeitada. A jogada sai da tela nos passes longos e a câmera corre demais.
- **Zoom que não seja múltiplo do pixel (1,6× ou 1,8×):** rejeitada. O pixel art fica com linhas de espessura irregular.
- **Câmera também no Ao Vivo do site:** rejeitada por enquanto. No site, a pessoa quer ver o Time inteiro e achar o próprio boneco.
- **Tirar todos os @ no Reels:** rejeitada. Ver o próprio @ no lance é parte da graça do Reels.

## Consequences

- Nos lances, quem está longe da bola sai da tela. Os letreiros (destaque, placar) continuam mostrando quem fez o lance.
- Num chutão do goleiro, a câmera chega a andar 6 pixels lógicos por quadro, seguindo a bola sem pular.
- A gravação fica um pouco mais cara: a câmera e o rastro consultam a bola em cerca de 30 instantes por quadro. Nos testes, o Reels de 112 s seguiu gravando em cerca de 3 minutos.
