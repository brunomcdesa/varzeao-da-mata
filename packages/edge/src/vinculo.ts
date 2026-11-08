/**
 * Vínculo do personagem pela DM (ADR-0013). Quem é dono de um Jogador prova isso mandando
 * um código para a DM da Liga; o navegador dele recebe uma sessão e passa a poder fazer
 * pelo site o que antes só dava por comentário (por enquanto, a Transferência).
 *
 *   POST /vinculo                {jogadorId}              → {codigo, sessao, expiraEm}
 *   POST /vinculo/verificar      {codigo, sessao}         → {vinculado: true, jogadorId} | {vinculado: false}
 *   POST /vinculo/eu             {sessao}                 → {jogadorId, username} | 404
 *   POST /vinculo/sair           {sessao}                 → {ok}
 *   POST /transferencia          {sessao, time?, posicao?} → {ok}
 *   POST /transferencia/estado   {sessao}                 → o pedido com o resultado da coleta
 *   POST /perfil                 {sessao, visual?, numero?} → {ok} (visual do boneco, camisa)
 *   POST /perfil/estado          {sessao}                 → o pedido com o resultado da coleta
 *   (o voto do Craque vinculado vai pelo /votos, com a sessão)
 *
 * A sessão é um segredo aleatório que só o navegador guarda; no KV fica só o hash dela.
 * Só a própria conta consegue mandar DM com o próprio @, então o código prova o dono.
 */

export interface EnvVinculo {
  AGENDA: KVNamespace;
  PUBLICO: R2Bucket;
  IG_USER_ID: string;
}

type Graph = <T>(metodo: 'GET' | 'POST', caminho: string, params: Record<string, string>) => Promise<T>;
type Disparar = (job: string) => Promise<boolean>;

const TIMES = ['ONC', 'ARA', 'CAP', 'TUC', 'SAG', 'PRE', 'TAM', 'TAT'] as const;
const POSICOES = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
/** O código vale 15 minutos. */
export const VALIDADE_CODIGO_S = 15 * 60;
/** No máximo 8 códigos por rede (IP) por hora. */
const CODIGOS_POR_HORA = 8;

interface CodigoPendente {
  jogadorId: string;
  username: string;
  sessao: string; // hash
  criadoEm: string;
}

export interface SessaoVinculada {
  jogadorId: string;
  username: string;
  vinculadoEm: string;
}

export interface PedidoDoSite {
  tipo: 'TRANSFERENCIA';
  jogadorId: string;
  time?: string;
  posicao?: string;
  pedidoEm: string;
  resultado?: string;
  mensagem?: string;
  processadoEm?: string;
}

const CORS = { 'access-control-allow-origin': '*' };
const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });

async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function aleatorio(bytes: number): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** "VZ-4821": fácil de digitar no celular. */
function novoCodigo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 10000;
  return `VZ-${String(n).padStart(4, '0')}`;
}

/** Acha "VZ-4821", "vz 4821", "VZ4821" numa mensagem. */
export function codigoNaMensagem(texto: string): string | null {
  const m = /\bVZ\s*[-‐–—]?\s*(\d{4})\b/i.exec(texto);
  return m ? `VZ-${m[1]}` : null;
}

const sessaoValida = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{30,60}$/.test(s);

async function corpo<T>(req: Request): Promise<Partial<T> | null> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return null;
  }
}

async function jogadorPublico(env: EnvVinculo, id: string): Promise<{ id: string; username: string } | null> {
  const obj = await env.PUBLICO.get('dados/jogadores.json');
  if (!obj) return null;
  const lista = (await obj.json()) as { id: string; username: string }[];
  return lista.find((j) => j.id === id) ?? null;
}

export async function sessaoDe(env: EnvVinculo, sessao: string): Promise<SessaoVinculada | null> {
  return env.AGENDA.get<SessaoVinculada>(`vinculo/sessao/${await hash(sessao)}`, 'json');
}

