/**
 * Vínculo do personagem pela DM (ADR-0013). Quem é dono de um Jogador prova isso mandando
 * um código para a DM da Liga; o navegador dele recebe uma sessão e passa a poder fazer
 * pelo site o que antes só dava por comentário (por enquanto, a Transferência).
 *
 *   POST /vinculo                {jogadorId}              → {codigo, sessao, expiraEm}
 *   POST /vinculo/verificar      {codigo, sessao}         → {vinculado: true, jogadorId} | {vinculado: false}
 *   POST /vinculo/eu             {sessao}                 → {jogadorId, username} | 404
 *   POST /vinculo/sair           {sessao}                 → {ok}
 *   POST /vinculo/link/ver       {token}                  → {jogadorId, username} | 410 (só olha; não gasta o link)
 *   POST /vinculo/link           {token, sessaoAntiga?}   → {vinculado, sessao, jogadorId, username} | 410 (ADR-0082)
 *   POST /transferencia          {sessao, time?, posicao?} → {ok}
 *   POST /transferencia/estado   {sessao}                 → o pedido com o resultado da coleta
 *   POST /perfil                 {sessao, visual?, numero?, apelido?} → {ok} (visual, camisa, apelido)
 *   POST /perfil/estado          {sessao}                 → o pedido com o resultado da coleta
 *   (o voto do Craque vinculado vai pelo /votos, com a sessão)
 *
 * A sessão é um segredo aleatório que só o navegador guarda; no KV fica só o hash dela.
 * Só a própria conta consegue mandar DM com o próprio @, então o código prova o dono.
 */
import { TIMES } from '@liga/shared';
import { marcarPendencia } from './pendencias.js';

export interface EnvVinculo {
  AGENDA: KVNamespace;
  PUBLICO: R2Bucket;
  IG_USER_ID: string;
  /** Com o banco, a borda aplica o pedido na hora; sem ele, a coleta aplica (1 a 2 min). */
  DATABASE_URL?: string;
}

/** Aplica no banco agora (Transferência ou perfil); null quando a borda não tem o banco. */
export type AplicarAgora = (
  pedido:
    | { tipo: 'TRANSFERENCIA'; jogadorId: string; time?: string; posicao?: string }
    | { tipo: 'PERFIL'; jogadorId: string; visual?: unknown; numero?: number; apelido?: string }
    | { tipo: 'ESCOLHA'; jogadorId: string; escolha: EscolhaDaT2 },
) => Promise<{ resultado: string; mensagem: string } | null>;

/** Temporada 2 (ADRs 0020 e 0023): o que se escolhe pelo site. A regra fica no worker. */
export type EscolhaDaT2 =
  | { tipo: 'ESPECIALIZACAO'; valor: string | null }
  | { tipo: 'TREINO'; valor: string | null }
  | { tipo: 'CANTO'; valor: string | null }
  | { tipo: 'PRESENCA' }
  | { tipo: 'POSTURA'; valor: string }
  | { tipo: 'FORMACAO'; valor: string }
  /** T3 (ADR-0091): ids dos Batedores, em ordem (até 5). */
  | { tipo: 'BATEDORES'; valor: string[] }
  /** T3 (ADR-0089): Palpite, "partida:mandante-visitante". */
  | { tipo: 'PALPITE'; valor: string }
  /** Loja (ADR-0101): código do Item (comprar ou equipar) ou o Encaixe (tirar). */
  | { tipo: 'COMPRA' | 'EQUIPAR' | 'TIRAR'; valor: string }
  /** Técnico e Interesse (ADR-0111) e Capitão em campo (ADR-0112). */
  | { tipo: 'FIXADOS' | 'ESCANTEIO'; valor: string[] }
  | { tipo: 'PEDIDO' | 'CONVIDAR' | 'CONVITE' | 'TROCA_PROPOR' | 'TROCA' | 'SER_TECNICO' | 'MARCACAO' | 'GRITO'; valor: string }
  | { tipo: 'SAIR_DO_CARGO' | 'CHAMADA' };
