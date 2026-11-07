import { describe, expect, it } from 'vitest';
import { CHAVE_PROXIMA, CHAVE_VOTACAO, dispararJobs, jobsDoMinuto, VOTOS_POR_IP, publicarVencidos, responder, type Env, type ItemDaAgenda } from '../src/index.js';

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

const item = (ref: number, em: string): ItemDaAgenda => ({ tipo: 'PARTIDA', ref, containerId: `C${ref}`, publicarEm: em });

function montar() {
  const AGENDA = kv();
  const env = { AGENDA, PUBLICO: r2({ 'dados/liga.json': { ok: 1 } }), PRIVADO: r2({ 'partidas/7.json': { id: 7, apito: '2026-11-07T15:00:00.000Z', resultado: { lances: [] } } }), IG_USER_ID: 'EU' } as unknown as Env;
  return { env, AGENDA };
}

describe('publicação agendada', () => {
  it('só lista a agenda quando a próxima vence, publica e reprograma', async () => {
    const { env, AGENDA } = montar();
    await AGENDA.put('ig/token', JSON.stringify({ token: 'T' }));
    await AGENDA.put('agenda/2026-11-07T15:06:00.000Z/partida-1', JSON.stringify(item(1, '2026-11-07T15:06:00.000Z')));
    await AGENDA.put('agenda/2026-11-07T17:06:00.000Z/partida-2', JSON.stringify(item(2, '2026-11-07T17:06:00.000Z')));
    await AGENDA.put(CHAVE_PROXIMA, JSON.stringify({ em: '2026-11-07T15:06:00.000Z' }));
    const chamadas: string[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      chamadas.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`);
      if (url.includes('media_publish')) return new Response(JSON.stringify({ id: 'M1' }));
      return new Response(JSON.stringify({ status_code: 'FINISHED' }));
    }) as typeof fetch;

    expect(await publicarVencidos(env, new Date('2026-11-07T15:05:00Z'), f)).toEqual([]);
    expect(AGENDA.listagens).toBe(0);

    expect(await publicarVencidos(env, new Date('2026-11-07T15:06:10Z'), f)).toEqual(['agenda/2026-11-07T15:06:00.000Z/partida-1']);
    expect(chamadas).toEqual(['GET /v25.0/C1', 'POST /v25.0/EU/media_publish']);
    expect(JSON.parse(AGENDA.m.get('agenda/2026-11-07T15:06:00.000Z/partida-1')!)).toMatchObject({ publicadoEm: '2026-11-07T15:06:10.000Z', mediaId: 'M1' });
    expect(JSON.parse(AGENDA.m.get(CHAVE_PROXIMA)!)).toEqual({ em: '2026-11-07T17:06:00.000Z' });

    // De novo no mesmo minuto: nada.
    expect(await publicarVencidos(env, new Date('2026-11-07T15:07:00Z'), f)).toEqual([]);
    expect(chamadas).toHaveLength(2);
  });

  it('container já publicado (execução anterior caiu) é só marcado; erro tenta de novo', async () => {
    const { env, AGENDA } = montar();
    await AGENDA.put('ig/token', JSON.stringify({ token: 'T' }));
    await AGENDA.put('agenda/2026-11-07T15:06:00.000Z/partida-1', JSON.stringify(item(1, '2026-11-07T15:06:00.000Z')));
    await AGENDA.put('agenda/2026-11-07T15:06:00.000Z/partida-2', JSON.stringify(item(2, '2026-11-07T15:06:00.000Z')));
    await AGENDA.put(CHAVE_PROXIMA, JSON.stringify({ em: '2026-11-07T15:06:00.000Z' }));
    const f = (async (url: string) =>
      url.includes('/C1') ? new Response(JSON.stringify({ status_code: 'PUBLISHED' })) : new Response(JSON.stringify({ error: { message: 'fora do ar' } }), { status: 500 })) as unknown as typeof fetch;
    const agora = new Date('2026-11-07T15:06:30Z');
    expect(await publicarVencidos(env, agora, f)).toEqual(['agenda/2026-11-07T15:06:00.000Z/partida-1']);
    const falhou = JSON.parse(AGENDA.m.get('agenda/2026-11-07T15:06:00.000Z/partida-2')!);
    expect(falhou).toMatchObject({ tentativas: 1 });
    expect(falhou.erro).toMatch(/fora do ar/);
    expect(JSON.parse(AGENDA.m.get(CHAVE_PROXIMA)!).em).toBe('2026-11-07T15:07:30.000Z');
  });
});

describe('leitura', () => {
  it('Partida: 425 antes do Apito, completa depois', async () => {
    const { env } = montar();
    const antes = await responder(new Request('https://e/partidas/7'), env, new Date('2026-11-07T14:59:00Z'));
    expect(antes.status).toBe(425);
    expect(antes.headers.get('retry-after')).toBe('60');
    expect(JSON.stringify(await antes.json())).not.toContain('lances');
    const durante = await responder(new Request('https://e/partidas/7'), env, new Date('2026-11-07T15:01:00Z'));
    expect(durante.status).toBe(200);
    expect(await durante.json()).toMatchObject({ situacao: 'AO_VIVO', resultado: { lances: [] } });
    expect(durante.headers.get('access-control-allow-origin')).toBe('*');
    expect((await responder(new Request('https://e/partidas/8'), env)).status).toBe(404);
  });

  it('dados do site com CORS', async () => {
    const { env } = montar();
    const r = await responder(new Request('https://e/dados/liga.json'), env);
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(await r.json()).toEqual({ ok: 1 });
  });
});

describe('voto pelo site', () => {
  const votar = (env: Env, corpo: unknown, ip = '1.2.3.4') =>
    responder(new Request('https://borda/votos', { method: 'POST', body: JSON.stringify(corpo), headers: { 'cf-connecting-ip': ip } }), env, new Date('2026-11-07T20:00:00Z'));
  const aparelho = (n: number) => `aparelho-${String(n).padStart(10, '0')}`;

  it('aceita um voto por aparelho, só na votação aberta e para um Candidato que existe', async () => {
    const { env, AGENDA } = montar();
    expect((await votar(env, { rodada: 3, numero: 2, aparelho: aparelho(1) })).status).toBe(409);
    await AGENDA.put(CHAVE_VOTACAO, JSON.stringify({ rodada: 3, candidatos: 5 }));
    expect((await votar(env, { rodada: 2, numero: 2, aparelho: aparelho(1) })).status).toBe(409);
    expect((await votar(env, { rodada: 3, numero: 6, aparelho: aparelho(1) })).status).toBe(400);
    expect((await votar(env, { rodada: 3, numero: 2, aparelho: 'curto' })).status).toBe(400);
    expect(await (await votar(env, { rodada: 3, numero: 2, aparelho: aparelho(1) })).json()).toEqual({ ok: true, numero: 2 });
    // Segundo voto do mesmo aparelho não troca o primeiro.
    expect(await (await votar(env, { rodada: 3, numero: 4, aparelho: aparelho(1) })).json()).toEqual({ ok: true, numero: 2, jaVotou: true });
    expect(AGENDA.meta.get(`voto-site/3/${aparelho(1)}`)).toMatchObject({ numero: 2 });
  });

  it('limita os aparelhos por rede', async () => {
    const { env, AGENDA } = montar();
    await AGENDA.put(CHAVE_VOTACAO, JSON.stringify({ rodada: 3, candidatos: 5 }));
    for (let i = 0; i < VOTOS_POR_IP; i++) expect((await votar(env, { rodada: 3, numero: 1, aparelho: aparelho(i) })).status).toBe(200);
    expect((await votar(env, { rodada: 3, numero: 1, aparelho: aparelho(99) })).status).toBe(429);
    expect((await votar(env, { rodada: 3, numero: 1, aparelho: aparelho(99) }, '5.6.7.8')).status).toBe(200);
  });
});

describe('relógio dos jobs', () => {
  it('dispara coletar às :17, partida às 11h25/13h25/15h25/17h25 e resumo às 18h10 (Brasília)', () => {
    expect(jobsDoMinuto(new Date('2026-11-08T14:25:30Z'))).toEqual(['partida']); // 11h25
    expect(jobsDoMinuto(new Date('2026-11-08T14:17:00Z'))).toEqual(['coletar']);
    expect(jobsDoMinuto(new Date('2026-11-08T21:10:00Z'))).toEqual(['resumo']); // 18h10
    expect(jobsDoMinuto(new Date('2026-11-08T22:25:00Z'))).toEqual([]); // 19h25: não tem jogo
  });

  it('chama o workflow_dispatch com origem=borda; sem token não faz nada', async () => {
    const { env } = montar();
    const chamadas: { url: string; corpo: string }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      chamadas.push({ url, corpo: String(init?.body) });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    expect(await dispararJobs(env, new Date('2026-11-08T14:25:00Z'), f)).toEqual([]);
    const comToken = { ...env, GH_DISPARO_TOKEN: 'x', GH_REPOSITORIO: 'dono/repo' } as Env;
    expect(await dispararJobs(comToken, new Date('2026-11-08T14:25:00Z'), f)).toEqual(['partida']);
    expect(chamadas[0]!.url).toBe('https://api.github.com/repos/dono/repo/actions/workflows/partida.yml/dispatches');
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ ref: 'master', inputs: { origem: 'borda' } });
  });
});
