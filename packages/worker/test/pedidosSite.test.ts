import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { processarComentario } from '../src/coletar.js';
import { AgendaNaMemoria } from '../src/nuvem.js';
import { processarPedidosDoSite, type PedidoDoSite, type PerfilDoSite } from '../src/pedidosSite.js';
import { importarVotosDoSite } from '../src/votoSite.js';
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

  it('salva o visual e o número; número repetido no Time e cor fora da paleta são recusados', async () => {
    const id = await inscrever();
    await processarComentario(banco, { igCommentId: 'c2', igMediaId: 'm', igUserId: 'u2', username: 'ciclano', texto: 'ENTRO ONCA ZAG', comentadoEm: new Date('2026-11-08T12:01:00Z') }, { rodadaEmVotacao: null });
    const outro = (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE username = 'ciclano'`)).rows[0]!.id;
    const agenda = new AgendaNaMemoria();
    await agenda.gravar(`perfil-site/${id}`, { jogadorId: id, visual: { pele: '#9A6238', cabelo: '#E8C547', penteado: 'BLACK' }, numero: 10, pedidoEm: agora.toISOString() } satisfies PerfilDoSite);
    await processarPedidosDoSite(banco, agenda, agora);
    expect((await agenda.ler<PerfilDoSite>(`perfil-site/${id}`))!.resultado).toBe('SALVO');
    const j = (await banco.query<{ visual: unknown; numero: number }>(`SELECT visual, numero FROM jogador WHERE id = $1`, [id])).rows[0]!;
    expect(j).toMatchObject({ numero: 10, visual: { pele: '#9A6238', cabelo: '#E8C547', penteado: 'BLACK' } });

    await agenda.gravar(`perfil-site/${outro}`, { jogadorId: outro, numero: 10, pedidoEm: agora.toISOString() } satisfies PerfilDoSite);
    await processarPedidosDoSite(banco, agenda, agora);
    const r = (await agenda.ler<PerfilDoSite>(`perfil-site/${outro}`))!;
    expect(r.resultado).toBe('RECUSADO');
    expect(r.mensagem).toMatch(/camisa 10 já é de @fulano/);

    await agenda.gravar(`perfil-site/${outro}`, { jogadorId: outro, visual: { pele: '#FF0000', cabelo: '#111111', penteado: 'CURTO' }, pedidoEm: agora.toISOString() } satisfies PerfilDoSite);
    await processarPedidosDoSite(banco, agenda, agora);
    expect((await agenda.ler<PerfilDoSite>(`perfil-site/${outro}`))!.resultado).toBe('RECUSADO');
  });

  it('o voto de quem vinculou conta como o voto do @ (vale o último, junto com o comentado)', async () => {
    const id = await inscrever();
    const r = (await banco.query<{ id: number }>(`SELECT id FROM rodada LIMIT 1`)).rows[0]!;
    await banco.query(`INSERT INTO candidato (rodada_id, jogador_id, nota, numero) VALUES ($1, $2, 8, 1)`, [r.id, id]);
    // Comentou "1" antes; depois votou no site, vinculado.
    await banco.query(`INSERT INTO voto (rodada_id, ig_user_id, jogador_id, votado_em) VALUES ($1, 'u1', $2, '2026-11-08T18:00:00Z')`, [r.id, id]);
    const agenda = new AgendaNaMemoria();
    agenda.itens.set(`voto-vinculado/${r.id}/${id}`, '');
    agenda.metadados.set(`voto-vinculado/${r.id}/${id}`, { numero: 1, em: '2026-11-08T19:00:00Z' });
    expect(await importarVotosDoSite(banco, agenda, r.id)).toBe(1);
    const votos = (await banco.query<{ ig_user_id: string; votado_em: Date }>(`SELECT ig_user_id, votado_em FROM voto WHERE rodada_id = $1`, [r.id])).rows;
    expect(votos).toHaveLength(1); // um por pessoa
    expect(new Date(votos[0]!.votado_em).toISOString()).toBe('2026-11-08T19:00:00.000Z');
    expect(await importarVotosDoSite(banco, agenda, r.id)).toBe(0);
  });
});
