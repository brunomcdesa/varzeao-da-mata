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
/** Id provisório de quem comentou sem o `from` na API: só vota (ADR-0076). */
export const PREFIXO_SEM_ID = 'sem-id:';

export const VERSAO_API = process.env.IG_API_VERSAO ?? 'v25.0';

/** Limite da API para colaboradores num Reels. */
export const MAX_COLABORADORES = 3;

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

export interface ComentarioBruto {
  hidden?: boolean;
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

  /** Conversas da DM (diagnóstico da permissão de mensagens). */
  async conversas(): Promise<{ id: string; updated_time?: string; participants?: { data: { username?: string }[] } }[]> {
    const r = await this.chamar<Pagina<{ id: string; updated_time?: string; participants?: { data: { username?: string }[] } }>>('GET', `${this.o.userId}/conversations`, { platform: 'instagram', fields: 'id,updated_time,participants', limit: '20' });
    return r.data;
  }

  /** O id de quem mandou DM para a Liga, pelo @ (para inscrever à mão quem pediu pela DM). */
  async idNaDm(username: string): Promise<string | null> {
    const alvo = username.replace(/^@/, '').toLowerCase();
    let pagina = await this.chamar<Pagina<{ participants?: { data: { id: string; username?: string }[] } }>>('GET', `${this.o.userId}/conversations`, { platform: 'instagram', fields: 'participants', limit: '50' });
    for (let i = 0; i < 10; i++) {
      for (const c of pagina.data) {
        const p = c.participants?.data.find((x) => (x.username ?? '').toLowerCase() === alvo);
        if (p) return p.id;
      }
      if (!pagina.paging?.next) return null;
      pagina = await this.chamar('GET', pagina.paging.next);
    }
    return null;
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

  /** Comentários como a API devolve (com respostas), para diagnóstico. */
  async comentariosCrus(mediaId: string): Promise<ComentarioBruto[]> {
    const campos = 'id,text,timestamp,username,hidden,from{id,username}';
    const lista: ComentarioBruto[] = [];
    let pagina = await this.chamar<Pagina<ComentarioBruto>>('GET', `${mediaId}/comments`, { fields: `${campos},replies{${campos}}`, limit: '50' });
    for (;;) {
      for (const c of pagina.data) lista.push(c, ...(c.replies?.data ?? []));
      if (!pagina.paging?.next) return lista;
      pagina = await this.chamar<Pagina<ComentarioBruto>>('GET', pagina.paging.next);
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
      if (!username) return; // sem autor identificável não dá para inscrever ninguém
      // Sem o id da conta (a API às vezes não traz o `from`): o @ ainda identifica a pessoa, e
      // isso basta para o voto, mas não para Inscrição (ADR-0076).
      const igUserId = c.from?.id ?? `${PREFIXO_SEM_ID}${username.toLowerCase()}`;
      lista.push({ igCommentId: c.id, igMediaId: mediaId, igUserId, username, texto: c.text ?? '', comentadoEm: quando });
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

  /**
   * Cria o container do Reels. O `videoUrl` precisa ser público (R2). `colaboradores` são os @
   * (sem o @) convidados para a colaboração: o Perfil do Time (ADR-0100). A API aceita até 3 e
   * só no login unificado; cada perfil precisa aceitar o convite no próprio Reels.
   */
  async criarReels(o: { videoUrl: string; legenda: string; capaEmMs?: number; capaUrl?: string; colaboradores?: string[] }): Promise<string> {
    const params: Record<string, string> = { media_type: 'REELS', video_url: o.videoUrl, caption: o.legenda, share_to_feed: 'true' };
    const colaboradores = [...new Set((o.colaboradores ?? []).map((u) => u.replace(/^@/, '').trim()).filter(Boolean))].slice(0, MAX_COLABORADORES);
    if (colaboradores.length) params.collaborators = JSON.stringify(colaboradores);
    if (o.capaUrl) params.cover_url = o.capaUrl;
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

  /** Quem já respondeu um comentário (os @ das respostas). */
  async quemRespondeu(igCommentId: string): Promise<string[]> {
    const r = await this.chamar<{ data: { username?: string; from?: { id: string } }[] }>('GET', `${igCommentId}/replies`, { fields: 'username,from' });
    return r.data.map((x) => (x.username ?? '').toLowerCase());
  }

  /**
   * A última mensagem que o @ mandou para a Liga na DM: o id dele como remetente (o mesmo que a
   * borda usa para confirmar o Vínculo) e quando foi. A janela de 24 h da Meta conta a partir dela.
   */
  async ultimaMensagemDe(username: string): Promise<{ id: string; em: Date; idNaConversa: string } | null> {
    const alvo = username.replace(/^@/, '').toLowerCase();
    type Conversa = { participants?: { data: { id: string; username?: string }[] }; messages?: { data: { from?: { id: string; username?: string }; created_time?: string }[] } };
    let pagina = await this.chamar<Pagina<Conversa>>('GET', `${this.o.userId}/conversations`, { platform: 'instagram', fields: 'participants,messages.limit(20){from,created_time}', limit: '25' });
    for (let i = 0; i < 10; i++) {
      for (const c of pagina.data) {
        const participante = c.participants?.data.find((x) => (x.username ?? '').toLowerCase() === alvo);
        if (!participante) continue;
        const dele = (c.messages?.data ?? []).filter((m) => (m.from?.username ?? '').toLowerCase() === alvo && m.created_time);
        const ultima = dele.sort((a, b) => Date.parse(b.created_time!) - Date.parse(a.created_time!))[0];
        if (ultima) return { id: ultima.from!.id, em: new Date(ultima.created_time!), idNaConversa: participante.id };
      }
      if (!pagina.paging?.next) return null;
      pagina = await this.chamar('GET', pagina.paging.next);
    }
    return null;
  }

  /**
   * Manda uma DM pela conta da Liga para quem já conversa com ela (o id vem de `ultimaMensagemDe`).
   * A Meta só deixa mandar dentro de 24 h da última mensagem da pessoa.
   */
  async enviarDm(destinatarioId: string, texto: string): Promise<string> {
    const r = await this.chamar<{ message_id: string }>('POST', `${this.o.userId}/messages`, {
      recipient: JSON.stringify({ id: destinatarioId }),
      message: JSON.stringify({ text: texto }),
    });
    return r.message_id;
  }

  /**
   * Inscreve a conta da Liga no campo `messages` do webhook (ADR-0083). Sem isso, a Meta não abre
   * a janela de 24 h para o app e toda DM pela API volta com 10/2534022.
   */
  async inscreverMensagens(): Promise<boolean> {
    const r = await this.chamar<{ success?: boolean }>('POST', `${this.o.userId}/subscribed_apps`, { subscribed_fields: 'messages' });
    return r.success === true;
  }

  /** Os campos do webhook em que a conta da Liga está inscrita, por app. */
  async inscricoesDoWebhook(): Promise<{ app: string; campos: string[] }[]> {
    const r = await this.chamar<{ data: { name?: string; id?: string; subscribed_fields?: string[] }[] }>('GET', `${this.o.userId}/subscribed_apps`);
    return r.data.map((a) => ({ app: a.name ?? a.id ?? '?', campos: a.subscribed_fields ?? [] }));
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
