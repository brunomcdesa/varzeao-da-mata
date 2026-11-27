import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { conferirCapitaes } from '../src/capitaoAtivo.js';
import { aplicarEscolha, ordemDoCapitao } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let n = 0;
const comentar = (user: string, texto: string) =>
  processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: `ig-${user}`, username: user, texto, comentadoEm: new Date('2026-11-28T12:00:00Z') }, { rodadaEmVotacao: null, comVinculo: new Set(), responder: async () => undefined });
const idDe = async (user: string) => (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador_todos WHERE username = $1`, [user])).rows[0]!.id;
const PRE = new Date('2026-11-28T12:00:00Z');

beforeEach(async () => {
  banco = await bancoDeTeste();
  await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 3, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
});
afterEach(async () => {
  await banco.fechar();
});

/** Os jogos da Onça em ordem (só os da Série; com `copa`, só os da Copa) e um jeito de dar o jogo por terminado. */
async function jogosDaOnca(copa = false) {
  const jogos = (
    await banco.query<{ id: number; apito: Date }>(
      `SELECT id, apito_inicial AS apito FROM partida WHERE (mandante_id = 'ONC' OR visitante_id = 'ONC') AND (copa_etapa IS NOT NULL) = $1 ORDER BY apito_inicial`,
      [copa],
    )
  ).rows;
  const terminar = (k: number) => banco.query(`UPDATE partida SET status = 'SIMULADA', resultado = '{}'::jsonb WHERE id = $1`, [jogos[k]!.id]);
  const depois = (k: number) => new Date(new Date(jogos[k]!.apito).getTime() + 3 * 3_600_000);
  return { jogos, terminar, depois };
}

describe('Capitão ativo (ADR-0114)', () => {
  it('3 jogos sem escolha de Capitão: a faixa vai para o próximo ativo da ordem, com Aviso', async () => {
    for (let k = 0; k < 4; k++) await comentar(`a${k}`, 'ENTRO Onça atacante');
    const [a0, a1, a2] = [await idDe('a0'), await idDe('a1'), await idDe('a2')];
    const vinc = new Set([a0, a1, a2]);
    for (const id of [a0, a2]) await banco.query(`INSERT INTO aviso_aparelho (endpoint, p256dh, auth, times, jogador_id) VALUES ($1, 'B', 'A', '{}', $2)`, [`https://push.exemplo.com/${id}`, id]);
    const { jogos, terminar, depois } = await jogosDaOnca();
    expect(await conferirCapitaes(banco, PRE, vinc)).toEqual([]);
    for (let k = 0; k < 2; k++) await terminar(k);
    // a2 confirmou Presença num dos jogos: está ativo; a1 não.
    await banco.query(`INSERT INTO presenca (partida_id, jogador_id, confirmado_em) VALUES ($1, $2, $3)`, [jogos[1]!.id, a2, PRE.toISOString()]);
    expect(await conferirCapitaes(banco, depois(1), vinc)).toEqual([]);
    await terminar(2);
    expect(await conferirCapitaes(banco, depois(2), vinc)).toEqual([{ time: 'ONC', saiu: a0, entrou: a2 }]);
    expect((await ordemDoCapitao(banco, 'ONC'))[0]).toBe(a2);
    expect(await ordemDoCapitao(banco, 'ONC')).not.toContain(a0);
    const avisos = (await banco.query<{ jogador_id: string; titulo: string }>(`SELECT jogador_id::text AS jogador_id, titulo FROM aviso_pessoal ORDER BY id`)).rows;
    expect(avisos).toEqual([{ jogador_id: a2, titulo: 'A faixa é sua' }, { jogador_id: a0, titulo: 'Você perdeu a faixa' }]);
    expect(a1).not.toBe(a2);
  });

  it('jogos da Copa contam como os da Série: 3 jogos do Time sem escolha tiram a faixa (ADR-0088)', async () => {
    for (let k = 0; k < 3; k++) await comentar(`d${k}`, 'ENTRO Onça atacante');
    const d0 = await idDe('d0');
    const vinc = new Set([d0, await idDe('d1')]);
    const copa = await jogosDaOnca(true);
    const liga = await jogosDaOnca();
    await conferirCapitaes(banco, PRE, vinc);
    await copa.terminar(0);
    await liga.terminar(0);
    expect(await conferirCapitaes(banco, liga.depois(0), vinc)).toEqual([]);
    // O 3º jogo do Time sem escolha (um da Copa e dois da Série): a faixa sai.
    await liga.terminar(1);
    expect(await conferirCapitaes(banco, liga.depois(1), vinc)).toMatchObject([{ saiu: d0 }]);
  });

  it('uma escolha de Capitão segura a faixa; a conta recomeça a partir dela', async () => {
    for (let k = 0; k < 3; k++) await comentar(`b${k}`, 'ENTRO Onça atacante');
    const b0 = await idDe('b0');
    const vinc = new Set([b0, await idDe('b1')]);
    const { terminar, depois } = await jogosDaOnca();
    await conferirCapitaes(banco, PRE, vinc);
    await terminar(0);
    await terminar(1);
    // A Formação escolhida pelo Capitão no site conta como escolha.
    expect((await aplicarEscolha(banco, b0, { tipo: 'FORMACAO', valor: '2-3-1' }, depois(1), async () => vinc)).ok).toBe(true);
    await terminar(2);
    await terminar(3);
    expect(await conferirCapitaes(banco, depois(3), vinc)).toEqual([]);
    await terminar(4);
    expect(await conferirCapitaes(banco, depois(4), vinc)).toHaveLength(1);
  });

  it('perde também a faixa posta à mão; fora da ordem só nesta Temporada', async () => {
    for (let k = 0; k < 3; k++) await comentar(`c${k}`, 'ENTRO Onça atacante');
    const [c0, c2] = [await idDe('c0'), await idDe('c2')];
    await banco.query(`INSERT INTO capitao_a_mao (time_id, jogador_id, escolhido_em) VALUES ('ONC', $1, now())`, [c2]);
    const vinc = new Set([c0, c2]);
    const { terminar, depois } = await jogosDaOnca();
    await conferirCapitaes(banco, PRE, vinc);
    for (let k = 0; k < 3; k++) await terminar(k);
    const [troca] = await conferirCapitaes(banco, depois(2), vinc);
    expect(troca).toMatchObject({ saiu: c2 });
    expect((await banco.query(`SELECT 1 FROM capitao_a_mao WHERE jogador_id = $1`, [c2])).rows).toHaveLength(0);
    // Na Temporada seguinte, volta à ordem.
    expect(await ordemDoCapitao(banco, 'ONC' as TimeId)).not.toContain(c2);
    await criarTemporada(banco, { numero: 4, primeiraRodada: '2027-03-01', seed: 4, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
    expect(await ordemDoCapitao(banco, 'ONC' as TimeId)).toContain(c2);
  });
});
