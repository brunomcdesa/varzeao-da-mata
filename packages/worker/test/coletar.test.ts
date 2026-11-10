import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { corrigirTrocasDePosicao, jogadorPeloUsername, moverJogador, processarComentario, vincularConta, type Comentario } from '../src/coletar.js';
import { FOLGA_DE_ELENCO, OVR_INICIAL } from '../src/regras.js';
import { AgendaNaMemoria } from '../src/nuvem.js';
import { craqueDaRodada } from '../src/resumo.js';
import { importarVotosDoSite } from '../src/votoSite.js';
import { bancoDeTeste } from './banco-de-teste.js';
import { ovrDasHabilidades } from '@liga/shared';

let banco: Banco;
let n = 0;
const comentario = (igUserId: string, texto: string, extra: Partial<Comentario> = {}): Comentario => ({
  igCommentId: `c${++n}`,
  igMediaId: 'reels-1',
  igUserId,
  username: `user_${igUserId}`,
  texto,
  comentadoEm: new Date(Date.UTC(2026, 10, 6, 12, 0, n)),
  ...extra,
});
const semVotacao = { rodadaEmVotacao: null };

beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

describe('Inscrição', () => {
  it('cria o Jogador com OVR inicial na faixa e grava o Comando', async () => {
    expect(await processarComentario(banco, comentario('u1', 'Entro na Onça de goleiro'), semVotacao)).toBe('INSCRITO');
    const [j] = (await banco.query<{ time_id: string; posicao: string; ovr: number; username: string }>('SELECT * FROM jogador')).rows;
    expect(j).toMatchObject({ time_id: 'ONC', posicao: 'GOL', username: 'user_u1' });
    expect(j!.ovr).toBeGreaterThanOrEqual(OVR_INICIAL.min);
    expect(j!.ovr).toBeLessThanOrEqual(OVR_INICIAL.max);
    const [c] = (await banco.query<{ tipo: string; resultado: string }>('SELECT tipo, resultado FROM comando')).rows;
    expect(c).toEqual({ tipo: 'INSCRICAO', resultado: 'INSCRITO' });
  });

  it('o mesmo comentário processado duas vezes não cria dois Jogadores', async () => {
    const c = comentario('u1', 'ENTRO CAPIVARA ATA');
    expect(await processarComentario(banco, c, semVotacao)).toBe('INSCRITO');
    expect(await processarComentario(banco, c, semVotacao)).toBe('REPETIDO');
    expect((await banco.query('SELECT * FROM jogador')).rows).toHaveLength(1);
  });

  it('cada conta tem um único Jogador e não troca de Time', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO CAPIVARA ATA'), semVotacao);
    expect(await processarComentario(banco, comentario('u1', 'ENTRO ONCA GOL'), semVotacao)).toBe('JA_INSCRITO');
    const [j] = (await banco.query<{ time_id: string }>('SELECT time_id FROM jogador')).rows;
    expect(j!.time_id).toBe('CAP');
  });

  it('o Jogador é da conta: trocar de @ só atualiza o username', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO CAPIVARA ATA', { username: 'antigo' }), semVotacao);
    await processarComentario(banco, comentario('u1', 'que jogo!', { username: 'novo' }), semVotacao);
    const linhas = (await banco.query<{ username: string }>('SELECT username FROM jogador')).rows;
    expect(linhas).toEqual([{ username: 'novo' }]);
  });

  it('respeita o limite de equilíbrio entre Times', async () => {
    for (let i = 0; i < FOLGA_DE_ELENCO; i++) {
      expect(await processarComentario(banco, comentario(`cap${i}`, 'ENTRO CAPIVARA ATA'), semVotacao)).toBe('INSCRITO');
    }
    expect(await processarComentario(banco, comentario('cap-cheio', 'ENTRO CAPIVARA ATA'), { ...semVotacao, realocar: false })).toBe('TIME_CHEIO');
    // Time cheio: entra no Time mais vazio, na mesma posição, e recebe uma resposta explicando.
    const respostas: string[] = [];
    const ctx = { ...semVotacao, realocar: true, responder: async (_id: string, texto: string) => void respostas.push(texto) };
    expect(await processarComentario(banco, comentario('cap-extra', 'ENTRO CAPIVARA ATA'), ctx)).toBe('REALOCADO');
    const j = (await banco.query<{ time_id: string; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE ig_user_id = 'cap-extra'`)).rows[0]!;
    expect(j.time_id).not.toBe('CAP');
    expect(j.posicao).toBe('ATA');
    expect(respostas[0]).toMatch(/time da Capivara encheu, então você entrou no time (do|da) \S+ para equilibrar a Liga\. Agora é atacante (do|da) \S+, OVR \d+/);
    const confirmacao: string[] = [];
    await processarComentario(banco, comentario('tat0', 'entro tatu goleiro', { username: 'goleirao' }), { ...semVotacao, responder: async (_id, t) => void confirmacao.push(t) });
    expect(confirmacao[0]).toMatch(/^@goleirao você entrou no Varzeão da Mata! Agora é goleiro do Tatu, OVR \d+\./);
    expect(await processarComentario(banco, comentario('onc0', 'ENTRO ONCA ATA'), semVotacao)).toBe('INSCRITO');
  });

  it('Inscrição manual forçada entra no Time cheio, na posição pedida (ADR-0029)', async () => {
    for (let i = 0; i < FOLGA_DE_ELENCO; i++) await processarComentario(banco, comentario(`onc${i}`, 'ENTRO ONCA ATA'), semVotacao);
    expect(await processarComentario(banco, comentario('dm-1', 'ENTRO ONCA ZAG'), { ...semVotacao, realocar: true, forcar: true })).toBe('INSCRITO');
    const j = (await banco.query<{ time_id: string; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE ig_user_id = 'dm-1'`)).rows[0]!;
    expect(j).toEqual({ time_id: 'ONC', posicao: 'ZAG' });
    // Sem forçar, o mesmo pedido continua sendo realocado.
    expect(await processarComentario(banco, comentario('dm-2', 'ENTRO ONCA ZAG'), { ...semVotacao, realocar: true })).toBe('REALOCADO');
  });

  it('mover: muda o Time cheio sem gastar a Transferência e mantém as Habilidades (ADR-0029)', async () => {
    for (let i = 0; i < FOLGA_DE_ELENCO; i++) await processarComentario(banco, comentario(`onc${i}`, 'ENTRO ONCA ATA'), semVotacao);
    await processarComentario(banco, comentario('pre1', 'ENTRO PREGUICA ZAG', { username: 'Jonatas_KS' }), semVotacao);
    await banco.query(`UPDATE jogador SET numero = 4 WHERE username = 'Jonatas_KS'`);
    await banco.query(`UPDATE jogador SET numero = 4 WHERE ig_user_id = 'onc0'`);
    const antes = (await banco.query<{ ovr: number; habilidades: unknown }>(`SELECT ovr, habilidades FROM jogador WHERE username = 'Jonatas_KS'`)).rows[0]!;
    const r = await moverJogador(banco, '@jonatas_ks', 'ONC');
    expect(r).toMatchObject({ de: 'PRE', para: 'ONC', posicao: 'ZAG', ovr: antes.ovr, perdeuCamisa: true });
    const depois = (await banco.query<{ time_id: string; posicao: string; numero: number | null; habilidades: unknown }>(`SELECT time_id, posicao, numero, habilidades FROM jogador WHERE username = 'Jonatas_KS'`)).rows[0]!;
    expect(depois).toMatchObject({ time_id: 'ONC', posicao: 'ZAG', numero: null });
    expect(depois.habilidades).toEqual(antes.habilidades);
    expect((await banco.query('SELECT 1 FROM transferencia')).rows).toHaveLength(0);
    await expect(moverJogador(banco, 'ninguem', 'ONC')).rejects.toThrow(/Nenhum Jogador/);
  });

  it('dois Jogadores com o mesmo @: mover pede o id; a Inscrição manual vê que o @ já joga', async () => {
    await processarComentario(banco, comentario('ig-real', 'ENTRO TAMANDUA ZAG', { username: '_eduardo_les' }), semVotacao);
    expect(await jogadorPeloUsername(banco, '@_Eduardo_Les')).toMatchObject({ time_id: 'TAM', posicao: 'ZAG' });
    await processarComentario(banco, comentario('dm-_eduardo_les', 'ENTRO ONCA ZAG', { username: '_eduardo_les' }), { ...semVotacao, forcar: true });
    await expect(moverJogador(banco, '_eduardo_les', 'ONC')).rejects.toThrow(/informe o ID/);
    const real = (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = 'ig-real'`)).rows[0]!.id;
    expect(await moverJogador(banco, '_eduardo_les', 'ONC', undefined, real)).toMatchObject({ de: 'TAM', para: 'ONC' });
  });

  it('vincular-conta: o Jogador da DM passa a ser da conta que comentou', async () => {
    await processarComentario(banco, comentario('1789', 'ENTRO TAMANDUA ZAG', { username: '_eduardo_les' }), semVotacao);
    await banco.query(`DELETE FROM jogador`);
    await processarComentario(banco, comentario('dm-_eduardo_les', 'ENTRO ONCA ZAG', { username: '_eduardo_les', igMediaId: 'dm' }), { ...semVotacao, forcar: true });
    expect(await vincularConta(banco, '@_eduardo_les')).toMatchObject({ de: 'dm-_eduardo_les', para: '1789' });
    expect((await banco.query(`SELECT time_id FROM jogador WHERE ig_user_id = '1789'`)).rows).toEqual([{ time_id: 'ONC' }]);
    // Agora o comentário dele acha o Jogador: um novo ENTRO não cria outro.
    expect(await processarComentario(banco, comentario('1789', 'ENTRO ONCA ZAG', { username: '_eduardo_les' }), semVotacao)).toBe('JA_INSCRITO');
    await expect(vincularConta(banco, '_eduardo_les')).rejects.toThrow(/id provisório/);
  });

  it('banido é ignorado; @ bloqueado não se inscreve', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO CAPIVARA ATA'), semVotacao);
    await banco.query(`UPDATE jogador SET banido = true`);
    expect(await processarComentario(banco, comentario('u1', 'CRAQUE 1'), { rodadaEmVotacao: 1 })).toBe('BANIDO');

    await banco.query(`INSERT INTO config (chave, valor) VALUES ('bloqueio', '["palavrao"]')`);
    expect(await processarComentario(banco, comentario('u2', 'ENTRO ONCA ATA', { username: 'o.Palavrao_10' }), semVotacao)).toBe('NOME_BLOQUEADO');
  });

  it('registra comandos inválidos e ignora comentários comuns', async () => {
    expect(await processarComentario(banco, comentario('u1', 'entro atacante'), semVotacao)).toBe('SEM_TIME');
    expect(await processarComentario(banco, comentario('u2', 'golaço!'), semVotacao)).toBe('IGNORADO');
    expect((await banco.query('SELECT * FROM jogador')).rows).toHaveLength(0);
  });

  it('pedido em dois comentários: o Time num e a posição no outro', async () => {
    const t = (min: number) => ({ comentadoEm: new Date(Date.UTC(2026, 10, 8, 2, min)) });
    expect(await processarComentario(banco, comentario('mumu', 'Arara', t(46)), semVotacao)).toBe('IGNORADO');
    expect(await processarComentario(banco, comentario('mumu', 'Entro como meia', t(47)), semVotacao)).toBe('INSCRITO');
    const j = (await banco.query<{ time_id: string; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE ig_user_id = 'mumu'`)).rows[0]!;
    expect(j).toEqual({ time_id: 'ARA', posicao: 'MEI' });
    // Sem pedido nenhum ("Arara" e "meia" soltos) não inscreve.
    expect(await processarComentario(banco, comentario('torcedor', 'Arara', t(50)), semVotacao)).toBe('IGNORADO');
    expect(await processarComentario(banco, comentario('torcedor', 'que meia!', t(51)), semVotacao)).toBe('IGNORADO');
  });

  it('pedido em três comentários: "ENTRO" sozinho, depois a posição, depois o Time', async () => {
    const t = (min: number) => ({ comentadoEm: new Date(Date.UTC(2026, 10, 10, 4, min)) });
    expect(await processarComentario(banco, comentario('clyverff', 'ENTRO', t(6)), semVotacao)).toBe('SEM_TIME');
    expect(await processarComentario(banco, comentario('clyverff', '10', t(7)), semVotacao)).toBe('IGNORADO');
    expect(await processarComentario(banco, comentario('clyverff', 'ATA', t(8)), semVotacao)).toBe('IGNORADO');
    expect(await processarComentario(banco, comentario('clyverff', 'Arara', t(9)), semVotacao)).toBe('INSCRITO');
    const j = (await banco.query<{ time_id: string; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE ig_user_id = 'clyverff'`)).rows[0]!;
    expect(j).toEqual({ time_id: 'ARA', posicao: 'ATA' });
  });

  it('releitura: comentários lidos antes da regra (ENTRO, ATA, Arara) inscrevem na coleta seguinte', async () => {
    const t = (min: number) => ({ comentadoEm: new Date(Date.UTC(2026, 10, 10, 4, min)) });
    const lidos = [
      [comentario('cly2', 'ENTRO', t(6)), 'INVALIDO', 'SEM_TIME'],
      [comentario('cly2', 'ATA', t(8)), 'IGNORADO', 'IGNORADO'],
      [comentario('cly2', 'Arara', t(9)), 'IGNORADO', 'IGNORADO'],
    ] as const;
    for (const [c, tipo, resultado] of lidos) {
      await banco.query(
        `INSERT INTO comando (ig_comment_id, ig_media_id, ig_user_id, username, texto, comentado_em, tipo, resultado) VALUES ($1, 'reels-1', 'cly2', 'user_cly2', $2, $3, $4, $5)`,
        [c.igCommentId, c.texto, c.comentadoEm.toISOString(), tipo, resultado],
      );
    }
    const resultados = [];
    for (const [c] of lidos) resultados.push(await processarComentario(banco, c, semVotacao));
    expect(resultados).toContain('INSCRITO');
    const j = (await banco.query<{ time_id: string; posicao: string }>(`SELECT time_id, posicao FROM jogador WHERE ig_user_id = 'cly2'`)).rows[0]!;
    expect(j).toEqual({ time_id: 'ARA', posicao: 'ATA' });
  });

  it('comentário da própria Liga nunca inscreve', async () => {
    expect(await processarComentario(banco, comentario('liga', 'Comente ENTRO (POSICAO) ARARA', { username: 'varzeao_da_mata' }), semVotacao)).toBe('IGNORADO');
    expect((await banco.query(`SELECT 1 FROM jogador WHERE ig_user_id = 'liga'`)).rows).toHaveLength(0);
  });

  it('só o Time: entra na posição mais vazia dele', async () => {
    expect(await processarComentario(banco, comentario('a', 'entro capivara atacante'), semVotacao)).toBe('INSCRITO');
    expect(await processarComentario(banco, comentario('b', 'entro capivara goleiro'), semVotacao)).toBe('INSCRITO');
    expect(await processarComentario(banco, comentario('c', 'eu sou da capivara'), semVotacao)).toBe('INSCRITO');
    // ATA 1/2, GOL 1/1, ZAG 0/2, MEI 0/2: empate entre meia e zagueiro, vai meia.
    const c = (await banco.query<{ posicao: string }>(`SELECT posicao FROM jogador WHERE ig_user_id = 'c'`)).rows[0]!;
    expect(c.posicao).toBe('MEI');
  });
});

describe('Voto para Craque da Rodada', () => {
  async function prepararCandidatos(): Promise<number> {
    const t = (await banco.query<{ id: number }>(`INSERT INTO temporada (numero, inicio) VALUES (1, '2026-11-06') RETURNING id`)).rows[0]!;
    const r = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, 1, 'LIGA', '2026-11-06') RETURNING id`, [t.id])).rows[0]!;
    await processarComentario(banco, comentario('craque1', 'ENTRO CAPIVARA ATA', { username: 'Rafa_Capivara' }), semVotacao);
    await processarComentario(banco, comentario('craque2', 'ENTRO ONCA GOL', { username: 'bia.onca' }), semVotacao);
    // 1 = Rafa, 2 = Bia
    await banco.query(`INSERT INTO candidato (rodada_id, jogador_id, nota, numero) SELECT $1, id, 8, row_number() OVER (ORDER BY id) FROM jogador`, [r.id]);
    return r.id;
  }

  it('vale o último voto de cada @', async () => {
    const rodada = await prepararCandidatos();
    expect(await processarComentario(banco, comentario('fã', 'CRAQUE 1'), { rodadaEmVotacao: rodada })).toBe('VOTO_REGISTRADO');
    expect(await processarComentario(banco, comentario('fã', 'craque 2'), { rodadaEmVotacao: rodada })).toBe('VOTO_REGISTRADO');
    const votos = (await banco.query<{ username: string }>(`SELECT j.username FROM voto v JOIN jogador j ON j.id = v.jogador_id`)).rows;
    expect(votos).toEqual([{ username: 'bia.onca' }]);
  });

  it('voto chegando fora de ordem não substitui um mais novo', async () => {
    const rodada = await prepararCandidatos();
    const novo = comentario('fã', 'CRAQUE 2', { comentadoEm: new Date(Date.UTC(2026, 10, 6, 20)) });
    const velho = comentario('fã', 'CRAQUE 1', { comentadoEm: new Date(Date.UTC(2026, 10, 6, 19)) });
    await processarComentario(banco, novo, { rodadaEmVotacao: rodada });
    expect(await processarComentario(banco, velho, { rodadaEmVotacao: rodada })).toBe('VOTO_ANTIGO');
  });

  it('só vale para Candidatos e com votação aberta', async () => {
    const rodada = await prepararCandidatos();
    expect(await processarComentario(banco, comentario('fã', 'CRAQUE 5'), { rodadaEmVotacao: rodada })).toBe('NAO_CANDIDATO');
    expect(await processarComentario(banco, comentario('fã2', 'CRAQUE 2'), semVotacao)).toBe('VOTACAO_FECHADA');
  });

  it('comentário ignorado antes vira Inscrição quando o leitor passa a aceitá-lo', async () => {
    const c = comentario('nova', 'Onça, atacante');
    // Simula o leitor antigo: o comentário ficou registrado como ignorado.
    await banco.query(
      `INSERT INTO comando (ig_comment_id, ig_media_id, ig_user_id, username, texto, comentado_em, tipo, resultado) VALUES ($1, $2, $3, $4, $5, $6, 'IGNORADO', 'IGNORADO')`,
      [c.igCommentId, c.igMediaId, c.igUserId, c.username, c.texto, c.comentadoEm.toISOString()],
    );
    expect(await processarComentario(banco, c, semVotacao)).toBe('INSCRITO');
    expect(await processarComentario(banco, c, semVotacao)).toBe('REPETIDO');
  });

  it('o número sozinho só vale no post do Resumo', async () => {
    const rodada = await prepararCandidatos();
    const ctx = { rodadaEmVotacao: rodada, postDaVotacao: 'RESUMO' };
    expect(await processarComentario(banco, comentario('fã', '2', { igMediaId: 'OUTRO' }), ctx)).toBe('IGNORADO');
    expect(await processarComentario(banco, comentario('fã', '2', { igMediaId: 'RESUMO' }), ctx)).toBe('VOTO_REGISTRADO');
  });

  it('votos do site somam com os do Instagram, um por aparelho', async () => {
    const rodada = await prepararCandidatos();
    await processarComentario(banco, comentario('fã', 'CRAQUE 1'), { rodadaEmVotacao: rodada });
    const agenda = new AgendaNaMemoria();
    for (const [aparelho, numero] of [['a1', 2], ['a2', 2], ['a3', 9]] as const) {
      agenda.itens.set(`voto-site/${rodada}/${aparelho}`, '""');
      agenda.metadados.set(`voto-site/${rodada}/${aparelho}`, { numero, em: '2026-11-06T22:00:00Z' });
    }
    expect(await importarVotosDoSite(banco, agenda, rodada)).toBe(2); // o 9 não existe
    expect(await importarVotosDoSite(banco, agenda, rodada)).toBe(0); // reimportar não duplica
    expect((await craqueDaRodada(banco, rodada))?.username).toBe('bia.onca');
  });
});

