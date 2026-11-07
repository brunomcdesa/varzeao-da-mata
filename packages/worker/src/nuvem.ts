/**
 * Cloudflare: R2 (arquivos) e KV (agenda de publicações e o token do Instagram para o
 * worker na borda). Cada um tem uma versão local, usada nos testes e no `pnpm liga`.
 *
 * R2 público: vídeos (nome aleatório, para ninguém achar antes da hora) e os JSON do site.
 * R2 privado: a Partida completa (com lances), que a borda só entrega depois do Apito.
 */
import { AwsClient } from 'aws4fetch';

export type Bucket = 'publico' | 'privado';

export interface Armazenamento {
  enviar(bucket: Bucket, chave: string, corpo: Uint8Array | string, o?: { tipo?: string; cache?: string }): Promise<void>;
  /** URL pública de um arquivo do bucket público. */
  urlPublica(chave: string): string;
}

export interface Agenda {
  gravar(chave: string, valor: unknown): Promise<void>;
  ler<T>(chave: string): Promise<T | null>;
  listar(prefixo: string): Promise<string[]>;
  apagar(chave: string): Promise<void>;
}

const TIPOS: Record<string, string> = { json: 'application/json', mp4: 'video/mp4', png: 'image/png', html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css' };
export const tipoDe = (chave: string) => TIPOS[chave.split('.').pop() ?? ''] ?? 'application/octet-stream';

export interface ConfigR2 {
  contaId: string;
  chaveId: string;
  segredo: string;
  bucketPublico: string;
  bucketPrivado: string;
  /** Domínio público do bucket público (r2.dev ou domínio próprio). */
  urlPublica: string;
  fetch?: typeof fetch;
}

export class R2 implements Armazenamento {
  private readonly aws: AwsClient;
  constructor(private readonly c: ConfigR2) {
    this.aws = new AwsClient({ accessKeyId: c.chaveId, secretAccessKey: c.segredo, service: 's3', region: 'auto' });
  }
  async enviar(bucket: Bucket, chave: string, corpo: Uint8Array | string, o: { tipo?: string; cache?: string } = {}): Promise<void> {
    const nome = bucket === 'publico' ? this.c.bucketPublico : this.c.bucketPrivado;
    const url = `https://${this.c.contaId}.r2.cloudflarestorage.com/${nome}/${chave.split('/').map(encodeURIComponent).join('/')}`;
    const pedido = await this.aws.sign(url, {
      method: 'PUT',
      body: corpo as BodyInit,
      headers: { 'content-type': o.tipo ?? tipoDe(chave), ...(o.cache ? { 'cache-control': o.cache } : {}) },
    });
    const r = await (this.c.fetch ?? fetch)(pedido);
    if (!r.ok) throw new Error(`R2 ${r.status} ao enviar ${nome}/${chave}: ${(await r.text()).slice(0, 300)}`);
  }
  urlPublica(chave: string): string {
    return `${this.c.urlPublica.replace(/\/$/, '')}/${chave}`;
  }
}

export interface ConfigKV {
  contaId: string;
  namespaceId: string;
  token: string;
  fetch?: typeof fetch;
}

export class KV implements Agenda {
  constructor(private readonly c: ConfigKV) {}
  private url(resto: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.c.contaId}/storage/kv/namespaces/${this.c.namespaceId}/${resto}`;
  }
  private async chamar(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await (this.c.fetch ?? fetch)(url, { ...init, headers: { authorization: `Bearer ${this.c.token}`, ...(init.headers ?? {}) } });
    if (!r.ok && r.status !== 404) throw new Error(`KV ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r;
  }
  async gravar(chave: string, valor: unknown): Promise<void> {
    await this.chamar(this.url(`values/${encodeURIComponent(chave)}`), { method: 'PUT', body: JSON.stringify(valor), headers: { 'content-type': 'application/json' } });
  }
  async ler<T>(chave: string): Promise<T | null> {
    const r = await this.chamar(this.url(`values/${encodeURIComponent(chave)}`));
    return r.status === 404 ? null : ((await r.json()) as T);
  }
  async listar(prefixo: string): Promise<string[]> {
    const chaves: string[] = [];
    let cursor = '';
    do {
      const r = await this.chamar(this.url(`keys?prefix=${encodeURIComponent(prefixo)}&limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`));
      const j = (await r.json()) as { result: { name: string }[]; result_info?: { cursor?: string } };
      chaves.push(...j.result.map((k) => k.name));
      cursor = j.result_info?.cursor ?? '';
    } while (cursor);
    return chaves;
  }
  async apagar(chave: string): Promise<void> {
    await this.chamar(this.url(`values/${encodeURIComponent(chave)}`), { method: 'DELETE' });
  }
}

