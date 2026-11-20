# 0097 — Narração refeita e envio ao R2 com nova tentativa

- Status: aceito (aprovado pelo dono em 20/11/2026)
- Data: 2026-11-20

## Contexto

Em 20/11/2026, o jogo das 15h (Sucuri × Jacaré, Partida 44) saiu sem narração no Ao Vivo e no Replay. A voz foi gerada normalmente (281 s de áudio), mas o envio do arquivo ao R2 recebeu um 503 da Cloudflare ("ServiceUnavailable"). O job registrou "sem narração do Ao Vivo" e seguiu. A mesma instabilidade derrubou o fim do job das 16h, na hora de subir os dados do site.

Dois pontos deixaram uma queda de segundos virar um jogo mudo para sempre:

1. O envio ao R2 fazia um pedido só.
2. Depois que o Reels é agendado, o job nunca mais volta à Partida, então a narração que faltou não é refeita.

## Decisão

1. **Envio ao R2 com nova tentativa.** Instabilidade (5xx, 429 ou falha de rede) tenta de novo até 3 vezes no total, esperando 2 s e depois 8 s. Recusa (outros 4xx, como credencial errada) não repete. Vale para todo envio (vídeos, narração, dados do site).
2. **Narração refeita no job partida.** No fim de cada rodada do job partida, toda Partida já jogada (AGENDADA ou PUBLICADA) sem narração, com Apito Inicial nas últimas 48 h e com o Ao Vivo já encerrado, ganha a narração de novo e a cópia privada da Partida é guardada outra vez (é ela que o Ao Vivo e o Replay usam).
3. Só o áudio é refeito: a Partida não é simulada de novo, o resultado não muda e a VERSAO_SIM continua a mesma. As falas já estão no cache de voz, então quase não gasta a cota do Gemini.

## Considered Options

- **Só repetir o envio:** rejeitada; uma queda mais longa ainda deixaria o jogo mudo para sempre.
- **Refazer durante o Ao Vivo:** rejeitada; o áudio começaria fora de sincronia com o jogo na tela.
- **Refazer sem limite de tempo:** rejeitada; Partidas antigas sem narração (de antes da narração do Ao Vivo existir) iriam todas para a fila da voz.

## Consequences

- `R2.enviar` ganha as tentativas (`ESPERAS_DO_ENVIO_MS`); `ConfigR2.dormir` permite testar sem esperar.
- `jobs.ts`: a gravação da narração vira `gravarNarracao`, usada no jogo do horário e em `refazerNarracoes`, chamada no fim de `jobPartida`.
- A Partida 44 de 20/11 ganha a narração na próxima rodada do job partida.
