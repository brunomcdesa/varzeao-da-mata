# Enchimento do Ao Vivo no momento certo

No Ao Vivo, o Narrador às vezes falava de coisas que não estavam na tela. As frases de jogo corrido entre os lances (o enchimento) tinham dois problemas.

- **Escritas para um vão e faladas em outro.** O enchimento era montado com a duração estimada das falas, antes da síntese. Depois, com a duração real, cada grupo de frases ia para "o maior vão ainda livre na ordem", que nem sempre era o vão para o qual ele tinha sido escrito. Num diagnóstico com 60 partidas de teste e a voz variando ±25% em relação à estimativa, 18% das frases caíram a mais de 5 s do lugar certo. Isso gerou "78 minutos de jogo" com a tela no 60', "Tudo igual de novo!" com 0×1 e "Capivara 1, Onça 2" com 1×1.
- **Ações sorteadas, sem olhar o desenho.** "O goleiro repõe a bola", "Passe errado!", "Dividida no meio!" e "O zagueiro tenta o lançamento... a zaga afasta" saíam em qualquer vão. O toque de bola (ADR-0045) nunca desenha dividida, passe errado nem lançamento afastado, e o goleiro só aparece com a bola às vezes.

## Regras

- **Âncoras primeiro.** A narração do Ao Vivo é sintetizada em duas vezes: primeiro as falas dos lances, do intervalo, dos pênaltis e do fim (`ancorasAoVivo`), depois o enchimento. Com a duração real das âncoras, os vãos são os de verdade.
- **Cada frase tem hora.** O enchimento é escrito frase por frase para a hora em que vai ser dito (`em`). Minuto, placar, "depois do gol", reta final e o que é da última Rodada são os daquele instante.
- **Só o que está na tela.** A Timeline diz o que a bola está fazendo no toque de bola (`bolaNoToque`: com quem está, de quem para quem vai o passe, ou parada). Uma frase de posse só entra se a tela mostrar aquilo do começo ao fim da fala, contando a voz até 30% mais lenta e a entrada até 1 s atrasada. Exemplos:
  - "O goleiro repõe a bola" só quando o goleiro está com ela e passa;
  - "O meia pede a bola" só com um passe para o meia;
  - "troca passes no meio-campo" só com passe e a bola no terço do meio;
  - "chega pela direita" só com a bola no campo de ataque, do lado direito da tela.
- **Saem** "Dividida no meio!", "Passe errado! Mas…" e "O zagueiro tenta o lançamento… a zaga afasta", porque o toque de bola não desenha nada disso. "Recupera…, e começa tudo de novo" só vale logo depois de um lance em que esse Time defendeu. "Saída de bola…, depois do gol" só vale com a bola parada no meio.
- **Encaixe.** Cada frase entra na hora para que foi escrita, ou no máximo 1 s depois (`ATRASO_MAXIMO_ENCHIMENTO`), sem passar da âncora seguinte. Se não couber, sai.
- **Repetição.** Uma frase nova (de posse ou de contexto) vem antes de uma já dita. Isso importa quando a tela só deixa poucas frases de posse.
- Não muda a simulação (VERSAO_SIM continua igual). Vale para a narração do Ao Vivo gravada a partir daqui. Partidas já jogadas e áudios já publicados não mudam.

## Considered Options

- **Só corrigir a associação de vãos:** rejeitada. Continuaria falando de ações que a tela não mostra.
- **Uma síntese só, com a duração estimada:** rejeitada. Sem a duração real das âncoras, os vãos não são os de verdade.
- **Narrar cada passe do toque de bola:** rejeitada. Ficaria repetitivo e gastaria mais cota do Gemini.

## Consequences

- A cota do Gemini fica igual: os pedidos continuam em lotes de até 20 falas, agora em duas levas (âncoras e enchimento). O cache por texto continua valendo.
- Nas Partidas antigas, sem toque de bola, o enchimento fica só com frases de contexto (minuto, placar, torcida).
- O diagnóstico com 60 partidas de teste passou de 317 frases deslocadas e 15 minutos ou placares errados para nenhum.
