/**
 * Copa A+B (ADR-0088): Mata-mata com os 16 Times das duas Séries, nos 3 últimos dias da
 * Pré-temporada, a partir da T3. As oitavas são os 8 segundos Clássicos (Oitavas de Clássico).
 *
 * No banco, a Copa usa Rodadas do Mata-mata com números próprios (101 a 103), para não se
 * misturar com a Fase de Liga (1 a 7) nem com as Semifinais (8) e a Final (9) das Séries. A
 * etapa de cada Partida fica nela mesma (`partida.copa_etapa`), porque Quartas e Semifinais
 * caem no mesmo dia.
 */
import type { TimeId } from './index.js';
import { PRIMEIRA_TEMPORADA_COM_REGRAS_T3 } from './temporada3.js';

export const PRIMEIRA_TEMPORADA_COM_COPA = PRIMEIRA_TEMPORADA_COM_REGRAS_T3;
export function temCopa(numeroDaTemporada: number): boolean {
  return numeroDaTemporada >= PRIMEIRA_TEMPORADA_COM_COPA;
}

export const ETAPAS_DA_COPA = ['OITAVAS', 'QUARTAS', 'SEMIFINAL', 'FINAL'] as const;
export type EtapaDaCopa = (typeof ETAPAS_DA_COPA)[number];

/** As Rodadas da Copa: dia 1 as Oitavas, dia 2 Quartas e Semifinais, dia 3 a Final. */
export const RODADA_DA_COPA = { OITAVAS: 101, QUARTAS_E_SEMIS: 102, FINAL: 103 } as const;
export const RODADA_DA_ETAPA: Record<EtapaDaCopa, number> = {
  OITAVAS: RODADA_DA_COPA.OITAVAS,
  QUARTAS: RODADA_DA_COPA.QUARTAS_E_SEMIS,
  SEMIFINAL: RODADA_DA_COPA.QUARTAS_E_SEMIS,
  FINAL: RODADA_DA_COPA.FINAL,
};
export const ehRodadaDaCopa = (numero: number): boolean => numero >= RODADA_DA_COPA.OITAVAS;

/** Dias da Copa: a Fase de Liga começa no dia seguinte à Final da Copa. */
export const DIAS_DA_COPA = 3;

/** Horários (Brasília) de cada etapa, na ordem da chave. */
export const HORARIOS_DA_COPA: Record<EtapaDaCopa, readonly number[]> = {
  OITAVAS: [11, 12, 13, 14, 15, 16, 17, 18],
  QUARTAS: [11, 12, 13, 14],
  SEMIFINAL: [16, 17],
  FINAL: [18],
};

/**
 * Oitavas de Clássico: os 8 segundos Clássicos (ADR-0066), na ordem da chave. Escritos aqui (e
 * conferidos contra CLASSICOS num teste) para este módulo não depender do index na carga.
 */
export const OITAVAS_DE_CLASSICO: ReadonlyArray<readonly [TimeId, TimeId]> = [
  ['ONC', 'LEA'],
  ['CAP', 'SUC'],
  ['TAT', 'JAC'],
  ['TAM', 'LOB'],
  ['PRE', 'TAR'],
  ['ARA', 'BOT'],
  ['SAG', 'BES'],
  ['TUC', 'COR'],
];

/** "Oitavas de Clássico", "Quartas de final", "Semifinal", "Final" (uma Partida da Copa). */
export const NOME_DA_ETAPA_DA_COPA: Record<EtapaDaCopa, string> = {
  OITAVAS: 'Oitavas de Clássico',
  QUARTAS: 'Quartas de final',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
};

/** O dia inteiro da Copa, para o calendário e o Resumo. */
export function nomeDaRodadaDaCopa(numero: number): string {
  if (numero === RODADA_DA_COPA.OITAVAS) return 'Copa: Oitavas de Clássico';
  if (numero === RODADA_DA_COPA.QUARTAS_E_SEMIS) return 'Copa: Quartas e Semifinais';
  return 'Copa: Final';
}

/**
 * Quem manda o jogo da Copa: o Time da Série A; entre Times da mesma Série, o primeiro da chave
 * (nas Oitavas, o fundador do Clássico).
 */
export function mandanteDaCopa(a: TimeId, b: TimeId, serieDe: (t: TimeId) => 'A' | 'B'): readonly [TimeId, TimeId] {
  return serieDe(b) === 'A' && serieDe(a) === 'B' ? [b, a] : [a, b];
}

/**
 * A próxima etapa a partir dos vencedores da anterior, na ordem da chave: 1º × 2º, 3º × 4º...
 * (a chave é fixa desde as Oitavas, então já dá para mostrá-la inteira).
 */
export function proximaEtapa(vencedores: readonly TimeId[]): (readonly [TimeId, TimeId])[] {
  const jogos: (readonly [TimeId, TimeId])[] = [];
  for (let i = 0; i + 1 < vencedores.length; i += 2) jogos.push([vencedores[i]!, vencedores[i + 1]!]);
  return jogos;
}

export const ETAPA_SEGUINTE: Partial<Record<EtapaDaCopa, EtapaDaCopa>> = { OITAVAS: 'QUARTAS', QUARTAS: 'SEMIFINAL', SEMIFINAL: 'FINAL' };
