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

describe('Abertura do Reels: a capa ganha vida (ADR-0107)', () => {
  it('os escudos entram um de cada lado, batem e só então vêm nomes, selos e a Briga', async () => {
    const { entradaDoConfronto } = await import('../src/video.js');
    const no = (t: number) => entradaDoConfronto(t);
    expect(no(0).mandante).toBe(0);
    expect(no(0.8).mandante).toBe(1);
    expect(no(0.8).visitante).toBeLessThan(1);
    expect(no(1.1).visitante).toBe(1);
    expect(no(1.1).impacto).toBe(1);
    expect(no(1.0).nomes).toBe(0);
    expect(no(2).impacto).toBe(0);
    // Na abertura mais curta (3 s), tudo já entrou antes do fim.
    expect(no(2.2)).toMatchObject({ topo: 1, mandante: 1, visitante: 1, nomes: 1, selos: 1, briga: 1 });
  });
});
