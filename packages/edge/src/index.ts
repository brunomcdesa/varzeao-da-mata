/**
 * Worker na borda (Cloudflare). Três trabalhos pequenos que precisam de relógio exato:
 *
 * - Cron a cada minuto: publica no Instagram os Reels cuja hora chegou (agenda no KV,
 *   gravada pelo GitHub Actions). Idempotente: confere o container antes de publicar.
 * - GET /partidas/:id — a Partida completa (com lances) do bucket privado, só depois do
 *   Apito Inicial; antes responde 425 com o horário. É o que alimenta o Ao Vivo do site.
 * - GET /dados/* — os JSON do site, do bucket público, com CORS (o site fica em outro domínio).
 * - POST /votos — voto do Craque pelo site, um por aparelho (ADR-0011). O job coletar traz
 *   os votos do KV para o banco e mantém `votacao-aberta` em dia.
 */

import type { Posicao, TimeId } from '@liga/shared';
import { transferirJogador } from '../../worker/src/coletar.js';
import { aplicarPerfil } from '../../worker/src/perfil.js';
import { comBanco } from './banco.js';
import { rotasDoVinculo, sessaoDe } from './vinculo.js';

export interface Env {
  AGENDA: KVNamespace;
  PUBLICO: R2Bucket;
  PRIVADO: R2Bucket;
  IG_USER_ID: string;
  IG_API_VERSAO?: string;
  /** Segredo do Cloudflare Turnstile (anti-robô). Sem ele, o voto vale sem o desafio. */
  TURNSTILE_SECRET?: string;
  /** Token do GitHub (só Actions: escrita neste repositório) para disparar os jobs na hora certa. */
  GH_DISPARO_TOKEN?: string;
  /** dono/repositório dos workflows. */
  GH_REPOSITORIO?: string;
  /** Banco (Neon): a borda aplica na hora a Transferência e o perfil pedidos pelo site. */
  DATABASE_URL?: string;
}

export interface ItemDaAgenda {
  tipo: 'PARTIDA' | 'RESUMO' | 'CRAQUE' | 'APRESENTACAO';
  ref: number;
  containerId: string;
  publicarEm: string;
  publicadoEm?: string;
  mediaId?: string;
  erro?: string;
  tentativas?: number;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const json = (dados: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra } });

// ------------------------------------------------------------------ publicação

type Fetch = typeof fetch;

