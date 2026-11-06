# Locutor no Gemini TTS, com estilo por tom da fala

O Locutor da Liga passa a usar o Gemini TTS (`gemini-3.8-flash-tts`) com a voz Lumi, escolhida pelo ouvido no AI Studio. Isso substitui o Azure Speech do ADR-0008.

As vozes pt-BR do Azure não têm estilos de emoção, e as vozes HD do Azure, que têm, não estão disponíveis em português. Com elas, o grito de gol soava sem emoção. O Gemini recebe, separado do texto lido, uma descrição de como falar (`speech_metadata.style`). Usamos três estilos, um por tom da fala: normal (acompanhando a jogada), animado (reação ao lance) e grito (gol a plenos pulmões, esticando a vogal).

A troca ficou contida em `scripts/locutor.ts` e `scripts/gemini.ts`. O resto do pipeline (narração, roteiro esticado para as falas caberem, mixagem) não mudou. O Azure continua disponível como alternativa, assim como o espeak-ng para testes.

## Consequences

- Chave em `GEMINI_API_KEY` (Google AI Studio). O modelo cobra por tokens de áudio gerados, e o cache de frases evita pagar duas vezes pela mesma fala.
- A API devolve WAV 24 kHz, que é convertido para 48 kHz antes da mixagem.
- "Lumi" não está entre as 30 vozes prontas da documentação, então deve vir da biblioteca estendida. `pnpm vozes --gemini <nome>` mostra o identificador exato para pôr em `GEMINI_TTS_VOZ`.
- Os textos de estilo ficam em `ESTILO` (`scripts/gemini.ts`). Mudar um deles invalida o cache das falas daquele tom.
