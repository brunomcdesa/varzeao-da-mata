import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { avancarMataMata, campeao } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
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
  it('Semifinais 1º×4º e 2º×3º com Vantagem do Empate, Final no dia seguinte, campeão no fim', async () => {
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
    expect(semis.every((s) => s.vantagem_do_empate === 'mandante')).toBe(true);
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
});
