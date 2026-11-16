import { describe, expect, it } from 'vitest';
import { MAXIMO_DE_ESTRELAS, estrelasDosTimes } from '@liga/shared';
import { definirEstrelas, filaDeEstrelas, larguraDasEstrelas } from '../src/escudos.js';

describe('Estrelas de Título (ADR-0060)', () => {
  it('o campeão só ganha a estrela quando a Temporada seguinte já foi criada', () => {
    expect(estrelasDosTimes([{ numero: 1, campeao: 'ONC' }])).toEqual({});
    expect(estrelasDosTimes([{ numero: 1, campeao: 'ONC' }, { numero: 2, campeao: null }])).toEqual({ ONC: { ouro: 1, prata: 0 } });
  });

  it('Título da A é dourado e o da B é prata, somando Temporada a Temporada', () => {
    const e = estrelasDosTimes([
      { numero: 1, campeao: 'ONC' },
      { numero: 2, campeao: 'ONC', campeaoB: 'QUA' },
      { numero: 3, campeao: 'CAP', campeaoB: 'ONC' },
      { numero: 4, campeao: 'TAT', campeaoB: 'JAB' },
    ]);
    expect(e).toEqual({ ONC: { ouro: 2, prata: 1 }, QUA: { ouro: 0, prata: 1 }, CAP: { ouro: 1, prata: 0 } });
  });

  it('Temporada sem campeão (Final não jogada) não dá estrela a ninguém', () => {
    expect(estrelasDosTimes([{ numero: 1, campeao: null, campeaoB: null }, { numero: 2, campeao: null }])).toEqual({});
  });

  it('no escudo, as douradas vêm antes das pratas, até o máximo que cabe', () => {
    definirEstrelas({ ONC: { ouro: 2, prata: 1 }, CAP: { ouro: 4, prata: 3 } });
    expect(filaDeEstrelas('ONC')).toEqual(['ouro', 'ouro', 'prata']);
    expect(filaDeEstrelas('CAP')).toHaveLength(MAXIMO_DE_ESTRELAS);
    expect(filaDeEstrelas('CAP').filter((t) => t === 'ouro')).toHaveLength(4);
    expect(filaDeEstrelas('TAT')).toEqual([]);
  });

  it('definir de novo troca a lista inteira (Time que saiu da lista perde as estrelas)', () => {
    definirEstrelas({ ONC: { ouro: 1, prata: 0 } });
    definirEstrelas({ CAP: { ouro: 1, prata: 0 } });
    expect(filaDeEstrelas('ONC')).toEqual([]);
    expect(filaDeEstrelas('CAP')).toEqual(['ouro']);
  });

  it('até 3 estrelas cabem na largura do escudo (20)', () => {
    expect(larguraDasEstrelas(0)).toBe(0);
    expect(larguraDasEstrelas(1)).toBe(7);
    expect(larguraDasEstrelas(3)).toBeLessThanOrEqual(20);
  });
});
