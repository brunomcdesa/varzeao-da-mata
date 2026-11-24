import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GRUPOS_DA_A_DE_16, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { rodarPartida } from '../src/partida.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

const primeira = async (temporadaId: number) =>
  (await banco.query<{ id: number; mandante_id: TimeId }>(`SELECT p.id, p.mandante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial LIMIT 1`, [temporadaId])).rows[0]!;

describe('Capa do Reels (ADR-0106)', () => {
  it('a Partida da Fase de Liga com Grupos leva o Grupo para a capa; sem Grupos, nada', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    expect((await rodarPartida(banco, (await primeira(t1)).id, { seed: 4 })).dados.grupo).toBeUndefined();

    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });
    const p = await primeira(t2);
    const grupo = GRUPOS_DA_A_DE_16.CHAO.includes(p.mandante_id) ? 'CHAO' : 'COPA';
    expect((await rodarPartida(banco, p.id, { seed: 4 })).dados.grupo).toBe(grupo);
  });
});
