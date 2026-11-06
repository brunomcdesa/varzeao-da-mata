import { describe, expect, it, vi } from 'vitest';
import { codificarWav, lerWavMono } from '../src/audio.js';
import { ESTILO, dividirPorSilencio, falarLoteGemini, esperaPedida, extrairAudio, para48k, pedidoGemini } from '../scripts/gemini.js';

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

  it('lê quanto tempo a API pediu para esperar', () => {
    expect(esperaPedida('Rate limit exceeded ... Please retry in 19s or upgrade')).toBe(19);
    expect(esperaPedida('Please retry in 2.5s')).toBe(2.5);
    expect(esperaPedida('erro qualquer')).toBeNull();
  });
});

describe('Lote de falas', () => {
  const tom = (seg: number, f = 220) => new Float32Array(Math.floor(seg * 48000)).map((_, i) => Math.sin((2 * Math.PI * f * i) / 48000) * 0.5);
  const silencio = (seg: number) => new Float32Array(Math.floor(seg * 48000));
  const juntar = (...partes: Float32Array[]) => {
    const total = new Float32Array(partes.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of partes) {
      total.set(p, o);
      o += p.length;
    }
    return total;
  };

  it('divide nas pausas longas e ignora pausas curtas dentro da fala', () => {
    const audio = juntar(silencio(0.2), tom(1.0), silencio(0.15), tom(0.5), silencio(0.9), tom(2.0), silencio(1.0), tom(0.8), silencio(0.3));
    const pedacos = dividirPorSilencio(audio, 3)!;
    expect(pedacos).toHaveLength(3);
    const dur = pedacos.map((p) => p.length / 48000);
    expect(dur[0]).toBeGreaterThan(1.6); // 1,0 + 0,15 + 0,5 com respiros
    expect(dur[0]).toBeLessThan(1.9);
    expect(dur[1]).toBeCloseTo(2.1, 1);
    expect(dur[2]).toBeCloseTo(0.9, 1);
  });

  it('desiste quando não há pausas suficientes', () => {
    const audio = juntar(tom(1.0), silencio(0.1), tom(1.0));
    expect(dividirPorSilencio(audio, 2)).toBeNull();
  });
});

describe('Lote com a API simulada', () => {
  it('pede 3 falas num pedido só e devolve as 3 separadas', async () => {
    // Áudio de 24 kHz como o Gemini devolve: três "falas" separadas por pausas longas.
    const taxa = 24000;
    const trechos = [1.2, 0.8, 1.6];
    const partes: number[] = [];
    trechos.forEach((d, k) => {
      for (let i = 0; i < d * taxa; i++) partes.push(Math.sin((2 * Math.PI * 200 * i) / taxa) * 0.5);
      if (k < trechos.length - 1) for (let i = 0; i < 1.0 * taxa; i++) partes.push(0);
    });
    const s = Float32Array.from(partes);
    const wav = codificarWav(s, s);
    const v = new DataView(wav.buffer);
    v.setUint32(24, taxa, true);
    v.setUint32(28, taxa * 4, true);

    const pedidos: any[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      pedidos.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: Buffer.from(wav).toString('base64') }] }] }));
    });
    try {
      const textos = ['Que defesa do goleiro da Onça!', 'Pra fora!', 'Espalmou o goleiro da Capivara, que defesa!'];
      const out = await falarLoteGemini(textos, 'animado', 'k', 'Lumi', 'gemini-3.8-flash-tts');
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0].input[0].content[0].text).toContain('<long pause>');
      expect(out).not.toBeNull();
      const dur = out!.map((w) => lerWavMono(w).amostras.length / 48000);
      dur.forEach((d, i) => {
        expect(d).toBeGreaterThanOrEqual(trechos[i]!);
        expect(d).toBeLessThanOrEqual(trechos[i]! + 0.12);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
