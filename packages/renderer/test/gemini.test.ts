import { describe, expect, it } from 'vitest';
import { codificarWav, lerWavMono } from '../src/audio.js';
import { ESTILO, extrairAudio, para48k, pedidoGemini } from '../scripts/gemini.js';

describe('Gemini TTS', () => {
  it('monta o pedido com voz, estilo do tom e texto separados', () => {
    const p = pedidoGemini('Gooool da Capivara!', 'grito', 'Lumi', 'gemini-3.8-flash-tts') as any;
    expect(p.model).toBe('gemini-3.8-flash-tts');
    expect(p.generation_config.speech_config[0].voice).toBe('Lumi');
    const conteudo = p.input[0].content[0];
    expect(conteudo.text).toBe('Gooool da Capivara!');
    expect(conteudo.annotations[0]).toEqual({ type: 'speech_metadata', style: ESTILO.grito });
    expect(p.response_format.type).toBe('audio');
  });

  it('acha o áudio na resposta e converte 24 kHz para 48 kHz', () => {
    // WAV 24 kHz mono de 0,1 s (codificarWav grava a 48 kHz: ajusta o cabeçalho para 24 kHz)
    const s = new Float32Array(2400).map((_, i) => Math.sin(i / 5) * 0.5);
    const wav = codificarWav(s, s);
    const v = new DataView(wav.buffer);
    v.setUint32(24, 24000, true);
    v.setUint32(28, 24000 * 4, true);
    const resposta = {
      steps: [
        { type: 'thought' },
        { type: 'model_output', content: [{ type: 'text' }, { type: 'audio', data: Buffer.from(wav).toString('base64') }] },
      ],
    };
    const convertido = lerWavMono(para48k(extrairAudio(resposta)));
    expect(convertido.taxa).toBe(48000);
    expect(convertido.amostras.length).toBe(4800);
    expect(convertido.amostras[200]).toBeCloseTo(s[100]!, 2);
  });

  it('avisa quando a resposta não tem áudio', () => {
    expect(() => extrairAudio({ steps: [{ type: 'model_output', content: [] }] })).toThrow(/não trouxe áudio/);
  });
});
