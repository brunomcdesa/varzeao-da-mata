import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type LigaPublica, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { avancarMataMata, campeao } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
import { processarComentario } from '../src/coletar.js';
import { craqueDaRodada, fecharRodada } from '../src/resumo.js';
import { finalistas, seriesDaTemporada, timesAtivos } from '../src/series.js';
import { tabela } from '../src/tabela.js';
import { exportarSite } from '../src/site.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

async function jogarTemporada(temporadaId: number) {
  for (let numero = 1; numero <= 9; numero++) {
    const partidas = (
      await banco.query<{ id: number }>(
        `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = $2 ORDER BY p.apito_inicial, p.serie`,
        [temporadaId, numero],
      )
    ).rows;
    for (const { id } of partidas) await rodarPartida(banco, id, { seed: id * 17 });
    await avancarMataMata(banco, temporadaId);
  }
}

const ordenados = (xs: readonly TimeId[]) => [...xs].sort();

describe('Série A e Série B (ADR-0015)', () => {
  it('a Temporada 1 tem uma Série só, com os fundadores', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    const s = await seriesDaTemporada(banco, t1);
    expect(ordenados(s.A)).toEqual(ordenados(TIMES_FUNDADORES));
    expect(s.B).toEqual([]);
    expect(ordenados(await timesAtivos(banco))).toEqual(ordenados(TIMES_FUNDADORES));
  });

  it('depois da Temporada 1, os fundadores ficam na A e os Times novos formam a B, com A e B no mesmo horário', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });

    const s = await seriesDaTemporada(banco, t2);
    expect(ordenados(s.A)).toEqual(ordenados(TIMES_FUNDADORES));
    expect(ordenados(s.B)).toEqual(ordenados(TIMES_NOVOS));
    expect(ordenados(await timesAtivos(banco))).toHaveLength(16);

    const jogos = (
      await banco.query<{ numero: number; serie: string; mandante_id: TimeId; visitante_id: TimeId; apito_inicial: Date }>(
        `SELECT r.numero, p.serie, p.mandante_id, p.visitante_id, p.apito_inicial FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1`,
        [t2],
      )
    ).rows;
    expect(jogos).toHaveLength(7 * 8);
    for (let r = 1; r <= 7; r++) {
      const doDia = jogos.filter((j) => j.numero === r);
      // Cada horário tem uma Partida da A e uma da B.
      const porHorario = new Map<number, string[]>();
      for (const j of doDia) porHorario.set(new Date(j.apito_inicial).getTime(), [...(porHorario.get(new Date(j.apito_inicial).getTime()) ?? []), j.serie]);
      expect([...porHorario.values()].map((v) => v.sort().join(''))).toEqual(['AB', 'AB', 'AB', 'AB']);
      // Nenhum Time joga fora da sua Série, e cada Time joga uma vez por dia.
      for (const j of doDia) {
        const serie = j.serie === 'A' ? s.A : s.B;
        expect(serie).toContain(j.mandante_id);
        expect(serie).toContain(j.visitante_id);
      }
      expect(new Set(doDia.flatMap((j) => [j.mandante_id, j.visitante_id])).size).toBe(16);
    }
  });

  it('cada Série tem tabela, Mata-mata e campeão; os 2 últimos da A descem e os finalistas da B sobem', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });
    await jogarTemporada(t2);

    const s2 = await seriesDaTemporada(banco, t2);
    const tabelaA = await tabela(banco, t2, 'A');
    const tabelaB = await tabela(banco, t2, 'B');
    expect(ordenados(tabelaA.map((l) => l.time))).toEqual(ordenados(s2.A));
    expect(ordenados(tabelaB.map((l) => l.time))).toEqual(ordenados(s2.B));
    expect(tabelaA.every((l) => l.jogos === 7)).toBe(true);

    // As semifinais de cada Série são entre os 4 melhores dela.
    const semis = (
      await banco.query<{ serie: string; mandante_id: TimeId; visitante_id: TimeId }>(
        `SELECT p.serie, p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = 8 ORDER BY p.serie, p.apito_inicial`,
        [t2],
      )
    ).rows;
    const top4 = (t: typeof tabelaA) => t.slice(0, 4).map((l) => l.time);
    expect(semis.filter((p) => p.serie === 'A').map((p) => [p.mandante_id, p.visitante_id])).toEqual([[top4(tabelaA)[0], top4(tabelaA)[3]], [top4(tabelaA)[1], top4(tabelaA)[2]]]);
    expect(semis.filter((p) => p.serie === 'B').map((p) => [p.mandante_id, p.visitante_id])).toEqual([[top4(tabelaB)[0], top4(tabelaB)[3]], [top4(tabelaB)[1], top4(tabelaB)[2]]]);

    const campeaoA = await campeao(banco, t2, 'A');
    const campeaoB = await campeao(banco, t2, 'B');
    expect(s2.A).toContain(campeaoA);
    expect(s2.B).toContain(campeaoB);
    const t = (await banco.query<{ status: string; campeao_id: TimeId; campeao_b_id: TimeId }>(`SELECT status, campeao_id, campeao_b_id FROM temporada WHERE id = $1`, [t2])).rows[0]!;
    expect(t).toEqual({ status: 'ENCERRADA', campeao_id: campeaoA, campeao_b_id: campeaoB });

    const rebaixados = tabelaA.slice(-2).map((l) => l.time);
    const sobem = await finalistas(banco, t2, 'B');
    expect(sobem).toContain(campeaoB);

    // O site separa as duas Séries: tabela, campeão e Final de cada uma.
    const { arquivos } = await exportarSite(banco, new Date('2026-11-28T12:00:00Z'));
    const liga = arquivos.get('liga.json') as LigaPublica;
    const h2 = liga.temporadas.find((x) => x.numero === 2)!;
    expect(h2.campeao).toBe(campeaoA);
    expect(h2.serieB?.campeao).toBe(campeaoB);
    expect(ordenados(h2.tabela.map((l) => l.time))).toEqual(ordenados(s2.A));
    expect(ordenados(h2.serieB!.tabela.map((l) => l.time))).toEqual(ordenados(s2.B));
    expect(liga.calendario.filter((p) => p.serie === 'B')).toHaveLength(7 * 4 + 2 + 1);

    const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-29', seed: 9 });
    const s3 = await seriesDaTemporada(banco, t3);
    expect(ordenados(s3.A)).toEqual(ordenados([...s2.A.filter((x) => !rebaixados.includes(x)), ...sobem]));
    expect(ordenados(s3.B)).toEqual(ordenados([...s2.B.filter((x) => !sobem.includes(x)), ...rebaixados]));
  }, 120_000);
});

