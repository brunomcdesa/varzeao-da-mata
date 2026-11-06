import { describe, expect, it } from 'vitest';
import { ErroInstagram, Instagram } from '../src/instagram.js';
import { AgendaNaMemoria, KV, R2, chaveDaAgenda } from '../src/nuvem.js';

type Rota = (url: URL, init: RequestInit) => unknown;
function falso(rotas: Record<string, Rota>) {
  const chamadas: { metodo: string; url: URL; corpo: string }[] = [];
  const f = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const req = entrada instanceof Request ? entrada : null;
    const url = new URL(req ? req.url : String(entrada));
    const metodo = req?.method ?? init.method ?? 'GET';
    const corpo = req ? await req.clone().text() : init.body ? String(init.body) : '';
    chamadas.push({ metodo, url, corpo });
    const chave = Object.keys(rotas).find((k) => k.startsWith(`${metodo} `) && url.pathname.endsWith(k.slice(metodo.length + 1)));
    if (!chave) return new Response(JSON.stringify({ error: { code: 100, message: 'rota desconhecida' } }), { status: 400 });
    const r = rotas[chave]!(url, init);
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 });
  }) as typeof fetch;
  return { f, chamadas };
}

describe('Instagram', () => {
  it('lê comentários com paginação, ignora os sem autor e devolve do mais antigo ao mais novo', async () => {
    const { f, chamadas } = falso({
      'GET /v25.0/M1/comments': (url) =>
        url.searchParams.get('after')
          ? { data: [{ id: 'c1', text: 'ENTRO ONÇA ATA', timestamp: '2026-11-07T10:00:00+0000', from: { id: 'u1', username: 'rafa' } }] }
          : {
              data: [
                { id: 'c3', text: 'CRAQUE @rafa', timestamp: '2026-11-07T12:00:00+0000', from: { id: 'u2', username: 'bia' } },
                { id: 'c2', text: 'oi', timestamp: '2026-11-07T11:00:00+0000' },
              ],
              paging: { next: 'https://graph.instagram.com/v25.0/M1/comments?after=x&access_token=T' },
            },
    });
    const ig = new Instagram({ userId: 'EU', token: 'T', fetch: f });
    const cs = await ig.comentarios('M1');
    expect(cs.map((c) => c.igCommentId)).toEqual(['c1', 'c3']);
    expect(cs[0]).toMatchObject({ igMediaId: 'M1', igUserId: 'u1', username: 'rafa', texto: 'ENTRO ONÇA ATA' });
    expect(chamadas[0]!.url.searchParams.get('fields')).toContain('from{id,username}');
    expect(chamadas[0]!.url.searchParams.get('access_token')).toBe('T');
  });

  it('publica um Reels: container, espera FINISHED, media_publish', async () => {
    let consultas = 0;
    const { f, chamadas } = falso({
      'POST /v25.0/EU/media': () => ({ id: 'CONT' }),
      'GET /v25.0/CONT': () => ({ status_code: ++consultas < 3 ? 'IN_PROGRESS' : 'FINISHED' }),
      'POST /v25.0/EU/media_publish': () => ({ id: 'MIDIA' }),
    });
    const ig = new Instagram({ userId: 'EU', token: 'T', fetch: f, dormir: async () => {} });
    const id = await ig.criarReels({ videoUrl: 'https://videos/x.mp4', legenda: 'Gol!' });
    await ig.esperarContainer(id);
    expect(await ig.publicar(id)).toBe('MIDIA');
    const corpo = new URLSearchParams(chamadas[0]!.corpo);
    expect(corpo.get('media_type')).toBe('REELS');
    expect(corpo.get('video_url')).toBe('https://videos/x.mp4');
    expect(new URLSearchParams(chamadas.at(-1)!.corpo).get('creation_id')).toBe('CONT');
    expect(consultas).toBe(3);
  });

  it('erro do container e token vencido viram ErroInstagram', async () => {
    const { f } = falso({
      'GET /v25.0/CONT': () => ({ status_code: 'ERROR', status: 'Formato de vídeo' }),
      'GET /v25.0/me': () => new Response(JSON.stringify({ error: { code: 190, message: 'expirou' } }), { status: 400 }),
    });
    const ig = new Instagram({ userId: 'EU', token: 'T', fetch: f, dormir: async () => {} });
    await expect(ig.esperarContainer('CONT')).rejects.toThrow(/ERROR: Formato/);
    const e = await ig.eu().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroInstagram);
    expect((e as ErroInstagram).tokenInvalido).toBe(true);
  });

  it('renova o token e passa a usar o novo', async () => {
    const { f, chamadas } = falso({
      'GET /refresh_access_token': () => ({ access_token: 'NOVO', token_type: 'bearer', expires_in: 5184000 }),
      'GET /v25.0/me': () => ({ user_id: 'EU', username: 'varzeao' }),
    });
    const ig = new Instagram({ userId: 'EU', token: 'VELHO', fetch: f });
    const r = await ig.renovarToken();
    expect(r.token).toBe('NOVO');
    expect(chamadas[0]!.url.searchParams.get('grant_type')).toBe('ig_refresh_token');
    await ig.eu();
    expect(chamadas[1]!.url.searchParams.get('access_token')).toBe('NOVO');
  });
});

