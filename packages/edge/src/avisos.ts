/**
 * Avisos do App (ADR-0042): notificações no celular de quem ativou os Avisos de um Time.
 *
 * - POST /avisos — o App manda o endereço de notificação do aparelho e os Times escolhidos.
 * - DELETE /avisos — desativa.
 * - Cron: perto dos jogos, decide o que avisar no minuto e manda. Escalação (a partir do Corte),
 *   5 min antes do Apito Inicial, cada gol (no minuto seguinte ao que ele aparece no Ao Vivo, nunca antes) e
 *   o fim do Ao Vivo com o placar.
 *
 * Cifra no padrão aes128gcm (RFC 8291) com a biblioteca web-push-neo, que roda na borda (WebCrypto).
 * O plano grátis do Workers permite 50 pedidos externos por execução; a borda manda no máximo
 * ENVIOS_POR_MINUTO e deixa o resto numa fila no KV para o minuto seguinte.
 */
import { generateRequestDetails } from 'web-push-neo';
import {
  FALA_DO_TIME,
  TIMES,
  timesValidos,
  type AvisoNoCelular,
  type MomentosDoAoVivo,
  type PartidaNoCalendario,
  type Placar,
  type TimeId,
} from '@liga/shared';
import type { Banco } from '../../worker/src/banco.js';

/** Minutos antes do Apito em que a Escalação pode sair (o Corte é 30 min antes). */
const ESCALACAO_DESDE_MIN = 30;
/** O aviso do jogo sai antes do Apito, para a pessoa pegar o Ao Vivo desde o começo. */
export const AVISO_ANTES_DO_APITO_MIN = 5;
/** O Ao Vivo do Mata-mata dura 7 min; folga de 2. */
const DEPOIS_DO_APITO_MIN = 9;
export const ENVIOS_POR_MINUTO = 40;

export const CHAVE_FILA = 'aviso/fila';
const chaveEscalacaoAvisada = (id: number) => `aviso/escalacao/${id}`;

export interface AvisoParaTimes extends AvisoNoCelular {
  times: TimeId[];
}

const doTime = (t: TimeId) => `d${FALA_DO_TIME[t].artigo} ${FALA_DO_TIME[t].curto}`;
const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
const confronto = (p: PartidaNoCalendario, placar?: Placar) =>
  placar ? `${curto(p.mandante)} ${placar.mandante} × ${placar.visitante} ${curto(p.visitante)}` : `${curto(p.mandante)} × ${curto(p.visitante)}`;
const horaLocal = (iso: string) => `${new Date(Date.parse(iso) - 3 * 3600_000).getUTCHours()}h`;
const rotaDa = (p: PartidaNoCalendario) => `#/partida/${p.id}`;

/** O minuto que acabou de fechar: (inicio, fim]. Assim nada é avisado antes de acontecer. */
export function janelaDoMinuto(agora: Date): { inicio: number; fim: number } {
  const fim = Math.floor(agora.getTime() / 60_000) * 60_000;
  return { inicio: fim - 60_000, fim };
}

/** Partidas perto o bastante do relógio para render algum Aviso agora. */
export function partidasPerto(calendario: readonly PartidaNoCalendario[], agora: Date): PartidaNoCalendario[] {
  const t = agora.getTime();
  return calendario.filter((p) => {
    const apito = Date.parse(p.apito);
    return t >= apito - ESCALACAO_DESDE_MIN * 60_000 && t <= apito + DEPOIS_DO_APITO_MIN * 60_000;
  });
}

/**
 * O que avisar neste minuto. Regra pura: recebe o calendário, os momentos de cada Partida
 * já começada e quais Escalações já foram avisadas.
 */
export function avisosDoMinuto(
  calendario: readonly PartidaNoCalendario[],
  agora: Date,
  momentos: ReadonlyMap<number, MomentosDoAoVivo>,
  escalacaoAvisada: ReadonlySet<number>,
): AvisoParaTimes[] {
  const { inicio, fim } = janelaDoMinuto(agora);
  const dentro = (ms: number) => ms > inicio && ms <= fim;
  const avisos: AvisoParaTimes[] = [];
  for (const p of partidasPerto(calendario, agora)) {
    const apito = Date.parse(p.apito);
    const times: TimeId[] = [p.mandante, p.visitante];
    const base = { partidaId: p.id, times, url: rotaDa(p) };
    if (p.escalada && agora.getTime() < apito && !escalacaoAvisada.has(p.id)) {
      avisos.push({ ...base, tipo: 'ESCALACAO', titulo: 'Saiu a Escalação', corpo: `${confronto(p)}, às ${horaLocal(p.apito)}. Veja quem entra em campo.` });
    }
    if (dentro(apito - AVISO_ANTES_DO_APITO_MIN * 60_000)) {
      avisos.push({ ...base, tipo: 'APITO', titulo: `Daqui a ${AVISO_ANTES_DO_APITO_MIN} min: ${confronto(p)}`, corpo: 'Abra o App para ver o Ao Vivo desde o Apito Inicial.' });
    }
    const m = momentos.get(p.id);
    if (!m) continue;
    for (const g of m.gols) {
      if (!dentro(apito + g.emMs)) continue;
      avisos.push({ ...base, tipo: 'GOL', titulo: `GOL ${doTime(p[g.lado])}!`, corpo: confronto(p, g.placar) });
    }
    if (dentro(apito + m.fimMs)) {
      const pen = m.penaltis ? ` (pênaltis ${m.penaltis.mandante} × ${m.penaltis.visitante})` : '';
      avisos.push({ ...base, tipo: 'FIM', titulo: 'Fim de jogo', corpo: `${confronto(p, m.placar)}${pen}` });
    }
  }
  return avisos;
}

