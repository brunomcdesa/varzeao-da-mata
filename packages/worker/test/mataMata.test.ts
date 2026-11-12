import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { avancarMataMata, campeao } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
import { dadosDoResumo } from '../src/resumo.js';
import { tabela } from '../src/tabela.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let temporada: number;
beforeEach(async () => {
  banco = await bancoDeTeste();
  temporada = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
});
afterEach(async () => {
  await banco.fechar();
});

const jogar = async (numero: number) => {
  for (const { id } of (await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.numero = $1 ORDER BY p.apito_inicial`, [numero])).rows) {
    await rodarPartida(banco, id, { seed: id * 31 });
  }
};

describe('Mata-mata', () => {
  it('Semifinais 1º×4º e 2º×3º, Final no dia seguinte, campeão no fim; empate vai para os pênaltis', async () => {
    for (let n = 1; n <= 6; n++) await jogar(n);
    expect(await avancarMataMata(banco, temporada)).toBe('NADA');
    await jogar(7);
    expect(await avancarMataMata(banco, temporada)).toBe('SEMIFINAIS_CRIADAS');
    expect(await avancarMataMata(banco, temporada)).toBe('NADA');

    const t = (await tabela(banco, temporada)).map((l) => l.time);
    const semis = (
      await banco.query<{ mandante_id: string; visitante_id: string; apito_inicial: Date; vantagem_do_empate: string; data: string | Date }>(
        `SELECT p.mandante_id, p.visitante_id, p.apito_inicial, p.vantagem_do_empate, r.data FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.numero = 8 ORDER BY p.apito_inicial`,
      )
    ).rows;
    expect(semis.map((s) => [s.mandante_id, s.visitante_id])).toEqual([[t[0], t[3]], [t[1], t[2]]]);
    expect(semis.every((s) => s.vantagem_do_empate === null)).toBe(true);
    expect(new Date(semis[0]!.apito_inicial).toISOString()).toBe('2026-11-14T17:00:00.000Z'); // 14h do 8º dia

    await jogar(8);
    expect(await avancarMataMata(banco, temporada)).toBe('FINAL_CRIADA');
    const final = (await banco.query<{ apito_inicial: Date; vantagem_do_empate: string | null }>(`SELECT p.apito_inicial, p.vantagem_do_empate FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.numero = 9`)).rows;
    expect(final).toHaveLength(1);
    expect(final[0]!.vantagem_do_empate).toBeNull();
    expect(new Date(final[0]!.apito_inicial).toISOString()).toBe('2026-11-15T21:00:00.000Z'); // 18h do 9º dia
    expect(await campeao(banco, temporada)).toBeNull();

    await jogar(9);
    expect(await avancarMataMata(banco, temporada)).toBe('TEMPORADA_ENCERRADA');
    expect(t.slice(0, 4)).toContain(await campeao(banco, temporada));
    expect((await banco.query<{ status: string }>(`SELECT status FROM temporada`)).rows[0]!.status).toBe('ENCERRADA');
  });

  it('o Narrador sabe se é Semifinal ou Final, e o Resumo das Semifinais traz a Final (ADR-0048)', async () => {
    for (let n = 1; n <= 7; n++) await jogar(n);
    await avancarMataMata(banco, temporada);
    const ids = async (numero: number) => (await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.numero = $1 ORDER BY p.apito_inicial`, [numero])).rows.map((r) => r.id);
    const liga = await rodarPartida(banco, (await ids(7))[0]!);
    expect(liga.dados.mataMata).toBeUndefined();
    const [semi] = await ids(8);
    expect((await rodarPartida(banco, semi!, { seed: 5 })).dados.mataMata).toEqual({ etapa: 'SEMIFINAL', temporada: 1, serie: null });
    await jogar(8);
    await avancarMataMata(banco, temporada);
    const [finalId] = await ids(9);
    expect((await rodarPartida(banco, finalId!, { seed: 5 })).dados.mataMata).toEqual({ etapa: 'FINAL', temporada: 1, serie: null });

    const rodadaDasSemis = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE numero = 8`)).rows[0]!.id;
    const final = (await banco.query<{ mandante_id: string; visitante_id: string }>(`SELECT mandante_id, visitante_id FROM partida WHERE id = $1`, [finalId])).rows[0]!;
    expect((await dadosDoResumo(banco, rodadaDasSemis)).final).toEqual([{ mandante: final.mandante_id, visitante: final.visitante_id, hora: 18 }]);
    const rodadaDaFinal = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE numero = 9`)).rows[0]!.id;
    expect((await dadosDoResumo(banco, rodadaDaFinal)).final).toBeUndefined();
  });
});
