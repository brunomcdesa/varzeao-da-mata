import { PARAMETROS } from './parametros.js';
import type { Rng } from './rng.js';

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Probabilidade de quem ataca vencer um Duelo de Habilidades: parte da chance `base` (a do
 * Duelo entre iguais) e anda na curva logística conforme a diferença de Habilidade.
 */
export function probabilidadeDuelo(ataque: number, defesa: number, base = 0.5): number {
  return sigmoide(logit(base) + (PARAMETROS.forcaHabilidade * (ataque - defesa)) / PARAMETROS.escalaDuelo);
}

/** Resolve um Duelo: true se quem ataca vence. */
export function duelo(rng: Rng, ataque: number, defesa: number, base = 0.5): boolean {
  return rng.chance(probabilidadeDuelo(ataque, defesa, base));
}