describe('Inscrição e voto com duas Séries', () => {
  const comentario = (id: string, user: string, texto: string, em = '2026-11-06T12:00:00Z', midia = 'm') => ({
    igCommentId: id,
    igMediaId: midia,
    igUserId: user,
    username: user,
    texto,
    comentadoEm: new Date(em),
  });

  it('pedido para um Time novo espera a estreia e entra quando a Temporada dele é criada', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    const c = comentario('c1', 'fa_do_jacare', 'ENTRO Jacaré atacante');
    expect(await processarComentario(banco, c, { rodadaEmVotacao: null })).toBe('TIME_ESTREANTE');
    expect((await banco.query(`SELECT 1 FROM jogador WHERE ig_user_id = 'fa_do_jacare'`)).rows).toHaveLength(0);

    await jogarTemporada(t1);
    await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });
    // A coleta seguinte relê o pedido que estava esperando.
    expect(await processarComentario(banco, c, { rodadaEmVotacao: null })).toBe('INSCRITO');
    const j = (await banco.query<{ time_id: string }>(`SELECT time_id FROM jogador WHERE ig_user_id = 'fa_do_jacare'`)).rows[0]!;
    expect(j.time_id).toBe('JAC');
  }, 60_000);

  it('Candidatos por Série (A de 1 a 5, B de 6 a 10), um voto por @ em cada Série e um Craque em cada', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });
    const s = await seriesDaTemporada(banco, t2);
    let n = 0;
    for (const time of [...s.A, ...s.B]) {
      for (const pos of ['ATA', 'MEI', 'ZAG']) await processarComentario(banco, comentario(`i${++n}`, `${time}_${pos}`.toLowerCase(), `ENTRO ${time} ${pos}`, '2026-11-17T12:00:00Z'), { rodadaEmVotacao: null });
    }
    const rodada = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = 1`, [t2])).rows[0]!.id;
    for (const { id } of (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE rodada_id = $1`, [rodada])).rows) await rodarPartida(banco, id, { seed: id * 7 });
    await fecharRodada(banco, rodada);

    const candidatos = (
      await banco.query<{ numero: number; serie: string; time_id: TimeId }>(
        `SELECT c.numero, c.serie, j.time_id FROM candidato c JOIN jogador j ON j.id = c.jogador_id WHERE c.rodada_id = $1 ORDER BY c.numero`,
        [rodada],
      )
    ).rows;
    expect(candidatos.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const c of candidatos) expect(c.serie === 'A' ? s.A : s.B).toContain(c.time_id);

    // "3" e "A3" votam na A; "B2" vota na B. O mesmo @ vota nas duas.
    const ctx = { rodadaEmVotacao: rodada, postDaVotacao: 'resumo' };
    expect(await processarComentario(banco, comentario('v1', 'eleitor', '3', '2026-11-18T22:30:00Z', 'resumo'), ctx)).toBe('VOTO_REGISTRADO');
    expect(await processarComentario(banco, comentario('v2', 'eleitor', 'B2', '2026-11-18T22:31:00Z', 'resumo'), ctx)).toBe('VOTO_REGISTRADO');
    expect(await processarComentario(banco, comentario('v3', 'outro', 'CRAQUE B2', '2026-11-18T22:32:00Z'), ctx)).toBe('VOTO_REGISTRADO');
    expect(await processarComentario(banco, comentario('v4', 'outro', 'B9', '2026-11-18T22:33:00Z', 'resumo'), ctx)).toBe('NAO_CANDIDATO');
    const votos = (await banco.query<{ serie: string; n: string }>(`SELECT serie, count(*) AS n FROM voto WHERE rodada_id = $1 GROUP BY serie ORDER BY serie`, [rodada])).rows;
    expect(votos.map((v) => [v.serie, Number(v.n)])).toEqual([['A', 1], ['B', 2]]);

    const doNumero = async (numero: number) => (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM candidato WHERE rodada_id = $1 AND numero = $2`, [rodada, numero])).rows[0]!.id;
    expect((await craqueDaRodada(banco, rodada, 'A'))!.id).toBe(await doNumero(3));
    expect((await craqueDaRodada(banco, rodada, 'B'))!.id).toBe(await doNumero(7));
  }, 60_000);
});
