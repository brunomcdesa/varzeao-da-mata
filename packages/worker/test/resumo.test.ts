import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { rodarPartida } from '../src/partida.js';
import { dadosDoResumo, fecharRodada } from '../src/resumo.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let n = 0;

beforeEach(async () => {
  banco = await bancoDeTeste();
  await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 9 });
  // Dois Jogadores por Time, inscritos antes da Rodada 1, e um depois do Resumo.
  for (const t of TIMES) {
    for (const pos of ['ATA', 'GOL']) {
      const id = `${t}-${pos}`.toLowerCase();
      await processarComentario(
        banco,
        { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: id, username: id, texto: `ENTRO ${t} ${pos}`, comentadoEm: new Date('2026-11-06T12:00:00Z') },
        { rodadaEmVotacao: null },
      );
    }
  }
  await processarComentario(
    banco,
    { igCommentId: 'tarde', igMediaId: 'm', igUserId: 'tarde', username: 'tarde', texto: 'ENTRO TATU MEI', comentadoEm: new Date('2026-11-07T23:00:00Z') },
    { rodadaEmVotacao: null },
  );
});
afterEach(async () => {
  await banco.fechar();
});

describe('Resumo da Rodada', () => {
  it('junta placares, tabela, Novos Contratados e os 5 Candidatos a Craque', async () => {
    const rodada = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE numero = 1`)).rows[0]!.id;
    const ids = (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE rodada_id = $1`, [rodada])).rows;
    for (const { id } of ids) await rodarPartida(banco, id, { seed: id * 13 });
    await fecharRodada(banco, rodada);
    await fecharRodada(banco, rodada); // idempotente

    const d = await dadosDoResumo(banco, rodada);
    expect(d.rodada).toBe(1);
    expect(d.placares.map((p) => p.hora)).toEqual([12, 14, 16, 18]);
    expect(d.tabela).toHaveLength(8);
    expect(d.totalNovos).toBe(16); // o "tarde" entrou depois das 19h
    expect(d.candidatos).toHaveLength(5);
    const notas = d.candidatos.map((c) => c.nota);
    expect([...notas].sort((a, b) => b - a)).toEqual(notas);
    const golsNaRodada = d.placares.reduce((s, p) => s + p.golsMandante + p.golsVisitante, 0);
    expect(d.candidatos.reduce((s, c) => s + c.gols, 0)).toBeLessThanOrEqual(golsNaRodada);
  });
});
