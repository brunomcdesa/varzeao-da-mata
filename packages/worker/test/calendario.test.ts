import { describe, expect, it } from 'vitest';
import { TIMES } from '@liga/shared';
import { apitoInicial, faseDeLiga } from '../src/calendario.js';

describe('Fase de Liga', () => {
  it.each([1, 7, 42, 2026])('seed %i: turno único, todos jogam toda Rodada, mandos equilibrados', (seed) => {
    const rodadas = faseDeLiga(seed);
    expect(rodadas).toHaveLength(7);
    const pares = new Set<string>();
    const emCasa = new Map<string, number>(TIMES.map((t) => [t, 0]));
    for (const jogos of rodadas) {
      expect(jogos).toHaveLength(4);
      const doDia = jogos.flatMap((j) => [j.mandante, j.visitante]);
      expect(new Set(doDia).size).toBe(8);
      for (const j of jogos) {
        pares.add([j.mandante, j.visitante].sort().join('-'));
        emCasa.set(j.mandante, emCasa.get(j.mandante)! + 1);
      }
    }
    expect(pares.size).toBe(28); // C(8,2): cada par uma vez
    for (const n of emCasa.values()) expect([3, 4]).toContain(n);
  });

  it('é a mesma para o mesmo seed e muda com outro', () => {
    expect(faseDeLiga(5)).toEqual(faseDeLiga(5));
    expect(faseDeLiga(5)).not.toEqual(faseDeLiga(6));
  });

  it('Apito Inicial em horário de Brasília (UTC−3)', () => {
    expect(apitoInicial('2026-11-07', 12).toISOString()).toBe('2026-11-07T15:00:00.000Z');
    expect(apitoInicial('2026-11-07', 18).toISOString()).toBe('2026-11-07T21:00:00.000Z');
  });
});
