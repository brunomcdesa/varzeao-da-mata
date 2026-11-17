# Reels com mais lances e o @ de todos

Duas reações ao primeiro Reels com a câmera (ADR-0072):

- O zoom agradou, mas o pessoal quer ver o @ de todos os Jogadores, como antes, e não só de quem está no lance.
- Muitos lances bons ficavam de fora, como na Final. O Roteiro cortava pelo teto de 75 s do vídeo planejado, antes de a narração esticar os trechos. Nas partidas de teste da T2, saíam cerca de 4 lances por jogo, de uns 14 (sem contar desarmes e escanteios que não viraram gol). Primeiro saíam faltas, chutes para fora e bloqueios. O vídeo final ficava em média com 2 min, longe dos 3 min que o Instagram aceita para recomendar o Reels.

## Regras

- **O @ de todos.** No Reels com câmera, todo Jogador mostra o @ embaixo do boneco, no mesmo tamanho de letra de antes do zoom. Na disputa de pênaltis continua só quem está na área.
- **Teto pelo vídeo final.** Entram lances até o vídeo final, já esticado para a narração caber, chegar a 2 min 50 s (`DURACAO_MAXIMA_DO_REELS` = 170 s). `tetoDoReels` procura, de 5 em 5 s, o maior teto planejado que cabe, estimando a voz pelo texto com 10% de folga.
- **Conferência com a voz real.** Depois da síntese, se o vídeo passar de 2 min 58 s, a gravação tira mais lances (teto 5 s menor) e monta de novo. O cache evita sintetizar outra vez as falas que não mudaram.
- **A ordem de corte não muda (ADR-0006):** primeiro faltas, depois chutes para fora, bloqueios e defesas. Gol nunca sai. Falta que vira gol ou dá vermelho fica junto com o lance.
- Desarmes e escanteios que não viraram gol continuam só no Ao Vivo.
- Não muda a simulação (VERSAO_SIM continua igual). Vale para os Reels gravados a partir daqui. Reels já publicados não mudam.

## Considered Options

- **Só subir o teto planejado para 90 s:** rejeitada. Continuam saindo uns 2 lances por jogo, e os jogos de Mata-mata com pênaltis passariam dos 3 min.
- **Teto maior só no Mata-mata:** rejeitada. A Fase de Liga também perdia lances bons.
- **Trechos mais curtos por lance:** rejeitada. A narração estica o trecho de qualquer jeito, e o lance fica corrido.
- **@ só de quem está no lance (ADR-0072):** substituída por esta.

## Consequences

- Nas partidas de teste, os lances fora do Reels caíram de 4 para 1,3 por jogo na Fase de Liga e para 1,8 no Mata-mata. O vídeo final passou de uns 2 min para uns 2 min 22 s em média.
- Jogo com muitos gols e pênaltis ainda pode passar do limite, porque gol nunca sai. Num caso de teste do Mata-mata, só com os gols e os pênaltis, o vídeo ficou com 3 min 01 s.
- Reels mais longo leva mais tempo para gravar e gasta mais falas na síntese, em média uns 3 lances a mais por jogo. O cache por texto reduz isso.
