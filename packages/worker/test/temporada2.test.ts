import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario, transferirJogador } from '../src/coletar.js';
import { interpretar } from '../src/comandos.js';
import { escalarPartida, montarEscalacao, ordemDoRodizio } from '../src/escalacao.js';
import { rodarPartida } from '../src/partida.js';
import { exportarSite } from '../src/site.js';
import { aplicarEscolha, capitaniaDoJogador, capitaoDaPartida, formacoesDaPartida, ordemDoCapitao, suspensos } from '../src/temporada2.js';
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

describe('Formação (ADR-0044)', () => {
  const nenhum = new Set<string>();
  /** Inscrição direta no banco (sem o limite de equilíbrio entre Elencos da coleta). */
  const direto = async (time: TimeId, posicao: string, quem: string, em = '2026-11-12T12:00:00Z') =>
    (
      await banco.query<{ id: string }>(
        `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) VALUES ($1, $1, $2, $3, 60, NULL, $4) RETURNING id::text AS id`,
        [quem, time, posicao, em],
      )
    ).rows[0]!.id;
  it('só o Capitão escolhe; a Postura continua a mesma e a simulação usa as duas', async () => {
    const t2 = await novaT2();
    const capitao = await inscrever('ONC', 'MEI', 'capitao_onc', '2026-11-10T12:00:00Z');
    const outro = await inscrever('ONC', 'ATA', 'outro_onc', '2026-11-12T12:00:00Z');
    const p = await primeiraPartida(t2, 'ONC');
    const antes = new Date('2026-11-18T12:00:00Z');
    const vinc = async () => new Set([capitao, outro]);
    expect((await aplicarEscolha(banco, outro, { tipo: 'FORMACAO', valor: '3-2-1' }, antes, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'FORMACAO', valor: '4-4-2' as never }, antes, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'FORMACAO', valor: '3-2-1' }, antes, vinc)).ok).toBe(true);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'POSTURA', valor: 'DEFENSIVA' }, antes, vinc)).ok).toBe(true);
    expect(await capitaniaDoJogador(banco, outro, antes, vinc)).toEqual({ eu: false, capitao: 'capitao_onc', postura: 'DEFENSIVA', formacao: '3-2-1' });
    // Depois do Corte a escolha já vale para o jogo seguinte: a deste fica travada.
    const depoisDoCorte = new Date(new Date((await banco.query<{ a: Date }>(`SELECT apito_inicial AS a FROM partida WHERE id = $1`, [p.id])).rows[0]!.a).getTime() - 10 * 60_000);
    await aplicarEscolha(banco, capitao, { tipo: 'FORMACAO', valor: '2-3-1' }, depoisDoCorte, vinc);
    expect((await formacoesDaPartida(banco, p.id, p.mandante_id, p.visitante_id))[p.mandante_id === 'ONC' ? 'mandante' : 'visitante']).toBe('3-2-1');

    const job = await rodarPartida(banco, p.id, { seed: 9, vinculos: new Set([capitao]) });
    const lado = p.mandante_id === 'ONC' ? 'mandante' : 'visitante';
    expect(job.dados.resultado.formacao![lado]).toBe('3-2-1');
    expect(job.dados.resultado.formacao![lado === 'mandante' ? 'visitante' : 'mandante']).toBe('2-2-2');
    expect(job.dados.resultado.postura![lado]).toBe('DEFENSIVA');
    expect(job.dados.escalacoes[lado].jogadores.map((j) => j.posicao)).toEqual(['GOL', 'ZAG', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA']);
  });

  it('vaga sem inscrito da Posição: quem sobrou de outra entra fora de posição, com o OVR da vaga; sem ninguém, a Base', async () => {
    const t2 = await novaT2();
    const meias = [await inscrever('TAT', 'MEI', 'm1'), await inscrever('TAT', 'MEI', 'm2'), await inscrever('TAT', 'MEI', 'm3')];
    const z1 = await inscrever('TAT', 'ZAG', 'z1');
    const corte = new Date('2026-11-30T00:00:00Z');
    const m = await montarEscalacao(banco, { time: 'TAT', temporadaId: t2, corte, t2: { suspensos: nenhum, confirmados: nenhum, formacao: '3-2-1' } });
    const js = m.escalacao.jogadores;
    expect(js.map((j) => j.posicao)).toEqual(['GOL', 'ZAG', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA']);
    expect(js[0]!.jogadorId).toBeNull(); // sem goleiro: Base (linha não vai para o gol)
    expect(js[1]!.jogadorId).toBe(z1);
    // O 3º meia (sobrou) cobre a 2ª vaga de zagueiro; a 3ª vaga de zagueiro e o ATA ficam com a Base.
    const fora = js.filter((j) => j.posicaoDeOrigem);
    expect(fora).toHaveLength(1);
    expect(fora[0]!.posicao).toBe('ZAG');
    expect(fora[0]!.posicaoDeOrigem).toBe('MEI');
    expect(meias).toContain(fora[0]!.jogadorId);
    const { ovrDasHabilidades } = await import('@liga/shared');
    expect(fora[0]!.ovr).toBe(ovrDasHabilidades('ZAG', fora[0]!.habilidades));
    expect(js.filter((j) => j.jogadorId === null).map((j) => j.posicao)).toEqual(['GOL', 'ZAG', 'ATA']);
    // Na Temporada 1 (sem regras da T2), a mesma lista não joga fora de posição.
    const t1 = await montarEscalacao(banco, { time: 'TAT', temporadaId: t2, corte });
    expect(t1.escalacao.jogadores.some((j) => j.posicaoDeOrigem)).toBe(false);
  });

  it('quem a Formação cortou passa na frente no jogo seguinte do Time', async () => {
    const t2 = await novaT2();
    const atacantes = [await inscrever('SAG', 'ATA', 'a1', '2026-11-10T12:00:00Z'), await inscrever('SAG', 'ATA', 'a2', '2026-11-11T12:00:00Z'), await inscrever('SAG', 'ATA', 'a3', '2026-11-12T12:00:00Z')];
    // Zagueiros e meias completos: ninguém joga fora de posição.
    for (const [pos, q] of [['ZAG', 'sz1'], ['ZAG', 'sz2'], ['MEI', 'sm1'], ['MEI', 'sm2'], ['MEI', 'sm3']] as const) await direto('SAG', pos, q);
    const corte = new Date('2026-11-30T00:00:00Z');
    const m = await montarEscalacao(banco, { time: 'SAG', temporadaId: t2, corte, t2: { suspensos: nenhum, confirmados: nenhum, formacao: '2-3-1' } });
    // No 2-2-2 entrariam a1 e a2; no 2-3-1 só a1 entra e a2 foi cortado.
    expect(m.escalacao.jogadores.filter((j) => j.posicao === 'ATA').map((j) => j.jogadorId)).toEqual([atacantes[0]]);
    expect(m.cortados).toEqual([atacantes[1]]);
    // No jogo seguinte, com o corte, a2 passa na frente de a3 (que jogou menos tanto quanto ele).
    const prox = await montarEscalacao(banco, { time: 'SAG', temporadaId: t2, corte, t2: { suspensos: nenhum, confirmados: nenhum, formacao: '2-3-1', cortados: new Set([atacantes[1]!]) } });
    expect(prox.escalacao.jogadores.find((j) => j.posicao === 'ATA')!.jogadorId).toBe(atacantes[1]);
    // No 2-2-2 ninguém é cortado.
    const padrao = await montarEscalacao(banco, { time: 'SAG', temporadaId: t2, corte, t2: { suspensos: nenhum, confirmados: nenhum } });
    expect(padrao.cortados).toEqual([]);
  });

  it('a Escalação grava quem foi cortado e quem jogou fora de posição', async () => {
    const t2 = await novaT2();
    const capitao = await inscrever('PRE', 'ATA', 'cap_pre', '2026-11-10T12:00:00Z');
    const a2 = await inscrever('PRE', 'ATA', 'a2_pre', '2026-11-11T12:00:00Z');
    await inscrever('PRE', 'ATA', 'a3_pre', '2026-11-12T12:00:00Z');
    for (const [pos, q] of [['ZAG', 'z1_pre'], ['ZAG', 'z2_pre'], ['ZAG', 'z3_pre'], ['MEI', 'm1_pre'], ['MEI', 'm2_pre']] as const) await direto('PRE', pos, q);
    const p = await primeiraPartida(t2, 'PRE');
    // O rival joga no 2-2-2 só com meias: o 3º meia cobre uma vaga de zagueiro.
    const rival = p.mandante_id === 'PRE' ? p.visitante_id : p.mandante_id;
    for (const q of ['rm1', 'rm2', 'rm3']) await direto(rival, 'MEI', q);
    const vinc = async () => new Set([capitao]);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'FORMACAO', valor: '3-2-1' }, new Date('2026-11-18T12:00:00Z'), vinc)).ok).toBe(true);
    await escalarPartida(banco, p.id, { vinculos: new Set([capitao]) });
    // 3-2-1: um atacante joga na frente; o 2º (que entraria no 2-2-2) foi cortado.
    const cortados = (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM corte_da_formacao WHERE partida_id = $1`, [p.id])).rows.map((r) => r.id);
    expect(cortados).toEqual([a2]);
    const origem = (await banco.query<{ posicao: string; posicao_de_origem: string }>(`SELECT posicao, posicao_de_origem FROM escalacao WHERE partida_id = $1 AND posicao_de_origem IS NOT NULL`, [p.id])).rows;
    expect(origem).toEqual([{ posicao: 'ZAG', posicao_de_origem: 'MEI' }]);
    // E a Escalação relida do banco (reexecução do job) traz a Posição de origem.
    const relida = await escalarPartida(banco, p.id);
    const ladoRival = p.mandante_id === rival ? 'mandante' : 'visitante';
    expect(relida.escalacoes[ladoRival].jogadores.filter((j) => j.posicaoDeOrigem).map((j) => j.posicaoDeOrigem)).toEqual(['MEI']);
  });
});

describe('Temporada 2 no worker', () => {
  it('na Temporada 1 as escolhas são recusadas e a Partida é simulada na versão 5', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 3 });
    const id = await inscrever('CAP', 'ATA', 'na_t1', '2026-11-06T12:00:00Z');
    const r = await aplicarEscolha(banco, id, { tipo: 'ESPECIALIZACAO', valor: 'ARTILHEIRO' }, new Date('2026-11-06T13:00:00Z'), ninguem);
    expect(r).toEqual({ ok: false, mensagem: 'Isso chega na Temporada 2.' });
    expect(await capitaniaDoJogador(banco, id, new Date('2026-11-06T13:00:00Z'), ninguem)).toBeNull();
    expect(await processarComentario(banco, { igCommentId: 'conf1', igMediaId: 'm', igUserId: 'na_t1', username: 'na_t1', texto: 'CONFIRMO', comentadoEm: new Date('2026-11-06T13:00:00Z') }, { rodadaEmVotacao: null })).toBe('PRESENCA_RECUSADA');
    const p = await primeiraPartida(t1, 'CAP');
    const job = await rodarPartida(banco, p.id, { seed: 5 });
    const res = job.dados.resultado;
    expect(res.versaoSim).toBe(12);
    expect(job.dados.torcida).toBeUndefined();
    const site = await exportarSite(banco, new Date('2026-12-30T12:00:00Z'));
    expect((site.arquivos.get(`partidas/${p.id}.json`) as { torcida?: unknown }).torcida).toBeUndefined();
    // Nada da T2 nos Jogadores do site da T1 (Especialização, Treino, cartões).
    const doSite = site.arquivos.get('jogadores.json') as { especializacao?: unknown; treino?: unknown; historico: { amarelos?: unknown; expulso?: unknown }[] }[];
    expect((await banco.query(`SELECT 1 FROM escalacao WHERE capitao`)).rows).toHaveLength(0);
    expect(JSON.stringify([...site.arquivos.values()])).not.toContain('"capitao"');
    expect(doSite.every((j) => !('especializacao' in j) && !('treino' in j) && j.historico.every((h) => !('amarelos' in h) && !('expulso' in h)))).toBe(true);
    expect(res.postura).toBeUndefined();
    expect(res.desempenhos.every((d) => d.faltas === undefined)).toBe(true);
  });

  it('Partida da T2 leva o tamanho dos Elencos para a Arquibancada (vídeo e site)', async () => {
    const t2 = await novaT2();
    await inscrever('CAP', 'ATA');
    await inscrever('CAP', 'MEI');
    const p = await primeiraPartida(t2, 'CAP');
    const job = await rodarPartida(banco, p.id, { seed: 5 });
    expect(job.dados.resultado.versaoSim).toBe(13);
    const lado = p.mandante_id === 'CAP' ? 'mandante' : 'visitante';
    expect(job.dados.torcida?.[lado]).toBe(2);
    const site = await exportarSite(banco, new Date('2026-12-30T12:00:00Z'));
    expect((site.arquivos.get(`partidas/${p.id}.json`) as { torcida?: Record<string, number> }).torcida?.[lado]).toBe(2);
    expect((site.arquivos.get('jogadores.json') as { especializacao?: unknown }[]).every((j) => 'especializacao' in j)).toBe(true);
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
    // O painel do site: só o Capitão vê a escolha; o outro vê quem é o Capitão e a Postura.
    expect(await capitaniaDoJogador(banco, novato, antes, async () => new Set([novato]))).toEqual({ eu: true, capitao: 'novato', postura: 'OFENSIVA', formacao: '2-2-2' });
    expect(await capitaniaDoJogador(banco, veterano, antes, async () => new Set([novato]))).toEqual({ eu: false, capitao: 'novato', postura: 'OFENSIVA', formacao: '2-2-2' });
    // O site mostra a faixa "C" para todos: no Capitão atual e, depois, na Escalação.
    const antesDoJogo = await exportarSite(banco, antes, { vinculos: new Set([novato]) });
    const doSite = antesDoJogo.arquivos.get('jogadores.json') as { id: string; capitao?: true }[];
    expect(doSite.filter((j) => j.capitao).map((j) => j.id)).toContain(novato);
    expect(doSite.find((j) => j.id === veterano)?.capitao).toBeUndefined();
    const res = (await rodarPartida(banco, p.id, { seed: 9, vinculos: new Set([novato]) })).dados.resultado;
    const faixa = (await banco.query<{ id: string }>(`SELECT jogador_id::text AS id FROM escalacao WHERE partida_id = $1 AND time_id = 'ONC' AND capitao`, [p.id])).rows;
    expect(faixa).toEqual([{ id: novato }]);
    expect((await banco.query(`SELECT 1 FROM escalacao WHERE partida_id = $1 AND capitao`, [p.id])).rows.length).toBeLessThanOrEqual(2);
    expect(res.versaoSim).toBe(13);
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
    expect(res.versaoSim).toBe(13);
  });
});
