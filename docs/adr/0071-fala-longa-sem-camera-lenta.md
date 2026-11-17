# Fala longa no Reels sem câmera lenta

No Reels, o Roteiro estica o trecho do lance para a narração caber inteira (`exigenciasDaNarracao`). O trecho de jogo mostrado não mudava, então o lance ficava em câmera lenta. Num diagnóstico com 150 partidas de teste (1.416 lances), 34% ficaram mais de 30% mais lentos até a resolução e 85% depois dela. Na T2, a primeira fala de cada Jogador ficou mais longa ("Bruninho, atacante da Onça,…", ADR-0059), o que piorou isso.

O mesmo diagnóstico mostrou que o "Comemora o atacante!" sai sempre depois do fim da comemoração na tela (156 de 156 gols).

## Regras

- **Mais jogada, mesma velocidade.** Quando a fala pede mais tempo antes da resolução, o corte começa mais cedo na jogada, na velocidade de sempre. Quando pede mais tempo depois, o lance respira mais tempo de jogo, também na velocidade de sempre.
- **Sem invadir outro lance.** O trecho fica dentro de `Timeline.trechoLivre`: depois do fim do lance anterior e do letreiro dele, e antes do começo do lance seguinte. Se faltar espaço, só o que sobra vira câmera lenta.
- **Bola parada** (lateral, escanteio, falta, pênalti) continua começando na cobrança. Ali só o depois cresce.
- **Sem "Comemora…!"** entre as falas depois do gol, no Reels e no Ao Vivo.
- Não muda a simulação (VERSAO_SIM continua igual). Vale para os Reels gravados a partir daqui. Reels já publicados não mudam.

## Considered Options

- **Encurtar as falas:** rejeitada. As frases aprovadas e o apelido da T2 continuariam longos, e cortar frases deixa a narração pobre.
- **Acelerar a voz:** rejeitada. O ADR-0049 e o ritmo da voz já limitam isso, e a fala fica difícil de entender.
- **Manter a câmera lenta só depois do gol:** rejeitada. A comemoração dura pouco na tela de qualquer jeito, e o lance lento parecia replay sem ser.

## Consequences

- No mesmo diagnóstico, os lances com câmera lenta acima de 30% caíram de 481 para 91 antes da resolução e de 1.206 para 177 depois dela. Os que sobram são de bola parada ou esbarram no lance vizinho.
- Antes da resolução, o Reels mostra mais do toque de bola e da construção, então aparecem mais passes e mais sons de passe.
- O Reels fica com a mesma duração: o esticamento já existia, só deixou de ser câmera lenta.
