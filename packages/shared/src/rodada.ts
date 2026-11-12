/** A Temporada: 7 Rodadas da Fase de Liga, depois Semifinais (dia 8) e Final (dia 9). */
export const RODADAS_DA_LIGA = 7;
export const RODADA_DAS_SEMIFINAIS = 8;
export const RODADA_DA_FINAL = 9;

export type Etapa = 'LIGA' | 'SEMIFINAL' | 'FINAL';

export function etapaDa(fase: 'LIGA' | 'MATA_MATA', numero: number): Etapa {
  if (fase === 'LIGA') return 'LIGA';
  return numero >= RODADA_DA_FINAL ? 'FINAL' : 'SEMIFINAL';
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
