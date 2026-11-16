import { describe, expect, it } from 'vitest';
import { etapaDa, estruturaDaLiga, timesQueCaem } from '@liga/shared';
import { horariosDaLiga } from '../src/calendario.js';

describe('Estrutura da Temporada (ADR-0062)', () => {
  it('cada número de Rodada do Mata-mata tem uma etapa só: T1 (7), T2 (15) e da T3 em diante (14, turno e returno)', () => {
    expect(estruturaDaLiga(7)).toEqual({ rodadasDaLiga: 7, rodadaDasSemifinais: 8, rodadaDaFinal: 9 });
    expect(estruturaDaLiga(15)).toEqual({ rodadasDaLiga: 15, rodadaDasSemifinais: 16, rodadaDaFinal: 17 });
    expect(estruturaDaLiga(14)).toEqual({ rodadasDaLiga: 14, rodadaDasSemifinais: 16, rodadaDaFinal: 17 });
    expect([8, 16].map((n) => etapaDa('MATA_MATA', n))).toEqual(['SEMIFINAL', 'SEMIFINAL']);
    expect([9, 17].map((n) => etapaDa('MATA_MATA', n))).toEqual(['FINAL', 'FINAL']);
  });

  it('caem 8 na A de 16 sem B (T2), 2 com Série B e nenhum na T1', () => {
    expect(timesQueCaem(16, false)).toBe(8);
    expect(timesQueCaem(8, true)).toBe(2);
    expect(timesQueCaem(8, false)).toBe(0);
  });

  it('a A de 16 sem B joga um jogo por hora, das 11h às 18h', () => {
    expect(horariosDaLiga('A', false, 8)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(horariosDaLiga('A', false, 4)).toEqual([12, 14, 16, 18]);
    expect(horariosDaLiga('A', true, 4)).toEqual([15, 16, 17, 18]);
  });
});