describe('Transferência (ADR-0012)', () => {
  const respostas: string[] = [];
  const ctx = { rodadaEmVotacao: null, responder: async (_: string, t: string) => void respostas.push(t) };
  let temporada: number;
  beforeEach(async () => {
    respostas.length = 0;
    temporada = (await banco.query<{ id: number }>(`INSERT INTO temporada (numero, inicio, status) VALUES (1, '2026-11-06', 'EM_ANDAMENTO') RETURNING id`)).rows[0]!.id;
    const r = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, 1, 'LIGA', '2026-11-10') RETURNING id`, [temporada])).rows[0]!;
    await banco.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial) VALUES ($1, 'ONC', 'PRE', '2026-11-10T15:00:00Z')`, [r.id]);
  });
  const time = async (u: string) => (await banco.query<{ time_id: string; posicao: string; ovr: number }>('SELECT time_id, posicao, ovr FROM jogador WHERE ig_user_id = $1', [u])).rows[0]!;

  it('troca de Time, leva as Habilidades e responde; a segunda na Temporada não vale', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA MEIA'), ctx);
    expect(await processarComentario(banco, comentario('u1', 'Posso ir pro time da preguiça pra equilibrar?'), ctx)).toBe('TRANSFERIDO');
    expect(await time('u1')).toMatchObject({ time_id: 'PRE', posicao: 'MEI' });
    expect(respostas.at(-1)).toMatch(/transferência feita! Agora você é meia da Preguiça/);
    expect(await processarComentario(banco, comentario('u1', 'TRANSFERIR arara'), ctx)).toBe('TRANSFERENCIA_USADA');
    expect((await time('u1')).time_id).toBe('PRE');
  });

  it('trocar de posição mantém o OVR e refaz as Habilidades no perfil novo (ADR-0030)', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA ATA'), ctx);
    const antes = await time('u1');
    expect(await processarComentario(banco, comentario('u1', 'quero virar goleiro'), ctx)).toBe('TRANSFERIDO');
    const j = await time('u1');
    expect(j).toMatchObject({ time_id: 'ONC', posicao: 'GOL', ovr: antes.ovr });
    const h = (await banco.query<{ habilidades: Record<string, number> }>(`SELECT habilidades FROM jogador WHERE ig_user_id = 'u1'`)).rows[0]!.habilidades;
    expect(h.GOL).toBeGreaterThan(h.FIN!);
    expect(Math.round(ovrDasHabilidades('GOL', h as never))).toBe(antes.ovr);
    expect(respostas.at(-1)).toMatch(new RegExp(`mudança de posição feita! Agora você é goleiro da Onça, OVR ${antes.ovr}`));
  });

  it('corrige quem trocou de posição pela regra antiga: volta ao OVR de antes (ADR-0030)', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO ARARA ATA'), ctx);
    const antes = (await banco.query<{ id: string; ovr: number; habilidades: unknown }>(`SELECT id::text AS id, ovr, habilidades FROM jogador WHERE ig_user_id = 'u1'`)).rows[0]!;
    // Como a regra antiga deixava: virou goleiro com as Habilidades de atacante.
    const gol = Math.round(ovrDasHabilidades('GOL', antes.habilidades as never));
    await banco.query(`UPDATE jogador SET posicao = 'GOL', ovr = $2 WHERE id = $1`, [antes.id, gol]);
    await banco.query(`INSERT INTO transferencia (jogador_id, temporada_id, de_time, para_time, de_posicao, para_posicao, ig_comment_id, feita_em, janela) VALUES ($1, $2, 'ARA', 'ARA', 'ATA', 'GOL', 'x', now(), false)`, [antes.id, temporada]);
    expect(gol).toBeLessThan(50);
    expect(await corrigirTrocasDePosicao(banco)).toEqual([{ username: 'user_u1', antes: gol, depois: antes.ovr }]);
    expect(await time('u1')).toMatchObject({ posicao: 'GOL', ovr: antes.ovr });
    expect(await corrigirTrocasDePosicao(banco)).toEqual([]);
  });

  it('não vai para um Time cheio (mesma folga da Inscrição)', async () => {
    for (let i = 0; i < FOLGA_DE_ELENCO; i++) await processarComentario(banco, comentario(`a${i}`, 'ENTRO ARARA ATA'), { ...ctx, realocar: false });
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA MEIA'), ctx);
    expect(await processarComentario(banco, comentario('u1', 'TRANSFERIR arara'), ctx)).toBe('DESTINO_CHEIO');
    expect((await time('u1')).time_id).toBe('ONC');
  });

  it('fecha no fim da Fase de Liga', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA MEIA'), ctx);
    expect(await processarComentario(banco, comentario('u1', 'TRANSFERIR preguiça', { comentadoEm: new Date('2026-11-10T14:45:00Z') }), ctx)).toBe('TRANSFERENCIA_FECHADA');
  });

  it('"ENTRO" de quem já joga não troca de Time, só explica', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA MEIA'), ctx);
    expect(await processarComentario(banco, comentario('u1', 'ENTRO PREGUICA'), ctx)).toBe('JA_INSCRITO');
    expect((await time('u1')).time_id).toBe('ONC');
    expect(respostas.at(-1)).toMatch(/comente TRANSFERIR/);
  });

  it('quem ainda não joga e pede para ir pra um Time entra nele', async () => {
    expect(await processarComentario(banco, comentario('u9', 'quero ir pra preguiça'), ctx)).toBe('INSCRITO');
    expect((await time('u9')).time_id).toBe('PRE');
  });

  it('comentário já lido como ignorado vira Transferência na releitura, se é depois da Inscrição', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA MEIA'), ctx);
    const c = comentario('u1', 'Posso ir pro time da preguiça pra equilibrar?');
    await banco.query(`INSERT INTO comando (ig_comment_id, ig_media_id, ig_user_id, username, texto, comentado_em, tipo, resultado) VALUES ($1, 'm', 'u1', 'user_u1', $2, $3, 'IGNORADO', 'IGNORADO')`, [c.igCommentId, c.texto, c.comentadoEm.toISOString()]);
    expect(await processarComentario(banco, c, ctx)).toBe('TRANSFERIDO');
    expect(await processarComentario(banco, c, ctx)).toBe('REPETIDO');
  });
});
