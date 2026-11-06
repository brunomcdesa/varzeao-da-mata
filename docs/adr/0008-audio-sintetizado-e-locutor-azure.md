# Áudio sintetizado em código e Locutor no Azure Speech

> A voz do Locutor mudou para o Gemini TTS no ADR-0009. O resto deste registro continua valendo.

O áudio do Reels é montado em três camadas, todas determinísticas:

1. **Locutor da Liga**: Azure Speech (REST) com voz neural pt-BR, por padrão `pt-BR-AntonioNeural`. A narração sai de templates por estilo de jogada e tipo de lance (`src/narracao.ts`), com os bordões dos Times e o nome dos Clássicos. Os Jogadores são citados pela posição e pelo Time, nunca pelo @. A empolgação vem da `prosody` (velocidade e tom), que funciona em qualquer voz. Um estilo (`AZURE_SPEECH_STYLE`) só é aplicado se a voz aceitar.
2. **Trilha chiptune**: gerada em código (C, Am, F, G a 128 BPM, com baixo triangular, arpejo de onda quadrada e bateria de ruído). O tema completo toca nas cartelas, e durante os lances só fica a base.
3. **Efeitos**: torcida ambiente, explosão no gol, "uuuh" na defesa e no chute para fora, apito inicial e final, e o som de cada passe e chute. São sintetizados a partir dos eventos do Roteiro.

A trilha e a torcida abaixam sozinhas quando o Locutor fala. Nenhuma fala é acelerada nem cortada. As falas são sintetizadas antes do vídeo, e cada trecho do Roteiro estica até a sua narração caber inteira (`exigenciasDaNarracao`). O vídeo fica alguns segundos mais longo, mas sem frase pela metade.

Escolhemos o Azure pela qualidade da voz. O plano gratuito (500 mil caracteres por mês) cobre com folga uns 5 Reels por dia. Cada frase sintetizada fica em cache, e frases repetidas não gastam cota. A trilha e os efeitos sintetizados evitam qualquer questão de direitos autorais (ADR-0003).

## Consequences

- Sem chave do Azure, o gravador usa o espeak-ng como voz de teste (robótica), se estiver instalado. Sem ele, o vídeo sai sem voz. O resto do pipeline não muda.
- O cache `.cache/locutor` deve ser preservado entre execuções no Actions (actions/cache) para economizar cota.
- Trocar a voz ou o texto das frases invalida o cache dessas frases.