describe('Cloudflare', () => {
  it('R2 assina o PUT (SigV4) no endpoint da conta', async () => {
    const { f, chamadas } = falso({ 'PUT /pub/videos/a%20b.mp4': () => new Response('', { status: 200 }) });
    let cabecalhos: Headers | null = null;
    const espia = (async (e: RequestInfo | URL, i?: RequestInit) => {
      cabecalhos = (e as Request).headers;
      return f(e, i);
    }) as typeof fetch;
    const r2 = new R2({ contaId: 'CONTA', chaveId: 'ID', segredo: 'S', bucketPublico: 'pub', bucketPrivado: 'priv', urlPublica: 'https://v.exemplo/', fetch: espia });
    await r2.enviar('publico', 'videos/a b.mp4', new Uint8Array([1, 2]));
    expect(chamadas[0]!.url.host).toBe('CONTA.r2.cloudflarestorage.com'.toLowerCase());
    expect(cabecalhos!.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=ID\/\d{8}\/auto\/s3\/aws4_request/);
    expect(cabecalhos!.get('content-type')).toBe('video/mp4');
    expect(r2.urlPublica('videos/x.mp4')).toBe('https://v.exemplo/videos/x.mp4');
  });

  it('KV grava, lê e lista com cursor', async () => {
    const guardado = new Map<string, string>();
    const { f } = falso({
      'PUT /values/agenda%2Fa': (_u, i) => (guardado.set('agenda/a', String(i.body)), { success: true }),
      'GET /values/agenda%2Fa': () => new Response(guardado.get('agenda/a')!, { status: 200 }),
      'GET /values/nada': () => new Response('', { status: 404 }),
      'GET /keys': (u) => (u.searchParams.get('cursor') ? { result: [{ name: 'agenda/b' }], result_info: { cursor: '' } } : { result: [{ name: 'agenda/a' }], result_info: { cursor: 'c' } }),
    });
    const kv = new KV({ contaId: 'C', namespaceId: 'N', token: 'T', fetch: f });
    await kv.gravar('agenda/a', { x: 1 });
    expect(await kv.ler('agenda/a')).toEqual({ x: 1 });
    expect(await kv.ler('nada')).toBeNull();
    expect(await kv.listar('agenda/')).toEqual(['agenda/a', 'agenda/b']);
  });

  it('chave da agenda ordena por horário', async () => {
    const a = new AgendaNaMemoria();
    await a.gravar(chaveDaAgenda({ tipo: 'RESUMO', ref: 1, publicarEm: '2026-11-07T22:00:00.000Z' }), {});
    await a.gravar(chaveDaAgenda({ tipo: 'PARTIDA', ref: 4, publicarEm: '2026-11-07T21:06:00.000Z' }), {});
    expect(await a.listar('agenda/')).toEqual(['agenda/2026-11-07T21:06:00.000Z/partida-4', 'agenda/2026-11-07T22:00:00.000Z/resumo-1']);
  });
});
