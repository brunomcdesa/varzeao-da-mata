/**
 * A Temporada tem uma Rodada por dia: a Fase de Liga, depois as Semifinais e a Final, cada uma
 * no dia seguinte. A Fase de Liga dura o turno único da maior Série (ADR-0058):
 * - T1, só a Série A com 8 Times: 7 Rodadas, Semifinais na 8 e Final na 9;
 * - da T2 em diante, A com 16 Times: 15 Rodadas, Semifinais na 16 e Final na 17 (a B, com 8,
 *   joga turno e returno nas Rodadas 1 a 14).
 */
export interface EstruturaDaTemporada {
  rodadasDaLiga: number;
  rodadaDasSemifinais: number;
  rodadaDaFinal: number;
}

export function estruturaDaLiga(rodadasDaLiga: number): EstruturaDaTemporada {
  return { rodadasDaLiga, rodadaDasSemifinais: rodadasDaLiga + 1, rodadaDaFinal: rodadasDaLiga + 2 };
}

/** As durações de Fase de Liga que existem: 7 (A com 8 Times) e 15 (A com 16 Times). */
export const RODADAS_DA_LIGA_POSSIVEIS = [7, 15] as const;

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
