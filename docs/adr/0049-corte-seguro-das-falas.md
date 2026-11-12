# Corte seguro das falas do Narrador

Em 12/11, o Narrador disse "Fim de jogo!" no meio da Partida (aos 77'), no Ao Vivo e no Reels, e numa delas anunciou um empate quando um Time estava na frente. O texto das falas estava certo: a única fala com "Fim de jogo" é a do fim, e ela só entra depois do apito final. O problema estava no áudio.

O Gemini TTS recebe várias falas num pedido só (ADR-0009) e o áudio é cortado nas pausas longas. A fala do fim tem várias frases ("Fim de jogo! Placar. Vitória… Curtiu? Compartilha…"), e a voz às vezes faz nela uma pausa quase tão longa quanto a separação entre as falas. Quando isso acontece, o corte cai no lugar errado e uma fala fica com o áudio de outra. Com o cache persistente (ADR-0018), esse áudio trocado fica guardado com o texto de uma fala comum ("Segue o jogo.", "Pra fora!"…) e volta em outras Partidas, com o placar de outro jogo.

## Regras

- **Conferência do corte:** a menor pausa usada como corte precisa ser pelo menos 1,3× maior que a maior pausa que ficou dentro de alguma fala (`FOLGA_DO_CORTE`). Se não for, o lote é recusado e dividido ao meio, como já acontecia quando faltavam pausas. Um lote de uma fala só não é cortado.
- **Cache novo:** a chave do cache ganhou a versão `corte2` e o cache do Actions passou a se chamar `locutor-v2-`. Todo o áudio guardado antes desta regra é descartado, porque não dá para saber quais falas estão trocadas.
- Não muda a simulação (VERSAO_SIM continua igual). Partidas já jogadas e Reels já publicados não mudam.

## Considered Options

- **Apagar só as falas suspeitas do cache:** rejeitada. Sem transcrever o áudio, não dá para saber quais estão trocadas.
- **Uma fala por pedido:** rejeitada. Não cabe na cota de cerca de 100 pedidos por dia.
- **Pedir a fala do fim sempre sozinha:** não resolve as outras falas com pausa interna e não limpa o cache.

## Consequences

- Nos primeiros dias o cache está vazio de novo e o consumo de cota sobe. O modelo lite continua de reserva.
- Lotes ambíguos viram mais pedidos (divididos ao meio), nunca áudio trocado.
- Se o log mostrar muitos "corte do lote falhou", dá para ajustar `FOLGA_DO_CORTE` olhando os áudios salvos em `.cache/locutor/falhas`.
