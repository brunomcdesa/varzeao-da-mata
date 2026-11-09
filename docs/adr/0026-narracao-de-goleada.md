# Narração de Goleada

Placares como o 5×1 da Arara Azul sobre a Onça (Rodada 2, Temporada 1) passavam com a mesma fala de qualquer vitória. Agora o narrador comemora a **Goleada**.

## Regras

- **O que é Goleada:** o vencedor tem 4 gols ou mais e 3 ou mais de vantagem (`ehGoleada` em `@liga/shared`). 4×0, 4×1, 5×1 e 5×2 são Goleada; 4×2 e 4×3 não, porque o jogo ficou apertado.
- **No gol que confirma a Goleada:** a fala extra do gol ("Fulano não perdoa!", o bordão ou o placar) vira uma frase de Goleada. Com apelido falável, o nome entra junto (ADR-0014). Vale uma vez por Time na Partida: se o rival diminuir e a Goleada voltar, o narrador não repete.
- **No Fim de jogo:** o "Vitória do…" vira uma frase de Goleada, desde que o placar final seja Goleada.
- **Mesma quantidade de falas:** as frases substituem falas que já existiam, então o vídeo não fica mais longo e a narração não gasta mais pedidos da cota do Gemini TTS.
- O placar está na tela, então a regra "o narrador só comenta o que aparece" continua valendo.
- É só narração: a simulação não muda e a VERSAO_SIM continua a mesma. Vale a partir do próximo áudio gerado; partidas já narradas ficam como estão.

## Considered Options

- Qualquer Time com 4 gols ou mais: um 4×3 viraria Goleada.
- Diferença de 4 gols ou mais: um 4×1 não contaria.
- Frase em todo gol depois da Goleada: ficaria repetitivo.
