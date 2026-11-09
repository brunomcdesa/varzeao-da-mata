import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario, transferirJogador } from '../src/coletar.js';
import { interpretar } from '../src/comandos.js';
import { escalarPartida, ordemDoRodizio } from '../src/escalacao.js';
import { rodarPartida } from '../src/partida.js';
import { aplicarEscolha, capitaoDaPartida, ordemDoCapitao, suspensos } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

const ninguem = async () => new Set<string>();
let n = 0;
async function inscrever(time: TimeId, posicao: string, quem = `${time}_${posicao}_${++n}`.toLowerCase(), em = '2026-11-17T12:00:00Z'): Promise<string> {
  await processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}
const primeiraPartida = async (temporadaId: number, time: TimeId) =>
  (
    await banco.query<{ id: number; mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.id, p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = $2 OR p.visitante_id = $2) ORDER BY p.apito_inicial LIMIT 1`,
      [temporadaId, time],
    )
  ).rows[0]!;
const novaT2 = () => criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });

describe('Temporada 2 no worker', () => {
  it('na Temporada 1 as escolhas são recusadas e a Partida é simulada na versão 5', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    const id = await inscrever('CAP', 'ATA', 'na_t1', '2026-11-06T12:00:00Z');
    const r = await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'ARTILHEIRO' }, new Date('2026-11-06T13:00:00Z'), ninguem);
    expect(r).toEqual({ ok: false, mensagem: 'Isso chega na Temporada 2.' });
    expect(await processarComentario(banco, { igCommentId: 'conf1', igMediaId: 'm', igUserId: 'na_t1', username: 'na_t1', texto: 'CONFIRMO', comentadoEm: new Date('2026-11-06T13:00:00Z') }, { rodadaEmVotacao: null })).toBe('PRESENCA_RECUSADA');
    const p = await primeiraPartida(t1, 'CAP');
    const res = (await rodarPartida(banco, p.id, { seed: 5 })).dados.resultado;
    expect(res.versaoSim).toBe(5);
    expect(res.postura).toBeUndefined();
    expect(res.desempenhos.every((d) => d.faltas === undefined)).toBe(true);
  });

  it('Especialização: só da própria Posição e uma troca por dia', async () => {
    await novaT2();
    const id = await inscrever('CAP', 'ATA');
    const dia = new Date('2026-11-17T15:00:00Z');
    expect((await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'PAREDAO' }, dia, ninguem)).ok).toBe(false);
    expect((await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'ARTILHEIRO' }, dia, ninguem)).ok).toBe(true);
    const deNovo = await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'DRIBLADOR' }, new Date('2026-11-17T20:00:00Z'), ninguem);
    expect(deNovo.ok).toBe(false);
    expect((await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'DRIBLADOR' }, new Date('2026-11-18T12:00:00Z'), ninguem)).ok).toBe(true);
    expect((await banco.query<{ especializacao: string }>(`SELECT especializacao FROM jogador WHERE id = $1`, [id])).rows[0]!.especializacao).toBe('DRIBLADOR');
  });

  it('Postura: só o Capitão escolhe (o primeiro com Vínculo), e a simulação usa a escolha', async () => {
    const t2 = await novaT2();
    const veterano = await inscrever('ONC', 'MEI', 'veterano', '2026-11-10T12:00:00Z');
    const novato = await inscrever('ONC', 'ATA', 'novato', '2026-11-12T12:00:00Z');
    const p = await primeiraPartida(t2, 'ONC');
    expect(await ordemDoCapitao(banco, 'ONC')).toEqual([veterano, novato]);
    // Sem Vínculo do veterano, a faixa passa para o novato.
    expect(await capitaoDaPartida(banco, p.id, 'ONC', new Set([novato]))).toBe(novato);
    const antes = new Date('2026-11-18T12:00:00Z');
    expect((await aplicarEscolha(banco, veterano, { tipo: 'POSTURA', valor: 'OFENSIVA' }, antes, async () => new Set([novato]))).ok).toBe(false);
    expect((await aplicarEscolha(banco, novato, { tipo: 'POSTURA', valor: 'OFENSIVA' }, antes, async () => new Set([novato]))).ok).toBe(true);
    const res = (await rodarPartida(banco, p.id, { seed: 9 })).dados.resultado;
    expect(res.versaoSim).toBe(6);
    const lado = p.mandante_id === 'ONC' ? 'mandante' : 'visitante';
    expect(res.postura![lado]).toBe('OFENSIVA');
    expect(res.postura![lado === 'mandante' ? 'visitante' : 'mandante']).toBe('EQUILIBRADA');
  });

  it('Presença: quem confirmou passa na frente no rodízio, logo depois do Craque', () => {
    const base = { username: 'x', posicao: 'ATA' as const, ovr: 60, habilidades: { FIN: 60, PAS: 60, DRI: 60, DEF: 60, GOL: 60 }, ultimo: null, inscritoEm: new Date(0) };
    const jogouMais = { ...base, id: '1', jogos: 5 };
    const jogouMenos = { ...base, id: '2', jogos: 0 };
    expect(ordemDoRodizio(jogouMais, jogouMenos, null)).toBeGreaterThan(0);
    expect(ordemDoRodizio(jogouMais, jogouMenos, null, new Set(['1']))).toBeLessThan(0);
    expect(ordemDoRodizio(jogouMais, jogouMenos, '2', new Set(['1']))).toBeGreaterThan(0);
  });

  it('CONFIRMO marca Presença no próximo jogo do Time, e a Escalação respeita', async () => {
    expect(interpretar('CONFIRMO')).toEqual({ tipo: 'PRESENCA' });
    expect(interpretar('tô dentro!')).toEqual({ tipo: 'PRESENCA' });
    const t2 = await novaT2();
    const a = await inscrever('TAT', 'ATA', 'atacante_a', '2026-11-10T12:00:00Z');
    const b = await inscrever('TAT', 'ATA', 'atacante_b', '2026-11-11T12:00:00Z');
    const c = await inscrever('TAT', 'ATA', 'atacante_c', '2026-11-12T12:00:00Z');
    expect(await processarComentario(banco, { igCommentId: 'conf', igMediaId: 'm', igUserId: 'atacante_c', username: 'atacante_c', texto: 'CONFIRMO', comentadoEm: new Date('2026-11-18T10:00:00Z') }, { rodadaEmVotacao: null })).toBe('PRESENCA_CONFIRMADA');
    const p = await primeiraPartida(t2, 'TAT');
    const e = await escalarPartida(banco, p.id);
    const lado = p.mandante_id === 'TAT' ? 'mandante' : 'visitante';
    const atas = e.escalacoes[lado].jogadores.filter((j) => j.posicao === 'ATA').map((j) => j.jogadorId);
    // c chegou por último, mas confirmou: joga; a chegou primeiro e completa.
    expect(atas).toEqual([c, a]);
    expect(atas).not.toContain(b);
  });

  it('Suspensão: o expulso fica fora do jogo seguinte do Time', async () => {
    const t2 = await novaT2();
    const z1 = await inscrever('SAG', 'ZAG');
    await inscrever('SAG', 'ZAG');
    await inscrever('SAG', 'ZAG');
    const jogos = (
      await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = 'SAG' OR p.visitante_id = 'SAG') ORDER BY p.apito_inicial LIMIT 2`, [t2])
    ).rows;
    await rodarPartida(banco, jogos[0]!.id, { seed: 2 });
    expect([...(await suspensos(banco, 'SAG', jogos[1]!.id))]).toEqual([]);
    await banco.query(`UPDATE escalacao SET expulso = true WHERE partida_id = $1 AND jogador_id = $2`, [jogos[0]!.id, z1]);
    const escalado = (await banco.query(`SELECT 1 FROM escalacao WHERE partida_id = $1 AND jogador_id = $2`, [jogos[0]!.id, z1])).rows.length;
    expect(escalado).toBe(1);
    expect([...(await suspensos(banco, 'SAG', jogos[1]!.id))]).toEqual([z1]);
    const e = await escalarPartida(banco, jogos[1]!.id);
    expect([...e.escalacoes.mandante.jogadores, ...e.escalacoes.visitante.jogadores].map((j) => j.jogadorId)).not.toContain(z1);
  });

  it('Janela de Transferências: na Pré-temporada da T2 a troca não gasta a da Temporada', async () => {
    const t2 = await novaT2();
    const id = await inscrever('CAP', 'MEI');
    await inscrever('JAC', 'MEI');
    const quando = new Date('2026-11-17T13:00:00Z');
    const janela = await transferirJogador(banco, id, { times: ['JAC'] }, { quando, ref: 'j1' });
    expect(janela.resultado).toBe('TRANSFERIDO');
    expect((await transferirJogador(banco, id, { times: ['CAP'] }, { quando, ref: 'j2' })).resultado).toBe('TRANSFERENCIA_USADA');
    await banco.query(`UPDATE temporada SET status = 'EM_ANDAMENTO' WHERE id = $1`, [t2]);
    expect((await transferirJogador(banco, id, { times: ['CAP'] }, { quando, ref: 'j3' })).resultado).toBe('TRANSFERIDO');
  });

  it('a Escalação da T2 guarda a Especialização, o Treino e o Canto da hora', async () => {
    const t2 = await novaT2();
    const id = await inscrever('ARA', 'GOL');
    const agora = new Date('2026-11-17T15:00:00Z');
    await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'PEGADOR_DE_PENALTI' }, agora, ninguem);
    await aplicarEscolha(banco, id, { tipo: 'TREINO', valor: 'GOL' }, agora, ninguem);
    await aplicarEscolha(banco, id, { tipo: 'CANTO', valor: 'DIREITA' }, agora, ninguem);
    const p = await primeiraPartida(t2, 'ARA');
    const res: ResultadoPartida = (await rodarPartida(banco, p.id, { seed: 4 })).dados.resultado;
    const linha = (await banco.query<{ especializacao: string; treino: string; canto: string; amarelos: number | null }>(`SELECT especializacao, treino, canto, amarelos FROM escalacao WHERE partida_id = $1 AND jogador_id = $2`, [p.id, id])).rows[0]!;
    expect(linha).toMatchObject({ especializacao: 'PEGADOR_DE_PENALTI', treino: 'GOL', canto: 'DIREITA' });
    expect(linha.amarelos).not.toBeNull();
    expect(res.versaoSim).toBe(6);
  });
});
