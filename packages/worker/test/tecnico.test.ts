import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import {
  aprovarTecnico,
  conferirInatividade,
  convidar,
  decidirPedido,
  pedirParaSerTecnico,
  proporTroca,
  quemDecide,
  resolverPrazos,
  responderConvite,
  responderTroca,
  tecnicoDoTime,
} from '../src/tecnico.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let t3: number;
const respostas: string[] = [];
const ctx = (comVinculo: string[] = []) => ({ rodadaEmVotacao: null, comVinculo: new Set(comVinculo), responder: async (_: string, texto: string) => void respostas.push(texto) });
let n = 0;
const comentar = (user: string, texto: string, em = '2026-11-28T12:00:00Z', vinculos: string[] = []) =>
  processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: `ig-${user}`, username: user, texto, comentadoEm: new Date(em) }, ctx(vinculos));
const idDe = async (user: string) => (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador_todos WHERE username = $1`, [user])).rows[0]!.id;
const timeDe = async (user: string) => (await banco.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE username = $1`, [user])).rows[0]?.time_id;
const PRE = new Date('2026-11-28T12:00:00Z');

beforeEach(async () => {
  banco = await bancoDeTeste();
  respostas.length = 0;
  // T3: A = fundadores, B = Times novos da T2 (quem caiu).
  t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 3, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
});
afterEach(async () => {
  await banco.fechar();
});

