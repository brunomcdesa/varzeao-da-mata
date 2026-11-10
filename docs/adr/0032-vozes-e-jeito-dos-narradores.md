# Vozes da biblioteca e jeito de narrar dos Narradores

Os cinco Narradores estrearam em 10/11 com quatro vozes criadas no Voice design do Gemini. Nos jogos elas soaram como uma voz só: o tom médio das três masculinas ficou na mesma faixa da Lumi (o Beto Bola), e todas recebiam o mesmo estilo curto.

Decisão: a Lumi, que era do Beto Bola, passa para o Zé da Várzea, e os outros quatro usam vozes prontas da biblioteca pt-BR do Gemini, escolhidas de ouvido pelo dono em prévias com a mesma fala:

- Zé da Várzea: `Lumi`
- Seu Dito: `pt-br-storyteller-10`
- Tiago Turbo: `pt-br-techagent-4`
- Beto Bola: `pt-br-assistant-9`
- Rita Rádio: `pt-br-training-7`

Cada um dos quatro da biblioteca ganha também um **jeito**: uma frase curta sobre ritmo e postura ("fala pausada e solene", "fala muito rápida e elétrica"), que vai no estilo do pedido antes da emoção do momento.

## Regras

- O jeito é opcional. Sem jeito (o Zé da Várzea), o estilo e o cache de falas são os de sempre.
- O jeito entra na chave do cache de falas, então trocar o jeito regrava as falas daquele Narrador.
- A grafia "Varzêão" só é usada para vozes do Voice design (`voice_...`); as vozes da biblioteca leem "Varzeão" como se escreve.
- O sorteio do Narrador pela semente não muda, e vale só para Partidas ainda não gravadas. Reels e Ao Vivo já publicados ficam com a voz antiga.

## Considered Options

- **Recriar as vozes no Voice design com descrições mais opostas:** rejeitado; foi o que gerou vozes parecidas, e a biblioteca informa tom e gênero de cada voz.
- **Mudar tom e velocidade no ffmpeg:** rejeitado; não gasta cota, mas soa artificial.

## Consequences

- As falas dos quatro Narradores são regravadas na primeira Partida de cada um (o cache antigo é da voz antiga), o que gasta mais pedidos da cota nesse dia.
- `scripts/catalogo.ts` lista as vozes pt-BR da biblioteca, e a prévia do workflow "narradores" grava candidatas com a mesma fala.
