import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { Roteiro } from '../src/roteiro.js';
import { Timeline } from '../src/timeline.js';
import { ZOOM_DO_REELS, daCamera } from '../src/video.js';
import { COLUNAS, LINHAS } from '../src/pixel.js';

describe('câmera do Reels (ADR-0072)', () => {
  const casos = [3, 8, 42].map((seed) => {
    const p = partidaDeTeste(seed, 'CAP', 'ONC', undefined, 'LIGA', true);
    const tl = new Timeline(p.resultado, p.escalacoes);
    return { seed, tl, roteiro: new Roteiro(tl) };
  });
  const quadros = function* () {
    for (const c of casos)
      for (const s of c.roteiro.segmentos) {
        if (s.tipo !== 'LANCE') continue;
        for (let t = s.inicio + 0.05; t < s.fim; t += 0.25) {
          const q = c.roteiro.quadroEm(t);
          yield { ...c, s, t, q, cam: daCamera(c.roteiro, q, t, c.tl.estado(q.tJogo)) };
        }
      }
  };

  it('fica dentro do cenário, com o zoom que não borra o pixel', () => {
    for (const { cam } of quadros()) {
      const c = cam.camera!;
      expect(c.zoom).toBe(ZOOM_DO_REELS);
      expect(c.cx - COLUNAS / 2 / c.zoom).toBeGreaterThanOrEqual(-1e-9);
      expect(c.cx + COLUNAS / 2 / c.zoom).toBeLessThanOrEqual(COLUNAS + 1e-9);
      expect(c.cy - LINHAS / 2 / c.zoom).toBeGreaterThanOrEqual(-1e-9);
      expect(c.cy + LINHAS / 2 / c.zoom).toBeLessThanOrEqual(LINHAS + 1e-9);
    }
  });

  // Mesmo atrás de um chutão do goleiro (a bola cruza meio campo em 1 s), a câmera anda no
  // máximo 6 pixels lógicos por quadro: segue a bola sem pular.
  it('anda suave: de um quadro para o seguinte a câmera mexe pouco', () => {
    for (const c of casos)
      for (const s of c.roteiro.segmentos) {
        if (s.tipo !== 'LANCE') continue;
        let antes: { cx: number; cy: number } | null = null;
        for (let t = s.inicio + 0.2; t < s.fim - 0.2; t += 1 / 30) {
          const q = c.roteiro.quadroEm(t);
          const cam = daCamera(c.roteiro, q, t, c.tl.estado(q.tJogo)).camera!;
          if (antes) expect(Math.hypot(cam.cx - antes.cx, cam.cy - antes.cy), `seed ${c.seed} t ${t.toFixed(2)}`).toBeLessThan(6);
          antes = cam;
        }
      }
  });

  it('o @ aparece em quem está no lance, e o finalizador vem primeiro', () => {
    for (const { tl, s, cam } of quadros()) {
      const l = tl.resultado.lances[s.lance!]!;
      const quem = cam.rotulos!;
      expect(quem.length).toBeLessThanOrEqual(9);
      const ref = l.finalizador ?? l.criador;
      expect(quem.some((x) => x.lado === ref.lado && x.indice === ref.indice)).toBe(true);
    }
  });

  it('só o gol treme e clareia, e só logo depois da resolução', () => {
    let gols = 0;
    for (const { tl, s, t, cam } of quadros()) {
      const gol = tl.resultado.lances[s.lance!]!.tipo === 'GOL';
      const dt = t - s.resolucao!;
      if (cam.camera!.flash) {
        expect(gol).toBe(true);
        expect(dt).toBeGreaterThanOrEqual(0);
        expect(dt).toBeLessThan(0.3);
        gols++;
      }
      if (cam.camera!.tremor) expect(gol && dt >= 0 && dt < 0.5).toBe(true);
    }
    expect(gols).toBeGreaterThan(0);
  });
});
