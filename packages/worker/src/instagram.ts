/**
 * Cliente da API do Instagram. Funciona com os dois tipos de token que a Meta emite:
 *
 * - Login do Instagram (token `IG...`): graph.instagram.com. Apps antigos.
 * - Login unificado (token `EAA...`): graph.facebook.com. Apps criados a partir de 2026
 *   só têm este; as permissões são instagram_basic, instagram_manage_comments e
 *   instagram_content_publish, e o id da conta é o `1784...` da tela "Gerar tokens".
 *
 * Os caminhos (`<conta>/media`, `media_publish`, `<mídia>/comments`) são os mesmos nos dois.
 *
 * Permissões: instagram_business_basic (ler mídias), instagram_business_manage_comments
 * (ler comentários com o @ de quem comentou) e instagram_business_content_publish (Reels).
 * Conta própria: Standard Access basta, sem App Review.
 *
 * Reels em 2 passos: cria o container (o Instagram baixa o vídeo do `video_url`, que
 * precisa ser público), espera `status_code = FINISHED` e publica com `media_publish`.
 * O container vale 24 h; o limite é 100 publicações por 24 h.
 */
import type { Comentario } from './coletar.js';

/** Versão da Graph API (cada uma vale ~2 anos). Troque por IG_API_VERSAO sem mexer no código. */
export const VERSAO_API = process.env.IG_API_VERSAO ?? 'v25.0';

export type LoginDoToken = 'INSTAGRAM' | 'UNIFICADO';

/** Tokens do login unificado (Facebook Login para Empresas) começam com EAA. */
export function loginDoToken(token: string): LoginDoToken {
  return token.startsWith('EAA') ? 'UNIFICADO' : 'INSTAGRAM';
}

export function baseDaApi(token: string): string {
  return loginDoToken(token) === 'UNIFICADO' ? 'https://graph.facebook.com' : 'https://graph.instagram.com';
}

export type StatusContainer = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

export class ErroInstagram extends Error {
  constructor(
    readonly status: number,
    readonly codigo: number | null,
    readonly subcodigo: number | null,
    mensagem: string,
  ) {
    super(`Instagram ${status}${codigo !== null ? ` (código ${codigo}${subcodigo ? `/${subcodigo}` : ''})` : ''}: ${mensagem}`);
  }
  /** Token vencido ou revogado: renove ou gere outro. */
  get tokenInvalido(): boolean {
    return this.codigo === 190;
  }
  /** Limite de chamadas: espere e tente de novo. */
  get limite(): boolean {
    return this.codigo === 4 || this.codigo === 17 || this.codigo === 32 || this.codigo === 613 || this.status === 429;
  }
}

export interface OpcoesInstagram {
  userId: string;
  token: string;
  /** Login unificado: id e chave secreta do app da Meta, para trocar o token antes de vencer. */
  appId?: string;
  appSecret?: string;
  fetch?: typeof fetch;
  /** Para testes: não espera de verdade. */
  dormir?: (ms: number) => Promise<void>;
}

interface Pagina<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

export interface Midia {
  id: string;
  timestamp: string;
  media_product_type?: string;
  permalink?: string;
  caption?: string;
}

interface ComentarioBruto {
  id: string;
  text?: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username?: string };
  replies?: { data: ComentarioBruto[] };
}

export class Instagram {
  private readonly f: typeof fetch;
  private readonly dormir: (ms: number) => Promise<void>;

