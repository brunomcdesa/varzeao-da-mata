import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FASE_DO_CLASSICO, TIMES_DA_EXPANSAO, TIMES_FUNDADORES, TIMES_NOVOS, ehClassico, repescagemDaCopa, quartasComRepescagem, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada, horariosDaLiga } from '../src/calendario.js';
import { avancarCopa, cabeACopa, formatoDaCopa } from '../src/copa.js';
import { conferirExpansao, lotacao } from '../src/expansao.js';
import { avancarMataMata, estruturaDaTemporada } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
import { finalistas, seriesDaTemporada } from '../src/series.js';
import { processarComentario } from '../src/coletar.js';
import { legendaDoFimDaTemporada } from '../src/jobs.js';
import { tabela } from '../src/tabela.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
const ordenados = (xs: readonly TimeId[]) => [...xs].sort();

/** Inscreve `n` Jogadores direto no banco, espalhados pelos Times. */
let lote = 0;
async function encher(times: readonly TimeId[], n: number) {
  lote++;
  await banco.query(
    `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, inscrito_em)
     SELECT 'cheio' || $3 || '_' || g, 'cheio' || $3 || '_' || g, ($1::text[])[1 + g % array_length($1::text[], 1)], (ARRAY['GOL','ZAG','MEI','ATA'])[1 + g % 4], 60, now()
     FROM generate_series(1, $2::int) g`,
    [times, n, lote],
  );
}

