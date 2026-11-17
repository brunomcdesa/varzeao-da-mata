import { describe, expect, it } from 'vitest';
import type { JogadorPublico } from '@liga/shared';
import { pontosDoOvr } from '../src/pontosDoOvr.js';

const jogo = (temporada: number, ovr: number) => ({ temporada, ovr }) as JogadorPublico['historico'][number];

describe('gráfico do OVR jogo a jogo (ADR-0078)', () => {
  it('quem subiu pelo Piso ganha o degrau logo depois do último jogo da T1', () => {
    const j = { ovrInicial: 60, historico: [jogo(1, 61), jogo(1, 62), jogo(2, 66)], pisoT1: { antes: 62, depois: 65 } };
    expect(pontosDoOvr(j).map((p) => [p.tipo, p.v])).toEqual([['ESTREIA', 60], ['JOGO', 61], ['JOGO', 62], ['PISO', 65], ['JOGO', 66]]);
  });
  it('antes da estreia na T2, o gráfico termina no OVR do Piso, igual ao do card', () => {
    const j = { ovrInicial: 60, historico: [jogo(1, 61), jogo(1, 62)], pisoT1: { antes: 62, depois: 65 } };
    expect(pontosDoOvr(j).at(-1)).toEqual({ v: 65, tipo: 'PISO', jogo: 2 });
  });
  it('sem Piso, só a estreia e os jogos', () => {
    expect(pontosDoOvr({ ovrInicial: 66, historico: [jogo(1, 67)] }).map((p) => p.tipo)).toEqual(['ESTREIA', 'JOGO']);
  });
});
