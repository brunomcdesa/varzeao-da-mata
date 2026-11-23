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

export const ETAPAS_DA_COPA = ['OITAVAS', 'QUARTAS', 'SEMIFINAL', 'FINAL', 'CLASSICO', 'REPESCAGEM'] as const;
export type EtapaDaCopa = (typeof ETAPAS_DA_COPA)[number];

/** As Rodadas da Copa: dia 1 as Oitavas, dia 2 Quartas e Semifinais, dia 3 a Final. */
export const RODADA_DA_COPA = { OITAVAS: 101, QUARTAS_E_SEMIS: 102, FINAL: 103 } as const;
export const RODADA_DA_ETAPA: Record<EtapaDaCopa, number> = {
  OITAVAS: RODADA_DA_COPA.OITAVAS,
  QUARTAS: RODADA_DA_COPA.QUARTAS_E_SEMIS,
  SEMIFINAL: RODADA_DA_COPA.QUARTAS_E_SEMIS,
  FINAL: RODADA_DA_COPA.FINAL,
  CLASSICO: RODADA_DA_COPA.OITAVAS,
  REPESCAGEM: RODADA_DA_COPA.QUARTAS_E_SEMIS,
};

/**
 * Copa com 20 Times, depois da Expansão (ADR-0093), também em 3 dias: dia 1 a Fase do Clássico
 * (10 jogos); dia 2 a Repescagem (os 4 vencedores com pior campanha na Temporada anterior) e as
 * Quartas; dia 3 as Semifinais e a Final. Usa as mesmas Rodadas 101 a 103.
 */
export const RODADA_DA_ETAPA_DE_20: Record<EtapaDaCopa, number> = {
  ...RODADA_DA_ETAPA,
  CLASSICO: RODADA_DA_COPA.OITAVAS,
  REPESCAGEM: RODADA_DA_COPA.QUARTAS_E_SEMIS,
  QUARTAS: RODADA_DA_COPA.QUARTAS_E_SEMIS,
  SEMIFINAL: RODADA_DA_COPA.FINAL,
  FINAL: RODADA_DA_COPA.FINAL,
};
export const HORARIOS_DA_COPA_DE_20: Record<EtapaDaCopa, readonly number[]> = {
  CLASSICO: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  REPESCAGEM: [11, 12],
  QUARTAS: [14, 15, 16, 17],
  SEMIFINAL: [15, 16],
  FINAL: [18],
  OITAVAS: [],
};
/** A ordem das etapas em cada formato, e quais caem no mesmo dia da anterior. */
export const ETAPAS_DA_COPA_DE_16: readonly EtapaDaCopa[] = ['OITAVAS', 'QUARTAS', 'SEMIFINAL', 'FINAL'];
export const ETAPAS_DA_COPA_DE_20: readonly EtapaDaCopa[] = ['CLASSICO', 'REPESCAGEM', 'QUARTAS', 'SEMIFINAL', 'FINAL'];
export const MESMO_DIA_DA_ANTERIOR: Record<16 | 20, ReadonlySet<EtapaDaCopa>> = {
  16: new Set<EtapaDaCopa>(['SEMIFINAL']),
  20: new Set<EtapaDaCopa>(['QUARTAS', 'FINAL']),
};

/**
 * A Fase do Clássico (ADR-0093): as Oitavas de Clássico mais os 2 primeiros Clássicos dos
 * Times da Expansão.
 */
export const FASE_DO_CLASSICO: ReadonlyArray<readonly [TimeId, TimeId]> = [
  ['ONC', 'LEA'],
  ['CAP', 'SUC'],
  ['TAT', 'JAC'],
  ['TAM', 'LOB'],
  ['PRE', 'TAR'],
  ['ARA', 'BOT'],
  ['SAG', 'BES'],
  ['TUC', 'COR'],
  ['GAT', 'RAT'],
  ['ESC', 'ARN'],
];

/**
 * Da Fase do Clássico às Quartas (ADR-0093). `vencedores` vem ordenado da melhor para a pior
 * campanha na Temporada anterior (Time novo conta como o pior). Os 4 piores fazem a Repescagem
 * (7º × 10º e 8º × 9º); as Quartas cruzam 1º × vencedor de 7º×10º, 4º × 5º, 2º × vencedor de
 * 8º×9º e 3º × 6º, e as Semifinais seguem a chave (1º jogo × 2º, 3º × 4º).
 */
export function repescagemDaCopa(vencedores: readonly TimeId[]): (readonly [TimeId, TimeId])[] {
  if (vencedores.length !== 10) throw new Error(`A Repescagem precisa dos 10 vencedores (veio ${vencedores.length})`);
  const v = vencedores;
  return [
    [v[6]!, v[9]!],
    [v[7]!, v[8]!],
  ];
}
export function quartasComRepescagem(melhoresSeis: readonly TimeId[], daRepescagem: readonly [TimeId, TimeId]): (readonly [TimeId, TimeId])[] {
  const s = melhoresSeis;
  return [
    [s[0]!, daRepescagem[0]],
    [s[3]!, s[4]!],
    [s[1]!, daRepescagem[1]],
    [s[2]!, s[5]!],
  ];
}
export const ehRodadaDaCopa = (numero: number): boolean => numero >= RODADA_DA_COPA.OITAVAS;

/** Dias da Copa: a Fase de Liga começa no dia seguinte à Final da Copa. */
export const DIAS_DA_COPA = 3;

/** Horários (Brasília) de cada etapa, na ordem da chave. */
export const HORARIOS_DA_COPA: Record<EtapaDaCopa, readonly number[]> = {
  OITAVAS: [11, 12, 13, 14, 15, 16, 17, 18],
  QUARTAS: [11, 12, 13, 14],
  SEMIFINAL: [16, 17],
  FINAL: [18],
  CLASSICO: [],
  REPESCAGEM: [],
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
  CLASSICO: 'Fase do Clássico',
  REPESCAGEM: 'Repescagem',
  OITAVAS: 'Oitavas de Clássico',
  QUARTAS: 'Quartas de final',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
};

/** O dia inteiro da Copa, para o calendário e o Resumo. */
export function nomeDaRodadaDaCopa(numero: number, comVinte = false): string {
  if (comVinte) {
    if (numero === RODADA_DA_COPA.OITAVAS) return 'Copa: Fase do Clássico';
    if (numero === RODADA_DA_COPA.QUARTAS_E_SEMIS) return 'Copa: Repescagem e Quartas';
    return 'Copa: Semifinais e Final';
  }
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

export const ETAPA_SEGUINTE: Partial<Record<EtapaDaCopa, EtapaDaCopa>> = { OITAVAS: 'QUARTAS', QUARTAS: 'SEMIFINAL', SEMIFINAL: 'FINAL', CLASSICO: 'REPESCAGEM', REPESCAGEM: 'QUARTAS' };
