import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDENTIDADE, OITAVAS_DE_CLASSICO, CLASSICOS, TIMES_FUNDADORES, TIMES_NOVOS, estruturaDaLiga, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario, transferirJogador } from '../src/coletar.js';
import { avancarCopa, cabeACopa } from '../src/copa.js';
import { legendaDoResumo } from '../src/jobs.js';
import { dadosDoResumo, fecharRodada } from '../src/resumo.js';
import { pagarTitulos } from '../src/moedas.js';
import { estrelasNoBanco, estruturaDaTemporada } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
import { penduradosAntesDa, suspensos } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

interface Jogo {
  id: number;
  etapa: string;
  rodada: number;
  dia: string;
  hora: number;
  mandante: TimeId;
  visitante: TimeId;
}
const jogosDaCopa = async (temporadaId: number): Promise<Jogo[]> =>
  (
    await banco.query<Jogo>(
      `SELECT p.id, p.copa_etapa AS etapa, r.numero AS rodada, to_char(r.data, 'YYYY-MM-DD') AS dia,
              ((extract(hour from p.apito_inicial AT TIME ZONE 'UTC')::int + 21) % 24) AS hora, p.mandante_id AS mandante, p.visitante_id AS visitante
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa IS NOT NULL ORDER BY p.apito_inicial`,
      [temporadaId],
    )
  ).rows;
const jogar = async (js: Jogo[]) => {
  for (const [k, j] of js.entries()) await rodarPartida(banco, j.id, { seed: 100 + k });
};
const vencedor = async (id: number): Promise<TimeId> => {
  const r = (await banco.query<{ resultado: { vencedor: 'mandante' | 'visitante'; times: Record<string, TimeId> } }>(`SELECT resultado FROM partida WHERE id = $1`, [id])).rows[0]!.resultado;
  return r.times[r.vencedor]!;
};
const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };

