import { describe, expect, it } from 'vitest';
import type { JogadorPublico } from '@liga/shared';
import { pontosDoOvr, variacaoDoOvr } from '../src/pontosDoOvr.js';

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

describe('OVR à mão no gráfico (ADR-0079)', () => {
  it('o ajuste entra como degrau depois do jogo em que foi feito, e o gráfico continua inteiro', () => {
    const j = { ovrInicial: 60, historico: [jogo(2, 61), jogo(2, 62), jogo(2, 81)], degraus: [{ jogo: 2, ovr: 80 }] };
    expect(pontosDoOvr(j).map((p) => [p.tipo, p.v])).toEqual([['ESTREIA', 60], ['JOGO', 61], ['JOGO', 62], ['DEGRAU', 80], ['JOGO', 81]]);
  });
  it('ajuste antes da estreia fica logo depois dela; o Piso vem antes do ajuste no mesmo jogo', () => {
    expect(pontosDoOvr({ ovrInicial: 62, historico: [], degraus: [{ jogo: 0, ovr: 75 }] }).map((p) => p.tipo)).toEqual(['ESTREIA', 'DEGRAU']);
    const j = { ovrInicial: 60, historico: [jogo(1, 61)], pisoT1: { antes: 61, depois: 65 }, degraus: [{ jogo: 1, ovr: 70 }] };
    expect(pontosDoOvr(j).map((p) => p.tipo)).toEqual(['ESTREIA', 'JOGO', 'PISO', 'DEGRAU']);
  });
});

describe('variação do OVR no card (ADR-0079)', () => {
  it('sem ajuste, conta desde a estreia; com ajuste, desde o ajuste e sem revelá-lo', () => {
    expect(variacaoDoOvr({ ovr: 66, ovrInicial: 62 })).toEqual({ delta: 4, desde: 'desde a estreia' });
    expect(variacaoDoOvr({ ovr: 79, ovrInicial: 62, base: { ovr: 80, habilidades: {} as never } })).toEqual({ delta: -1, desde: 'nos últimos jogos' });
  });
});
