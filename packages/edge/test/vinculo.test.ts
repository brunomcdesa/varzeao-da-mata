import { describe, expect, it } from 'vitest';
import { responder, type Env } from '../src/index.js';
import { codigoNaMensagem, rotasDoVinculo } from '../src/vinculo.js';

function kv() {
  const m = new Map<string, string>();
  let listagens = 0;
  return {
    m,
    get listagens() {
      return listagens;
    },
    async get(k: string, tipo?: string) {
      const v = m.get(k);
      return v === undefined ? null : tipo === 'json' ? JSON.parse(v) : v;
    },
    meta: new Map<string, unknown>(),
    async put(k: string, v: string, o?: { metadata?: unknown }) {
      m.set(k, v);
      if (o?.metadata) this.meta.set(k, o.metadata);
    },
    async getWithMetadata(k: string) {
      return { value: m.get(k) ?? null, metadata: this.meta.get(k) ?? null };
    },
    async delete(k: string) {
      m.delete(k);
    },
    async list(o: { prefix: string }) {
      listagens++;
      return { keys: [...m.keys()].filter((k) => k.startsWith(o.prefix)).sort().map((name) => ({ name })) };
    },
  };
}
function r2(objs: Record<string, unknown>) {
  return {
    async get(k: string) {
      if (!(k in objs)) return null;
      const texto = JSON.stringify(objs[k]);
      return { json: async () => JSON.parse(texto), body: texto };
    },
  };
}


const agora = new Date('2026-11-08T20:00:00Z');
function montar(mensagens: { de: string; texto: string; em?: string }[]) {
  const AGENDA = kv();
  void AGENDA.put('ig/token', JSON.stringify({ token: 'EAAteste' }));
  const env = {
    AGENDA,
    PUBLICO: r2({ 'dados/jogadores.json': [{ id: '7', username: 'Fulano_10' }] }),
    PRIVADO: r2({}),
    IG_USER_ID: 'LIGA',
    GH_DISPARO_TOKEN: 'gh',
    GH_REPOSITORIO: 'dono/repo',
  } as unknown as Env;
  const chamadas: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    chamadas.push(`${init?.method ?? 'GET'} ${u.hostname}${u.pathname}`);
    if (u.pathname.endsWith('/conversations')) {
      return Response.json({
        data: [{ messages: { data: mensagens.map((m) => ({ message: m.texto, from: { id: `id-${m.de}`, username: m.de }, created_time: m.em ?? '2026-11-08T20:00:30+0000' })) } }],
      });
    }
    if (u.pathname.endsWith('/messages')) return Response.json({ message_id: 'm1' });
    if (u.hostname === 'api.github.com') return new Response(null, { status: 204 });
    return new Response('?', { status: 404 });
  }) as typeof fetch;
  const post = async (caminho: string, corpo: unknown, quando = agora) =>
    responder(new Request(`https://borda${caminho}`, { method: 'POST', body: JSON.stringify(corpo), headers: { 'cf-connecting-ip': '1.2.3.4' } }), env, quando, f);
  return { env, AGENDA, post, chamadas };
}

