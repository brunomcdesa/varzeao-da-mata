# Cache de falas persistente

As falas sintetizadas pelo Gemini TTS ficam guardadas fora do Actions e são reaproveitadas entre Partidas. Até aqui, o cache em `.cache/locutor` se perdia a cada execução, e toda Partida pedia todas as suas falas de novo.

Motivo: com a Série B (ADR-0015), a Rodada passa de 4 para 8 Partidas, todas com Reels e Ao Vivo narrados. Cada Partida faz 1 pedido para o Reels e mais 1 a cada 20 falas do Ao Vivo, e a cota do Tier 1 é de cerca de 100 pedidos por dia no modelo principal. Boa parte das falas do jogo corrido se repete entre Partidas, sempre com a mesma voz e o mesmo tom. Por isso, guardar e reaproveitar o áudio corta pedidos sem tirar narração de nenhuma Partida.

## Regras

- **Chave:** a mesma de hoje, `gemini|modelo|voz|tom|texto`. Uma fala só é reaproveitada se for idêntica, com a mesma voz e o mesmo modelo.
- **Onde fica:** um lugar que sobrevive entre execuções. O candidato natural é o R2 que o projeto já usa.
- **O que não é reaproveitado:** falas com o apelido de alguém (gols e Craque) são únicas e continuam gerando pedido.

## Considered Options

- **Série B sem voz no Ao Vivo:** rejeitada. O dono quer narração completa nas duas séries.
- **Ao Vivo só com torcida para todos:** rejeitada, pelo mesmo motivo.
- **Subir o tier do Gemini:** fica como reserva se o cache não bastar.

## Consequences

- Nos primeiros dias, o cache está vazio e o consumo é alto. Ele cai à medida que as falas comuns ficam guardadas.
- Trocar o modelo ou a voz de um Narrador invalida as falas dele no cache.
- Se a cota estourar mesmo assim, o modelo lite continua sendo a reserva automática.
