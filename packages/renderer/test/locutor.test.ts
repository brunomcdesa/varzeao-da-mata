import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lerWavMono } from '../src/audio.js';
import { criarLocutor } from '../scripts/locutor.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Locutor com Gemini', () => {
  it('cota do dia esgotada: o vídeo inteiro sai com a voz reserva', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'chave-de-teste');
    vi.stubEnv('GEMINI_TTS_RPM', '10000');
    vi.stubEnv('LOCUTOR_RESERVA', 'mudo');
    vi.stubEnv('LOCUTOR', '');
    let pedidos = 0;
    vi.stubGlobal('fetch', async () => {
      pedidos++;
      return new Response(JSON.stringify({ error: { message: 'limit: 10 requests per day on Free Tier. Please retry in 11h15m6s' } }), { status: 429 });
    });
    const locutor = criarLocutor(mkdtempSync(join(tmpdir(), 'locutor-')), 'gemini');
    const falas = [
      { texto: 'O meia vai pela ponta... cruzou!', tom: 'normal' as const },
      { texto: 'Gooool da Onça!', tom: 'grito' as const },
    ];
    const wavs = await locutor.falarTodas(falas);
    expect(wavs).toHaveLength(2);
    expect(wavs.every((w) => lerWavMono(w).amostras.length > 0)).toBe(true);
    expect(pedidos).toBe(2); // um no modelo principal e um no lite, sem insistir
  });

  it('cota do modelo principal esgotada: usa o modelo lite com a mesma voz', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'chave-de-teste');
    vi.stubEnv('GEMINI_TTS_RPM', '10000');
    vi.stubEnv('LOCUTOR_RESERVA', 'mudo');
    vi.stubEnv('LOCUTOR', '');
    const modelos: string[] = [];
    vi.stubGlobal('fetch', async (_: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body) as { model: string };
      modelos.push(corpo.model);
      if (corpo.model !== 'gemini-3.8-flash-lite-tts') {
        return new Response(JSON.stringify({ error: { message: 'limit: 100 requests per day on Tier 1. Please retry in 12h46m9s' } }), { status: 429 });
      }
      throw new Error('lite chamado');
    });
    const locutor = criarLocutor(mkdtempSync(join(tmpdir(), 'locutor-')), 'gemini');
    await expect(locutor.falarTodas([{ texto: 'Bola rolando!', tom: 'normal' }])).rejects.toThrow('lite chamado');
    expect(modelos).toEqual(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  });
});
