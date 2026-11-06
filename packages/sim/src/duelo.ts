import { PARAMETROS } from './parametros.js';
import type { Rng } from './rng.js';

/**
 * Probabilidade de quem ataca vencer um Duelo: curva logística sobre a diferença
 * de OVR, puxada para 50% pelo peso da sorte.
 */
export function probabilidadeDuelo(ovrAtaque: number, ovrDefesa: number): number {
  const logistica = 1 / (1 + Math.exp(-(ovrAtaque - ovrDefesa) / PARAMETROS.escalaDuelo));
  return 0.5 + (logistica - 0.5) * PARAMETROS.pesoOvr;
}

/** Resolve um Duelo: true se quem ataca vence. */
export function duelo(rng: Rng, ovrAtaque: number, ovrDefesa: number): boolean {
  return rng.chance(probabilidadeDuelo(ovrAtaque, ovrDefesa));
}
