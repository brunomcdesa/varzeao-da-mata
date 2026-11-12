/**
 * Casos da trava da Temporada 1: com as regras da T1 (sem `t2` na entrada), a simulação tem
 * que dar exatamente os mesmos resultados da VERSAO_SIM_T1 (ADR-0027; 12 desde o ADR-0045).
 */
import { createHash } from 'node:crypto';
import type { Fase } from '../src/tipos.js';
import { simularPartida } from '../src/partida.js';
import { escalacao } from './fabricas.js';

export const CASOS: { seed: number; a: number | number[]; b: number | number[]; fase: Fase }[] = [];
for (let i = 0; i < 60; i++) {
  const seed = 1000 + i * 7919;
  const a = i % 3 === 0 ? 70 : i % 3 === 1 ? [62, 80, 55, 74, 69, 88, 51] : 85;
  const b = i % 2 === 0 ? 70 : [77, 58, 66, 90, 45, 61, 72];
  CASOS.push({ seed, a, b, fase: i % 4 === 0 ? 'MATA_MATA' : 'LIGA' });
}

export function impressao(c: (typeof CASOS)[number]): string {
  const r = simularPartida({ mandante: escalacao('CAP', c.a), visitante: escalacao('ONC', c.b), seed: c.seed, fase: c.fase });
  return createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 16);
}