async function jogarRodada(t: number, numero: number) {
  const ps = (
    await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = $2 ORDER BY p.apito_inicial, p.serie`, [t, numero])
  ).rows;
  for (const { id } of ps) await rodarPartida(banco, id, { seed: id * 13 });
}

const jogosDaCopa = async (t: number, etapa: string) =>
  (
    await banco.query<{ id: number; dia: string; hora: number; mandante: TimeId; visitante: TimeId }>(
      `SELECT p.id, to_char(r.data, 'YYYY-MM-DD') AS dia, ((extract(hour from p.apito_inicial AT TIME ZONE 'UTC')::int + 21) % 24) AS hora,
              p.mandante_id AS mandante, p.visitante_id AS visitante
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa = $2 ORDER BY p.apito_inicial`,
      [t, etapa],
    )
  ).rows;

describe('Expansão por lotação (ADR-0093)', () => {
  it('o gatilho é 90% das 224 vagas (202 Jogadores), só da T3 em diante', async () => {
    const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    await encher([...TIMES_FUNDADORES, ...TIMES_NOVOS], 201);
    expect(await lotacao(banco, t3)).toEqual({ ocupadas: 201, vagas: 224, precisa: 202 });
    expect(await conferirExpansao(banco, t3)).toBe(false);
    await encher(['CAP'], 1);
    expect(await conferirExpansao(banco, t3)).toBe(true);
  });

  it('a Rodada a mais da Expansão: B das 9h às 13h e A das 14h às 18h, um jogo por hora', () => {
    expect(horariosDaLiga('B', true, 5)).toEqual([9, 10, 11, 12, 13]);
    expect(horariosDaLiga('A', true, 5)).toEqual([14, 15, 16, 17, 18]);
    expect(horariosDaLiga('A', true, 4)).toEqual([15, 16, 17, 18]);
  });

  it('a chave da Copa de 20: Fase do Clássico com os 4 Times novos, Repescagem dos 4 piores e Quartas', () => {
    expect(FASE_DO_CLASSICO).toHaveLength(10);
    expect(FASE_DO_CLASSICO.every(([a, b]) => ehClassico(a, b))).toBe(true);
    expect(formatoDaCopa([...TIMES_FUNDADORES, ...TIMES_NOVOS, ...TIMES_DA_EXPANSAO])).toBe(20);
    expect(cabeACopa([...TIMES_FUNDADORES, ...TIMES_NOVOS])).toBe(true);
    const v = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as unknown as TimeId[];
    expect(repescagemDaCopa(v)).toEqual([['g', 'j'], ['h', 'i']]);
    expect(quartasComRepescagem(v.slice(0, 6), ['g', 'h'] as unknown as [TimeId, TimeId])).toEqual([['a', 'g'], ['d', 'e'], ['b', 'h'], ['c', 'f']]);
  });

  it('na Temporada seguinte: ninguém cai, 2 sobem, 4 Times novos na B, 10 por Série, 9 Rodadas e a Copa de 20', async () => {
    const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    for (let n = 1; n <= 7; n++) {
      await jogarRodada(t3, n);
      // A lotação chega aos 90% antes do fim da Fase de Liga.
      if (n === 7) await encher([...TIMES_FUNDADORES, ...TIMES_NOVOS], 202);
      await avancarMataMata(banco, t3);
    }
    expect((await banco.query<{ expansao: boolean }>(`SELECT expansao FROM temporada WHERE id = $1`, [t3])).rows[0]!.expansao).toBe(true);
    for (const n of [8, 9]) {
      await jogarRodada(t3, n);
      await avancarMataMata(banco, t3);
    }
    const sobem = await finalistas(banco, t3, 'B');
    const s3 = await seriesDaTemporada(banco, t3);
    const ordemA = (await tabela(banco, t3, 'A')).map((l) => l.time);

    const t4 = await criarTemporada(banco, { numero: 4, primeiraRodada: '2026-12-14', seed: 5 });
    const s4 = await seriesDaTemporada(banco, t4);
    expect(ordenados(s4.A)).toEqual(ordenados([...s3.A, ...sobem]));
    expect(ordenados(s4.B)).toEqual(ordenados([...s3.B.filter((x) => !sobem.includes(x)), ...TIMES_DA_EXPANSAO]));
    expect(await estruturaDaTemporada(banco, t4)).toMatchObject({ rodadasDaLiga: 9 });
    const r1 = (
      await banco.query<{ serie: string; hora: number }>(
        `SELECT p.serie, ((extract(hour from p.apito_inicial AT TIME ZONE 'UTC')::int + 21) % 24) AS hora FROM partida p JOIN rodada r ON r.id = p.rodada_id
         WHERE r.temporada_id = $1 AND r.numero = 1 ORDER BY p.apito_inicial`,
        [t4],
      )
    ).rows;
    expect(r1.map((p) => [p.serie, p.hora])).toEqual([9, 10, 11, 12, 13].map((h) => ['B', h]).concat([14, 15, 16, 17, 18].map((h) => ['A', h])));

    // Copa de 20: dia 1, os 10 Clássicos das 9h às 18h.
    const classico = await jogosDaCopa(t4, 'CLASSICO');
    expect(classico.map((j) => j.hora)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(classico.every((j) => j.dia === '2026-12-14')).toBe(true);
    for (const j of classico) await rodarPartida(banco, j.id, { seed: j.id });
    expect(await avancarCopa(banco, t4)).toBe('REPESCAGEM_CRIADA');
    const rep = await jogosDaCopa(t4, 'REPESCAGEM');
    expect(rep.map((j) => [j.dia, j.hora])).toEqual([['2026-12-15', 11], ['2026-12-15', 12]]);
    // Os Times novos que passaram da Fase do Clássico contam como a pior campanha: vão à Repescagem.
    const vencedores = await Promise.all(classico.map(async (j) => {
      const r = (await banco.query<{ resultado: { vencedor: 'mandante' | 'visitante'; times: Record<string, TimeId> } }>(`SELECT resultado FROM partida WHERE id = $1`, [j.id])).rows[0]!.resultado;
      return r.times[r.vencedor]!;
    }));
    const naRepescagem = rep.flatMap((j) => [j.mandante, j.visitante]);
    for (const novo of vencedores.filter((t) => TIMES_DA_EXPANSAO.includes(t))) expect(naRepescagem).toContain(novo);
    // E o último da A da T3 (se passou) também é dos piores entre os da A.
    void ordemA;
    for (const j of rep) await rodarPartida(banco, j.id, { seed: j.id });
    expect(await avancarCopa(banco, t4)).toBe('QUARTAS_CRIADAS');
    const quartas = await jogosDaCopa(t4, 'QUARTAS');
    expect(quartas.map((j) => [j.dia, j.hora])).toEqual([14, 15, 16, 17].map((h) => ['2026-12-15', h]));
    for (const j of quartas) await rodarPartida(banco, j.id, { seed: j.id });
    expect(await avancarCopa(banco, t4)).toBe('SEMIFINAIS_CRIADAS');
    const semis = await jogosDaCopa(t4, 'SEMIFINAL');
    expect(semis.map((j) => [j.dia, j.hora])).toEqual([['2026-12-16', 15], ['2026-12-16', 16]]);
    for (const j of semis) await rodarPartida(banco, j.id, { seed: j.id });
    expect(await avancarCopa(banco, t4)).toBe('FINAL_CRIADA');
    const final = await jogosDaCopa(t4, 'FINAL');
    expect(final.map((j) => [j.dia, j.hora])).toEqual([['2026-12-16', 18]]);
    for (const j of final) await rodarPartida(banco, j.id, { seed: j.id });
    expect(await avancarCopa(banco, t4)).toBe('COPA_ENCERRADA');
  }, 400_000);

  describe('Elencos dos Times novos', () => {
    const respostas: string[] = [];
    const ctx = { rodadaEmVotacao: null, responder: async (_id: string, texto: string) => void respostas.push(texto) };
    const comentario = (id: string, user: string, texto: string, em: string) => ({ igCommentId: id, igMediaId: 'm', igUserId: user, username: user, texto, comentadoEm: new Date(em) });
    const novosNaA = TIMES_NOVOS.slice(0, 2);
    const s4 = { A: [...TIMES_FUNDADORES, ...novosNaA], B: [...TIMES_NOVOS.slice(2), ...TIMES_DA_EXPANSAO] };
    const fundadorDe = async (user: string) =>
      (await banco.query<{ time_id: TimeId }>(`SELECT f.time_id FROM fundador f JOIN jogador j ON j.id = f.jogador_id WHERE j.username = $1`, [user])).rows.map((r) => r.time_id);

    /** T3 encerrada com a Expansão marcada e a T4 na Pré-temporada, estreando em 14/12. */
    async function t4() {
      const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
      await banco.query(`UPDATE temporada SET expansao = true, status = 'ENCERRADA' WHERE id = $1`, [t3]);
      return criarTemporada(banco, { numero: 4, primeiraRodada: '2026-12-14', seed: 5, series: s4 });
    }

    it('quem entra num Time novo antes do primeiro jogo dele vira Fundador; depois do Corte, não', async () => {
      await t4();
      respostas.length = 0;
      expect(await processarComentario(banco, comentario('c1', 'gatinho', 'ENTRO Gato atacante', '2026-12-10T12:00:00Z'), ctx)).toBe('INSCRITO');
      expect(await fundadorDe('gatinho')).toEqual(['GAT']);
      expect(respostas.at(-1)).toMatch(/Fundador do Gato/);
      expect(await processarComentario(banco, comentario('c2', 'atrasado', 'ENTRO Aranha zagueiro', '2026-12-14T13:00:00Z'), ctx)).toBe('INSCRITO');
      expect(await fundadorDe('atrasado')).toEqual([]);
      // Time antigo não dá Fundador.
      expect(await processarComentario(banco, comentario('c3', 'oncinha', 'ENTRO Onça meia', '2026-12-10T12:00:00Z'), ctx)).toBe('INSCRITO');
      expect(await fundadorDe('oncinha')).toEqual([]);
    });

    it('com Séries de 10, Posição cheia manda para outro Time com vaga, como nas Séries de 8', async () => {
      await t4();
      for (let k = 0; k < 4; k++) expect(await processarComentario(banco, comentario(`a${k}`, `ata${k}`, 'ENTRO Onça atacante', '2026-12-10T12:00:00Z'), ctx)).toBe('INSCRITO');
      expect(await processarComentario(banco, comentario('a4', 'ata4', 'ENTRO Onça atacante', '2026-12-10T12:00:00Z'), ctx)).toBe('REALOCADO');
      const time = (await banco.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE username = 'ata4'`)).rows[0]!.time_id;
      expect(s4.A).toContain(time);
      expect(time).not.toBe('ONC');
    });

    it('na Janela, o veterano troca de graça para um Time novo: não gasta a troca da Janela e vira Fundador', async () => {
      await t4();
      await processarComentario(banco, comentario('v0', 'veterano', 'ENTRO Onça meia', '2026-12-01T12:00:00Z'), ctx);
      expect(await processarComentario(banco, comentario('v1', 'veterano', 'TRANSFERIR Preguiça', '2026-12-10T12:00:00Z'), ctx)).toBe('TRANSFERIDO');
      respostas.length = 0;
      expect(await processarComentario(banco, comentario('v2', 'veterano', 'TRANSFERIR Rato', '2026-12-11T12:00:00Z'), ctx)).toBe('TRANSFERIDO');
      expect(respostas.at(-1)).toMatch(/de graça/);
      expect(await fundadorDe('veterano')).toEqual(['RAT']);
      // A troca da Janela já tinha sido usada na Preguiça: para um Time antigo, não dá mais.
      expect(await processarComentario(banco, comentario('v3', 'veterano', 'TRANSFERIR Capivara', '2026-12-12T12:00:00Z'), ctx)).toBe('TRANSFERENCIA_USADA');
    });

    it('o Resumo da Temporada anuncia a Expansão na legenda', () => {
      const craque = { username: 'craque', time: 'ONC' as TimeId, jogos: 7, gols: 5, media: 7.5, votos: 30 };
      const com = legendaDoFimDaTemporada(3, undefined, craque, { numero: 4, inicio: '2026-12-14' }, null, true);
      expect(com).toMatch(/A Liga cresceu! Na Temporada 4 entram 4 Times novos na Série B: .*Gato.*Rato.*Escorpião.* e .*Aranha/);
      expect(legendaDoFimDaTemporada(3, undefined, craque, { numero: 4, inicio: '2026-12-14' }, null, false)).not.toMatch(/cresceu/);
    });
  });
});
