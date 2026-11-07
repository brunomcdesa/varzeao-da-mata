/**
 * Regras de jogo do worker. Valores iniciais propostos na implementação, ajustáveis antes
 * do lançamento; depois que houver Carreiras (ADR-0001), mexer no OVR inicial ou na Base
 * muda o equilíbrio entre Jogadores antigos e novos.
 */
import { HABILIDADES, OVR_JOGADOR_DA_BASE, habilidadesDoPerfil, type Habilidades, type Posicao } from '@liga/shared';

/** OVR sorteado na Inscrição (inclusive nas duas pontas). */
export const OVR_INICIAL = { min: 60, max: 70 } as const;

/** OVR do Jogador da Base, que completa a Escalação quando faltam inscritos. */
export const OVR_BASE = OVR_JOGADOR_DA_BASE;

/**
 * Limite de equilíbrio entre Times: um Time não aceita nova Inscrição se o seu Elenco já
 * tiver esta quantidade de Jogadores a mais que o menor Elenco da Liga.
 */
export const FOLGA_DE_ELENCO = 5;

/** A Escalação de futebol society: 7 lugares, nesta ordem. */
export const FORMACAO: readonly Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];

/** Sorteio determinístico do OVR a partir do id do comentário (reprocessar dá o mesmo OVR). */
export function sortearOvrInicial(semente: string): number {
  return OVR_INICIAL.min + (hash(semente) % (OVR_INICIAL.max - OVR_INICIAL.min + 1));
}

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
}

/**
 * Habilidades da Inscrição: o OVR sorteado, o perfil da Posição e uma variação por Habilidade,
 * tudo derivado do id do comentário (reprocessar dá o mesmo Jogador). ADR-0010.
 */
export function sortearHabilidadesIniciais(semente: string, posicao: Posicao): { ovr: number; habilidades: Habilidades } {
  const ovr = sortearOvrInicial(semente);
  const ruido = Object.fromEntries(HABILIDADES.map((h) => [h, (hash(`${semente}:${h}`) % 2001) / 1000 - 1])) as Habilidades;
  return { ovr, habilidades: habilidadesDoPerfil(posicao, ovr, ruido) };
}

/** Habilidades gravadas, ou o perfil da Posição para quem se inscreveu antes delas existirem. */
export function habilidadesDe(posicao: Posicao, ovr: number, gravadas: Habilidades | string | null | undefined): Habilidades {
  if (!gravadas) return habilidadesDoPerfil(posicao, ovr);
  return typeof gravadas === 'string' ? (JSON.parse(gravadas) as Habilidades) : gravadas;
}
