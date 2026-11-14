/**
 * Regras de jogo do worker. Valores iniciais propostos na implementação, ajustáveis antes
 * do lançamento; depois que houver Carreiras (ADR-0001), mexer no OVR inicial ou na Base
 * muda o equilíbrio entre Jogadores antigos e novos.
 */
import { HABILIDADES, OVR_INICIAL, OVR_INICIAL_DEPOIS_DA_T1, OVR_JOGADOR_DA_BASE, habilidadesDoPerfil, type Habilidades, type Posicao } from '@liga/shared';

/** Faixas do OVR sorteado na Inscrição (ADR-0056); ficam em `@liga/shared` para o site usar. */
export { OVR_INICIAL, OVR_INICIAL_DEPOIS_DA_T1 };

export type FaixaDoOvr = { readonly min: number; readonly max: number };

/** OVR do Jogador da Base, que completa a Escalação quando faltam inscritos. */
export const OVR_BASE = OVR_JOGADOR_DA_BASE;

/**
 * Limite de equilíbrio entre Times: um Time não aceita nova Inscrição se o seu Elenco já
 * tiver esta quantidade de Jogadores a mais que o menor Elenco da Liga.
 */
export const FOLGA_DE_ELENCO = 5;
/**
 * Time cheio: realoca no Time mais vazio (mesma posição) e responde o comentário explicando.
 * Desligado, o pedido fica como TIME_CHEIO e é relido até abrir vaga.
 */
export const REALOCAR_QUANDO_CHEIO = true;

/** A Escalação de futebol society: 7 lugares, nesta ordem. */
export const FORMACAO: readonly Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];

/** Sorteio determinístico do OVR a partir do id do comentário (reprocessar dá o mesmo OVR). */
export function sortearOvrInicial(semente: string, faixa: FaixaDoOvr = OVR_INICIAL): number {
  return faixa.min + (hash(semente) % (faixa.max - faixa.min + 1));
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
export function sortearHabilidadesIniciais(semente: string, posicao: Posicao, faixa: FaixaDoOvr = OVR_INICIAL): { ovr: number; habilidades: Habilidades } {
  const ovr = sortearOvrInicial(semente, faixa);
  return { ovr, habilidades: perfilNaPosicao(semente, posicao, ovr) };
}

/**
 * Habilidades no perfil da Posição para um OVR, com a variação derivada da semente. Usado na
 * Inscrição e na troca de posição (ADR-0030): quem troca de posição mantém o OVR.
 */
export function perfilNaPosicao(semente: string, posicao: Posicao, ovr: number): Habilidades {
  const ruido = Object.fromEntries(HABILIDADES.map((h) => [h, (hash(`${semente}:${h}`) % 2001) / 1000 - 1])) as Habilidades;
  return habilidadesDoPerfil(posicao, ovr, ruido);
}

/** Habilidades gravadas, ou o perfil da Posição para quem se inscreveu antes delas existirem. */
export function habilidadesDe(posicao: Posicao, ovr: number, gravadas: Habilidades | string | null | undefined): Habilidades {
  if (!gravadas) return habilidadesDoPerfil(posicao, ovr);
  return typeof gravadas === 'string' ? (JSON.parse(gravadas) as Habilidades) : gravadas;
}
