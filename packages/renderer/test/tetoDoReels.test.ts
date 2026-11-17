import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { estimarDuracao } from '../src/aoVivo.js';
import { Roteiro } from '../src/roteiro.js';
import { DURACAO_MAXIMA_DO_REELS, duracaoFinal, tetoDoReels } from '../src/tetoDoReels.js';
import { Timeline } from '../src/timeline.js';

describe('teto do Reels pelo vídeo final (ADR-0073)', () => {
  const casos = Array.from({ length: 16 }, (_, i) => {
    const seed = i + 1;
    const fase = i % 4 === 3 ? ('MATA_MATA' as const) : ('LIGA' as const);
    const p = partidaDeTeste(seed, 'CAP', 'ONC', undefined, fase, true);
    const tl = new Timeline(p.resultado, p.escalacoes);
    const narracao = { mataMata: p.mataMata ?? null };
    return { seed, p, tl, narracao, teto: tetoDoReels(tl, {}, p.apelidos, narracao) };
  });
  const dur = (texto: string) => estimarDuracao(texto) * 1.1;
  const lances = (tl: Timeline, teto: number) => new Roteiro(tl, { duracaoMaxima: teto }).segmentos.filter((s) => s.tipo === 'LANCE').length;

  it('o vídeo final, já com a narração, fica dentro do limite', () => {
    for (const { seed, p, tl, narracao, teto } of casos) {
      const final = duracaoFinal(tl, { duracaoMaxima: teto }, p.apelidos, narracao, dur);
      expect(final, `seed ${seed}`).toBeLessThanOrEqual(DURACAO_MAXIMA_DO_REELS);
    }
  });

  it('é o maior teto que cabe: 5 s a mais já passaria do limite ou não mudaria nada', () => {
    for (const { seed, p, tl, narracao, teto } of casos) {
      const mais = teto + 5;
      const passa = duracaoFinal(tl, { duracaoMaxima: mais }, p.apelidos, narracao, dur) > DURACAO_MAXIMA_DO_REELS;
      expect(passa || lances(tl, mais) === lances(tl, teto), `seed ${seed}`).toBe(true);
    }
  });

  it('entram mais lances que com o teto antigo de 75 s, e gol nunca sai', () => {
    let antes = 0;
    let agora = 0;
    for (const { seed, tl, teto } of casos) {
      antes += lances(tl, 75);
      agora += lances(tl, teto);
      const gols = tl.resultado.lances.filter((l) => l.tipo === 'GOL').length;
      const golsNoVideo = new Roteiro(tl, { duracaoMaxima: teto }).segmentos.filter((s) => s.tipo === 'LANCE' && tl.resultado.lances[s.lance!]!.tipo === 'GOL').length;
      expect(golsNoVideo, `seed ${seed}`).toBe(gols);
    }
    expect(agora).toBeGreaterThan(antes);
  });

  it('com a voz mais lenta, o teto diminui', () => {
    const { p, tl, narracao } = casos[0]!;
    const lento = tetoDoReels(tl, {}, p.apelidos, narracao, (t) => estimarDuracao(t) * 1.6);
    expect(lento).toBeLessThanOrEqual(casos[0]!.teto);
  });
});
