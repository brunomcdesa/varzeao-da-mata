import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { processarComentario, type Comentario } from '../src/coletar.js';
import { FOLGA_DE_ELENCO, OVR_INICIAL } from '../src/regras.js';
import { AgendaNaMemoria } from '../src/nuvem.js';
import { craqueDaRodada } from '../src/resumo.js';
import { importarVotosDoSite } from '../src/votoSite.js';
import { bancoDeTeste } from './banco-de-teste.js';

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
    expect(await processarComentario(banco, comentario('cap-extra', 'ENTRO CAPIVARA ATA'), semVotacao)).toBe('TIME_CHEIO');
    // Outro Time continua aberto, e quando todos crescem a Capivara volta a aceitar.
    expect(await processarComentario(banco, comentario('onc0', 'ENTRO ONCA ATA'), semVotacao)).toBe('INSCRITO');
  });

  it('banido é ignorado; @ bloqueado não se inscreve', async () => {
    await processarComentario(banco, comentario('u1', 'ENTRO CAPIVARA ATA'), semVotacao);
    await banco.query(`UPDATE jogador SET banido = true`);
    expect(await processarComentario(banco, comentario('u1', 'CRAQUE 1'), { rodadaEmVotacao: 1 })).toBe('BANIDO');

    await banco.query(`INSERT INTO config (chave, valor) VALUES ('bloqueio', '["palavrao"]')`);
    expect(await processarComentario(banco, comentario('u2', 'ENTRO ONCA ATA', { username: 'o.Palavrao_10' }), semVotacao)).toBe('NOME_BLOQUEADO');
  });

  it('registra comandos inválidos e ignora comentários comuns', async () => {
    expect(await processarComentario(banco, comentario('u1', 'entro capivara'), semVotacao)).toBe('SEM_POSICAO');
    expect(await processarComentario(banco, comentario('u2', 'golaço!'), semVotacao)).toBe('IGNORADO');
    expect((await banco.query('SELECT * FROM jogador')).rows).toHaveLength(0);
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