const TIPOS_DE_ESCOLHA = [
  'ESPECIALIZACAO', 'TREINO', 'CANTO', 'PRESENCA', 'POSTURA', 'FORMACAO', 'BATEDORES', 'PALPITE', 'COMPRA', 'EQUIPAR', 'TIRAR',
  'FIXADOS', 'ESCANTEIO', 'PEDIDO', 'CONVIDAR', 'CONVITE', 'TROCA_PROPOR', 'TROCA', 'SER_TECNICO', 'MARCACAO', 'GRITO', 'SAIR_DO_CARGO', 'CHAMADA',
] as const;
/** Escolhas que são listas de ids (até quantos) e escolhas sem valor. */
const LISTAS: Partial<Record<(typeof TIPOS_DE_ESCOLHA)[number], number>> = { BATEDORES: 5, FIXADOS: 3, ESCANTEIO: 2 };
const SEM_VALOR = new Set(['PRESENCA', 'SAIR_DO_CARGO', 'CHAMADA']);
/** O formato de cada escolha nova (a regra de verdade fica no worker). */
const FORMATO: Partial<Record<(typeof TIPOS_DE_ESCOLHA)[number], RegExp>> = {
  PEDIDO: /^(ACEITAR|RECUSAR):\d{1,12}$/,
  CONVITE: /^(ACEITAR|RECUSAR):\d{1,12}$/,
  TROCA: /^(ACEITAR|RECUSAR):\d{1,12}$/,
  CONVIDAR: /^\d{1,12}$/,
  TROCA_PROPOR: /^\d{1,12}:\d{1,12}$/,
  MARCACAO: /^(\d{1,12}:\d{1,12})?$/,
  GRITO: /^[0-2]$/,
};
/** A Carteira de Moedas (ADR-0087): saldo e extrato só para o dono, pelo Vínculo. */
export type ConsultarCarteira = (jogadorId: string) => Promise<unknown | null>;

type Graph = <T>(metodo: 'GET' | 'POST', caminho: string, params: Record<string, string>) => Promise<T>;
type Disparar = (job: string) => Promise<boolean>;

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

/**
 * Link de Vínculo (ADR-0082), gravado pelo workflow "link-de-vinculo" em
 * `vinculo/link/<hash do token>`. O token só existe na DM do dono.
 */
export interface LinkDeVinculo {
  jogadorId: string;
  username: string;
  criadoEm: string;
  expiraEm: string;
}
export const chaveDoLink = (hashDoToken: string) => `vinculo/link/${hashDoToken}`;

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

/**
 * Grava a sessão com o `jogadorId` também nos metadados da chave (ADR-0094): assim a lista de
 * quem tem Vínculo sai de uma listagem só, sem ler sessão por sessão.
 */
async function gravarSessao(agenda: KVNamespace, hashDaSessao: string, s: SessaoVinculada) {
  await agenda.put(`vinculo/sessao/${hashDaSessao}`, JSON.stringify(s), { metadata: { jogadorId: s.jogadorId } });
}

/**
 * Os Jogadores com Vínculo (ADR-0094). O `jogadorId` vem dos metadados da listagem; só as
 * sessões antigas, gravadas antes dos metadados, são lidas uma a uma, todas ao mesmo tempo.
 */
export async function jogadoresVinculados(agenda: KVNamespace): Promise<Set<string>> {
  const ids = new Set<string>();
  const semMetadados: string[] = [];
  let cursor: string | undefined;
  do {
    const lista = await agenda.list<{ jogadorId?: string }>({ prefix: 'vinculo/sessao/', ...(cursor ? { cursor } : {}) });
    for (const k of lista.keys) {
      if (k.metadata?.jogadorId) ids.add(k.metadata.jogadorId);
      else semMetadados.push(k.name);
    }
    cursor = lista.list_complete ? undefined : lista.cursor;
  } while (cursor);
  const antigas = await Promise.all(semMetadados.map((k) => agenda.get<{ jogadorId?: string }>(k, 'json').catch(() => null)));
  for (const s of antigas) if (s?.jogadorId) ids.add(s.jogadorId);
  return ids;
}

/** Marca de que as sessões antigas já ganharam os metadados (uma vez só, pelo cron). */
export const CHAVE_METADADOS_OK = 'vinculo/metadados-v1';

/**
 * Uma vez só (ADR-0094): regrava as sessões antigas com o `jogadorId` nos metadados, para a
 * lista de Vínculos não precisar mais ler nenhuma. Devolve quantas regravou.
 */
