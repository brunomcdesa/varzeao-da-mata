/**
 * A Temporada tem uma Rodada por dia: a Fase de Liga, depois as Semifinais e a Final, cada uma
 * no dia seguinte. A Fase de Liga dura o turno único da maior Série (ADR-0058):
 * - T1, só a Série A com 8 Times: 7 Rodadas, Semifinais na 8 e Final na 9;
 * - T2, só a A com 16 Times: 15 Rodadas, Semifinais na 16 e Final na 17 (ADR-0062);
 * - da T3 em diante, A e B com 8 em turno e returno: 14 Rodadas, Semifinais na 16 e Final na 17.
 */
export interface EstruturaDaTemporada {
  rodadasDaLiga: number;
  rodadaDasSemifinais: number;
  rodadaDaFinal: number;
}

/**
 * Com as duas Séries de 8 em turno e returno (14 Rodadas, da T3 em diante, ADR-0062), o
 * Mata-mata fica com os mesmos números da A de 16 (Semifinais 16, Final 17): o número 15 fica
 * sem Rodada. Assim cada número de Rodada do Mata-mata tem uma etapa só.
 */
const RODADAS_DA_LIGA_EM_TURNO_E_RETURNO = 14;

export function estruturaDaLiga(rodadasDaLiga: number): EstruturaDaTemporada {
  const pula = rodadasDaLiga === RODADAS_DA_LIGA_EM_TURNO_E_RETURNO ? 1 : 0;
  return { rodadasDaLiga, rodadaDasSemifinais: rodadasDaLiga + 1 + pula, rodadaDaFinal: rodadasDaLiga + 2 + pula };
}

/** A Rodada da Final em SQL, a partir da última Rodada da Fase de Liga (`ultima`, expressão SQL). */
export function sqlRodadaDaFinal(ultima: string): string {
  return `(CASE WHEN ${ultima} = ${RODADAS_DA_LIGA_EM_TURNO_E_RETURNO} THEN ${ultima} + 3 ELSE ${ultima} + 2 END)`;
}

/**
 * As durações de Fase de Liga que existem: 7 (A com 8 Times, T1), 15 (A com 16 Times, T2) e 14
 * (A e B com 8, turno e returno, da T3 em diante).
 */
export const RODADAS_DA_LIGA_POSSIVEIS = [7, 14, 15] as const;

export type Etapa = 'LIGA' | 'SEMIFINAL' | 'FINAL';

/** A etapa de uma Rodada pelo número: a Final é sempre 2 dias depois da última Rodada da Liga. */
export function etapaDa(fase: 'LIGA' | 'MATA_MATA', numero: number): Etapa {
  if (fase === 'LIGA') return 'LIGA';
  return RODADAS_DA_LIGA_POSSIVEIS.some((l) => numero === estruturaDaLiga(l).rodadaDaFinal) ? 'FINAL' : 'SEMIFINAL';
}

/** "Rodada 3", "Semifinais", "Final" (o dia inteiro). */
export function nomeDaRodada(fase: 'LIGA' | 'MATA_MATA', numero: number): string {
  const e = etapaDa(fase, numero);
  return e === 'LIGA' ? `Rodada ${numero}` : e === 'SEMIFINAL' ? 'Semifinais' : 'Final';
}

/** "Rodada 3", "Semifinal", "Final" (uma Partida). */
export function nomeDaEtapa(fase: 'LIGA' | 'MATA_MATA', numero: number): string {
  const e = etapaDa(fase, numero);
  return e === 'LIGA' ? `Rodada ${numero}` : e === 'SEMIFINAL' ? 'Semifinal' : 'Final';
}

/**
 * O que o Narrador e as cartelas sabem de uma Partida do Mata-mata (ADR-0048): a etapa, a
 * Temporada e a Série (null quando a Temporada só tem a Série A).
 */
export interface MataMataDaPartida {
  etapa: 'SEMIFINAL' | 'FINAL';
  temporada: number;
  serie: 'A' | 'B' | null;
}

/** null na Fase de Liga. */
export function mataMataDaPartida(o: { fase: 'LIGA' | 'MATA_MATA'; rodada: number; temporada: number; serie: 'A' | 'B'; comSeries: boolean }): MataMataDaPartida | null {
  const etapa = etapaDa(o.fase, o.rodada);
  if (etapa === 'LIGA') return null;
  return { etapa, temporada: o.temporada, serie: o.comSeries ? o.serie : null };
}

/**
 * Quanto dura o Ao Vivo no site (90 minutos de jogo a 20×, 4 min 30 s, mais
 * o fim da narração). No Mata-mata a janela inclui a disputa de pênaltis (até 2 min a mais) mesmo quando não há: assim a duração do Ao Vivo
 * não entrega que o jogo foi empatado.
 */
export function duracaoAoVivoMs(fase: 'LIGA' | 'MATA_MATA'): number {
  return (fase === 'MATA_MATA' ? 7 : 5) * 60_000;
}