  constructor(private o: OpcoesInstagram) {
    this.f = o.fetch ?? fetch;
    this.dormir = o.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get token(): string {
    return this.o.token;
  }

  private async chamar<T>(metodo: 'GET' | 'POST', caminho: string, params: Record<string, string> = {}): Promise<T> {
    const url = caminho.startsWith('https://') ? new URL(caminho) : new URL(`${baseDaApi(this.o.token)}/${VERSAO_API}/${caminho}`);
    const corpo = new URLSearchParams(params);
    // Links de paginação (`paging.next`) já trazem o token.
    if (!url.searchParams.has('access_token')) corpo.set('access_token', this.o.token);
    let resposta: Response;
    if (metodo === 'GET') {
      for (const [k, v] of corpo) url.searchParams.set(k, v);
      resposta = await this.f(url, { method: 'GET' });
    } else {
      resposta = await this.f(url, { method: 'POST', body: corpo, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    }
    const json = (await resposta.json().catch(() => ({}))) as { error?: { code?: number; error_subcode?: number; message?: string } } & T;
    if (!resposta.ok || json.error) {
      const e = json.error ?? {};
      throw new ErroInstagram(resposta.status, e.code ?? null, e.error_subcode ?? null, e.message ?? resposta.statusText);
    }
    return json;
  }

  get login(): LoginDoToken {
    return loginDoToken(this.o.token);
  }

  /** A conta da Liga (para conferir a configuração). */
  async eu(): Promise<{ user_id: string; username: string; account_type?: string }> {
    if (this.login === 'INSTAGRAM') return this.chamar('GET', 'me', { fields: 'user_id,username,account_type' });
    const r = await this.chamar<{ id: string; username: string }>('GET', this.o.userId, { fields: 'id,username' });
    return { user_id: r.id, username: r.username };
  }

  /**
   * Quando o token vence (null = não vence). Só no login unificado; no do Instagram, sempre
   * 60 dias. O debug_token exige o token do app (id|chave secreta) quando o token é de testador.
   */
  async validade(): Promise<{ expiraEm: Date | null; escopos: string[] }> {
    const url = new URL(`${baseDaApi(this.o.token)}/${VERSAO_API}/debug_token`);
    url.searchParams.set('input_token', this.o.token);
    if (this.o.appId && this.o.appSecret) url.searchParams.set('access_token', `${this.o.appId}|${this.o.appSecret}`);
    const r = await this.chamar<{ data: { expires_at?: number; data_access_expires_at?: number; scopes?: string[] } }>('GET', url.toString());
    const em = r.data.expires_at ?? 0;
    return { expiraEm: em > 0 ? new Date(em * 1000) : null, escopos: r.data.scopes ?? [] };
  }

  /** Mídias publicadas desde `desde` (as mais novas primeiro). */
  async midiasDesde(desde: Date, limite = 100): Promise<Midia[]> {
    const lista: Midia[] = [];
    let pagina = await this.chamar<Pagina<Midia>>('GET', `${this.o.userId}/media`, { fields: 'id,timestamp,media_product_type,permalink', limit: '50' });
    for (;;) {
      for (const m of pagina.data) {
        if (Date.parse(m.timestamp) < desde.getTime()) return lista;
        lista.push(m);
        if (lista.length >= limite) return lista;
      }
      if (!pagina.paging?.next) return lista;
      pagina = await this.chamar<Pagina<Midia>>('GET', pagina.paging.next);
    }
  }

  /** Comentários de uma mídia (de primeiro nível), no formato que o `coletar` entende. */
  async comentarios(mediaId: string, desde?: Date): Promise<Comentario[]> {
    const lista: Comentario[] = [];
    // As respostas a outros comentários também contam ("entro onça atacante" respondendo alguém).
    const campos = 'id,text,timestamp,username,from{id,username}';
    let pagina = await this.chamar<Pagina<ComentarioBruto>>('GET', `${mediaId}/comments`, { fields: `${campos},replies{${campos}}`, limit: '50' });
    const guardar = (c: ComentarioBruto) => {
      const quando = new Date(Date.parse(c.timestamp));
      if (desde && quando.getTime() < desde.getTime()) return;
      const username = c.from?.username ?? c.username;
      if (!c.from?.id || !username) return; // sem autor identificável não dá para inscrever ninguém
      lista.push({ igCommentId: c.id, igMediaId: mediaId, igUserId: c.from.id, username, texto: c.text ?? '', comentadoEm: quando });
    };
    for (;;) {
      for (const c of pagina.data) {
        guardar(c);
        for (const resposta of c.replies?.data ?? []) guardar(resposta);
      }
      if (!pagina.paging?.next) break;
      pagina = await this.chamar<Pagina<ComentarioBruto>>('GET', pagina.paging.next);
    }
    // Do mais antigo para o mais novo: a ordem importa para o último voto valer.
    return lista.sort((a, b) => a.comentadoEm.getTime() - b.comentadoEm.getTime() || a.igCommentId.localeCompare(b.igCommentId));
  }

  /** Cria o container do Reels. O `videoUrl` precisa ser público (R2). */
  async criarReels(o: { videoUrl: string; legenda: string; capaEmMs?: number }): Promise<string> {
    const params: Record<string, string> = { media_type: 'REELS', video_url: o.videoUrl, caption: o.legenda, share_to_feed: 'true' };
    if (o.capaEmMs !== undefined) params.thumb_offset = String(Math.round(o.capaEmMs));
    const r = await this.chamar<{ id: string }>('POST', `${this.o.userId}/media`, params);
    return r.id;
  }

  async statusDoContainer(id: string): Promise<{ status: StatusContainer; detalhe?: string }> {
    const r = await this.chamar<{ status_code: StatusContainer; status?: string }>('GET', id, { fields: 'status_code,status' });
    return r.status ? { status: r.status_code, detalhe: r.status } : { status: r.status_code };
  }

  /** Espera o Instagram processar o vídeo (normalmente 30 s a alguns minutos). */
  async esperarContainer(id: string, o: { tentativas?: number; intervaloMs?: number } = {}): Promise<void> {
    const tentativas = o.tentativas ?? 40;
    for (let i = 0; i < tentativas; i++) {
      const { status, detalhe } = await this.statusDoContainer(id);
      if (status === 'FINISHED' || status === 'PUBLISHED') return;
      if (status === 'ERROR' || status === 'EXPIRED') throw new ErroInstagram(400, null, null, `container ${id} ${status}${detalhe ? `: ${detalhe}` : ''}`);
      await this.dormir(o.intervaloMs ?? 15_000);
    }
    throw new ErroInstagram(408, null, null, `container ${id} não ficou pronto a tempo`);
  }

  /** Responde um comentário (aparece como resposta da conta da Liga). */
  async responder(igCommentId: string, texto: string): Promise<string> {
    const r = await this.chamar<{ id: string }>('POST', `${igCommentId}/replies`, { message: texto });
    return r.id;
  }

  async publicar(containerId: string): Promise<string> {
    const r = await this.chamar<{ id: string }>('POST', `${this.o.userId}/media_publish`, { creation_id: containerId });
    return r.id;
  }

  async linkDaMidia(mediaId: string): Promise<string | null> {
    const r = await this.chamar<{ permalink?: string }>('GET', mediaId, { fields: 'permalink' });
    return r.permalink ?? null;
  }

  /**
   * Renova o token de longa duração (60 dias). Só funciona com token de pelo menos 24 h
   * e ainda válido; o novo passa a valer para este cliente.
   */
  async renovarToken(): Promise<{ token: string; expiraEm: Date }> {
    if (this.login === 'UNIFICADO') return this.renovarTokenUnificado();
    const url = new URL(`${baseDaApi(this.o.token)}/refresh_access_token`);
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', this.o.token);
    const r = await this.chamar<{ access_token: string; expires_in: number }>('GET', url.toString());
    this.o = { ...this.o, token: r.access_token };
    return { token: r.access_token, expiraEm: new Date(Date.now() + r.expires_in * 1000) };
  }

  /**
   * Login unificado: token que não vence fica como está; o que vence é trocado por um de
   * longa duração (fb_exchange_token), com o id e a chave secreta do app da Meta.
   */
  private async renovarTokenUnificado(): Promise<{ token: string; expiraEm: Date }> {
    // Sem o id e a chave do app não dá nem para consultar a validade; o `verificar` avisa
    // quando o token vence. Segue com o atual.
    if (!this.o.appId || !this.o.appSecret) return { token: this.o.token, expiraEm: new Date(Date.now() + 10 * 365 * 86400_000) };
    const { expiraEm } = await this.validade();
    if (!expiraEm) return { token: this.o.token, expiraEm: new Date(Date.now() + 10 * 365 * 86400_000) };
    const url = new URL(`https://graph.facebook.com/${VERSAO_API}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', this.o.appId);
    url.searchParams.set('client_secret', this.o.appSecret);
    url.searchParams.set('fb_exchange_token', this.o.token);
    const r = await this.chamar<{ access_token: string; expires_in?: number }>('GET', url.toString());
    this.o = { ...this.o, token: r.access_token };
    return { token: r.access_token, expiraEm: new Date(Date.now() + (r.expires_in ?? 60 * 86400) * 1000) };
  }
}
