/**
 * Regras de jogo do worker. Valores iniciais propostos na implementação, ajustáveis antes
 * do lançamento; depois que houver Carreiras (ADR-0001), mexer no OVR inicial ou na Base
 * muda o equilíbrio entre Jogadores antigos e novos.
 */
import type { Posicao } from '@liga/shared';

/** OVR sorteado na Inscrição (inclusive nas duas pontas). */
export const OVR_INICIAL = { min: 60, max: 70 } as const;

/** OVR do Jogador da Base, que completa a Escalação quando faltam inscritos. */
export const OVR_BASE = 55;

/**
 * Limite de equilíbrio entre Times: um Time não aceita nova Inscrição se o seu Elenco já
 * tiver esta quantidade de Jogadores a mais que o menor Elenco da Liga.
 */
export const FOLGA_DE_ELENCO = 5;

/** A Escalação de futebol society: 7 lugares, nesta ordem. */
export const FORMACAO: readonly Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];

/** Sorteio determinístico do OVR a partir do id do comentário (reprocessar dá o mesmo OVR). */
export function sortearOvrInicial(semente: string): number {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return OVR_INICIAL.min + (h % (OVR_INICIAL.max - OVR_INICIAL.min + 1));
}