// ------------------------------------------------------------------ aparelhos

export interface AparelhoDoAviso {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Só aceita endereços https de serviço de notificação (nada de rede interna). */
export function endpointValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname);
  } catch {
    return false;
  }
}

export function lerAtivacao(corpo: unknown): { aparelho: AparelhoDoAviso; times: TimeId[] } | null {
  const c = corpo as { assinatura?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; times?: unknown } | null;
  const a = c?.assinatura;
  if (!a || !endpointValido(a.endpoint)) return null;
  const { p256dh, auth } = a.keys ?? {};
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  const times = timesValidos(c?.times, TIMES);
  if (!times) return null;
  return { aparelho: { endpoint: a.endpoint, p256dh, auth }, times };
}

export async function guardarAparelho(b: Banco, aparelho: AparelhoDoAviso, times: TimeId[]): Promise<void> {
  await b.query(
    `INSERT INTO aviso_aparelho (endpoint, p256dh, auth, times) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3, times = $4, atualizado_em = now()`,
    [aparelho.endpoint, aparelho.p256dh, aparelho.auth, times],
  );
}

export async function esquecerAparelho(b: Banco, endpoint: string): Promise<void> {
  await b.query('DELETE FROM aviso_aparelho WHERE endpoint = $1', [endpoint]);
}

export async function aparelhosDosTimes(b: Banco, times: TimeId[]): Promise<AparelhoDoAviso[]> {
  return (await b.query<AparelhoDoAviso>('SELECT endpoint, p256dh, auth FROM aviso_aparelho WHERE times && $1::text[] ORDER BY endpoint', [times])).rows;
}

// ------------------------------------------------------------------ envio

export interface EnvioPendente {
  aviso: AvisoNoCelular;
  aparelho: AparelhoDoAviso;
}

export interface ChavesVapid {
  publica: string;
  privada: string;
  contato: string;
}

/**
 * Manda um Aviso para um aparelho. Devolve 'sumiu' quando o serviço diz que o endereço não
 * existe mais (o aparelho desativou ou desinstalou), para a borda esquecer o aparelho.
 */