describe('Técnico (ADR-0106)', () => {
  it('o seguidor aprovado vira Técnico fora do Elenco; o Time passa a ter quem decide', async () => {
    const a = await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    expect(a).toMatchObject({ novo: true, pendurou: false });
    expect(await tecnicoDoTime(banco, 'ONC')).toMatchObject({ username: 'seu.tonho', time: 'ONC' });
    // Fora do Elenco: não aparece na visão dos Jogadores.
    expect((await banco.query(`SELECT 1 FROM jogador WHERE username = 'seu.tonho'`)).rows).toHaveLength(0);
    expect(await quemDecide(banco, 'ONC', PRE, new Set())).toMatchObject({ tipo: 'TECNICO', jogadorId: a.jogadorId });
    // Um Técnico por Time.
    await expect(aprovarTecnico(banco, { username: 'outro', time: 'ONC', agora: PRE, naJanela: true })).rejects.toThrow(/já tem Técnico/);
  });

  it('o Jogador pede pelo site, segue jogando até a aprovação e pendura as chuteiras', async () => {
    await comentar('bruninho', 'ENTRO Tatu atacante');
    const id = await idDe('bruninho');
    expect(await pedirParaSerTecnico(banco, id, 'TAT', PRE)).toMatchObject({ ok: true });
    expect(await timeDe('bruninho')).toBe('TAT');
    const a = await aprovarTecnico(banco, { username: 'bruninho', time: 'TAT', agora: PRE, naJanela: true });
    expect(a).toMatchObject({ jogadorId: id, pendurou: true });
    expect(await timeDe('bruninho')).toBeUndefined();
    expect(await tecnicoDoTime(banco, 'TAT')).toMatchObject({ jogadorId: id });
  });

  it('Técnico que nunca jogou e comenta ENTRO entra no Elenco e perde o cargo', async () => {
    await aprovarTecnico(banco, { username: 'seu.tonho', igUserId: 'ig-seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    expect(await comentar('seu.tonho', 'ENTRO Capivara meia')).toBe('INSCRITO');
    expect(await timeDe('seu.tonho')).toBe('CAP');
    expect(await tecnicoDoTime(banco, 'ONC')).toBeNull();
  });

  it('quem pendurou as chuteiras só volta a jogar na Janela de uma Temporada seguinte', async () => {
    await comentar('bruninho', 'ENTRO Tatu atacante');
    await aprovarTecnico(banco, { username: 'bruninho', time: 'TAT', agora: PRE, naJanela: true });
    expect(await comentar('bruninho', 'ENTRO Tatu atacante', '2026-11-28T13:00:00Z')).toBe('TECNICO_FORA');
    expect(respostas.at(-1)).toMatch(/próxima temporada/);
  });

  it('3 jogos do Time sem nenhuma decisão: o Técnico perde o cargo', async () => {
    await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    const jogos = (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE mandante_id = 'ONC' OR visitante_id = 'ONC' ORDER BY apito_inicial LIMIT 3`)).rows;
    await banco.query(`UPDATE partida SET resultado = '{}'::jsonb WHERE id = ANY($1)`, [jogos.map((j) => j.id)]);
    expect(await conferirInatividade(banco, new Date('2026-12-20T12:00:00Z'))).toEqual(['ONC']);
    expect(await tecnicoDoTime(banco, 'ONC')).toBeNull();
  });
});

describe('Pedido de Transferência (ADR-0106)', () => {
  it('com Técnico no destino, o TRANSFERIR vira Pedido; recusado não gasta a troca', async () => {
    await comentar('gabi', 'ENTRO Tatu meia');
    const tec = await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    expect(await comentar('gabi', 'TRANSFERIR Onça', '2026-11-28T14:00:00Z')).toBe('PEDIDO_ENVIADO');
    expect(await timeDe('gabi')).toBe('TAT');
    const p = (await banco.query<{ id: number }>(`SELECT id FROM pedido_transferencia WHERE status = 'ABERTO'`)).rows[0]!;
    expect(await decidirPedido(banco, tec.jogadorId, p.id, false, new Date('2026-11-28T15:00:00Z'), new Set())).toMatchObject({ ok: true });
    // Recusado não gasta: pede outro Time e passa (sem Técnico, nem Capitão com Vínculo: direto).
    expect(await comentar('gabi', 'TRANSFERIR Capivara', '2026-11-28T16:00:00Z')).toBe('TRANSFERIDO');
  });

  it('sem resposta até o prazo, o Pedido vale como aceito (pela hora do pedido, na Janela)', async () => {
    await comentar('gabi', 'ENTRO Tatu meia');
    await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    await comentar('gabi', 'TRANSFERIR Onça', '2026-11-28T14:00:00Z');
    expect(await resolverPrazos(banco, new Date('2026-11-29T13:00:00Z'))).toEqual([]);
    const avisos = await resolverPrazos(banco, new Date('2026-11-29T14:30:00Z'));
    expect(avisos[0]?.mensagem).toMatch(/aceito.*Janela/);
    expect(await timeDe('gabi')).toBe('ONC');
  });

  it('sem Técnico, o Capitão com Vínculo decide; o pedido da Posição dele espera o prazo', async () => {
    for (const u of ['cap1', 'cap2']) await comentar(u, 'ENTRO Onça atacante');
    await comentar('gabi', 'ENTRO Tatu atacante');
    const capitao = await idDe('cap1');
    const d = await quemDecide(banco, 'ONC', PRE, new Set([capitao]));
    expect(d).toMatchObject({ tipo: 'CAPITAO', jogadorId: capitao, posicao: 'ATA' });
    expect(await comentar('gabi', 'TRANSFERIR Onça', '2026-11-28T14:00:00Z', [capitao])).toBe('PEDIDO_ENVIADO');
    const p = (await banco.query<{ id: number; decisor_id: string | null }>(`SELECT id, decisor_id FROM pedido_transferencia WHERE status = 'ABERTO'`)).rows[0]!;
    expect(p.decisor_id).toBeNull();
    expect(await decidirPedido(banco, capitao, p.id, false, new Date('2026-11-28T15:00:00Z'), new Set([capitao]))).toMatchObject({ ok: false });
  });

  it('quem caiu na T2 troca direto para a Série A na Janela da T3', async () => {
    await comentar('rebaixado', 'ENTRO Jacaré zagueiro');
    await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    expect(await comentar('rebaixado', 'TRANSFERIR Onça', '2026-11-28T14:00:00Z')).toBe('TRANSFERIDO');
  });
});

describe('Fila de espera, Convite e Troca casada (ADR-0106)', () => {
  it('Posição cheia: o veterano entra na Fila e é chamado quando abre vaga', async () => {
    for (let k = 0; k < 4; k++) await comentar(`ata${k}`, 'ENTRO Onça atacante');
    await comentar('gabi', 'ENTRO Tatu atacante');
    expect(await comentar('gabi', 'TRANSFERIR Onça', '2026-11-28T14:00:00Z')).toBe('NA_FILA');
    expect(respostas.at(-1)).toMatch(/Fila de espera e é o 1º/);
    // Abre vaga: um atacante da Onça vai para a Capivara.
    await comentar('ata0', 'TRANSFERIR Capivara', '2026-11-28T15:00:00Z');
    await resolverPrazos(banco, new Date('2026-11-28T15:10:00Z'));
    expect(await timeDe('gabi')).toBe('ONC');
  });

  it('Convite aceito: o Jogador troca na hora; só para quem tem Vínculo, até 3 abertos', async () => {
    const tec = await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    await comentar('nina', 'ENTRO Capivara meia');
    const nina = await idDe('nina');
    expect(await convidar(banco, { autorId: tec.jogadorId, jogadorId: nina, agora: PRE, comVinculo: new Set() })).toMatchObject({ ok: false });
    expect(await convidar(banco, { autorId: tec.jogadorId, jogadorId: nina, agora: PRE, comVinculo: new Set([nina]) })).toMatchObject({ ok: true });
    const c = (await banco.query<{ id: number }>(`SELECT id FROM convite WHERE status = 'ABERTO'`)).rows[0]!;
    expect(await responderConvite(banco, nina, c.id, true, new Date('2026-11-28T13:00:00Z'))).toMatchObject({ ok: true });
    expect(await timeDe('nina')).toBe('ONC');
  });

  it('Troca casada: com os dois Jogadores de acordo e os Times em silêncio, acontece no prazo', async () => {
    for (let k = 0; k < 4; k++) await comentar(`onc${k}`, 'ENTRO Onça atacante');
    for (let k = 0; k < 4; k++) await comentar(`tat${k}`, 'ENTRO Tatu atacante');
    const [a, b] = [await idDe('onc0'), await idDe('tat0')];
    const v = new Set([a, b]);
    expect(await proporTroca(banco, { autorId: a, jogadorA: a, jogadorB: b, agora: PRE, comVinculo: v, trocaUsada: async () => false })).toMatchObject({ ok: true });
    const t = (await banco.query<{ id: number }>(`SELECT id FROM troca_casada WHERE status = 'ABERTA'`)).rows[0]!;
    expect(await responderTroca(banco, { pessoaId: b, trocaId: t.id, aceitar: true, agora: PRE, comVinculo: v })).toMatchObject({ ok: true });
    expect(await timeDe('onc0')).toBe('ONC');
    await resolverPrazos(banco, new Date('2026-11-29T13:00:00Z'));
    expect(await timeDe('onc0')).toBe('TAT');
    expect(await timeDe('tat0')).toBe('ONC');
  });
});

describe('Plano do Time com Técnico (ADRs 0106 e 0107)', () => {
  it('o Técnico decide; com Técnico, o Capitão sugere e a Sugestão vale no que ele não decidiu', async () => {
    const { aplicarEscolha } = await import('../src/temporada2.js');
    const { planosDaPartida } = await import('../src/planoDoTime.js');
    for (const u of ['cap1', 'z1', 'm1']) await comentar(u, `ENTRO Onça ${u === 'z1' ? 'zagueiro' : u === 'm1' ? 'meia' : 'atacante'}`);
    const [cap, z1, m1] = [await idDe('cap1'), await idDe('z1'), await idDe('m1')];
    const tec = await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    const vinc = async () => new Set([cap, tec.jogadorId]);
    expect((await aplicarEscolha(banco, tec.jogadorId, { tipo: 'FORMACAO', valor: '2-3-1' }, PRE, vinc)).ok).toBe(true);
    expect((await aplicarEscolha(banco, tec.jogadorId, { tipo: 'FIXADOS', valor: [z1, m1] }, PRE, vinc)).ok).toBe(true);
    // O Capitão sugere Postura e Formação: a Formação é do Técnico; a Postura vale a sugestão.
    expect((await aplicarEscolha(banco, cap, { tipo: 'POSTURA', valor: 'OFENSIVA' }, PRE, vinc)).mensagem).toMatch(/Sugestão/);
    await aplicarEscolha(banco, cap, { tipo: 'FORMACAO', valor: '3-2-1' }, PRE, vinc);
    // O Capitão não fixa a si mesmo, e o Técnico não faz Presença.
    expect((await aplicarEscolha(banco, tec.jogadorId, { tipo: 'PRESENCA' }, PRE, vinc)).ok).toBe(false);
    const p = (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE mandante_id = 'ONC' OR visitante_id = 'ONC' ORDER BY apito_inicial LIMIT 1`)).rows[0]!;
    expect((await planosDaPartida(banco, p.id)).get('ONC')).toMatchObject({ formacao: '2-3-1', postura: 'OFENSIVA', fixados: [z1, m1] });
    // Os Batedores continuam do Capitão.
    expect((await aplicarEscolha(banco, cap, { tipo: 'BATEDORES', valor: [cap] }, PRE, vinc)).ok).toBe(true);
    expect((await aplicarEscolha(banco, tec.jogadorId, { tipo: 'BATEDORES', valor: [cap] }, PRE, vinc)).ok).toBe(false);
  });

  it('o titular fixado entra mesmo sem Presença, na frente do rodízio', async () => {
    const { aplicarEscolha } = await import('../src/temporada2.js');
    const { escalarPartida } = await import('../src/escalacao.js');
    for (let k = 0; k < 4; k++) await comentar(`a${k}`, 'ENTRO Onça atacante');
    const tec = await aprovarTecnico(banco, { username: 'seu.tonho', time: 'ONC', agora: PRE, naJanela: true });
    const ultimo = await idDe('a3');
    await aplicarEscolha(banco, tec.jogadorId, { tipo: 'FIXADOS', valor: [ultimo] }, PRE, async () => new Set());
    const p = (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE mandante_id = 'ONC' OR visitante_id = 'ONC' ORDER BY apito_inicial LIMIT 1`)).rows[0]!;
    await escalarPartida(banco, p.id);
    const r = (await banco.query<{ fixado: boolean; reserva: boolean }>(`SELECT fixado, reserva FROM escalacao WHERE partida_id = $1 AND jogador_id = $2`, [p.id, ultimo])).rows[0];
    expect(r).toMatchObject({ fixado: true, reserva: false });
  });

  it('escanteio e Marcação do Capitão chegam à simulação; Marcação só com marcador ZAG/MEI e alvo de linha rival', async () => {
    const { aplicarEscolha } = await import('../src/temporada2.js');
    const { capitaoEmCampo } = await import('../src/planoDoTime.js');
    for (const u of ['cap1', 'z1']) await comentar(u, `ENTRO Onça ${u === 'z1' ? 'zagueiro' : 'atacante'}`);
    const [cap, z1] = [await idDe('cap1'), await idDe('z1')];
    const p = (await banco.query<{ id: number; mandante_id: TimeId; visitante_id: TimeId }>(`SELECT id, mandante_id, visitante_id FROM partida WHERE mandante_id = 'ONC' OR visitante_id = 'ONC' ORDER BY apito_inicial LIMIT 1`)).rows[0]!;
    const rival = p.mandante_id === 'ONC' ? p.visitante_id : p.mandante_id;
    const nomeDoRival = { TAT: 'Tatu', CAP: 'Capivara', LEA: 'Leão', JAC: 'Jacaré', TUC: 'Tucano', LOB: 'Lobo', ARA: 'Arara', COR: 'Coruja' }[rival as string] ?? rival;
    await comentar('alvo1', `ENTRO ${nomeDoRival} atacante`);
    await comentar('golrival', `ENTRO ${nomeDoRival} goleiro`);
    const [alvo, gol] = [await idDe('alvo1'), await idDe('golrival')];
    const vinc = async () => new Set([cap]);
    expect((await aplicarEscolha(banco, cap, { tipo: 'ESCANTEIO', valor: [z1, cap] }, PRE, vinc)).ok).toBe(true);
    expect((await aplicarEscolha(banco, cap, { tipo: 'MARCACAO', valor: `${cap}:${alvo}` }, PRE, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, cap, { tipo: 'MARCACAO', valor: `${z1}:${gol}` }, PRE, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, cap, { tipo: 'MARCACAO', valor: `${z1}:${alvo}` }, PRE, vinc)).ok).toBe(true);
    const lado = p.mandante_id === 'ONC' ? 'mandante' : 'visitante';
    const r = await capitaoEmCampo(banco, p.id, p.mandante_id, p.visitante_id);
    expect(r.escanteio[lado]).toEqual([z1, cap]);
    expect(r.marcacao[lado]).toEqual({ marcador: z1, alvo });
    expect(r.marcacao[lado === 'mandante' ? 'visitante' : 'mandante']).toBeUndefined();
  });
});
