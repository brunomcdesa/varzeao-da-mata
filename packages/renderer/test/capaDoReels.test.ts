import { describe, expect, it } from 'vitest';
import type { ResultadoPartida } from '@liga/sim';
import { linhaDaCapa, selosDaCapa } from '../src/video.js';

const r = (classico: boolean) => ({ classico }) as ResultadoPartida;

describe('Capa do Reels (ADR-0106)', () => {
  it('Rodada e horário numa linha curta; o Mata-mata fica como está', () => {
    expect(linhaDaCapa('Rodada 5, jogo das 18h')).toBe('Rodada 5 · 18h');
    expect(linhaDaCapa('Última Rodada, jogo das 15h')).toBe('Última Rodada · 15h');
    expect(linhaDaCapa('Semifinal')).toBe('Semifinal');
    expect(linhaDaCapa(undefined)).toBeNull();
  });

  it('selos: Clássico e o que a Partida vale, só quando vale de verdade', () => {
    expect(selosDaCapa(r(false), {})).toEqual([]);
    expect(selosDaCapa(r(true), {})).toEqual(['Clássico']);
    expect(selosDaCapa(r(true), { briga: {} as never })).toEqual(['Clássico', 'Vale a Semifinal']);
    expect(selosDaCapa(r(false), { mataMata: { etapa: 'SEMIFINAL', temporada: 2, serie: null } })).toEqual(['Vale a Final']);
    expect(selosDaCapa(r(false), { mataMata: { etapa: 'FINAL', temporada: 2, serie: null } })).toEqual(['Vale o título']);
  });

});
