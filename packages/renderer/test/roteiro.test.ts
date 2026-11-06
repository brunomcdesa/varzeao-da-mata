import { describe, expect, it } from 'vitest';
import type { Escalacao, Posicao, TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { DURACAO_JOGO, Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr })),
});

function timeline(seed: number, a = 72, b = 68) {
  const escalacoes = { mandante: esc('CAP', a), visitante: esc('ONC', b) };
  return new Timeline(simularPartida({ ...escalacoes, seed, fase: 'LIGA' }), escalacoes);
}

describe('Roteiro', () => {
  it('mostra todos os gols da Partida, mesmo acima do teto de duração', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const tl = timeline(seed, 85, 55);
      const roteiro = new Roteiro(tl, { duracaoMaxima: 20 });
      const golsNoVideo = roteiro.segmentos.filter((s) => s.tipo === 'LANCE' && tl.resultado.lances[s.lance!]!.tipo === 'GOL');
      expect(golsNoVideo.length).toBe(tl.resultado.gols.mandante + tl.resultado.gols.visitante);
    }
  });

  it('respeita o teto quando há lances sobrando para cortar', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const tl = timeline(seed);
      const roteiro = new Roteiro(tl, { duracaoMaxima: 60 });
      const gols = tl.resultado.gols.mandante + tl.resultado.gols.visitante;
      expect(roteiro.duracao).toBeLessThanOrEqual(Math.max(60, 3 + 4 + gols * 8));
    }
  });

  it('fica entre 3 s e 15 min (limites do Reels) e com segmentos contíguos', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const roteiro = new Roteiro(timeline(seed));
      expect(roteiro.duracao).toBeGreaterThanOrEqual(3);
      expect(roteiro.duracao).toBeLessThanOrEqual(15 * 60);
      roteiro.segmentos.forEach((s, i) => {
        expect(s.fim).toBeGreaterThan(s.inicio);
        if (i > 0) expect(s.inicio).toBe(roteiro.segmentos[i - 1]!.fim);
      });
      expect(roteiro.segmentos[0]!.tipo).toBe('ABERTURA');
      expect(roteiro.segmentos.at(-1)!.tipo).toBe('FIM');
    }
  });

  it('o placar no fim do vídeo é o placar final, e o de cada gol aparece no seu lance', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const tl = timeline(seed);
      const roteiro = new Roteiro(tl);
      const fim = roteiro.quadroEm(roteiro.duracao);
      expect(tl.estado(fim.tJogo).placar).toEqual(tl.resultado.gols);
      for (const s of roteiro.segmentos.filter((x) => x.tipo === 'LANCE')) {
        const antes = tl.estado(roteiro.quadroEm(s.inicio + 0.01).tJogo).placar;
        const depois = tl.estado(roteiro.quadroEm(s.fim - 0.01).tJogo).placar;
        const fezGol = tl.resultado.lances[s.lance!]!.tipo === 'GOL';
        const diff = depois.mandante + depois.visitante - (antes.mandante + antes.visitante);
        expect(diff).toBe(fezGol ? 1 : 0);
      }
    }
  });

  it('tempo de jogo nunca volta dentro de um segmento e fica em [0, 90 min]', () => {
    const roteiro = new Roteiro(timeline(3));
    let anterior = { seg: -1, t: -1 };
    for (let tv = 0; tv <= roteiro.duracao; tv += 1 / 30) {
      const q = roteiro.quadroEm(tv);
      const seg = roteiro.segmentos.indexOf(q.segmento);
      expect(q.tJogo).toBeGreaterThanOrEqual(0);
      expect(q.tJogo).toBeLessThanOrEqual(DURACAO_JOGO);
      if (seg === anterior.seg) expect(q.tJogo).toBeGreaterThanOrEqual(anterior.t);
      anterior = { seg, t: q.tJogo };
    }
  });

  it('escurece só perto dos cortes', () => {
    const roteiro = new Roteiro(timeline(3));
    expect(roteiro.quadroEm(0).escurecer).toBe(0);
    expect(roteiro.quadroEm(roteiro.duracao).escurecer).toBe(0);
    const corte = roteiro.segmentos[1]!.inicio;
    expect(roteiro.quadroEm(corte).escurecer).toBeCloseTo(1, 5);
    expect(roteiro.quadroEm(corte + 1).escurecer).toBe(0);
  });
});
