/**
 * Estrelas de Título no escudo (ADR-0060): uma dourada por Título da Série A (ou da Liga
 * inteira, antes das Séries) e uma prata por Título da Série B. A estrela só aparece quando a
 * Temporada seguinte já foi criada (abertura da Pré-temporada): até lá, o campeão é festejado
 * no Resumo e o escudo segue como estava.
 */
import type { TimeId } from './index.js';

export interface Estrelas {
  ouro: number;
  prata: number;
  /** Copa (ADR-0088): uma bronze por Título da Copa. */
  bronze?: number;
}

/** O que importa de cada Temporada para contar estrelas. */
export interface TituloDaTemporada {
  numero: number;
  campeao: TimeId | null;
  campeaoB?: TimeId | null;
  /** Campeão da Copa (ADR-0088), decidida no começo da Temporada. */
  campeaoCopa?: TimeId | null;
}

/** Quantas estrelas cabem desenhadas acima do escudo; Títulos além disso não aparecem. */
export const MAXIMO_DE_ESTRELAS = 5;

export function estrelasDosTimes(temporadas: readonly TituloDaTemporada[]): Partial<Record<TimeId, Estrelas>> {
  const ultima = Math.max(0, ...temporadas.map((t) => t.numero));
  const estrelas: Partial<Record<TimeId, Estrelas>> = {};
  const somar = (time: TimeId | null | undefined, tipo: keyof Estrelas) => {
    if (!time) return;
    const e = (estrelas[time] ??= { ouro: 0, prata: 0 });
    e[tipo] = (e[tipo] ?? 0) + 1;
  };
  for (const t of temporadas) {
    // A Copa acaba antes da Fase de Liga: a bronze aparece assim que ela termina.
    somar(t.campeaoCopa, 'bronze');
    if (t.numero >= ultima) continue;
    somar(t.campeao, 'ouro');
    somar(t.campeaoB, 'prata');
  }
  return estrelas;
}
