/**
 * Temporada 2 (ADR-0019): Clima da Partida e segundo uniforme. Só visual: nenhum dos dois
 * decide lance. Valem só para Partidas com as regras da T2 (as que guardam a Postura).
 */
import { IDENTIDADE, type TimeId } from '@liga/shared';
import type { Lado, ResultadoPartida } from '@liga/sim';

export type Clima = 'SOL' | 'NUBLADO' | 'CHUVA' | 'LAMA';

/**
 * A Partida segue as regras da Temporada 2? Só elas guardam a Postura no resultado. O número
 * da versão não serve: as regras da T1 também sobem de versão (ADR-0027).
 */
export const ehT2 = (r: Pick<ResultadoPartida, 'postura'>): boolean => r.postura != null;

/** Clima sorteado pela semente da Partida (sorteio próprio, não mexe em nada do jogo). */
export function climaDaPartida(seed: number): Clima {
  let h = (seed ^ 0x7f4a7c15) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  const x = ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
  return x < 0.42 ? 'SOL' : x < 0.66 ? 'NUBLADO' : x < 0.86 ? 'CHUVA' : 'LAMA';
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distancia = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!));
const claro = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 150;
};

/** Quando as camisas se confundem, o visitante joga com o segundo uniforme. */
export function quemUsaSegundoUniforme(times: Record<Lado, TimeId>): Lado | null {
  return distancia(IDENTIDADE[times.mandante].primaria, IDENTIDADE[times.visitante].primaria) < 75 ? 'visitante' : null;
}

/** Segundo uniforme: camisa clara com detalhe na cor do Time (escura, se o rival já é claro). */
export function segundoUniforme(time: TimeId, rival: TimeId): { camisa: string; detalhe: string; calcao: string; meiao: string } {
  const id = IDENTIDADE[time];
  const base = claro(IDENTIDADE[rival].primaria) ? '#2A2D36' : '#F2EFE6';
  return { camisa: base, detalhe: id.primaria, calcao: id.primaria, meiao: base };
}