describe('Copa A+B na Pré-temporada (ADR-0088)', () => {
  it('Resumo dos dias da Copa: título da Copa, placares sem divisão por Série, campeão no último dia', () => {
    const base = { temporada: 3, fase: 'MATA_MATA' as const, tabela: [], tabelaB: [], novosContratados: [], totalNovos: 0, candidatos: [] };
    const jogo = (mandante: TimeId, visitante: TimeId, serie: 'A' | 'B', penaltis: { mandante: number; visitante: number } | null = null) => ({ mandante, visitante, golsMandante: 1, golsVisitante: 1, penaltis, hora: 18, serie });
    const oitavas = legendaDoResumo({
      ...base,
      rodada: 101,
      placares: [jogo('ONC', 'LEA', 'A'), jogo('ARA', 'BOT', 'B')],
      craqueDaRodada: { rodada: 7, fase: 'LIGA', username: 'fulano', time: 'ONC', posicao: 'ATA', nota: 8, gols: 2, votos: 3 },
    });
    expect(oitavas.split('\n')[0]).toBe('📋 Resumo da Copa (Oitavas de Clássico) da Temporada 3');
    expect(oitavas).not.toContain('Série B\n');
    expect(oitavas).toContain('Quem é o Craque do dia');
    expect(oitavas).toContain('#copa');
    expect(oitavas).not.toContain('#matamata');
    const quartas = legendaDoResumo({ ...base, rodada: 102, placares: [jogo('ONC', 'TAT', 'A')], craqueDaRodada: { rodada: 101, fase: 'MATA_MATA', username: 'fulano', time: 'ONC', posicao: 'ATA', nota: 8, gols: 2, votos: 3 } });
    expect(quartas).toContain('⭐ Craque da Copa (Oitavas de Clássico)');
    expect(quartas).not.toContain('Semifinais da');
    const final = legendaDoResumo({ ...base, rodada: 103, placares: [jogo('ONC', 'TAT', 'A', { mandante: 3, visitante: 5 })] });
    expect(final.split('\n')[0]).toBe('📋 Resumo da Copa (Final) da Temporada 3');
    expect(final).toContain(`${IDENTIDADE.TAT.nome} é campeão da Copa da Temporada 3!`);
    expect(final).not.toContain('campeão da Série');
  });

  it('Troca de Time fechada da Janela até a Copa ter campeão: ninguém eliminado vai jogar o resto da Copa por outro Time', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const ids: string[] = [];
    for (const quem of ['um', 'dois']) {
      await processarComentario(banco, { igCommentId: `c-${quem}`, igMediaId: 'm', igUserId: quem, username: quem, texto: 'ENTRO ONCA ATA', comentadoEm: new Date('2026-11-29T12:00:00Z') }, { rodadaEmVotacao: null });
      ids.push((await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id);
    }
    // Segunda 30/11, 10h45 de Brasília: a Janela fechou no Corte do primeiro jogo da Copa (11h).
    const naCopa = await transferirJogador(banco, ids[0]!, { times: ['TAT'] }, { quando: new Date('2026-11-30T13:45:00Z'), ref: 't1' });
    expect(naCopa.resultado).toBe('TRANSFERENCIA_FECHADA');
    expect(naCopa.mensagem).toContain('Copa');
    expect((await transferirJogador(banco, ids[0]!, { times: ['TAT'] }, { quando: new Date('2026-12-02T20:00:00Z'), ref: 't2' })).resultado).toBe('TRANSFERENCIA_FECHADA');
    // Com campeão da Copa, reabre (a transferência da Temporada, antes da Fase de Liga).
    await banco.query(`UPDATE temporada SET campeao_copa_id = 'ONC' WHERE id = $1`, [t]);
    expect((await transferirJogador(banco, ids[1]!, { times: ['TAT'] }, { quando: new Date('2026-12-02T23:30:00Z'), ref: 't3' })).resultado).not.toBe('TRANSFERENCIA_FECHADA');
  });

  it('Craque do dia da Copa: uma lista só de 5, sem Série; no último dia o Resumo traz o campeão da Copa', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    let n = 0;
    for (const time of ['ONC', 'LEA', 'ARA', 'BOT', 'TUC', 'COR'] as const) {
      for (const pos of ['ATA', 'MEI']) {
        const quem = `${time.toLowerCase()}${++n}`;
        await processarComentario(banco, { igCommentId: `c${n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${pos}`, comentadoEm: new Date('2026-11-29T12:00:00Z') }, { rodadaEmVotacao: null });
      }
    }
    await jogar(await jogosDaCopa(t));
    const rodada = async (numero: number) => (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = $2`, [t, numero])).rows[0]!.id;
    const r101 = await rodada(101);
    await fecharRodada(banco, r101);
    const cands = (await banco.query<{ serie: string; numero: number }>(`SELECT serie, numero FROM candidato WHERE rodada_id = $1 ORDER BY numero`, [r101])).rows;
    expect(cands.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(cands.every((c) => c.serie === 'A')).toBe(true);
    const d = await dadosDoResumo(banco, r101);
    expect(d.tabelaB).toBeUndefined();
    expect(d.candidatos.map((c) => c.rotulo)).toEqual(['1', '2', '3', '4', '5']);
    expect(d.candidatos.every((c) => c.serie === undefined) && d.placares.every((p) => p.serie === undefined)).toBe(true);
    expect(d.placares).toHaveLength(8);
    expect(d.campeaoCopa).toBeUndefined();
    // Até a Final: o campeão aparece no Resumo do último dia.
    for (let k = 0; k < 3; k++) {
      await avancarCopa(banco, t);
      await jogar((await jogosDaCopa(t)).filter((j) => j.rodada > 101));
    }
    const final = (await jogosDaCopa(t)).find((j) => j.etapa === 'FINAL')!;
    expect((await dadosDoResumo(banco, await rodada(103))).campeaoCopa).toBe(await vencedor(final.id));
  });

  it('quem se inscreve depois de a Janela fechar entra no Elenco, mas só joga a partir da Liga', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const inscrever = async (quem: string, em: string) => {
      await processarComentario(banco, { igCommentId: `c-${quem}`, igMediaId: 'm', igUserId: quem, username: quem, texto: 'ENTRO TUCANO ATA', comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
      return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
    };
    const cedo = await inscrever('cedo', '2026-11-29T12:00:00Z');
    // Segunda 30/11, 12h de Brasília: a Janela fechou às 10h30, e Tucano × Coruja é às 18h.
    const tarde = await inscrever('tarde', '2026-11-30T15:00:00Z');
    const jogo = (await jogosDaCopa(t)).find((j) => j.mandante === 'TUC')!;
    await jogar([jogo]);
    const escalados = (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM escalacao WHERE partida_id = $1 AND jogador_id IS NOT NULL`, [jogo.id])).rows.map((r) => r.id);
    expect(escalados).toContain(cedo);
    expect(escalados).not.toContain(tarde);
  });

  it('Título da Série e Craque da Temporada só com jogos da Série: quem só jogou a Copa pelo campeão não leva', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const ids: string[] = [];
    for (const quem of ['so-copa', 'na-serie', 'dois-na-serie']) {
      await processarComentario(banco, { igCommentId: `c-${quem}`, igMediaId: 'm', igUserId: quem, username: quem, texto: 'ENTRO ONCA ATA', comentadoEm: new Date('2026-11-29T12:00:00Z') }, { rodadaEmVotacao: null });
      ids.push((await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id);
    }
    const [soCopa, naSerie, doisNaSerie] = ids as [string, string, string];
    await jogar((await jogosDaCopa(t)).filter((j) => j.mandante === 'ONC'));
    // Depois da Copa, "so-copa" sai do Elenco (banido): os 3 jogos da Série são só de "na-serie".
    await banco.query(`UPDATE jogador SET banido = true WHERE id = $1`, [soCopa]);
    const liga = (
      await banco.query<{ id: number }>(
        `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.fase = 'LIGA' AND (p.mandante_id = 'ONC' OR p.visitante_id = 'ONC') ORDER BY p.apito_inicial LIMIT 3`,
        [t],
      )
    ).rows;
    for (const [k, p] of liga.entries()) {
      // "dois-na-serie" joga a Copa e só 2 jogos da Série: 3 no total, mas 2 para o Craque da Temporada.
      if (k === 2) await banco.query(`UPDATE jogador SET banido = true WHERE id = $1`, [doisNaSerie]);
      await rodarPartida(banco, p.id, { seed: 200 + k });
    }
    await banco.query(`UPDATE jogador SET banido = false WHERE id = ANY($1::bigint[])`, [[soCopa, doisNaSerie]]);
    const jogos = async (id: string) => Number((await banco.query<{ n: string }>(`SELECT count(*) AS n FROM escalacao WHERE jogador_id = $1 AND nota IS NOT NULL`, [id])).rows[0]!.n);
    expect([await jogos(soCopa), await jogos(doisNaSerie), await jogos(naSerie)]).toEqual([1, 3, 4]);
    // Moedas do Título da Série A.
    await banco.query(`UPDATE temporada SET campeao_id = 'ONC' WHERE id = $1`, [t]);
    await pagarTitulos(banco, t);
    const pagos = (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM lancamento_moedas WHERE tipo = 'TITULO'`)).rows.map((r) => r.id);
    expect(pagos).toContain(naSerie);
    expect(pagos).not.toContain(soCopa);
    // Candidatos a Craque da Temporada: a Copa não entra na conta dos 3 jogos.
    // A Rodada da Final das Séries (o Mata-mata nasce depois da Liga): basta a Final da A existir.
    const numeroDaFinal = estruturaDaLiga(7).rodadaDaFinal;
    const rodadaDaFinal = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', '2026-12-11') RETURNING id`, [t, numeroDaFinal])).rows[0]!.id;
    await banco.query(`INSERT INTO partida (rodada_id, apito_inicial, mandante_id, visitante_id, serie) VALUES ($1, '2026-12-11T21:00:00Z', 'ONC', 'CAP', 'A')`, [rodadaDaFinal]);
    await fecharRodada(banco, rodadaDaFinal);
    const candidatos = (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM candidato WHERE rodada_id = $1`, [rodadaDaFinal])).rows.map((r) => r.id);
    expect(candidatos).toContain(naSerie);
    expect(candidatos).not.toContain(soCopa);
    expect(candidatos).not.toContain(doisNaSerie);
  });

  it('Cartões da Copa só valem na Copa: suspendem no jogo seguinte da Copa, não na Fase de Liga', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    // Dois Jogadores em cada lado de Onça × Leão.
    const doTime: Record<string, string[]> = { ONC: [], LEA: [] };
    let n = 0;
    for (const time of ['ONC', 'LEA'] as const) {
      for (const pos of ['ATA', 'MEI']) {
        const quem = `${time.toLowerCase()}${++n}`;
        await processarComentario(banco, { igCommentId: `c${n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${pos}`, comentadoEm: new Date('2026-11-29T12:00:00Z') }, { rodadaEmVotacao: null });
        doTime[time]!.push((await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id);
      }
    }
    const oitavas = await jogosDaCopa(t);
    await jogar(oitavas);
    const jogo = oitavas.find((j) => j.mandante === 'ONC')!;
    const time = await vencedor(jogo.id);
    const [expulso, pendurado] = doTime[time]!;
    await banco.query(`UPDATE escalacao SET expulso = true WHERE partida_id = $1 AND jogador_id = $2`, [jogo.id, expulso]);
    await banco.query(`UPDATE escalacao SET amarelos = 1, expulso = false WHERE partida_id = $1 AND jogador_id = $2`, [jogo.id, pendurado]);
    // Na Copa, valem: o expulso cumpre nas Quartas e o outro chega pendurado.
    await avancarCopa(banco, t);
    const quarta = (await jogosDaCopa(t)).find((j) => j.etapa === 'QUARTAS' && (j.mandante === time || j.visitante === time))!;
    expect([...(await suspensos(banco, time, quarta.id))]).toEqual([expulso]);
    expect([...(await penduradosAntesDa(banco, quarta.id, [expulso!, pendurado!]))]).toEqual([pendurado]);
    // Na Fase de Liga, não: nem Suspensão nem Pendurado vindos da Copa.
    const liga = (
      await banco.query<{ id: number }>(
        `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.fase = 'LIGA' AND (p.mandante_id = $2 OR p.visitante_id = $2) ORDER BY p.apito_inicial LIMIT 1`,
        [t, time],
      )
    ).rows[0]!;
    expect([...(await suspensos(banco, time, liga.id))]).toEqual([]);
    expect([...(await penduradosAntesDa(banco, liga.id, [expulso!, pendurado!]))]).toEqual([]);
  });

  it('as Oitavas de Clássico são os 8 segundos Clássicos e cobrem os 16 Times', () => {
    expect(OITAVAS_DE_CLASSICO).toEqual(CLASSICOS.slice(8, 16));
    expect(cabeACopa([...TIMES_FUNDADORES, ...TIMES_NOVOS])).toBe(true);
    expect(cabeACopa(TIMES_FUNDADORES)).toBe(false);
  });

  it('nasce com a Temporada da T3: Oitavas no 1º dia (11h às 18h) e a Fase de Liga 3 dias depois', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const oitavas = await jogosDaCopa(t);
    expect(oitavas).toHaveLength(8);
    expect(oitavas.every((j) => j.etapa === 'OITAVAS' && j.rodada === 101 && j.dia === '2026-11-30')).toBe(true);
    expect(oitavas.map((j) => j.hora)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    // Quem manda é o fundador do Clássico (Série A).
    expect(oitavas.map((j) => [j.mandante, j.visitante])).toEqual(OITAVAS_DE_CLASSICO.map(([a, b]) => [a, b]));
    const primeira = (await banco.query<{ dia: string }>(`SELECT to_char(data, 'YYYY-MM-DD') AS dia FROM rodada WHERE temporada_id = $1 AND numero = 1`, [t])).rows[0]!;
    expect(primeira.dia).toBe('2026-12-03');
    expect(await estruturaDaTemporada(banco, t)).toEqual(estruturaDaLiga(7));
  });

  it('a T2 não tem Copa', async () => {
    const t = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-30', seed: 4, series });
    expect(await jogosDaCopa(t)).toHaveLength(0);
  });

  it('avança a chave: Quartas no dia seguinte, Semifinais no mesmo dia, Final no outro; campeão ganha a bronze', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    expect(await avancarCopa(banco, t)).toBe('NADA');
    const oitavas = await jogosDaCopa(t);
    await jogar(oitavas);
    expect(await avancarCopa(banco, t)).toBe('QUARTAS_CRIADAS');
    expect(await avancarCopa(banco, t)).toBe('NADA');
    const quartas = (await jogosDaCopa(t)).filter((j) => j.etapa === 'QUARTAS');
    expect(quartas.map((j) => [j.dia, j.hora, j.rodada])).toEqual([11, 12, 13, 14].map((h) => ['2026-12-01', h, 102]));
    // A chave é fixa: vencedor do jogo 1 contra o do jogo 2...
    const v = await Promise.all(oitavas.map((j) => vencedor(j.id)));
    expect(quartas.map((j) => [j.mandante, j.visitante].sort())).toEqual([0, 2, 4, 6].map((k) => [v[k]!, v[k + 1]!].sort()));

    await jogar(quartas);
    expect(await avancarCopa(banco, t)).toBe('SEMIFINAIS_CRIADAS');
    const semis = (await jogosDaCopa(t)).filter((j) => j.etapa === 'SEMIFINAL');
    expect(semis.map((j) => [j.dia, j.hora, j.rodada])).toEqual([['2026-12-01', 17, 102], ['2026-12-01', 18, 102]]);

    await jogar(semis);
    expect(await avancarCopa(banco, t)).toBe('FINAL_CRIADA');
    const [final] = (await jogosDaCopa(t)).filter((j) => j.etapa === 'FINAL');
    expect([final!.dia, final!.hora, final!.rodada]).toEqual(['2026-12-02', 18, 103]);

    await jogar([final!]);
    expect(await avancarCopa(banco, t)).toBe('COPA_ENCERRADA');
    expect(await avancarCopa(banco, t)).toBe('NADA');
    const campeao = await vencedor(final!.id);
    expect((await banco.query<{ c: TimeId }>(`SELECT campeao_copa_id AS c FROM temporada WHERE id = $1`, [t])).rows[0]!.c).toBe(campeao);
    expect((await estrelasNoBanco(banco))[campeao]).toMatchObject({ bronze: 1 });
  });
});
