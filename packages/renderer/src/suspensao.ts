/**
 * Suspensão na transmissão (ADR-0116): o cartão gigante e o Narrador avisam quando o cartão
 * tira o Jogador do próximo jogo do Time. Vermelho sempre tira; amarelo, só de quem chegou
 * pendurado (o segundo amarelo na mesma Partida já vira vermelho na simulação).
 */
import type { Lado } from '@liga/sim';

export interface SuspensaoNaPartida {
  /** Quem chegou pendurado, pelo índice em titulares + Banco (o "ocupante" do lugar). */
  pendurados: Partial<Record<Lado, number[]>>;
  /** Final (ou último jogo da Temporada): não há próximo jogo para cumprir. */
  semProximoJogo?: boolean;
}

export function cartaoSuspende(s: SuspensaoNaPartida | null | undefined, lado: Lado, ocupante: number, cartao: 'AMARELO' | 'VERMELHO'): boolean {
  if (!s || s.semProximoJogo) return false;
  return cartao === 'VERMELHO' || (s.pendurados[lado]?.includes(ocupante) ?? false);
}

/** Pendurados da Escalação pública (titulares, depois o Banco), no formato da transmissão. */
export function penduradosDaEscalacao(e: { jogadores: { lugar: number; pendurado?: true }[]; banco?: { pendurado?: true }[] }): number[] {
  const titulares = [...e.jogadores].sort((a, b) => a.lugar - b.lugar);
  return [...titulares, ...(e.banco ?? [])].flatMap((j, i) => (j.pendurado ? [i] : []));
}
