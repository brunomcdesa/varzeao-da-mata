/**
 * Público e Reações do Ao Vivo (ADR-0046): o que o site e a sala na borda combinam.
 * A sala é um Durable Object por Partida; site e sala conversam por WebSocket.
 */

export const REACOES = [
  { id: 'gol', emoji: '⚽', nome: 'Gol' },
  { id: 'fogo', emoji: '🔥', nome: 'Fogo' },
  { id: 'susto', emoji: '😱', nome: 'Susto' },
  { id: 'palmas', emoji: '👏', nome: 'Palmas' },
] as const;
export type ReacaoId = (typeof REACOES)[number]['id'];
export type ContagemDeReacoes = Partial<Record<ReacaoId, number>>;

export const ehReacao = (x: unknown): x is ReacaoId => REACOES.some((r) => r.id === x);

/** Uma Reação por segundo por aba, no site e na sala. */
export const INTERVALO_REACAO_MS = 1000;
/** A sala junta as Reações e manda em lotes, no máximo um a cada tanto. */
export const LOTE_REACOES_MS = 800;

/** Da sala para o site. */
export type MensagemDaSala = { t: 'publico'; n: number } | { t: 'reacoes'; r: ContagemDeReacoes };
/** Do site para a sala. */
export type MensagemParaSala = { r: ReacaoId };

/** "1 assistindo", "37 assistindo", "1,2 mil assistindo". */
export function textoDoPublico(n: number): string {
  if (n < 1000) return `${n} assistindo`;
  const mil = Math.floor(n / 100) / 10;
  return `${String(mil).replace('.', ',')} mil assistindo`;
}

/** Lê o que o site mandou; qualquer outra coisa é ignorada. */
export function lerMensagemParaSala(texto: unknown): MensagemParaSala | null {
  if (typeof texto !== 'string' || texto.length > 64) return null;
  try {
    const m = JSON.parse(texto) as { r?: unknown };
    return ehReacao(m?.r) ? { r: m.r } : null;
  } catch {
    return null;
  }
}
