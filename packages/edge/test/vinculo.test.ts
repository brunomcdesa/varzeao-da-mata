import { describe, expect, it } from 'vitest';
import { responder, type Env } from '../src/index.js';
import { CHAVE_METADADOS_OK, codigoNaMensagem, completarMetadadosDasSessoes, jogadoresVinculados, rotasDoVinculo } from '../src/vinculo.js';

function kv() {
  const m = new Map<string, string>();
  let listagens = 0;
  let leituras = 0;
  return {
    m,
    get leituras() {
      return leituras;
    },
    get listagens() {
      return listagens;
    },
    async get(k: string, tipo?: string) {
      leituras++;
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
      return { list_complete: true, keys: [...m.keys()].filter((k) => k.startsWith(o.prefix)).sort().map((name) => ({ name, ...(this.meta.has(name) ? { metadata: this.meta.get(name) } : {}) })) };
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

  it('a Formação vai como escolha do site (ADR-0044) e precisa de valor', async () => {
    const t = montar([]);
    const sessao = 'd'.repeat(43);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessao)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await t.AGENDA.put(`vinculo/sessao/${h}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', vinculadoEm: agora.toISOString() }));
    const pedidos: unknown[] = [];
    const aplicar = async (p: unknown) => {
      pedidos.push(p);
      return { resultado: 'SALVO', mensagem: 'Formação 3-2-1 no próximo jogo.' };
    };
    const sem = await rotasDoVinculo(new Request('https://borda/escolha', { method: 'POST', body: JSON.stringify({ sessao, tipo: 'FORMACAO', valor: '' }) }), t.env, agora, async () => ({}) as never, async () => true, aplicar);
    expect(sem!.status).toBe(400);
    const r = await rotasDoVinculo(new Request('https://borda/escolha', { method: 'POST', body: JSON.stringify({ sessao, tipo: 'FORMACAO', valor: '3-2-1' }) }), t.env, agora, async () => ({}) as never, async () => true, aplicar);
    expect(await r!.json()).toMatchObject({ ok: true, pedido: { resultado: 'SALVO' } });
    expect(pedidos).toEqual([{ tipo: 'ESCOLHA', jogadorId: '7', escolha: { tipo: 'FORMACAO', valor: '3-2-1' } }]);
  });

  it('os Batedores vão como lista de ids (ADR-0091), até 5, só com dígitos', async () => {
    const t = montar([]);
    const sessao = 'e'.repeat(43);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessao)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await t.AGENDA.put(`vinculo/sessao/${h}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', vinculadoEm: agora.toISOString() }));
    const pedidos: unknown[] = [];
    const aplicar = async (p: unknown) => {
      pedidos.push(p);
      return { resultado: 'SALVO', mensagem: '2 Batedores salvos para o próximo jogo.' };
    };
    const enviar = (valor: unknown) => rotasDoVinculo(new Request('https://borda/escolha', { method: 'POST', body: JSON.stringify({ sessao, tipo: 'BATEDORES', valor }) }), t.env, agora, async () => ({}) as never, async () => true, aplicar);
    expect((await enviar(['1', '2', '3', '4', '5', '6']))!.status).toBe(400);
    expect((await enviar(['1', 'x; DROP'])) !.status).toBe(400);
    const r = await enviar(['12', '7']);
    expect(await r!.json()).toMatchObject({ ok: true, pedido: { resultado: 'SALVO' } });
    expect(pedidos).toEqual([{ tipo: 'ESCOLHA', jogadorId: '7', escolha: { tipo: 'BATEDORES', valor: ['12', '7'] } }]);
  });

  it('a Loja (ADR-0099) manda o código do Item ou o Encaixe, só com letras maiúsculas', async () => {
    const t = montar([]);
    const sessao = 'f'.repeat(43);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessao)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await t.AGENDA.put(`vinculo/sessao/${h}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', vinculadoEm: agora.toISOString() }));
    const pedidos: unknown[] = [];
    const aplicar = async (p: unknown) => {
      pedidos.push(p);
      return { resultado: 'SALVO', mensagem: 'Chuteira azul comprada e equipada.' };
    };
    const enviar = (tipo: string, valor: unknown) => rotasDoVinculo(new Request('https://borda/escolha', { method: 'POST', body: JSON.stringify({ sessao, tipo, valor }) }), t.env, agora, async () => ({}) as never, async () => true, aplicar);
    expect((await enviar('COMPRA', 'chuteira; DROP'))!.status).toBe(400);
    expect((await enviar('TIRAR', null))!.status).toBe(400);
    expect((await enviar('COMPRA', 'CHUTEIRA_AZUL'))!.status).toBe(200);
    expect((await enviar('TIRAR', 'CHUTEIRA'))!.status).toBe(200);
    expect(pedidos).toEqual([
      { tipo: 'ESCOLHA', jogadorId: '7', escolha: { tipo: 'COMPRA', valor: 'CHUTEIRA_AZUL' } },
      { tipo: 'ESCOLHA', jogadorId: '7', escolha: { tipo: 'TIRAR', valor: 'CHUTEIRA' } },
    ]);
  });
});

describe('Lista de quem tem Vínculo (ADR-0094)', () => {
  const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

  it('a sessão nova guarda o Jogador nos metadados, e a lista sai da listagem sem ler sessão por sessão', async () => {
    const t = montar([]);
    const token = 't'.repeat(43);
    await t.AGENDA.put(`vinculo/link/${await sha(token)}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', criadoEm: agora.toISOString(), expiraEm: '2026-11-09T20:00:00Z' }));
    const r = (await (await t.post('/vinculo/link', { token })).json()) as { sessao: string };
    expect(t.AGENDA.meta.get(`vinculo/sessao/${await sha(r.sessao)}`)).toEqual({ jogadorId: '7' });
    const antes = t.AGENDA.leituras;
    expect([...(await jogadoresVinculados(t.AGENDA as never))]).toEqual(['7']);
    expect(t.AGENDA.leituras).toBe(antes);
  });

  it('sessão antiga, sem metadados, ainda conta (lida à parte)', async () => {
    const t = montar([]);
    await t.AGENDA.put(`vinculo/sessao/${await sha('a'.repeat(43))}`, JSON.stringify({ jogadorId: '9', username: 'antigo', vinculadoEm: agora.toISOString() }));
    await t.AGENDA.put(`vinculo/sessao/${await sha('b'.repeat(43))}`, JSON.stringify({ jogadorId: '7', username: 'novo', vinculadoEm: agora.toISOString() }), { metadata: { jogadorId: '7' } });
    const antes = t.AGENDA.leituras;
    expect([...(await jogadoresVinculados(t.AGENDA as never))].sort()).toEqual(['7', '9']);
    expect(t.AGENDA.leituras - antes).toBe(1);
  });

  it('o cron regrava as sessões antigas com metadados uma vez só', async () => {
    const t = montar([]);
    const chave = `vinculo/sessao/${await sha('a'.repeat(43))}`;
    await t.AGENDA.put(chave, JSON.stringify({ jogadorId: '9', username: 'antigo', vinculadoEm: agora.toISOString() }));
    expect(await completarMetadadosDasSessoes(t.AGENDA as never)).toBe(1);
    expect(t.AGENDA.meta.get(chave)).toEqual({ jogadorId: '9' });
    expect(JSON.parse(t.AGENDA.m.get(chave)!)).toMatchObject({ jogadorId: '9', username: 'antigo' });
    expect(t.AGENDA.m.has(CHAVE_METADADOS_OK)).toBe(true);
    expect(await completarMetadadosDasSessoes(t.AGENDA as never)).toBe(0);
    const antes = t.AGENDA.leituras;
    expect([...(await jogadoresVinculados(t.AGENDA as never))]).toEqual(['9']);
    expect(t.AGENDA.leituras).toBe(antes);
  });
});

describe('Link de Vínculo (ADR-0082)', () => {
  const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const token = 't'.repeat(43);
  async function comLink(expiraEm = '2026-11-09T20:00:00Z') {
    const t = montar([]);
    await t.AGENDA.put(`vinculo/link/${await sha(token)}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', criadoEm: agora.toISOString(), expiraEm }));
    return t;
  }

  it('abrir o link vincula o navegador ao Jogador, e o link só vale uma vez', async () => {
    const t = await comLink();
    const r = (await (await t.post('/vinculo/link', { token })).json()) as { vinculado: boolean; sessao: string; jogadorId: string; username: string };
    expect(r).toMatchObject({ vinculado: true, jogadorId: '7', username: 'Fulano_10' });
    expect(r.sessao).toMatch(/^[A-Za-z0-9_-]{30,60}$/);
    expect(await (await t.post('/vinculo/eu', { sessao: r.sessao })).json()).toEqual({ jogadorId: '7', username: 'Fulano_10' });
    // O token não fica guardado; só o hash da sessão nova.
    expect([...t.AGENDA.m.keys()].some((k) => k.startsWith('vinculo/link/'))).toBe(false);
    expect(t.AGENDA.m.has(`vinculo/sessao/${await sha(r.sessao)}`)).toBe(true);
    expect((await t.post('/vinculo/link', { token })).status).toBe(410);
  });

  it('troca o vínculo antigo do navegador: a sessão do outro Jogador é apagada', async () => {
    const t = await comLink();
    const antiga = 'a'.repeat(43);
    await t.AGENDA.put(`vinculo/sessao/${await sha(antiga)}`, JSON.stringify({ jogadorId: '9', username: 'outro', vinculadoEm: agora.toISOString() }));
    const r = (await (await t.post('/vinculo/link', { token, sessaoAntiga: antiga })).json()) as { sessao: string };
    expect((await t.post('/vinculo/eu', { sessao: antiga })).status).toBe(404);
    expect(await (await t.post('/vinculo/eu', { sessao: r.sessao })).json()).toMatchObject({ jogadorId: '7' });
  });

  it('link vencido ou inventado não vincula', async () => {
    const t = await comLink('2026-11-08T19:59:00Z');
    expect((await t.post('/vinculo/link', { token })).status).toBe(410);
    expect([...t.AGENDA.m.keys()].some((k) => k.startsWith('vinculo/link/'))).toBe(false);
    expect((await t.post('/vinculo/link', { token: 'x'.repeat(43) })).status).toBe(410);
    expect((await t.post('/vinculo/link', { token: 'curto' })).status).toBe(400);
  });
});

describe('Link de Vínculo: só gasta no toque', () => {
  const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  it('olhar o link (pré-carregamento do navegador) não gasta; vincular gasta', async () => {
    const token = 'v'.repeat(43);
    const t = montar([]);
    await t.AGENDA.put(`vinculo/link/${await sha(token)}`, JSON.stringify({ jogadorId: '7', username: 'Fulano_10', criadoEm: agora.toISOString(), expiraEm: '2026-11-09T20:00:00Z' }));
    for (let i = 0; i < 3; i++) expect(await (await t.post('/vinculo/link/ver', { token })).json()).toEqual({ jogadorId: '7', username: 'Fulano_10' });
    expect(await (await t.post('/vinculo/link', { token })).json()).toMatchObject({ vinculado: true, jogadorId: '7' });
    expect((await t.post('/vinculo/link/ver', { token })).status).toBe(410);
  });
});
