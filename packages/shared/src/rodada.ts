import { NOME_DA_ETAPA_DA_COPA, RODADA_DA_COPA, ehRodadaDaCopa, ehRodadaDaSupercopa, nomeDaRodadaDaCopa, type EtapaDaCopa } from './copa.js';

/**
 * A Temporada tem uma Rodada por dia: a Fase de Liga, depois as Semifinais e a Final, cada uma
 * no dia seguinte. A Fase de Liga dura o turno único da maior Série (ADR-0058):
 * - T1, só a Série A com 8 Times: 7 Rodadas, Semifinais na 8 e Final na 9;
 * - T2, a A com 16 Times em dois Grupos de 8 (ADR-0064): 7 Rodadas, Semifinais na 8 e Final na 9;
 * - da T3 em diante, A e B com 8 em turno único: também 7, 8 e 9.
 */
export interface EstruturaDaTemporada {
  rodadasDaLiga: number;
  rodadaDasSemifinais: number;
  rodadaDaFinal: number;
}

export function estruturaDaLiga(rodadasDaLiga: number): EstruturaDaTemporada {
  return { rodadasDaLiga, rodadaDasSemifinais: rodadasDaLiga + 1, rodadaDaFinal: rodadasDaLiga + 2 };
}

/** A Rodada da Final em SQL, a partir da última Rodada da Fase de Liga (`ultima`, expressão SQL). */
export function sqlRodadaDaFinal(ultima: string): string {
  return `(${ultima} + 2)`;
}

/**
 * As durações de Fase de Liga que existem: 7 (turno único entre 8 Times: a T1, os Grupos da T2 e
 * as Séries da T3 em diante) e 15 (a A de 16 em turno único, ADR-0058; não é mais usada).
 */
export const RODADAS_DA_LIGA_POSSIVEIS = [7, 15] as const;

export type Etapa = 'LIGA' | 'SEMIFINAL' | 'FINAL' | 'COPA' | 'SUPERCOPA';

/**
 * A etapa de uma Rodada pelo número: a Final é sempre 2 dias depois da última Rodada da Liga. As
 * Rodadas da Copa (101 a 103, ADR-0088) são do Mata-mata, mas não do das Séries.
 */
export function etapaDa(fase: 'LIGA' | 'MATA_MATA', numero: number): Etapa {
  if (fase === 'LIGA') return 'LIGA';
  if (ehRodadaDaCopa(numero)) return 'COPA';
  if (ehRodadaDaSupercopa(numero)) return 'SUPERCOPA';
  return RODADAS_DA_LIGA_POSSIVEIS.some((l) => numero === estruturaDaLiga(l).rodadaDaFinal) ? 'FINAL' : 'SEMIFINAL';
}

/** "Rodada 3", "Semifinais", "Final", "Copa: Oitavas de Clássico" (o dia inteiro). */
export function nomeDaRodada(fase: 'LIGA' | 'MATA_MATA', numero: number): string {
  const e = etapaDa(fase, numero);
  if (e === 'COPA') return nomeDaRodadaDaCopa(numero);
  if (e === 'SUPERCOPA') return 'Supercopa';
  return e === 'LIGA' ? `Rodada ${numero}` : e === 'SEMIFINAL' ? 'Semifinais' : 'Final';
}

/** "Rodada 3", "Semifinal", "Final", "Copa · Quartas de final" (uma Partida; a da Copa diz a etapa). */
export function nomeDaEtapa(fase: 'LIGA' | 'MATA_MATA', numero: number, copa?: EtapaDaCopa | 'SUPERCOPA' | null): string {
  const e = etapaDa(fase, numero);
  if (e === 'SUPERCOPA' || copa === 'SUPERCOPA') return 'Supercopa';
  if (e === 'COPA') return copa ? `Copa · ${NOME_DA_ETAPA_DA_COPA[copa]}` : nomeDaRodadaDaCopa(numero);
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
  /** Copa (ADR-0088): a etapa dela; a `etapa` acima é FINAL só na Final da Copa. Sem Série. */
  copa?: EtapaDaCopa;
  /** Supercopa (ADR-0118): jogo único que vale taça (`etapa` FINAL), sem Série. */
  supercopa?: true;
}

/** null na Fase de Liga. Na Copa, precisa da etapa da Partida. */
export function mataMataDaPartida(o: { fase: 'LIGA' | 'MATA_MATA'; rodada: number; temporada: number; serie: 'A' | 'B'; comSeries: boolean; copa?: EtapaDaCopa | 'SUPERCOPA' | null }): MataMataDaPartida | null {
  const etapa = etapaDa(o.fase, o.rodada);
  if (etapa === 'LIGA') return null;
  if (etapa === 'SUPERCOPA' || o.copa === 'SUPERCOPA') return { etapa: 'FINAL', temporada: o.temporada, serie: null, supercopa: true };
  if (etapa === 'COPA') {
    const copa = (o.copa as EtapaDaCopa | null | undefined) ?? (o.rodada === RODADA_DA_COPA.FINAL ? 'FINAL' : o.rodada === RODADA_DA_COPA.OITAVAS ? 'OITAVAS' : 'QUARTAS');
    return { etapa: copa === 'FINAL' ? 'FINAL' : 'SEMIFINAL', temporada: o.temporada, serie: null, copa };
  }
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
