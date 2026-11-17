import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { rodarPartida } from '../src/partida.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let temporada: number;
let n = 0;

async function inscrever(id: string, texto: string) {
  await processarComentario(
    banco,
    { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: id, username: id, texto, comentadoEm: new Date(Date.UTC(2026, 10, 6, 10)) },
    { rodadaEmVotacao: null },
  );
}
const primeiraPartida = async () =>
  (
    await banco.query<{ id: number }>(
      `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = 1 AND 'CAP' IN (p.mandante_id, p.visitante_id) ORDER BY p.apito_inicial LIMIT 1`,
      [temporada],
    )
  ).rows[0]!.id;

beforeEach(async () => {
  banco = await bancoDeTeste();
  temporada = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
});
afterEach(async () => {
  await banco.fechar();
});

describe('número da camisa (ADR-0075)', () => {
  it('a Escalação guarda o número da época do jogo e o vídeo recebe; quem não escolheu joga de camisa lisa', async () => {
    await inscrever('dez', 'ENTRO CAPIVARA ATA');
    await inscrever('liso', 'ENTRO CAPIVARA MEI');
    await banco.query(`UPDATE jogador SET numero = 10 WHERE username = 'dez'`);
    const id = await primeiraPartida();
    const r = await rodarPartida(banco, id, { seed: 11 });

    const lado = r.dados.resultado.times.mandante === 'CAP' ? 'mandante' : 'visitante';
    const doNome = (u: string) => r.dados.numeros![lado][r.dados.nomes[lado].indexOf(`@${u}`)];
    expect(doNome('dez')).toBe(10);
    expect(doNome('liso')).toBeNull();
    // A Base também joga de camisa lisa.
    const daBase = r.dados.nomes[lado].findIndex((x) => x === null);
    expect(r.dados.numeros![lado][daBase]).toBeNull();

    const salvo = (await banco.query<{ numero: number | null }>(`SELECT e.numero FROM escalacao e JOIN jogador j ON j.id = e.jogador_id WHERE e.partida_id = $1 AND j.username = 'dez'`, [id])).rows[0]!;
    expect(salvo.numero).toBe(10);
  });

  it('trocar de número depois não muda a Partida já escalada', async () => {
    await inscrever('dez', 'ENTRO CAPIVARA ATA');
    await banco.query(`UPDATE jogador SET numero = 10 WHERE username = 'dez'`);
    const id = await primeiraPartida();
    await rodarPartida(banco, id, { seed: 11 });
    await banco.query(`UPDATE jogador SET numero = 77 WHERE username = 'dez'`);

    const de_novo = await rodarPartida(banco, id, { seed: 11 });
    const lado = de_novo.dados.resultado.times.mandante === 'CAP' ? 'mandante' : 'visitante';
    expect(de_novo.dados.numeros![lado][de_novo.dados.nomes[lado].indexOf('@dez')]).toBe(10);
  });
});
