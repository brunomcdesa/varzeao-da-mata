# Reels de melhores momentos, com roteiro determinístico

O Reels de cada Partida não mostra os 90 minutos (que no Ao Vivo levam ~6 min): mostra os melhores momentos, em cerca de 1 minuto. O `Roteiro` (`packages/renderer/src/roteiro.ts`) escolhe os trechos da Timeline: abertura (3 s), cada gol (7 s), defesa (4 s) e chute para fora (3 s), e o fim de jogo com o Melhor em Campo (4 s). Desarmes ficam de fora. Entre os trechos há um corte com escurecimento rápido.

Se o vídeo passar de 75 s, saem primeiro os chutes para fora e depois as defesas, do fim para o começo. Gol nunca sai.

Escolhemos isso porque a API aceita Reels de 3 s a 15 min, mas um jogo inteiro perde o público. O jogo completo continua no site (Ao Vivo e Replay).

## Consequences

- Como a Timeline, o Roteiro é função pura do tempo: o quadro N do vídeo é sempre o mesmo, e a gravação pode ser refeita ou dividida sem mudar o resultado.
- A gravação é quadro a quadro (`pnpm gravar`): o Playwright pede cada quadro à página `video/`, que devolve JPEG, e o ffmpeg monta o MP4. As fontes vão embutidas no bundle, sem depender de rede no Actions.
- A narração do Locutor da Liga terá de seguir os segmentos do Roteiro, não o relógio do jogo.
