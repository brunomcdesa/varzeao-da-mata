# Capitão em campo

A partir da T3, o Capitão ganha influências que ficam com ele mesmo quando o Time tem Técnico (ADR-0111). Sem Capitão com Vínculo, cada uma volta ao automático.

- **Cobradores no jogo:** o pênalti durante a Partida é batido pelo primeiro da ordem dos Batedores que estiver em campo. No escanteio, o Capitão escolhe 1 cobrador e 1 reserva entre os Jogadores de linha; sem nenhum dos dois em campo, volta o sorteio. Muda a simulação: sobe a versão da simulação da T3 (VERSAO_SIM_T3 22), que vale para os jogos escalados depois.
- **Chamada da Presença:** um botão por jogo, até o Corte, manda Aviso no App para os Jogadores do Elenco que têm o App com Vínculo e Avisos ligados. O site mostra quantos já confirmaram.
- **Marcação individual:** até o Corte, em segredo como a Postura, o Capitão escolhe um rival de linha (nunca o goleiro) e um zagueiro ou meia do próprio Time. O marcador leva vantagem nos duelos contra o alvo, mas faz mais faltas e leva mais cartão; o tamanho do efeito é calibrado na simulação. Se o alvo ou o marcador não entrar em campo, não há marcação. Aparece na cartela da Escalação e na fala do Narrador da Escalação.
- **Grito da Temporada:** 3 Gritos de guerra por Time, aprovados pelo dono. O Capitão escolhe um na Janela, e ele vale a Temporada toda. Sem escolha, fica o Grito atual. O coro continua sintetizado, sem voz, então não gasta a cota do Gemini.
- **Braçadeira:** faixa de Capitão no braço do boneco em campo e selo na Carreira, a partir da Rodada 4 da T3, congelada na Escalação.

## Considered Options

- **Bônus de Moedas para o Capitão:** rejeitada; as influências e a Braçadeira já dão peso ao cargo.
- **Lista separada para o pênalti no jogo:** rejeitada; os Batedores já são essa ordem.
- **Alvo da Marcação público antes do jogo:** rejeitada; fica em segredo, como a Postura.