export async function completarMetadadosDasSessoes(agenda: KVNamespace): Promise<number> {
  if (await agenda.get(CHAVE_METADADOS_OK)) return 0;
  let feitas = 0;
  let cursor: string | undefined;
  do {
    const lista = await agenda.list<{ jogadorId?: string }>({ prefix: 'vinculo/sessao/', ...(cursor ? { cursor } : {}) });
    for (const k of lista.keys) {
      if (k.metadata?.jogadorId) continue;
      const s = await agenda.get<SessaoVinculada>(k.name, 'json');
      if (!s?.jogadorId) continue;
      await gravarSessao(agenda, k.name.slice('vinculo/sessao/'.length), s);
      feitas++;
    }
    cursor = lista.list_complete ? undefined : lista.cursor;
  } while (cursor);
  await agenda.put(CHAVE_METADADOS_OK, new Date().toISOString());
  return feitas;
}

export async function sessaoDe(env: EnvVinculo, sessao: string): Promise<SessaoVinculada | null> {
  return env.AGENDA.get<SessaoVinculada>(`vinculo/sessao/${await hash(sessao)}`, 'json');
}

/** Capitão do próximo jogo do Time do Jogador (T2); null fora da T2, sem jogo ou sem banco. */
export interface CapitaniaPublica {
  eu: boolean;
  capitao: string | null;
  postura: string;
  formacao?: string;
  presenca?: boolean;
  jogo?: { apito: string; adversario: string };
  batedores?: string[];
  elenco?: { id: string; nome: string; posicao: string }[];
}
/** A capitania sozinha, ou (T3, ADR-0111) junto do Painel do Time e do Mercado do Jogador. */
export type ConsultarCapitania = (jogadorId: string) => Promise<CapitaniaPublica | { capitania: CapitaniaPublica | null; painel: unknown; mercado: unknown } | null>;

