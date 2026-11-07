/**
 * Habilidades (ADR-0010): cinco notas de 1 a 99 que decidem os Duelos. O OVR é a média
 * delas com os pesos da Posição.
 */
import type { Posicao } from './index.js';

export const HABILIDADES = ['FIN', 'PAS', 'DRI', 'DEF', 'GOL'] as const;
export type HabilidadeId = (typeof HABILIDADES)[number];
export type Habilidades = Record<HabilidadeId, number>;

export const NOME_DA_HABILIDADE: Record<HabilidadeId, string> = {
  FIN: 'Finalização',
  PAS: 'Passe',
  DRI: 'Drible',
  DEF: 'Defesa',
  GOL: 'Goleiro',
};

export const HABILIDADE_MIN = 1;
export const HABILIDADE_MAX = 99;

/** Pesos de cada Habilidade no OVR, por Posição (somam 1). */
export const PESOS_OVR: Readonly<Record<Posicao, Readonly<Partial<Record<HabilidadeId, number>>>>> = {
  ATA: { FIN: 0.55, DRI: 0.25, PAS: 0.15, DEF: 0.05 },
  MEI: { PAS: 0.45, DRI: 0.2, DEF: 0.2, FIN: 0.15 },
  ZAG: { DEF: 0.75, PAS: 0.15, DRI: 0.05, FIN: 0.05 },
  GOL: { GOL: 0.9, PAS: 0.1 },
};

/** A Habilidade principal de cada Posição (a de maior peso). */
export const PRINCIPAL: Readonly<Record<Posicao, HabilidadeId>> = { ATA: 'FIN', MEI: 'PAS', ZAG: 'DEF', GOL: 'GOL' };

/** OVR exato (sem arredondar) a partir das Habilidades. */
export function ovrExato(posicao: Posicao, h: Habilidades): number {
  let soma = 0;
  for (const [hab, peso] of Object.entries(PESOS_OVR[posicao]) as [HabilidadeId, number][]) soma += h[hab] * peso;
  return soma;
}

export function ovrDasHabilidades(posicao: Posicao, h: Habilidades): number {
  return Math.round(ovrExato(posicao, h));
}

/**
 * Perfil da Posição: quanto cada Habilidade fica acima ou abaixo do OVR num Jogador típico.
 * As que não pesam no OVR (ex.: Goleiro de um atacante) ficam bem baixas.
 */
export const PERFIL: Readonly<Record<Posicao, Habilidades>> = {
  ATA: { FIN: 4, DRI: 0, PAS: -6, DEF: -18, GOL: -35 },
  MEI: { PAS: 4, DRI: 0, DEF: -4, FIN: -6, GOL: -35 },
  ZAG: { DEF: 3, PAS: -8, DRI: -14, FIN: -16, GOL: -35 },
  GOL: { GOL: 2, PAS: -14, DRI: -30, DEF: -25, FIN: -35 },
};

const limitar = (x: number) => Math.min(HABILIDADE_MAX, Math.max(HABILIDADE_MIN, x));
const umaCasa = (x: number) => Math.round(x * 10) / 10;

/**
 * Habilidades de um Jogador com esse OVR na Posição: o perfil mais uma variação (`ruido`,
 * de −1 a 1 por Habilidade), com a principal ajustada para o OVR calculado dar exatamente `ovr`.
 */
export function habilidadesDoPerfil(posicao: Posicao, ovr: number, ruido?: Partial<Habilidades>): Habilidades {
  const h = {} as Habilidades;
  for (const hab of HABILIDADES) h[hab] = limitar(umaCasa(ovr + PERFIL[posicao][hab] + (ruido?.[hab] ?? 0) * 3));
  const principal = PRINCIPAL[posicao];
  const peso = PESOS_OVR[posicao][principal]!;
  for (let i = 0; i < 4; i++) {
    const falta = ovr - ovrExato(posicao, h);
    if (Math.abs(falta) < 0.05) break;
    h[principal] = limitar(umaCasa(h[principal] + falta / peso));
  }
  return h;
}
