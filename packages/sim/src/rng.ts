/**
 * Gerador pseudoaleatório com seed (mulberry32). É a ÚNICA fonte de sorte da sim:
 * nada aqui pode usar Math.random ou relógio (ADR-0002).
 */
export interface Rng {
  /** Número em [0, 1). */
  next(): number;
  /** Inteiro em [0, max). */
  int(max: number): number;
  /** Um item da lista, uniforme. */
  pick<T>(items: readonly T[]): T;
  /** true com probabilidade p. */
  chance(p: number): boolean;
}

export function criarRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (max) => Math.floor(next() * max),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick em lista vazia');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    chance: (p) => next() < p,
  };
}