export async function rotasDoVinculo(req: Request, env: EnvVinculo, agora: Date, graph: Graph, disparar: Disparar): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (req.method !== 'POST') return null;

  if (pathname === '/vinculo') {
    const c = await corpo<{ jogadorId: string }>(req);
    const jogadorId = String(c?.jogadorId ?? '');
    if (!/^\d{1,12}$/.test(jogadorId)) return json({ erro: 'Jogador inválido' }, 400);
    const j = await jogadorPublico(env, jogadorId);
    if (!j) return json({ erro: 'Jogador não encontrado' }, 404);
    // Limite por rede, para ninguém gerar códigos sem parar.
    const ip = req.headers.get('cf-connecting-ip') ?? 'sem-ip';
    const chaveIp = `vinculo/ip/${await hash(ip)}/${agora.toISOString().slice(0, 13)}`;
    const usados = Number((await env.AGENDA.get(chaveIp)) ?? 0);
    if (usados >= CODIGOS_POR_HORA) return json({ erro: 'Muitos códigos pedidos. Tente de novo em uma hora.' }, 429);
    await env.AGENDA.put(chaveIp, String(usados + 1), { expirationTtl: 3600 });

    let codigo = novoCodigo();
    for (let i = 0; i < 5 && (await env.AGENDA.get(`vinculo/codigo/${codigo}`)); i++) codigo = novoCodigo();
    const sessao = aleatorio(32);
    const pendente: CodigoPendente = { jogadorId, username: j.username, sessao: await hash(sessao), criadoEm: agora.toISOString() };
    await env.AGENDA.put(`vinculo/codigo/${codigo}`, JSON.stringify(pendente), { expirationTtl: VALIDADE_CODIGO_S });
    return json({ codigo, sessao, username: j.username, expiraEm: new Date(agora.getTime() + VALIDADE_CODIGO_S * 1000).toISOString() });
  }

  if (pathname === '/vinculo/verificar') {
    const c = await corpo<{ codigo: string; sessao: string }>(req);
    const codigo = String(c?.codigo ?? '').toUpperCase();
    if (!/^VZ-\d{4}$/.test(codigo) || !sessaoValida(c?.sessao)) return json({ erro: 'Pedido inválido' }, 400);
    const h = await hash(c.sessao);
    const ja = await env.AGENDA.get<SessaoVinculada>(`vinculo/sessao/${h}`, 'json');
    if (ja) return json({ vinculado: true, jogadorId: ja.jogadorId, username: ja.username });
    const pendente = await env.AGENDA.get<CodigoPendente>(`vinculo/codigo/${codigo}`, 'json');
    if (!pendente || pendente.sessao !== h) return json({ vinculado: false, expirado: true });

    // A DM da Liga: a mensagem com o código tem que ter vindo do @ dono do Jogador.
    const desde = Date.parse(pendente.criadoEm) - 60_000;
    const r = await graph<{ data: { participants?: { data: { id: string; username?: string }[] }; messages?: { data: { message?: string; from?: { id: string; username?: string }; created_time?: string }[] } }[] }>(
      'GET',
      `${env.IG_USER_ID}/conversations`,
      { platform: 'instagram', fields: 'participants,messages.limit(8){message,from,created_time}', limit: '25' },
    );
    const dono = pendente.username.toLowerCase();
    let remetente: string | null = null;
    for (const conversa of r.data) {
      for (const m of conversa.messages?.data ?? []) {
        if (!m.message || (m.from?.username ?? '').toLowerCase() !== dono) continue;
        if (m.created_time && Date.parse(m.created_time) < desde) continue;
        if (codigoNaMensagem(m.message) === codigo) remetente = m.from!.id;
      }
    }
    if (!remetente) return json({ vinculado: false });

    const sessao: SessaoVinculada = { jogadorId: pendente.jogadorId, username: pendente.username, vinculadoEm: agora.toISOString() };
    await env.AGENDA.put(`vinculo/sessao/${h}`, JSON.stringify(sessao));
    await env.AGENDA.delete(`vinculo/codigo/${codigo}`);
    // Confirmação na DM (se a API não deixar, o site já mostra que deu certo).
    await graph('POST', `${env.IG_USER_ID}/messages`, {
      recipient: JSON.stringify({ id: remetente }),
      message: JSON.stringify({ text: `Pronto, @${pendente.username}! Seu personagem está vinculado neste navegador. Agora dá para cuidar dele pelo site. ⚽` }),
    }).catch(() => {});
    return json({ vinculado: true, jogadorId: sessao.jogadorId, username: sessao.username });
  }

  if (pathname === '/vinculo/eu' || pathname === '/vinculo/sair') {
    const c = await corpo<{ sessao: string }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    if (pathname === '/vinculo/sair') {
      await env.AGENDA.delete(`vinculo/sessao/${await hash(c.sessao)}`);
      return json({ ok: true });
    }
    const s = await sessaoDe(env, c.sessao);
    return s ? json({ jogadorId: s.jogadorId, username: s.username }) : json({ erro: 'Não vinculado' }, 404);
  }

  if (pathname === '/perfil' || pathname === '/perfil/estado') {
    const c = await corpo<{ sessao: string; visual: { pele: string; cabelo: string; penteado: string }; numero: number }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    const s = await sessaoDe(env, c.sessao);
    if (!s) return json({ erro: 'Não vinculado' }, 401);
    const chave = `perfil-site/${s.jogadorId}`;
    if (pathname === '/perfil/estado') return json((await env.AGENDA.get(chave, 'json')) ?? {});
    const v = c.visual;
    const visual = v && typeof v === 'object' ? { pele: String(v.pele).slice(0, 9), cabelo: String(v.cabelo).slice(0, 9), penteado: String(v.penteado).slice(0, 12) } : undefined;
    const numero = c.numero !== undefined && c.numero !== null ? Number(c.numero) : undefined;
    if (numero !== undefined && (!Number.isInteger(numero) || numero < 1 || numero > 99)) return json({ erro: 'O número da camisa vai de 1 a 99.' }, 400);
    if (!visual && numero === undefined) return json({ erro: 'Nada para salvar' }, 400);
    // A coleta valida as cores e o número (sem repetir no Time) e devolve a mensagem.
    const pedido = { jogadorId: s.jogadorId, ...(visual ? { visual } : {}), ...(numero !== undefined ? { numero } : {}), pedidoEm: agora.toISOString() };
    await env.AGENDA.put(chave, JSON.stringify(pedido), { expirationTtl: 7 * 86400 });
    const disparou = await disparar('coletar').catch(() => false);
    return json({ ok: true, pedido, disparou });
  }

  if (pathname === '/transferencia' || pathname === '/transferencia/estado') {
    const c = await corpo<{ sessao: string; time: string; posicao: string }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    const s = await sessaoDe(env, c.sessao);
    if (!s) return json({ erro: 'Não vinculado' }, 401);
    const chave = `pedido-site/${s.jogadorId}`;
    if (pathname === '/transferencia/estado') return json((await env.AGENDA.get<PedidoDoSite>(chave, 'json')) ?? {});

    const time = c.time ? String(c.time) : undefined;
    const posicao = c.posicao ? String(c.posicao) : undefined;
    if (time && !(TIMES as readonly string[]).includes(time)) return json({ erro: 'Time inválido' }, 400);
    if (posicao && !(POSICOES as readonly string[]).includes(posicao)) return json({ erro: 'Posição inválida' }, 400);
    if (!time && !posicao) return json({ erro: 'Escolha o time ou a posição' }, 400);
    const anterior = await env.AGENDA.get<PedidoDoSite>(chave, 'json');
    if (anterior && !anterior.processadoEm) return json({ erro: 'Já tem um pedido em andamento' }, 409);
    const pedido: PedidoDoSite = { tipo: 'TRANSFERENCIA', jogadorId: s.jogadorId, ...(time ? { time } : {}), ...(posicao ? { posicao } : {}), pedidoEm: agora.toISOString() };
    await env.AGENDA.put(chave, JSON.stringify(pedido), { expirationTtl: 7 * 86400 });
    // A coleta aplica o pedido; dispara agora para a resposta vir em 1 a 2 minutos.
    const disparou = await disparar('coletar').catch(() => false);
    return json({ ok: true, pedido, disparou });
  }
  return null;
}
