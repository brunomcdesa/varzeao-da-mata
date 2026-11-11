/**
 * Pendências do KV (ADR-0035). O plano grátis do Workers KV tem 1.000 listagens por dia, e a
 * coleta (a cada 10 min) listava 7 prefixos toda vez. Agora a borda marca numa chave só o que
 * mudou (voto, pedido do site, vínculo, publicação) e a coleta lista apenas o que estiver
 * marcado. A leitura da chave é barata (100 mil por dia); a marca só é gravada quando o tipo
 * ainda não está marcado, então são poucas gravações. A coleta varre
 * tudo uma vez por hora, como rede de segurança para uma marca perdida.
 */
export const CHAVE_PENDENCIAS = 'pendencias';

export const TIPOS_DE_PENDENCIA = ['votos', 'perfis', 'escolhas', 'pedidos', 'vinculos', 'publicados'] as const;
export type TipoDePendencia = (typeof TIPOS_DE_PENDENCIA)[number];

/** Cada tipo marcado guarda quando foi marcado pela primeira vez (ISO). */
export type Pendencias = Partial<Record<TipoDePendencia, string>>;

/** A marca nova, ou null quando o tipo já estava marcado (aí não precisa gravar). */
export function comPendencia(atual: Pendencias | null, tipo: TipoDePendencia, agora: Date): Pendencias | null {
  if (atual?.[tipo]) return null;
  return { ...(atual ?? {}), [tipo]: agora.toISOString() };
}

/** De quanto em quanto tempo a coleta varre todos os prefixos, com ou sem marca. */
export const INTERVALO_DA_VARREDURA_MS = 55 * 60_000;

/** Hora de varrer tudo: nunca varreu, ou a última varredura foi há quase uma hora. */
export function ehHoraDaVarredura(ultima: Date | null, agora: Date): boolean {
  return !ultima || agora.getTime() - ultima.getTime() >= INTERVALO_DA_VARREDURA_MS;
}