async function graph<T>(f: Fetch, env: Env, token: string, metodo: 'GET' | 'POST', caminho: string, params: Record<string, string>): Promise<T> {
  // Token do login unificado (EAA…) fala com graph.facebook.com; o do login do Instagram, com graph.instagram.com.
  const base = token.startsWith('EAA') ? 'https://graph.facebook.com' : 'https://graph.instagram.com';
  const url = new URL(`${base}/${env.IG_API_VERSAO ?? 'v25.0'}/${caminho}`);
  const corpo = new URLSearchParams({ ...params, access_token: token });
  const r =
    metodo === 'GET'
      ? await f(`${url}?${corpo}`)
      : await f(url.toString(), { method: 'POST', body: corpo, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const j = (await r.json()) as T & { error?: { message?: string; code?: number } };
  if (!r.ok || j.error) throw new Error(`Instagram ${r.status}: ${j.error?.message ?? r.statusText}`);
  return j;
}

/**
 * Horário do próximo item pendente. O cron lê só esta chave a cada minuto e lista a agenda
 * quando ela vence: o plano grátis do KV tem 1.000 listagens por dia (o cron roda 1.440 vezes).
 */
export const CHAVE_PROXIMA = 'agenda-proxima';

/** Publica tudo que venceu. Devolve as chaves publicadas (para log e testes). */
export async function publicarVencidos(env: Env, agora: Date, f: Fetch = fetch): Promise<string[]> {
  const proxima = await env.AGENDA.get<{ em: string }>(CHAVE_PROXIMA, 'json');
  if (!proxima || Date.parse(proxima.em) > agora.getTime()) return [];
  const feitas = await publicarDaLista(env, agora, f);
  // Recalcula a próxima: o item pendente mais cedo (os que falharam voltam em 1 min).
  const pendentes: string[] = [];
  for (const k of (await env.AGENDA.list({ prefix: 'agenda/' })).keys) {
    const item = await env.AGENDA.get<ItemDaAgenda>(k.name, 'json');
    if (item && !item.publicadoEm && (item.tentativas ?? 0) < 10) pendentes.push(item.publicarEm);
  }
  pendentes.sort();
  if (pendentes.length) {
    const em = new Date(Math.max(Date.parse(pendentes[0]!), agora.getTime() + 60_000)).toISOString();
    await env.AGENDA.put(CHAVE_PROXIMA, JSON.stringify({ em }));
  } else {
    await env.AGENDA.delete(CHAVE_PROXIMA);
  }
  return feitas;
}

async function publicarDaLista(env: Env, agora: Date, f: Fetch): Promise<string[]> {
  const limite = `agenda/${agora.toISOString()}`;
  const lista = await env.AGENDA.list({ prefix: 'agenda/' });
  // Chave = agenda/<ISO>/<tipo-ref>: comparar texto já compara horário.
  const vencidas = lista.keys.map((k) => k.name).filter((n) => n <= limite);
  if (!vencidas.length) return [];
  const token = (await env.AGENDA.get<{ token: string }>('ig/token', 'json'))?.token;
  if (!token) throw new Error('Sem token do Instagram no KV (ig/token). Rode o job coletar.');

  const feitas: string[] = [];
  for (const chave of vencidas) {
    const item = await env.AGENDA.get<ItemDaAgenda>(chave, 'json');
    if (!item || item.publicadoEm) continue;
    if ((item.tentativas ?? 0) >= 10) continue; // desiste; o erro fica no item
    try {
      // Se uma execução anterior publicou e caiu antes de marcar, não publica de novo.
      const st = await graph<{ status_code: string }>(f, env, token, 'GET', item.containerId, { fields: 'status_code' });
      let mediaId = item.containerId;
      if (st.status_code === 'FINISHED') {
        mediaId = (await graph<{ id: string }>(f, env, token, 'POST', `${env.IG_USER_ID}/media_publish`, { creation_id: item.containerId })).id;
      } else if (st.status_code !== 'PUBLISHED') {
        throw new Error(`container ${st.status_code}`);
      }
      await env.AGENDA.put(chave, JSON.stringify({ ...item, publicadoEm: agora.toISOString(), mediaId }));
      feitas.push(chave);
    } catch (e) {
      await env.AGENDA.put(chave, JSON.stringify({ ...item, erro: String((e as Error).message), tentativas: (item.tentativas ?? 0) + 1 }));
    }
  }
  return feitas;
}

// ------------------------------------------------------------------ leitura

/** Igual a duracaoAoVivoMs do @liga/shared: 5 min, 7 no Mata-mata (pênaltis). */
const duracaoAoVivoMs = (fase?: string) => (fase === 'MATA_MATA' ? 7 : 5) * 60_000;

export async function responder(req: Request, env: Env, agora = new Date(), f: Fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const { pathname } = new URL(req.url);
  if (pathname === '/votos' && req.method === 'POST') return votar(req, env, agora, f);
  const vinculo = await rotasDoVinculo(
    req,
    env,
    agora,
    async (metodo, caminho, params) => {
      const token = (await env.AGENDA.get<{ token: string }>('ig/token', 'json'))?.token;
      if (!token) throw new Error('Sem token do Instagram no KV (ig/token).');
      return graph(f, env, token, metodo, caminho, params);
    },
    (job) => dispararUm(env, job, f),
    async (p) => {
      if (!env.DATABASE_URL) return null;
      return comBanco(env.DATABASE_URL, (b) =>
        b.transacao(async (t) => {
          if (p.tipo === 'PERFIL') {
            const r = await aplicarPerfil(t, p.jogadorId, { ...(p.visual !== undefined ? { visual: p.visual } : {}), ...(p.numero !== undefined ? { numero: p.numero } : {}) });
            return { resultado: r.ok ? 'SALVO' : 'RECUSADO', mensagem: r.mensagem };
          }
          const r = await transferirJogador(t, p.jogadorId, { times: p.time ? [p.time as TimeId] : [], ...(p.posicao ? { posicao: p.posicao as Posicao } : {}) }, { quando: agora, ref: `site:${p.jogadorId}:${agora.toISOString()}` });
          const m = r.mensagem ?? 'Pedido não entendido.';
          return { resultado: r.resultado, mensagem: m.charAt(0).toUpperCase() + m.slice(1) };
        }),
      );
    },
  ).catch((e: Error) => json({ erro: `Não deu agora: ${e.message.slice(0, 200)}` }, 502));
  if (vinculo) return vinculo;
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ erro: 'método não permitido' }, 405);

  const m = pathname.match(/^\/partidas\/(\d+)(?:\/lances)?$/);
  if (m) {
    const obj = await env.PRIVADO.get(`partidas/${m[1]}.json`);
    if (!obj) return json({ erro: 'Partida não encontrada' }, 404, { 'cache-control': 'public, max-age=30' });
    const p = (await obj.json()) as { apito: string; fase?: string; situacao?: string };
    const apito = Date.parse(p.apito);
    if (agora.getTime() < apito) {
      const segundos = Math.ceil((apito - agora.getTime()) / 1000);
      return json({ erro: 'Ainda não começou', apito: p.apito }, 425, { 'retry-after': String(segundos), 'cache-control': 'no-store' });
    }
    const encerrada = agora.getTime() >= apito + duracaoAoVivoMs(p.fase);
    p.situacao = encerrada ? 'ENCERRADA' : 'AO_VIVO';
    return json(p, 200, { 'cache-control': encerrada ? 'public, max-age=86400' : 'public, max-age=30' });
  }

  if (pathname.startsWith('/dados/')) {
    const chave = decodeURIComponent(pathname.slice(1));
    if (chave.includes('..')) return json({ erro: 'caminho inválido' }, 400);
    const obj = await env.PUBLICO.get(chave);
    if (!obj) return json({ erro: 'não encontrado' }, 404, { 'cache-control': 'public, max-age=30' });
    return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...CORS } });
  }

  if (pathname === '/') return json({ ok: true, servico: 'Varzeão da Mata' });
  return json({ erro: 'não encontrado' }, 404);
}

