import { describe, expect, it } from 'vitest';
import type { TimeId } from '@liga/shared';
import { avisoDaCorrecao, planejarCorrecao, type JogadorNaPosicao } from '../src/limitePorPosicao.js';

let n = 0;
const j = (time: TimeId, posicao: JogadorNaPosicao['posicao'], dia: number): JogadorNaPosicao => ({
  id: String(++n),
  username: `${time}_${posicao}_${n}`.toLowerCase(),
  time,
  posicao,
  inscritoEm: `2026-11-${String(dia).padStart(2, '0')}T12:00:00.000Z`,
});

describe('Correção do Limite por Posição (ADR-0079)', () => {
  it('o atacante mais recente do Time com 5 vai para o Time do Grupo com menos atacantes', () => {
    const lobo = [1, 2, 3, 4, 10].map((d) => j('LOB', 'ATA', d));
    const elenco = [...lobo, ...[1, 2, 3].map((d) => j('TAM', 'ATA', d)), j('LEA', 'ATA', 1), j('ONC', 'ATA', 1)];
    const grupo: TimeId[] = ['LOB', 'TAM', 'LEA'];
    const plano = planejarCorrecao(elenco, () => [grupo, [...grupo, 'ONC']]);
    expect(plano).toHaveLength(1);
    expect(plano[0]!.jogador.id).toBe(lobo[4]!.id);
    expect(plano[0]!.para).toBe('LEA');
    expect(avisoDaCorrecao(plano[0]!)).toContain('atacante do Leão');
  });

  it('sem vaga no Grupo, vai para a Série; sem excesso, ninguém muda; goleiro vale com limite 2', () => {
    const grupo: TimeId[] = ['LOB', 'TAM'];
    const elenco = [...[1, 2, 3].map((d) => j('LOB', 'GOL', d)), ...[1, 2].map((d) => j('TAM', 'GOL', d))];
    const plano = planejarCorrecao(elenco, () => [grupo, [...grupo, 'ONC']]);
    expect(plano.map((c) => c.para)).toEqual(['ONC']);
    expect(planejarCorrecao([j('LOB', 'ATA', 1)], () => [grupo])).toEqual([]);
  });
});
