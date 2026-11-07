import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { DISPUTA_MAXIMA } from '../src/penaltis.js';
import { Roteiro } from '../src/roteiro.js';
import { DURACAO_JOGO, Timeline } from '../src/timeline.js';

function comPenaltis() {
  for (let s = 1; ; s++) {
    const p = partidaDeTeste(s, 'TUC', 'ARA', 'Final', 'MATA_MATA');
    if (p.resultado.penaltis) return p;
  }
}

describe('disputa de pênaltis', () => {
  const p = comPenaltis();
  const tl = new Timeline(p.resultado, p.escalacoes);

  it('vem depois dos 90 minutos e cabe no teto', () => {
    expect(tl.duracao).toBeGreaterThan(DURACAO_JOGO);
    expect(tl.duracao - DURACAO_JOGO).toBeLessThanOrEqual(DISPUTA_MAXIMA);
    expect(tl.estado(DURACAO_JOGO - 1).penaltis).toBeNull();
    expect(tl.estado(DURACAO_JOGO + 10).penaltis?.fase).toBe('INTRO');
  });

  it('o placar da disputa bate com a sim e o vencedor aparece no fim', () => {
    const fim = tl.estado(tl.duracao);
    expect(fim.encerrada).toBe(true);
    expect(fim.penaltis!.placar).toEqual(p.resultado.penaltis!.placar);
    expect(fim.penaltis!.vencedor).toBe(p.resultado.vencedor);
    expect(fim.penaltis!.marcas).toHaveLength(p.resultado.penaltis!.cobrancas.length);
    expect(fim.placar).toEqual(p.resultado.gols);
  });

  it('cada cobrança acontece no seu instante, com o cobrador na marca', () => {
    for (let k = 0; k < p.resultado.penaltis!.cobrancas.length; k++) {
      const antes = tl.estado(tl.instanteDaCobranca(k) - 1).penaltis!;
      const depois = tl.estado(tl.instanteDaCobranca(k) + 1).penaltis!;
      expect(depois.marcas.length).toBe(antes.marcas.length + 1);
    }
  });

  it('o Reels ganha um trecho de pênaltis antes do fim', () => {
    const r = new Roteiro(tl);
    const tipos = r.segmentos.map((s) => s.tipo);
    expect(tipos.at(-2)).toBe('PENALTIS');
    const s = r.segmentos.at(-2)!;
    expect(r.quadroEm(s.inicio + 0.01).tJogo).toBeCloseTo(DURACAO_JOGO, -1);
    expect(r.quadroEm(s.fim - 0.01).tJogo).toBeCloseTo(tl.duracao, -1);
  });
});