export async function rotasDoVinculo(
  req: Request,
  env: EnvVinculo,
  agora: Date,
  graph: Graph,
  disparar: Disparar,
  aplicar: AplicarAgora = async () => null,
  capitania: ConsultarCapitania = async () => null,
  carteira: ConsultarCarteira = async () => null,
): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (req.method !== 'POST') return null;

  if (pathname === '/carteira') {
    const c = await corpo<{ sessao: string }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    const s = await sessaoDe(env, c.sessao);
    if (!s) return json({ erro: 'Não vinculado' }, 401);
    const dados = await carteira(s.jogadorId);
    return dados ? json(dados) : json({ erro: 'Sem Carteira ainda' }, 404);
  }

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
    await gravarSessao(env.AGENDA, h, sessao);
    await marcarPendencia(env.AGENDA, 'vinculos', agora);
    await env.AGENDA.delete(`vinculo/codigo/${codigo}`);
    // Confirmação na DM (se a API não deixar, o site já mostra que deu certo).
    await graph('POST', `${env.IG_USER_ID}/messages`, {
      recipient: JSON.stringify({ id: remetente }),
      message: JSON.stringify({ text: `Pronto, @${pendente.username}! Seu personagem está vinculado neste navegador. Agora dá para cuidar dele pelo site. ⚽` }),
    }).catch(() => {});
    return json({ vinculado: true, jogadorId: sessao.jogadorId, username: sessao.username });
  }

  // Link de Vínculo (ADR-0082): o dono manda pela DM um link de uso único; abrir vincula o
  // navegador ao Jogador. Se o navegador era de outro Jogador, a sessão antiga é apagada.
  // O navegador do Instagram pré-carrega links da DM e roda a página sozinho: só olhar não gasta
  // o link; ele só é gasto quando a pessoa toca em Vincular.
  if (pathname === '/vinculo/link' || pathname === '/vinculo/link/ver') {
    const c = await corpo<{ token: string; sessaoAntiga?: string }>(req);
    if (!sessaoValida(c?.token)) return json({ erro: 'Link inválido' }, 400);
    const chave = chaveDoLink(await hash(c.token));
    const link = await env.AGENDA.get<LinkDeVinculo>(chave, 'json');
    if (!link || Date.parse(link.expiraEm) <= agora.getTime()) {
      if (link) await env.AGENDA.delete(chave);
      return json({ erro: 'Este link já foi usado ou venceu.' }, 410);
    }
    if (pathname === '/vinculo/link/ver') return json({ jogadorId: link.jogadorId, username: link.username });
    await env.AGENDA.delete(chave);
    if (sessaoValida(c.sessaoAntiga)) await env.AGENDA.delete(`vinculo/sessao/${await hash(c.sessaoAntiga)}`);
    const sessao = aleatorio(32);
    const vinculada: SessaoVinculada = { jogadorId: link.jogadorId, username: link.username, vinculadoEm: agora.toISOString() };
    await gravarSessao(env.AGENDA, await hash(sessao), vinculada);
    await marcarPendencia(env.AGENDA, 'vinculos', agora);
    return json({ vinculado: true, sessao, jogadorId: link.jogadorId, username: link.username });
  }

  if (pathname === '/vinculo/eu' || pathname === '/vinculo/sair') {
    const c = await corpo<{ sessao: string }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    if (pathname === '/vinculo/sair') {
      await env.AGENDA.delete(`vinculo/sessao/${await hash(c.sessao)}`);
      await marcarPendencia(env.AGENDA, 'vinculos', agora);
      return json({ ok: true });
    }
    const s = await sessaoDe(env, c.sessao);
    return s ? json({ jogadorId: s.jogadorId, username: s.username }) : json({ erro: 'Não vinculado' }, 404);
  }

  if (pathname === '/perfil' || pathname === '/perfil/estado') {
    const c = await corpo<{ sessao: string; visual: { pele: string; cabelo: string; penteado: string }; numero: number; apelido: string }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    const s = await sessaoDe(env, c.sessao);
    if (!s) return json({ erro: 'Não vinculado' }, 401);
    const chave = `perfil-site/${s.jogadorId}`;
    if (pathname === '/perfil/estado') return json((await env.AGENDA.get(chave, 'json')) ?? {});
    const v = c.visual;
    const visual = v && typeof v === 'object' ? { pele: String(v.pele).slice(0, 9), cabelo: String(v.cabelo).slice(0, 9), penteado: String(v.penteado).slice(0, 12) } : undefined;
    const numero = c.numero !== undefined && c.numero !== null ? Number(c.numero) : undefined;
    if (numero !== undefined && (!Number.isInteger(numero) || numero < 1 || numero > 99)) return json({ erro: 'O número da camisa vai de 1 a 99.' }, 400);
    const apelido = typeof c.apelido === 'string' ? c.apelido.slice(0, 40) : undefined;
    if (!visual && numero === undefined && apelido === undefined) return json({ erro: 'Nada para salvar' }, 400);
    // A coleta valida as cores e o número (sem repetir no Time) e devolve a mensagem.
    const pedido = { jogadorId: s.jogadorId, ...(visual ? { visual } : {}), ...(numero !== undefined ? { numero } : {}), ...(apelido !== undefined ? { apelido } : {}), pedidoEm: agora.toISOString() };
    // Na hora, se a borda tem o banco; a coleta só republica o site.
    const feito = await aplicar({ tipo: 'PERFIL', ...pedido }).catch(() => null);
    const registro = feito ? { ...pedido, resultado: feito.resultado, mensagem: feito.mensagem, processadoEm: agora.toISOString() } : pedido;
    await env.AGENDA.put(chave, JSON.stringify(registro), { expirationTtl: 7 * 86400 });
    if (!feito) await marcarPendencia(env.AGENDA, 'perfis', agora);
    const disparou = await disparar('coletar').catch(() => false);
    return json({ ok: true, pedido: registro, disparou });
  }

  // Temporada 2: Postura e Formação (Capitão), Presença, Especialização, Treino e Canto. Um pedido por tipo.
  if (pathname === '/escolha' || pathname === '/escolha/estado') {
    const c = await corpo<{ sessao: string; tipo: string; valor: string | string[] | null }>(req);
    if (!sessaoValida(c?.sessao)) return json({ erro: 'Sessão inválida' }, 400);
    const s = await sessaoDe(env, c.sessao);
    if (!s) return json({ erro: 'Não vinculado' }, 401);
    if (pathname === '/escolha/estado') {
      // Tudo ao mesmo tempo (ADR-0094): as escolhas guardadas e a capitania, que vai ao banco.
      const [escolhas, cap] = await Promise.all([
        Promise.all(TIPOS_DE_ESCOLHA.map((t) => env.AGENDA.get(`escolha-site/${s.jogadorId}/${t}`, 'json'))),
        // A Postura só aparece para o Capitão (os outros veem quem ele é).
        capitania(s.jogadorId).catch(() => null),
      ]);
      const estado: Record<string, unknown> = {};
      TIPOS_DE_ESCOLHA.forEach((t, i) => (estado[t] = escolhas[i] ?? null));
      // T3 (ADR-0111): a consulta traz também o Painel do Time e o Mercado do Jogador.
      const junto = cap as { capitania?: unknown; painel?: unknown; mercado?: unknown } | null;
      if (junto && typeof junto === 'object' && 'painel' in junto) {
        estado.capitania = junto.capitania ?? null;
        estado.painel = junto.painel ?? null;
        estado.mercado = junto.mercado ?? null;
      } else estado.capitania = cap;
      return json(estado);
    }
    const tipo = String(c.tipo ?? '') as (typeof TIPOS_DE_ESCOLHA)[number];
    if (!TIPOS_DE_ESCOLHA.includes(tipo)) return json({ erro: 'Escolha desconhecida' }, 400);
    // Listas de ids (Batedores, titulares fixados, cobradores de escanteio): só dígitos e até o máximo.
    const maximo = LISTAS[tipo];
    const batedores = maximo ? (Array.isArray(c.valor) ? c.valor : []).map(String).filter((x) => /^\d{1,12}$/.test(x)) : null;
    if (batedores && (batedores.length > maximo! || (Array.isArray(c.valor) && batedores.length !== c.valor.length))) return json({ erro: 'Lista inválida' }, 400);
    const valor = c.valor === null || c.valor === undefined || c.valor === '' || Array.isArray(c.valor) ? null : String(c.valor).slice(0, 30);
    if (tipo === 'POSTURA' && !valor) return json({ erro: 'Escolha a Postura' }, 400);
    if (tipo === 'FORMACAO' && !valor) return json({ erro: 'Escolha a Formação' }, 400);
    if (tipo === 'PALPITE' && !/^\d{1,9}:\d{1,2}-\d{1,2}$/.test(valor ?? '')) return json({ erro: 'Palpite inválido' }, 400);
    if ((tipo === 'COMPRA' || tipo === 'EQUIPAR' || tipo === 'TIRAR') && !/^[A-Z_]{3,30}$/.test(valor ?? '')) return json({ erro: 'Item inválido' }, 400);
    if (FORMATO[tipo] && !FORMATO[tipo]!.test(valor ?? '')) return json({ erro: 'Escolha inválida' }, 400);
    if (tipo === 'SER_TECNICO' && !(TIMES as readonly string[]).includes(valor ?? '')) return json({ erro: 'Time inválido' }, 400);
    const escolha = (SEM_VALOR.has(tipo) ? { tipo } : batedores ? { tipo, valor: batedores } : { tipo, valor: tipo === 'MARCACAO' ? (valor ?? '') : valor }) as EscolhaDaT2;
    const base = { jogadorId: s.jogadorId, escolha, pedidoEm: agora.toISOString() };
    const feito = await aplicar({ tipo: 'ESCOLHA', jogadorId: s.jogadorId, escolha }).catch(() => null);
    const registro = feito ? { ...base, resultado: feito.resultado, mensagem: feito.mensagem, processadoEm: agora.toISOString() } : base;
    await env.AGENDA.put(`escolha-site/${s.jogadorId}/${tipo}`, JSON.stringify(registro), { expirationTtl: 7 * 86400 });
    if (!feito) await marcarPendencia(env.AGENDA, 'escolhas', agora);
    const disparou = feito ? false : await disparar('coletar').catch(() => false);
    return json({ ok: true, pedido: registro, disparou });
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
    const base: PedidoDoSite = { tipo: 'TRANSFERENCIA', jogadorId: s.jogadorId, ...(time ? { time } : {}), ...(posicao ? { posicao } : {}), pedidoEm: agora.toISOString() };
    const feito = await aplicar(base).catch(() => null);
    const pedido: PedidoDoSite = feito ? { ...base, resultado: feito.resultado, mensagem: feito.mensagem, processadoEm: agora.toISOString() } : base;
    await env.AGENDA.put(chave, JSON.stringify(pedido), { expirationTtl: 7 * 86400 });
    if (!feito) await marcarPendencia(env.AGENDA, 'pedidos', agora);
    // A coleta aplica o pedido; dispara agora para a resposta vir em 1 a 2 minutos.
    const disparou = await disparar('coletar').catch(() => false);
    return json({ ok: true, pedido, disparou });
  }
  return null;
}