describe('Vínculo pela DM (ADR-0013)', () => {
  it('lê o código em vários formatos', () => {
    expect(codigoNaMensagem('VZ-4821')).toBe('VZ-4821');
    expect(codigoNaMensagem('oi! meu código é vz 0042')).toBe('VZ-0042');
    expect(codigoNaMensagem('VZ4821')).toBe('VZ-4821');
    expect(codigoNaMensagem('4821')).toBeNull();
  });

  it('vincula quando o próprio @ manda o código na DM e libera a Transferência pelo site', async () => {
    let codigo = '';
    const t = montar([]);
    const r = await (await t.post('/vinculo', { jogadorId: '7' })).json() as { codigo: string; sessao: string };
    codigo = r.codigo;
    expect(codigo).toMatch(/^VZ-\d{4}$/);
    // Ainda não mandou: não vincula.
    expect(await (await t.post('/vinculo/verificar', r)).json()).toMatchObject({ vinculado: false });

    const m = montar([{ de: 'fulano_10', texto: `oi ${codigo.toLowerCase()}` }]);
    for (const [k, v] of t.AGENDA.m) m.AGENDA.m.set(k, v);
    expect(await (await m.post('/vinculo/verificar', r)).json()).toMatchObject({ vinculado: true, jogadorId: '7' });
    expect(m.chamadas.some((c) => c.endsWith('/LIGA/messages'))).toBe(true); // confirma na DM
    expect(await (await m.post('/vinculo/eu', { sessao: r.sessao })).json()).toEqual({ jogadorId: '7', username: 'Fulano_10' });

    const pedido = await m.post('/transferencia', { sessao: r.sessao, time: 'PRE' });
    expect(pedido.status).toBe(200);
    expect(JSON.parse(m.AGENDA.m.get('pedido-site/7')!)).toMatchObject({ tipo: 'TRANSFERENCIA', jogadorId: '7', time: 'PRE' });
    expect(m.chamadas.some((c) => c.includes('api.github.com') && c.includes('coletar.yml'))).toBe(true);
    // Um pedido por vez.
    expect((await m.post('/transferencia', { sessao: r.sessao, posicao: 'ZAG' })).status).toBe(409);
  });

  it('código mandado por outra conta não vincula', async () => {
    const t = montar([]);
    const r = await (await t.post('/vinculo', { jogadorId: '7' })).json() as { codigo: string; sessao: string };
    const m = montar([{ de: 'outra_pessoa', texto: r.codigo }]);
    for (const [k, v] of t.AGENDA.m) m.AGENDA.m.set(k, v);
    expect(await (await m.post('/vinculo/verificar', r)).json()).toMatchObject({ vinculado: false });
    expect((await m.post('/transferencia', { sessao: r.sessao, time: 'PRE' })).status).toBe(401);
  });

  it('sessão errada para o código não vincula', async () => {
    const t = montar([]);
    const r = await (await t.post('/vinculo', { jogadorId: '7' })).json() as { codigo: string; sessao: string };
    const m = montar([{ de: 'fulano_10', texto: r.codigo }]);
    for (const [k, v] of t.AGENDA.m) m.AGENDA.m.set(k, v);
    const outra = 'x'.repeat(43);
    expect(await (await m.post('/vinculo/verificar', { codigo: r.codigo, sessao: outra })).json()).toMatchObject({ vinculado: false, expirado: true });
  });

  it('com o banco na borda, o pedido é aplicado na hora e já volta com a mensagem', async () => {
    const t = montar([]);
    const sessao = 'b'.repeat(43);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessao)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await t.AGENDA.put(`vinculo/sessao/${h}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', vinculadoEm: agora.toISOString() }));
    const pedidos: unknown[] = [];
    const req = new Request('https://borda/perfil', { method: 'POST', body: JSON.stringify({ sessao, numero: 10 }) });
    const r = await rotasDoVinculo(req, t.env, agora, async () => ({}) as never, async () => true, async (p) => {
      pedidos.push(p);
      return { resultado: 'SALVO', mensagem: 'Pronto! Salvo: camisa 10.' };
    });
    expect(await r!.json()).toMatchObject({ ok: true, pedido: { resultado: 'SALVO', mensagem: 'Pronto! Salvo: camisa 10.' } });
    expect(pedidos).toEqual([{ tipo: 'PERFIL', jogadorId: '7', numero: 10, pedidoEm: agora.toISOString() }]);
    expect(JSON.parse(t.AGENDA.m.get('perfil-site/7')!)).toMatchObject({ resultado: 'SALVO', processadoEm: agora.toISOString() });
  });

  it('o estado das escolhas diz quem é o Capitão (só ele vê a Postura)', async () => {
    const t = montar([]);
    const sessao = 'c'.repeat(43);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessao)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await t.AGENDA.put(`vinculo/sessao/${h}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', vinculadoEm: agora.toISOString() }));
    const req = new Request('https://borda/escolha/estado', { method: 'POST', body: JSON.stringify({ sessao }) });
    const perguntados: string[] = [];
    const r = await rotasDoVinculo(req, t.env, agora, async () => ({}) as never, async () => true, async () => null, async (id) => {
      perguntados.push(id);
      return { eu: false, capitao: 'beltrano', postura: 'OFENSIVA' };
    });
    expect(await r!.json()).toMatchObject({ capitania: { eu: false, capitao: 'beltrano', postura: 'OFENSIVA' } });
    expect(perguntados).toEqual(['7']);
  });
});