// ------------------------------------------------------------------ voto pelo site

export const CHAVE_VOTACAO = 'votacao-aberta';
/** Quantos aparelhos podem votar da mesma rede (uma casa, um bar) na mesma votação. */
export const VOTOS_POR_IP = 4;

async function resumo(texto: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function votar(req: Request, env: Env, agora: Date, f: Fetch): Promise<Response> {
  let corpo: { rodada?: unknown; numero?: unknown; aparelho?: unknown; turnstile?: unknown; sessao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json({ erro: 'Corpo inválido' }, 400);
  }
  const rodada = Number(corpo.rodada);
  const numero = Number(corpo.numero);
  const aparelho = String(corpo.aparelho ?? '');
  if (!/^[a-z0-9-]{16,64}$/.test(aparelho)) return json({ erro: 'Aparelho inválido' }, 400);

  const aberta = await env.AGENDA.get<{ rodada: number; candidatos: number }>(CHAVE_VOTACAO, 'json');
  if (!aberta || aberta.rodada !== rodada) return json({ erro: 'Essa votação já fechou' }, 409);
  if (!Number.isInteger(numero) || numero < 1 || numero > aberta.candidatos) return json({ erro: 'Candidato inválido' }, 400);

  const ip = req.headers.get('cf-connecting-ip') ?? 'sem-ip';
  if (env.TURNSTILE_SECRET) {
    const r = await f('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(corpo.turnstile ?? ''), remoteip: ip }),
    });
    const v = (await r.json()) as { success?: boolean };
    if (!v.success) return json({ erro: 'Não deu para confirmar que você não é um robô. Tente de novo.' }, 403);
  }

  // Personagem vinculado (ADR-0013): o voto é do @, um por pessoa, e vale o último (como
  // no comentário). A coleta junta com os votos comentados desse @.
  if (typeof corpo.sessao === 'string' && corpo.sessao) {
    const s = await sessaoDe(env, corpo.sessao);
    if (s) {
      await env.AGENDA.put(`voto-vinculado/${rodada}/${s.jogadorId}`, '', { metadata: { numero, em: agora.toISOString() }, expirationTtl: 14 * 86400 });
      return json({ ok: true, numero, comoArroba: s.username });
    }
  }

  // Um voto por aparelho: o primeiro vale.
  const chave = `voto-site/${rodada}/${aparelho}`;
  const ja = await env.AGENDA.getWithMetadata<{ numero: number }>(chave);
  if (ja.metadata) return json({ ok: true, numero: ja.metadata.numero, jaVotou: true });

  const chaveIp = `voto-ip/${rodada}/${await resumo(ip)}`;
  const daRede = Number((await env.AGENDA.get(chaveIp)) ?? 0);
  if (daRede >= VOTOS_POR_IP) return json({ erro: 'Muitos votos saindo dessa rede. Vote pelo Instagram, comentando o número.' }, 429);

  const fimTtl = 14 * 86400;
  await env.AGENDA.put(chave, '', { metadata: { numero, em: agora.toISOString() }, expirationTtl: fimTtl });
  await env.AGENDA.put(chaveIp, String(daRede + 1), { expirationTtl: fimTtl });
  return json({ ok: true, numero });
}

