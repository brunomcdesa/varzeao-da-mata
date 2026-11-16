import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GRUPOS_DA_A_DE_16, TIMES_DA_SERIE_B, TIMES_FUNDADORES, TIMES_NOVOS, type LigaPublica, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { avancarMataMata, campeao, estrelasNoBanco } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
import { processarComentario } from '../src/coletar.js';
import { craqueDaRodada, fecharRodada } from '../src/resumo.js';
import { finalistas, gruposDaTemporada, seriesDaTemporada, timesAtivos } from '../src/series.js';
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
  for (let numero = 1; numero <= 17; numero++) {
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

describe('Série A e Série B (ADR-0017)', () => {
  it('a Temporada 1 tem uma Série só, com os fundadores', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    const s = await seriesDaTemporada(banco, t1);
    expect(ordenados(s.A)).toEqual(ordenados(TIMES_FUNDADORES));
    expect(s.B).toEqual([]);
    expect(ordenados(await timesAtivos(banco))).toEqual(ordenados(TIMES_FUNDADORES));
    // O site da Temporada 1 continua igual: sem Séries, sem tabela da B.
    const liga = (await exportarSite(banco, new Date('2026-11-08T12:00:00Z'))).arquivos.get('liga.json') as LigaPublica;
    expect(liga.series).toBeUndefined();
    expect(liga.tabelaB).toBeUndefined();
    expect(liga.calendario.every((p) => p.serie === undefined)).toBe(true);
  });

  it('depois da Temporada 1, ninguém desce: a T2 tem só a Série A de 16, em dois Grupos de 8, um jogo por hora (ADR-0064)', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });

    const s = await seriesDaTemporada(banco, t2);
    expect(ordenados(s.A)).toEqual(ordenados([...TIMES_FUNDADORES, ...TIMES_NOVOS]));
    expect(s.B).toEqual([]);
    expect(await gruposDaTemporada(banco, t2)).toEqual({ CHAO: ordenados(GRUPOS_DA_A_DE_16.CHAO), COPA: ordenados(GRUPOS_DA_A_DE_16.COPA) });
    expect(ordenados(await timesAtivos(banco))).toHaveLength(16);

    const jogos = (
      await banco.query<{ numero: number; mandante_id: TimeId; visitante_id: TimeId; apito_inicial: Date }>(
        `SELECT r.numero, p.mandante_id, p.visitante_id, p.apito_inicial FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1`,
        [t2],
      )
    ).rows;
    // Turno único dentro de cada Grupo: 7 Rodadas, 8 jogos por dia, sempre entre Times do mesmo Grupo.
    expect(jogos).toHaveLength(7 * 8);
    const mesmoGrupo = (a: TimeId, b: TimeId) => (GRUPOS_DA_A_DE_16.CHAO.includes(a) ? GRUPOS_DA_A_DE_16.CHAO : GRUPOS_DA_A_DE_16.COPA).includes(b);
    expect(jogos.every((j) => mesmoGrupo(j.mandante_id, j.visitante_id))).toBe(true);
    const hora = (j: (typeof jogos)[number]) => (new Date(j.apito_inicial).getUTCHours() + 21) % 24;
    for (let r = 1; r <= 7; r++) {
      const doDia = jogos.filter((j) => j.numero === r).sort((a, b) => new Date(a.apito_inicial).getTime() - new Date(b.apito_inicial).getTime());
      expect(doDia.map(hora)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
      expect(new Set(doDia.flatMap((j) => [j.mandante_id, j.visitante_id])).size).toBe(16);
    }
    // Todos os Clássicos acontecem.
    const pares = new Set(jogos.map((j) => [j.mandante_id, j.visitante_id].sort().join('-')));
    for (const c of ['CAP-ONC', 'TAM-TAT', 'PRE-SAG', 'ARA-TUC', 'JAC-SUC', 'CDM-LOB', 'BOT-PIR', 'COR-MOR']) expect(pares).toContain(c);
    // O site mostra uma tabela por Grupo e a zona de queda (4 por Grupo).
    const liga = (await exportarSite(banco, new Date('2026-11-18T12:00:00Z'))).arquivos.get('liga.json') as LigaPublica;
    expect(liga.grupos?.map((g) => [g.nome, g.tabela.length])).toEqual([['Grupo do Chão', 8], ['Grupo da Copa', 8]]);
    expect(liga.caem).toBe(4);
    expect(liga.tabelaB).toBeUndefined();
  }, 120_000);

  it('no fim da T2, os 4 últimos de cada Grupo formam a B da T3; Semifinais cruzadas; na T3 cada Série tem tabela, Mata-mata e campeão, e depois 2 descem e 2 sobem', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const t0 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8 });
    await jogarTemporada(t0);
    const chao = (await tabela(banco, t0, 'A', 'CHAO')).map((l) => l.time);
    const copa = (await tabela(banco, t0, 'A', 'COPA')).map((l) => l.time);
    // Semifinais: 1º do Chão × 2º da Copa e 1º da Copa × 2º do Chão.
    const semisT2 = (
      await banco.query<{ mandante_id: TimeId; visitante_id: TimeId }>(
        `SELECT p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = 8 ORDER BY p.apito_inicial`,
        [t0],
      )
    ).rows.map((p) => [p.mandante_id, p.visitante_id]);
    expect(semisT2).toEqual([[chao[0], copa[1]], [copa[0], chao[1]]]);
    expect((await banco.query<{ status: string }>(`SELECT status FROM temporada WHERE id = $1`, [t0])).rows[0]!.status).toBe('ENCERRADA');
    const t2 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-12-08', seed: 9 });
    const sT3 = await seriesDaTemporada(banco, t2);
    expect(ordenados(sT3.A)).toEqual(ordenados([...chao.slice(0, 4), ...copa.slice(0, 4)]));
    expect(ordenados(sT3.B)).toEqual(ordenados([...chao.slice(4), ...copa.slice(4)]));
    expect(await gruposDaTemporada(banco, t2)).toBeNull();
    await jogarTemporada(t2);

    const s2 = await seriesDaTemporada(banco, t2);
    const tabelaA = await tabela(banco, t2, 'A');
    const tabelaB = await tabela(banco, t2, 'B');
    expect(ordenados(tabelaA.map((l) => l.time))).toEqual(ordenados(s2.A));
    expect(ordenados(tabelaB.map((l) => l.time))).toEqual(ordenados(s2.B));
    expect(tabelaA.every((l) => l.jogos === 7)).toBe(true);
    expect(tabelaB.every((l) => l.jogos === 7)).toBe(true);

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
    const { arquivos } = await exportarSite(banco, new Date('2026-12-20T12:00:00Z'));
    const liga = arquivos.get('liga.json') as LigaPublica;
    const h2 = liga.temporadas.find((x) => x.numero === 3)!;
    expect(h2.campeao).toBe(campeaoA);
    expect(h2.serieB?.campeao).toBe(campeaoB);
    expect(ordenados(h2.tabela.map((l) => l.time))).toEqual(ordenados(s2.A));
    expect(ordenados(h2.serieB!.tabela.map((l) => l.time))).toEqual(ordenados(s2.B));
    expect(liga.calendario.filter((p) => p.serie === 'B')).toHaveLength(7 * 4 + 2 + 1);
    expect(liga.calendario.filter((p) => p.serie === 'A')).toHaveLength(7 * 4 + 2 + 1);

    const t3 = await criarTemporada(banco, { numero: 4, primeiraRodada: '2026-12-22', seed: 10 });
    const s3 = await seriesDaTemporada(banco, t3);
    expect(ordenados(s3.A)).toEqual(ordenados([...s2.A.filter((x) => !rebaixados.includes(x)), ...sobem]));
    expect(ordenados(s3.B)).toEqual(ordenados([...s2.B.filter((x) => !sobem.includes(x)), ...rebaixados]));
  }, 240_000);
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

  it('na T2, Posição cheia no Time da A (2 GOL, 4 nas outras) manda para outro Time da A com vaga; sem vaga em nenhum, para o Time da A com menos gente na Posição (ADR-0062)', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-12-08', seed: 8 });
    const s = await seriesDaTemporada(banco, t2);
    const respostas: string[] = [];
    const ctx = { rodadaEmVotacao: null, responder: async (_id: string, texto: string) => void respostas.push(texto) };
    const timeDe = async (u: string) => (await banco.query<{ time_id: TimeId; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE username = $1`, [u])).rows[0]!;

    // Dois goleiros cabem no Jacaré (agora na Série A).
    for (const u of ['gol_1', 'gol_2']) expect(await processarComentario(banco, comentario(u, u, 'ENTRO Jacaré goleiro', '2026-12-01T12:00:00Z'), ctx)).toBe('INSCRITO');
    expect(await timeDe('gol_2')).toEqual({ time_id: 'JAC', posicao: 'GOL' });
    // O terceiro goleiro vai para outro Time da A com vaga de goleiro, como goleiro.
    expect(await processarComentario(banco, comentario('gol_3', 'gol_3', 'ENTRO Jacaré goleiro', '2026-12-01T12:05:00Z'), ctx)).toBe('REALOCADO');
    const g3 = await timeDe('gol_3');
    expect(g3.posicao).toBe('GOL');
    expect(s.A).toContain(g3.time_id);
    expect(g3.time_id).not.toBe('JAC');
    expect(respostas.at(-1)).toContain('também da Série A');

    // Todos os Times da A com 2 goleiros: sem Série B na T2, vai para um Time da A, como goleiro.
    for (const time of s.A) {
      const n = Number((await banco.query<{ n: string }>(`SELECT count(*) AS n FROM jogador WHERE time_id = $1 AND posicao = 'GOL'`, [time])).rows[0]!.n);
      for (let k = n; k < 2; k++) {
        await banco.query(
          `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) SELECT $1, $1, $2, 'GOL', ovr, habilidades, inscrito_em FROM jogador WHERE username = 'gol_1'`,
          [`${time}_gol_${k}`.toLowerCase(), time],
        );
      }
    }
    expect(await processarComentario(banco, comentario('gol_x', 'gol_x', 'ENTRO Jacaré goleiro', '2026-12-01T12:10:00Z'), ctx)).toBe('REALOCADO');
    const gx = await timeDe('gol_x');
    expect(gx.posicao).toBe('GOL');
    expect(s.A).toContain(gx.time_id);
    expect(respostas.at(-1)).toContain('também da Série A');

    // Atacante no Jacaré ainda tem vaga: entra na A.
    expect(await processarComentario(banco, comentario('ata_1', 'ata_1', 'ENTRO Jacaré atacante', '2026-12-01T12:12:00Z'), ctx)).toBe('INSCRITO');
    expect((await timeDe('ata_1')).time_id).toBe('JAC');
    // Os Times guardados para a B não jogam a T2: o pedido espera (ADR-0062). "SERIEMA" é a
    // Seriema; "SER" sozinho continua sendo palavra de ligação.
    expect(await processarComentario(banco, comentario('qua_1', 'qua_1', 'ENTRO Quati meia', '2026-12-01T12:13:00Z'), ctx)).toBe('TIME_ESTREANTE');
    expect(await processarComentario(banco, comentario('ser_1', 'ser_1', 'quero ser goleiro da seriema', '2026-12-01T12:14:00Z'), ctx)).toBe('TIME_ESTREANTE');
  }, 120_000);

  it('Candidatos por Série (A de 1 a 5, B de 6 a 10), um voto por @ em cada Série e um Craque em cada', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    // Uma Temporada com as duas Séries de 8, como da T3 em diante (ADR-0062).
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
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

  it('o campeão da Temporada 1 ganha a estrela no escudo só quando a Temporada 2 é criada (ADR-0060)', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    await jogarTemporada(t1);
    const vencedor = (await campeao(banco, t1, 'A'))!;
    expect(vencedor).toBeTruthy();
    expect(await estrelasNoBanco(banco)).toEqual({});
    const antes = (await exportarSite(banco, new Date('2026-11-17T12:00:00Z'))).arquivos.get('liga.json') as LigaPublica;
    expect(antes.estrelas).toEqual({});

    await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-19', seed: 8 });
    expect(await estrelasNoBanco(banco)).toEqual({ [vencedor]: { ouro: 1, prata: 0 } });
    const depois = (await exportarSite(banco, new Date('2026-11-18T12:00:00Z'))).arquivos.get('liga.json') as LigaPublica;
    expect(depois.estrelas).toEqual({ [vencedor]: { ouro: 1, prata: 0 } });
  });
});
