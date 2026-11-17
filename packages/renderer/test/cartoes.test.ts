import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { Roteiro } from '../src/roteiro.js';
import { Timeline } from '../src/timeline.js';
import { momentoDoCartao, tempoComPausa } from '../src/video.js';

describe('destaque dos cartões (ADR-0074)', () => {
  const comCartao = Array.from({ length: 40 }, (_, i) => i + 1)
    .map((seed) => {
      const p = partidaDeTeste(seed, 'CAP', 'ONC', undefined, 'LIGA', true);
      return { seed, tl: new Timeline(p.resultado, p.escalacoes) };
    })
    .filter(({ tl }) => tl.resultado.lances.some((l) => l.falta?.cartao));

  it('há partidas de teste com cartão', () => expect(comCartao.length).toBeGreaterThan(5));

  it('cada falta com cartão vira um cartão na Partida, de quem fez a falta', () => {
    for (const { seed, tl } of comCartao) {
      const faltas = tl.janelas.filter((j) => j.lance.falta?.cartao);
      expect(tl.cartoes.length, `seed ${seed}`).toBe(faltas.length);
      faltas.forEach((j, k) => {
        const c = tl.cartoes[k]!;
        expect(c.lado).toBe(j.lance.falta!.autor.lado);
        expect(c.cartao).toBe(j.lance.falta!.cartao);
        expect(c.ocupante).toBe(tl.ocupanteEm(j.lance.falta!.autor, j.resolucao));
        expect(c.t).toBeGreaterThan(j.resolucao);
      });
    }
  });

  it('o placar e o @ só mostram o cartão depois que o juiz levanta', () => {
    for (const { tl } of comCartao) {
      for (const c of tl.cartoes) {
        expect(tl.estado(c.t - 0.5).cartoes ?? []).not.toContainEqual(c);
        expect(tl.estado(c.t + 0.5).cartoes).toContainEqual(c);
        expect(tl.estado(5399).cartoes).toContainEqual(c);
      }
    }
  });

  it('no Reels, o lance quase para no cartão e chega ao fim do trecho no instante de sempre', () => {
    let momentos = 0;
    for (const { seed, tl } of comCartao) {
      const r = new Roteiro(tl, { duracaoMaxima: 400 });
      for (const s of r.segmentos) {
        const m = momentoDoCartao(r, s);
        const lance = s.tipo === 'LANCE' ? tl.resultado.lances[s.lance!]! : null;
        if (!m) continue;
        momentos++;
        expect(lance?.falta?.cartao, `seed ${seed}`).toBeDefined();
        expect(m.inicio).toBeGreaterThanOrEqual(s.resolucao!);
        expect(m.fim).toBeLessThanOrEqual(s.fim);
        let antes = -Infinity;
        for (let t = s.inicio; t <= s.fim + 1e-9; t += 1 / 30) {
          const tj = tempoComPausa(s, m, t, r.quadroEm(Math.min(t, s.fim - 1e-9)).tJogo);
          expect(tj, `seed ${seed} t ${t.toFixed(2)}`).toBeGreaterThanOrEqual(antes - 1e-6);
          antes = tj;
        }
        // Contínuo nas bordas da pausa e no fim do trecho.
        const q = (t: number) => tempoComPausa(s, m, t, r.quadroEm(t).tJogo);
        expect(Math.abs(q(m.inicio) - q(m.inicio - 1e-4))).toBeLessThan(0.1);
        expect(Math.abs(q(m.fim) - q(m.fim - 1e-4))).toBeLessThan(0.1);
        expect(q(s.fim - 1e-6)).toBeCloseTo(s.jogoFim!, 1);
        // Durante a pausa, o juiz está com o cartão no ar.
        expect(tl.estado(q((m.inicio + m.fim) / 2)).juiz?.acao).toBe('CARTAO');
      }
    }
    expect(momentos).toBeGreaterThan(0);
  });
});
