/**
 * Voz do Locutor via Gemini TTS (API Interactions, REST, sem SDK).
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY      chave do Google AI Studio (aistudio.google.com/apikey)
 *   GEMINI_TTS_VOZ      voz (padrão Lumi; procure outras com `pnpm vozes --gemini <nome>`)
 *   GEMINI_TTS_MODELO   modelo (padrão gemini-3.8-flash-tts)
 *
 * A emoção vem do campo `style` (speech_metadata), separado do texto lido, com um estilo
 * por Tom da fala. A API devolve WAV 24 kHz mono; aqui ele vira 48 kHz, o formato da mixagem.
 */
import { codificarWav, lerWavMono } from '../src/audio.js';
import type { Tom } from '../src/narracao.js';

export const MODELO_PADRAO = 'gemini-3.8-flash-tts';
export const VOZ_PADRAO = 'Lumi';

const BASE = 'Narrador de futebol de várzea brasileiro, voz de rádio, sotaque brasileiro';
export const ESTILO: Record<Tom, string> = {
  normal: `${BASE}, animado, ritmo rápido, acompanhando a jogada com expectativa.`,
  animado: `${BASE}, muito empolgado, voz alta, reagindo ao lance com emoção.`,
  grito: `${BASE}, gritando o gol a plenos pulmões, eufórico e rouco, esticando bem a vogal de "gol" como nas rádios.`,
};

export function pedidoGemini(texto: string, tom: Tom, voz: string, modelo: string): unknown {
  return {
    model: modelo,
    input: [
      {
        type: 'user_input',
        content: [{ type: 'text', text: texto, annotations: [{ type: 'speech_metadata', style: ESTILO[tom] }] }],
      },
    ],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: voz }] },
  };
}

interface RespostaGemini {
  steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
}

/** Tira o áudio (base64) da resposta: steps[] → model_output → content[] → audio.data. */
export function extrairAudio(resposta: RespostaGemini): Uint8Array {
  for (const passo of resposta.steps ?? []) {
    if (passo.type !== 'model_output') continue;
    for (const c of passo.content ?? []) {
      if (c.type === 'audio' && c.data) return Uint8Array.from(Buffer.from(c.data, 'base64'));
    }
  }
  throw new Error('a resposta do Gemini não trouxe áudio');
}

/** Converte um WAV (qualquer taxa, 16 bits) para WAV 48 kHz mono, por interpolação linear. */
export function para48k(wav: Uint8Array): Uint8Array {
  const { amostras, taxa } = lerWavMono(wav);
  if (taxa === 48000) return codificarWav(amostras, amostras);
  const n = Math.floor((amostras.length * 48000) / taxa);
  const saida = new Float32Array(n);
  const passo = taxa / 48000;
  for (let i = 0; i < n; i++) {
    const p = i * passo;
    const k = Math.floor(p);
    const f = p - k;
    saida[i] = (amostras[k] ?? 0) * (1 - f) + (amostras[k + 1] ?? amostras[k] ?? 0) * f;
  }
  return codificarWav(saida, saida);
}

export async function falarGemini(texto: string, tom: Tom, chave: string, voz: string, modelo: string): Promise<Uint8Array> {
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify(pedidoGemini(texto, tom, voz, modelo)),
    });
    if (resp.ok) return para48k(extrairAudio((await resp.json()) as RespostaGemini));
    ultimoErro = `${resp.status} ${await resp.text()}`;
    if (resp.status !== 429 && resp.status < 500) break;
    // Limite de requisições do plano: espera e tenta de novo.
    await new Promise((ok) => setTimeout(ok, 4000 * tentativa));
  }
  throw new Error(`Gemini TTS recusou a fala "${texto}": ${ultimoErro}`);
}