/** Grava numa pasta (pasta/publico, pasta/privado): para rodar tudo sem nuvem. */
export class PastaLocal implements Armazenamento {
  constructor(private readonly pasta: string) {}
  async enviar(bucket: Bucket, chave: string, corpo: Uint8Array | string): Promise<void> {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const destino = join(this.pasta, bucket, chave);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, corpo);
  }
  urlPublica(chave: string): string {
    return `file://${this.pasta}/publico/${chave}`;
  }
}

export class AgendaNaMemoria implements Agenda {
  readonly itens = new Map<string, string>();
  async gravar(chave: string, valor: unknown): Promise<void> {
    this.itens.set(chave, JSON.stringify(valor));
  }
  async ler<T>(chave: string): Promise<T | null> {
    const v = this.itens.get(chave);
    return v === undefined ? null : (JSON.parse(v) as T);
  }
  async listar(prefixo: string): Promise<string[]> {
    return [...this.itens.keys()].filter((k) => k.startsWith(prefixo)).sort();
  }
  async apagar(chave: string): Promise<void> {
    this.itens.delete(chave);
  }
}

/** Configuração a partir do ambiente; null quando faltar algo (aí o job roda local). */
export function nuvemDoAmbiente(env = process.env): { armazenamento: R2; agenda: KV } | null {
  const precisa = ['CF_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_PUBLICO', 'R2_BUCKET_PRIVADO', 'R2_URL_PUBLICA', 'CF_API_TOKEN', 'CF_KV_NAMESPACE_ID'];
  if (precisa.some((k) => !env[k])) return null;
  return {
    armazenamento: new R2({
      contaId: env.CF_ACCOUNT_ID!,
      chaveId: env.R2_ACCESS_KEY_ID!,
      segredo: env.R2_SECRET_ACCESS_KEY!,
      bucketPublico: env.R2_BUCKET_PUBLICO!,
      bucketPrivado: env.R2_BUCKET_PRIVADO!,
      urlPublica: env.R2_URL_PUBLICA!,
    }),
    agenda: new KV({ contaId: env.CF_ACCOUNT_ID!, namespaceId: env.CF_KV_NAMESPACE_ID!, token: env.CF_API_TOKEN! }),
  };
}

/** Formato de um item da agenda (lido pelo worker na borda). */
export interface ItemDaAgenda {
  tipo: 'PARTIDA' | 'RESUMO' | 'CRAQUE';
  /** partidaId ou rodadaId. */
  ref: number;
  containerId: string;
  publicarEm: string;
  publicadoEm?: string;
  mediaId?: string;
}

/** Chave ordenável por horário: agenda/2026-11-07T15:06:00.000Z/partida-1 */
export const chaveDaAgenda = (i: Pick<ItemDaAgenda, 'tipo' | 'ref' | 'publicarEm'>) => `agenda/${i.publicarEm}/${i.tipo.toLowerCase()}-${i.ref}`;
export const CHAVE_TOKEN = 'ig/token';
/** Horário do próximo item pendente; o worker da borda só lista a agenda quando ele vence. */
export const CHAVE_PROXIMA = 'agenda-proxima';

/** Grava o item e adianta a "próxima" se ele vier antes. */
export async function gravarNaAgenda(agenda: Agenda, item: ItemDaAgenda): Promise<void> {
  await agenda.gravar(chaveDaAgenda(item), item);
  const atual = await agenda.ler<{ em: string }>(CHAVE_PROXIMA);
  if (!atual || Date.parse(item.publicarEm) < Date.parse(atual.em)) await agenda.gravar(CHAVE_PROXIMA, { em: item.publicarEm });
}
