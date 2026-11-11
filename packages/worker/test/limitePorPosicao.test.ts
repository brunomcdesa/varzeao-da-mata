import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, type Posicao, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { processarComentario, type Comentario } from '../src/coletar.js';
import { LIMITE_POR_POSICAO } from '../src/regras.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let n = 0;
const comentario = (igUserId: string, texto: string): Comentario => ({
  igCommentId: `c${++n}`,
  igMediaId: 'reels-1',
  igUserId,
  username: `user_${igUserId}`,
  texto,
  comentadoEm: new Date(Date.UTC(2026, 10, 6, 12, 0, n)),
});
const respostas: string[] = [];
const ctx = { rodadaEmVotacao: null, responder: async (_: string, t: string) => void respostas.push(t) };

/** Jogador direto no banco (para montar Elencos sem passar pelas regras da Inscrição). */
async function jogador(time: TimeId, posicao: Posicao): Promise<void> {
  const u = `p${++n}`;
  await banco.query(`INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, inscrito_em) VALUES ($1, $1, $2, $3, 65, '2026-11-01T12:00:00Z')`, [u, time, posicao]);
}
const onde = async (u: string) => (await banco.query<{ time_id: TimeId; posicao: Posicao }>('SELECT time_id, posicao FROM jogador WHERE ig_user_id = $1', [u])).rows[0];

beforeEach(async () => {
  banco = await bancoDeTeste();
  respostas.length = 0;
});
afterEach(async () => {
  await banco.fechar();
});

describe('Limite por Posição (ADR-0037)', () => {
  it('é o dobro das vagas da Escalação', () => {
    expect(LIMITE_POR_POSICAO).toEqual({ GOL: 2, ZAG: 4, MEI: 4, ATA: 4 });
  });

  it('Posição cheia no Time pedido: entra no Time com menos gente nela, na mesma Posição', async () => {
    for (let i = 0; i < 4; i++) await jogador('CAP', 'ATA');
    for (const t of TIMES_FUNDADORES.filter((t) => t !== 'CAP' && t !== 'SAG')) await jogador(t, 'ATA');
    // Elencos equilibrados para a folga não decidir: um zagueiro em cada Time menos a Capivara.
    for (const t of TIMES_FUNDADORES.filter((t) => t !== 'CAP')) await jogador(t, 'ZAG');
    expect(await processarComentario(banco, comentario('u1', 'ENTRO CAPIVARA ATA'), ctx)).toBe('REALOCADO');
    expect(await onde('u1')).toEqual({ time_id: 'SAG', posicao: 'ATA' });
    expect(respostas.at(-1)).toMatch(/^@user_u1 o time da Capivara já tem atacantes demais, então você entrou no time do Sagui, que precisava\. Agora é atacante do Sagui, OVR \d+\./);
  });

  it('goleiro tem limite 2', async () => {
    await jogador('ONC', 'GOL');
    await jogador('ONC', 'GOL');
    expect(await processarComentario(banco, comentario('u1', 'ENTRO ONCA GOLEIRO'), ctx)).toBe('REALOCADO');
    expect((await onde('u1'))!.time_id).not.toBe('ONC');
  });

  it('cheia em todos os Times: espera, avisa uma vez e entra sozinho quando abre vaga', async () => {
    for (const t of TIMES_FUNDADORES) for (let i = 0; i < 4; i++) await jogador(t, 'ATA');
    const c = comentario('u1', 'ENTRO TATU ATACANTE');
    expect(await processarComentario(banco, c, ctx)).toBe('POSICAO_CHEIA');
    expect(await onde('u1')).toBeUndefined();
    expect(respostas).toEqual([
      '@user_u1 todos os times já estão cheios de atacantes. Ainda tem vaga de goleiro, zagueiro, meia: se quiser, comente ENTRO com o time e uma dessas posições. Seu pedido fica guardado e você entra sozinho quando abrir vaga de atacante. ⚽',
    ]);
    // A coleta seguinte relê, mas não responde de novo.
    expect(await processarComentario(banco, c, ctx)).toBe('POSICAO_CHEIA');
    expect(respostas).toHaveLength(1);
    // Abriu vaga no Tatu: entra na próxima releitura.
    await banco.query(`UPDATE jogador SET banido = true WHERE id = (SELECT id FROM jogador WHERE time_id = 'TAT' AND posicao = 'ATA' LIMIT 1)`);
    expect(await processarComentario(banco, c, ctx)).toBe('INSCRITO');
    expect(await onde('u1')).toEqual({ time_id: 'TAT', posicao: 'ATA' });
  });

  it('a Inscrição manual do dono passa por cima do limite (ADR-0029)', async () => {
    for (let i = 0; i < 4; i++) await jogador('ARA', 'MEI');
    expect(await processarComentario(banco, comentario('dm-1', 'ENTRO ARARA MEIA'), { ...ctx, forcar: true })).toBe('INSCRITO');
    expect(await onde('dm-1')).toEqual({ time_id: 'ARA', posicao: 'MEI' });
  });

  it('Transferência para um Time cheio na Posição não acontece e diz onde tem vaga', async () => {
    const t = (await banco.query<{ id: number }>(`INSERT INTO temporada (numero, inicio, status) VALUES (1, '2026-11-06', 'EM_ANDAMENTO') RETURNING id`)).rows[0]!.id;
    const r = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, 1, 'LIGA', '2026-11-10') RETURNING id`, [t])).rows[0]!;
    await banco.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial) VALUES ($1, 'ONC', 'PRE', '2026-11-10T15:00:00Z')`, [r.id]);
    for (let i = 0; i < 4; i++) await jogador('PRE', 'ATA');
    for (const x of TIMES_FUNDADORES.filter((x) => x !== 'PRE' && x !== 'TUC')) for (let i = 0; i < 4; i++) await jogador(x, i ? 'MEI' : 'ATA');
    await processarComentario(banco, comentario('u1', 'ENTRO ONCA ATA'), ctx);
    expect(await processarComentario(banco, comentario('u1', 'TRANSFERIR preguiça'), ctx)).toBe('DESTINO_CHEIO');
    expect((await onde('u1'))!.time_id).toBe('ONC');
    expect(respostas.at(-1)).toMatch(/^@user_u1 o time da Preguiça já tem atacantes demais, então a transferência não deu\. Times com vaga de atacante: .*Tucano/);
    // Trocar de Posição para uma cheia no próprio Time também não vale.
    for (let i = 0; i < 3; i++) await jogador('ONC', 'ZAG');
    await jogador('ONC', 'ZAG');
    expect(await processarComentario(banco, comentario('u1', 'TRANSFERIR onça zagueiro'), ctx)).toBe('DESTINO_CHEIO');
  });
});
