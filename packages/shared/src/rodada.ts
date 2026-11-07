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
 * Quanto dura o Ao Vivo no site (90 minutos de jogo a 15×). No Mata-mata a janela inclui
 * a disputa de pênaltis (até 2 min a mais) mesmo quando não há: assim a duração do Ao Vivo
 * não entrega que o jogo foi empatado.
 */
export function duracaoAoVivoMs(fase: 'LIGA' | 'MATA_MATA'): number {
  return (fase === 'MATA_MATA' ? 8 : 6) * 60_000;
}
