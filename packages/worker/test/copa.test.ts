import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDENTIDADE, OITAVAS_DE_CLASSICO, CLASSICOS, TIMES_FUNDADORES, TIMES_NOVOS, estruturaDaLiga, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario, transferirJogador } from '../src/coletar.js';
import { avancarCopa, cabeACopa } from '../src/copa.js';
import { legendaDoResumo } from '../src/jobs.js';
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
    expect(semis.map((j) => [j.dia, j.hora, j.rodada])).toEqual([['2026-12-01', 16, 102], ['2026-12-01', 17, 102]]);

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
