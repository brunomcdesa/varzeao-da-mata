# Efeitos de momento no Ao Vivo e no Replay

O Reels tem efeitos que dão emoção aos lances (ADR-0072 e ADR-0074), mas o Ao Vivo e o Replay do site ficaram sem eles. Quem acompanha o jogo inteiro pelo site via o gol passar sem o mesmo impacto.

## Regras

- **Os efeitos do Reels entram no Ao Vivo e no Replay, com o campo inteiro:**
  - no gol, a imagem treme por 0,5 s e clareia por 0,3 s, e a rede estufa e balança;
  - a bola deixa um rastro curto (0,2 s) quando anda rápido;
  - o carrinho levanta poeira de terra;
  - no cartão, o cartão gigante aparece por 1,4 s no instante em que o juiz levanta o cartão, e o letreiro de sempre sai da tela enquanto isso.
- **Sem zoom e sem pausa.** A câmera continua no campo inteiro (o ADR-0072 segue valendo: no site cada um procura o próprio boneco). O cartão não para o lance nem dá close no juiz, porque o Ao Vivo segue o relógio.
- **Durações em s de Ao Vivo** (s de jogo ÷ VELOCIDADE_AO_VIVO): na velocidade normal, o tremor e o cartão duram o mesmo que no Reels.
- **Menos movimento.** Quem pediu menos movimento no aparelho (`prefers-reduced-motion`) fica sem o tremor e o clarão; o resto fica.
- **Vale para todos os Replays**, inclusive os de jogos já jogados. É só visual: placar, lances e narração não mudam, e a VERSAO_SIM continua igual.

## Considered Options

- **Câmera com zoom também no site:** rejeitada de novo. Quem está longe da bola sairia da tela.
- **Zoom rápido só no gol:** rejeitada por enquanto. O tremor e o clarão já marcam o momento.
- **Efeitos só a partir dos próximos jogos:** rejeitada. Exigiria guardar uma versão visual em cada Partida, sem ganho, já que nada do resultado muda.
- **Cartão com pausa, como no Reels:** impossível no Ao Vivo, que segue o relógio.

## Consequences

- O ADR-0072 deixa de valer na parte "Site sem mudança": o site ganha os efeitos de momento, mas segue sem a câmera que segue a jogada.
- O cartão gigante cobre por 1,4 s uma parte do campo de cima.
- Cada quadro do site consulta a bola em mais 5 instantes por causa do rastro.