// ------------------------------------------------------------------ relógio dos jobs

/**
 * O agendamento do GitHub atrasa e às vezes pula (e o da Liga precisa de hora certa). A borda,
 * que já roda a cada minuto, dispara os workflows por workflow_dispatch nos horários abaixo
 * (Brasília, UTC−3, sem horário de verão). O cron do GitHub fica de reserva; os jobs são
 * idempotentes e cada workflow tem seu grupo de concorrência.
 */
export function jobsDoMinuto(agora: Date): string[] {
  const local = new Date(agora.getTime() - 3 * 3600_000);
  const h = local.getUTCHours();
  const m = local.getUTCMinutes();
  const jobs: string[] = [];
  // Coleta a cada 10 minutos (:07, :17, :27…): quem comenta aparece logo.
  if (m % 10 === 7) jobs.push('coletar');
  // Logo depois do fim do Ao Vivo (5 min depois do apito): placar, tabela e Card no site.
  else if (m === 5 && [12, 14, 16, 18].includes(h)) jobs.push('coletar');
  if (m === 25 && [11, 13, 15, 17].includes(h)) jobs.push('partida');
  if (m === 10 && h === 18) jobs.push('resumo');
  return jobs;
}

export async function dispararJobs(env: Env, agora: Date, f: Fetch = fetch): Promise<string[]> {
  const disparados: string[] = [];
  for (const job of jobsDoMinuto(agora)) if (await dispararUm(env, job, f)) disparados.push(job);
  return disparados;
}

/** Dispara um workflow (origem=borda: só roda se LIGA_ATIVA=sim). */
export async function dispararUm(env: Env, job: string, f: Fetch = fetch): Promise<boolean> {
  if (!env.GH_DISPARO_TOKEN || !env.GH_REPOSITORIO) return false;
  {
    const r = await f(`https://api.github.com/repos/${env.GH_REPOSITORIO}/actions/workflows/${job}.yml/dispatches`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GH_DISPARO_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'varzeao-edge',
        'content-type': 'application/json',
      },
      // origem=borda: o workflow só roda se LIGA_ATIVA=sim (o "play" manual roda sempre).
      body: JSON.stringify({ ref: 'master', inputs: { origem: 'borda' } }),
    });
    if (!r.ok) console.error(`não disparou ${job}: ${r.status} ${await r.text()}`);
    return r.ok;
  }
}

export default {
  fetch: (req: Request, env: Env) => responder(req, env),
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    const agora = new Date();
    ctx.waitUntil(
      publicarVencidos(env, agora).then((feitas) => {
        if (feitas.length) console.log(`publicados: ${feitas.join(', ')}`);
      }),
    );
    ctx.waitUntil(
      dispararJobs(env, agora).then((jobs) => {
        if (jobs.length) console.log(`disparados: ${jobs.join(', ')}`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
