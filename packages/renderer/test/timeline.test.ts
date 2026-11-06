import { describe, expect, it } from 'vitest';
import type { Escalacao, Posicao, TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { DURACAO_JOGO, Timeline } from '../src/timeline.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr })),
});

function partida(seed: number) {
  const escalacoes = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
  const resultado = simularPartida({ ...escalacoes, seed, fase: 'LIGA' });
  return { resultado, timeline: new Timeline(resultado, escalacoes) };
}

describe('Timeline', () => {
  it('termina com o mesmo placar da sim', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { resultado, timeline } = partida(seed);
      expect(timeline.estado(DURACAO_JOGO).placar).toEqual(resultado.gols);
    }
  });

  it('o placar nunca diminui ao longo do jogo', () => {
    const { timeline } = partida(9);
    let anterior = 0;
    for (let t = 0; t <= DURACAO_JOGO; t += 15) {
      const { placar } = timeline.estado(t);
      const total = placar.mandante + placar.visitante;
      expect(total).toBeGreaterThanOrEqual(anterior);
      anterior = total;
    }
  });

  it('é função pura de t: pular direto para um instante dá o mesmo quadro que chegar lá', () => {
    const a = partida(5).timeline;
    const b = partida(5).timeline;
    for (let t = 0; t < DURACAO_JOGO; t += 60) b.estado(t);
    expect(a.estado(3210)).toEqual(b.estado(3210));
  });

  it('bola e Jogadores ficam dentro do campo', () => {
    const { timeline } = partida(3);
    for (let t = 0; t <= DURACAO_JOGO; t += 7) {
      const e = timeline.estado(t);
      for (const p of [e.bola, ...e.jogadores.map((j) => j.pos)]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('as janelas dos lances são contíguas e cabem nos 90 minutos', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { timeline } = partida(seed);
      let cursor = 0;
      for (const j of timeline.janelas) {
        expect(j.inicio).toBe(cursor);
        expect(j.fim).toBeGreaterThan(j.inicio);
        cursor = j.fim;
      }
      expect(cursor).toBeLessThanOrEqual(DURACAO_JOGO);
    }
  });

  it('mostra destaque de GOL no instante em que o gol sai', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { resultado, timeline } = partida(seed);
      const i = resultado.lances.findIndex((l) => l.tipo === 'GOL');
      if (i < 0) continue;
      const e = timeline.estado(timeline.instanteDoLance(i) + 1);
      expect(e.destaque?.tipo).toBe('GOL');
      return;
    }
    throw new Error('nenhum gol em 50 seeds');
  });
});
