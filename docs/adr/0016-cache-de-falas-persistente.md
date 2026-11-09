# Cache de falas persistente

As falas sintetizadas pelo Gemini TTS ficam guardadas fora do Actions e são reaproveitadas entre Partidas. Até aqui, o cache em `.cache/locutor` se perdia a cada execução, e toda Partida pedia todas as suas falas de novo.

Motivo: com a Série B (ADR-0015), a Rodada passa de 4 para 8 Partidas, todas com Reels e Ao Vivo narrados. Cada Partida faz 1 pedido para o Reels e mais 1 a cada 20 falas do Ao Vivo, e a cota do Tier 1 é de cerca de 100 pedidos por dia no modelo principal. Boa parte das falas do jogo corrido se repete entre Partidas, sempre com a mesma voz e o mesmo tom. Por isso, guardar e reaproveitar o áudio corta pedidos sem tirar narração de nenhuma Partida.

## Regras

- **Chave:** a mesma de hoje, `gemini|modelo|voz|tom|texto`. Uma fala só é reaproveitada se for idêntica, com a mesma voz e o mesmo modelo.
- **Onde fica:** no cache do GitHub Actions (`actions/cache`), restaurado e salvo pela ação `preparar` em todo workflow que grava vídeo (Partida, Resumo, apresentação, narradores). Cada execução restaura o cache mais recente e salva uma versão nova no fim.
- **O que não é reaproveitado:** falas com o apelido de alguém (gols e Craque) são únicas e continuam gerando pedido.

## Considered Options

- **Série B sem voz no Ao Vivo:** rejeitada. O dono quer narração completa nas duas séries.
- **Ao Vivo só com torcida para todos:** rejeitada, pelo mesmo motivo.
- **Subir o tier do Gemini:** fica como reserva se o cache não bastar.
- **Guardar no R2:** funcionaria, mas pede sincronizar a pasta com o bucket antes e depois de cada gravação. O cache do Actions faz isso sozinho, sem segredo novo e sem código.

## Consequences

- Nos primeiros dias, o cache está vazio e o consumo é alto. Ele cai à medida que as falas comuns ficam guardadas.
- Trocar o modelo ou a voz de um Narrador invalida as falas dele no cache.
- O GitHub guarda até 10 GB de cache por repositório e apaga os mais antigos. Cada fala tem cerca de 200 KB, então cabem dezenas de milhares.
- O cache é por branch: as execuções agendadas rodam no master e compartilham o mesmo cache.
- Se a cota estourar mesmo assim, o modelo lite continua sendo a reserva automática.