export async function enviar(f: typeof fetch, vapid: ChavesVapid, e: EnvioPendente): Promise<'ok' | 'sumiu' | 'falhou'> {
  try {
    // aes128gcm (RFC 8291), o formato que Chrome, Firefox e Safari aceitam.
    const pedido = await generateRequestDetails(
      { endpoint: e.aparelho.endpoint, keys: { p256dh: e.aparelho.p256dh, auth: e.aparelho.auth } },
      JSON.stringify(e.aviso),
      {
        vapidDetails: { subject: vapid.contato, publicKey: vapid.publica, privateKey: vapid.privada },
        // Aviso de jogo vale por pouco tempo: depois de 10 min já não ajuda.
        TTL: 600,
        urgency: 'high',
        topic: `partida-${e.aviso.partidaId}`,
      },
    );
    const r = await f(pedido.endpoint, { method: pedido.method, headers: pedido.headers, body: pedido.body });
    if (r.status === 404 || r.status === 410) return 'sumiu';
    if (!r.ok) console.error(`aviso não foi: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.ok ? 'ok' : 'falhou';
  } catch (err) {
    console.error(`aviso não foi: ${(err as Error).message}`);
    return 'falhou';
  }
}

// ------------------------------------------------------------------ na borda

/** Horários dos jogos (Brasília): 12h, 14h, 16h e 18h. Fora da janela, o cron nem olha o R2. */
const HORAS_DE_JOGO = [12, 14, 16, 18];

export function pertoDeUmJogo(agora: Date): boolean {
  const local = new Date(agora.getTime() - 3 * 3600_000);
  const minutos = local.getUTCHours() * 60 + local.getUTCMinutes();
  return HORAS_DE_JOGO.some((h) => minutos >= h * 60 - ESCALACAO_DESDE_MIN - 1 && minutos <= h * 60 + DEPOIS_DO_APITO_MIN + 1);
}

export interface AmbienteDosAvisos {
  AGENDA: KVNamespace;
  PUBLICO: R2Bucket;
  PRIVADO: R2Bucket;
  DATABASE_URL?: string;
  VAPID_PUBLICA?: string;
  VAPID_PRIVADA?: string;
  VAPID_CONTATO?: string;
}

type ComBanco = <T>(fn: (b: Banco) => Promise<T>) => Promise<T>;

/** Os Avisos do minuto que vem do calendário (vazio fora dos horários de jogo). */
async function avisosNovos(env: AmbienteDosAvisos, agora: Date): Promise<AvisoParaTimes[]> {
  if (!pertoDeUmJogo(agora)) return [];
  const obj = await env.PUBLICO.get('dados/liga.json');
  if (!obj) return [];
  const calendario = ((await obj.json()) as { calendario?: PartidaNoCalendario[] }).calendario ?? [];
  const perto = partidasPerto(calendario, agora);
  if (!perto.length) return [];
  const momentos = new Map<number, MomentosDoAoVivo>();
  const escalacaoAvisada = new Set<number>();
  for (const p of perto) {
    if (Date.parse(p.apito) <= agora.getTime()) {
      const privada = await env.PRIVADO.get(`partidas/${p.id}.json`);
      const m = privada ? ((await privada.json()) as { momentos?: MomentosDoAoVivo }).momentos : undefined;
      if (m) momentos.set(p.id, m);
    } else if (p.escalada && (await env.AGENDA.get(chaveEscalacaoAvisada(p.id))) !== null) {
      escalacaoAvisada.add(p.id);
    }
  }
  const avisos = avisosDoMinuto(calendario, agora, momentos, escalacaoAvisada);
  for (const a of avisos) if (a.tipo === 'ESCALACAO') await env.AGENDA.put(chaveEscalacaoAvisada(a.partidaId), '1', { expirationTtl: 2 * 86400 });
  return avisos;
}

/** Cron: junta os Avisos novos à fila e manda até ENVIOS_POR_MINUTO. Devolve quantos foram. */
export async function rodarAvisos(env: AmbienteDosAvisos, agora: Date, comBanco: ComBanco, f: typeof fetch = fetch): Promise<number> {
  if (!env.VAPID_PRIVADA || !env.VAPID_PUBLICA || !env.DATABASE_URL) return 0;
  const vapid: ChavesVapid = { publica: env.VAPID_PUBLICA, privada: env.VAPID_PRIVADA, contato: env.VAPID_CONTATO ?? 'https://varzeao-da-mata.pages.dev' };
  const antes = (await env.AGENDA.get<EnvioPendente[]>(CHAVE_FILA, 'json')) ?? [];
  const novos = await avisosNovos(env, agora);
  let fila = antes;
  if (novos.length) {
    const envios = await comBanco(async (b) => {
      const lista: EnvioPendente[] = [];
      for (const { times, ...aviso } of novos) for (const aparelho of await aparelhosDosTimes(b, times)) lista.push({ aviso, aparelho });
      return lista;
    });
    fila = [...antes, ...envios];
  }
  if (!fila.length) return 0;

  const agoraVai = fila.slice(0, ENVIOS_POR_MINUTO);
  const resto = fila.slice(ENVIOS_POR_MINUTO);
  const sumidos = new Set<string>();
  let feitos = 0;
  for (const e of agoraVai) {
    const r = await enviar(f, vapid, e);
    if (r === 'ok') feitos++;
    if (r === 'sumiu') sumidos.add(e.aparelho.endpoint);
  }
  if (sumidos.size) await comBanco(async (b) => {
    for (const endpoint of sumidos) await esquecerAparelho(b, endpoint);
  });
  const restoValido = resto.filter((e) => !sumidos.has(e.aparelho.endpoint));
  if (restoValido.length) await env.AGENDA.put(CHAVE_FILA, JSON.stringify(restoValido), { expirationTtl: 1800 });
  else if (antes.length) await env.AGENDA.delete(CHAVE_FILA);
  return feitos;
}

const resposta = (dados: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(dados), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

/** POST /avisos (ativar ou trocar os Times) e POST /avisos/desativar. */
export async function rotaDosAvisos(req: Request, env: AmbienteDosAvisos, comBanco: ComBanco, cors: Record<string, string>): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (req.method !== 'POST' || (pathname !== '/avisos' && pathname !== '/avisos/desativar')) return null;
  if (!env.DATABASE_URL || !env.VAPID_PRIVADA || !env.VAPID_PUBLICA) return resposta({ erro: 'Os Avisos ainda não estão ligados.' }, 503, cors);
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: 'Corpo inválido' }, 400, cors);
  }
  if (pathname === '/avisos/desativar') {
    const endpoint = (corpo as { endpoint?: unknown } | null)?.endpoint;
    if (!endpointValido(endpoint)) return resposta({ erro: 'Aparelho inválido' }, 400, cors);
    await comBanco((b) => esquecerAparelho(b, endpoint));
    return resposta({ ok: true }, 200, cors);
  }
  const ativacao = lerAtivacao(corpo);
  if (!ativacao) return resposta({ erro: 'Escolha pelo menos um Time.' }, 400, cors);
  await comBanco((b) => guardarAparelho(b, ativacao.aparelho, ativacao.times));
  return resposta({ ok: true, times: ativacao.times }, 200, cors);
}
