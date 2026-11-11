/**
 * Avisos do App (ADR-0041): notificações no celular de quem ativou os Avisos para um Time.
 * O job partida grava, no arquivo privado da Partida, em que instante do Ao Vivo cada gol
 * aparece; a borda manda o Aviso no minuto seguinte (nunca antes do que está na tela).
 */
import type { TimeId } from './index.js';

export type TipoDeAviso = 'ESCALACAO' | 'APITO' | 'GOL' | 'FIM';

export interface Placar {
  mandante: number;
  visitante: number;
}

/** Instantes do Ao Vivo, em ms depois do Apito Inicial. */
export interface MomentosDoAoVivo {
  gols: { lado: 'mandante' | 'visitante'; emMs: number; placar: Placar }[];
  fimMs: number;
  placar: Placar;
  penaltis?: Placar;
}

/** Corpo da notificação que a borda manda e o service worker mostra. */
export interface AvisoNoCelular {
  tipo: TipoDeAviso;
  partidaId: number;
  titulo: string;
  corpo: string;
  /** Rota do site para abrir ao tocar. */
  url: string;
}

/** Quantos Times um aparelho pode seguir (são 16 na T2). */
export const TIMES_POR_APARELHO = 16;

export function timesValidos(times: unknown, existentes: readonly string[]): TimeId[] | null {
  if (!Array.isArray(times) || times.length === 0 || times.length > TIMES_POR_APARELHO) return null;
  const unicos = [...new Set(times)];
  if (!unicos.every((t): t is TimeId => typeof t === 'string' && existentes.includes(t))) return null;
  return unicos;
}
