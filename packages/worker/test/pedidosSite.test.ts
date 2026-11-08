import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { processarComentario } from '../src/coletar.js';
import { AgendaNaMemoria } from '../src/nuvem.js';
import { processarPedidosDoSite, type PedidoDoSite } from '../src/pedidosSite.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
  const t = (await banco.query<{ id: number }>(`INSERT INTO temporada (numero, inicio, status) VALUES (1, '2026-11-06', 'EM_ANDAMENTO') RETURNING id`)).rows[0]!;
  const r = (await banco.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, 1, 'LIGA', '2026-11-10') RETURNING id`, [t.id])).rows[0]!;
  await banco.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial) VALUES ($1, 'ONC', 'PRE', '2026-11-10T15:00:00Z')`, [r.id]);
});
afterEach(async () => {
  await banco.fechar();
});

const agora = new Date('2026-11-08T19:00:00Z');
const inscrever = async () => {
  await processarComentario(banco, { igCommentId: 'c1', igMediaId: 'm', igUserId: 'u1', username: 'fulano', texto: 'ENTRO ONCA MEIA', comentadoEm: new Date('2026-11-08T12:00:00Z') }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador`)).rows[0]!.id;
};

describe('Pedidos do site (ADR-0013)', () => {
  it('aplica a Transferência pedida no site e devolve a mensagem no item', async () => {
    const id = await inscrever();
    const agenda = new AgendaNaMemoria();
    await agenda.gravar(`pedido-site/${id}`, { tipo: 'TRANSFERENCIA', jogadorId: id, time: 'PRE', pedidoEm: agora.toISOString() } satisfies PedidoDoSite);
    expect(await processarPedidosDoSite(banco, agenda, agora)).toBe(1);
    const p = (await agenda.ler<PedidoDoSite>(`pedido-site/${id}`))!;
    expect(p.resultado).toBe('TRANSFERIDO');
    expect(p.mensagem).toMatch(/^Transferência feita! Agora você é meia da Preguiça/);
    expect((await banco.query<{ time_id: string }>(`SELECT time_id FROM jogador`)).rows[0]!.time_id).toBe('PRE');
    // Já processado: não aplica de novo.
    expect(await processarPedidosDoSite(banco, agenda, agora)).toBe(0);
  });

  it('a segunda Transferência na Temporada não vale, nem pelo site', async () => {
    const id = await inscrever();
    const agenda = new AgendaNaMemoria();
    await agenda.gravar(`pedido-site/${id}`, { tipo: 'TRANSFERENCIA', jogadorId: id, posicao: 'ZAG', pedidoEm: agora.toISOString() } satisfies PedidoDoSite);
    await processarPedidosDoSite(banco, agenda, agora);
    await agenda.gravar(`pedido-site/${id}`, { tipo: 'TRANSFERENCIA', jogadorId: id, time: 'ARA', pedidoEm: new Date(agora.getTime() + 1000).toISOString() } satisfies PedidoDoSite);
    await processarPedidosDoSite(banco, agenda, agora);
    expect((await agenda.ler<PedidoDoSite>(`pedido-site/${id}`))!.resultado).toBe('TRANSFERENCIA_USADA');
  });
});
