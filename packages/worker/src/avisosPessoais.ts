/**
 * Avisos pessoais (ADR-0111): notificação no celular de quem tem Vínculo e ligou os Avisos do
 * App. O worker (na borda ou na coleta) grava em aviso_pessoal e marca que há o que mandar; o
 * cron da borda lê a fila só quando há marca, para não acordar o banco a cada minuto.
 */
import type { Banco } from './banco.js';

export type TipoDeAvisoPessoal = 'PEDIDO' | 'CONVITE' | 'TROCA' | 'TRANSFERENCIA' | 'CHAMADA' | 'CAPITAO';

export interface AvisoPessoal {
  tipo: TipoDeAvisoPessoal;
  titulo: string;
  corpo: string;
  url: string;
}

/** Chave no KV que diz à borda que há Aviso pessoal na fila. */
export const CHAVE_AVISO_PESSOAL = 'aviso/pessoal';

let houve = false;

/** Se algum Aviso pessoal entrou na fila desde a última pergunta (e zera). */
export function houveAvisoPessoal(): boolean {
  const h = houve;
  houve = false;
  return h;
}

/** Põe o Aviso na fila de cada pessoa que tem aparelho ligado; quem não tem fica de fora. */
export async function avisarPessoas(b: Banco, ids: readonly (string | null | undefined)[], aviso: AvisoPessoal | ((id: string) => AvisoPessoal)): Promise<number> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unicos.length) return 0;
  const comAparelho = (
    await b.query<{ id: string }>(`SELECT DISTINCT jogador_id::text AS id FROM aviso_aparelho WHERE jogador_id = ANY($1::bigint[])`, [unicos])
  ).rows.map((r) => r.id);
  for (const id of comAparelho) {
    const a = typeof aviso === 'function' ? aviso(id) : aviso;
    await b.query(`INSERT INTO aviso_pessoal (jogador_id, tipo, titulo, corpo, url) VALUES ($1, $2, $3, $4, $5)`, [id, a.tipo, a.titulo, a.corpo, a.url]);
  }
  if (comAparelho.length) houve = true;
  return comAparelho.length;
}

export interface EnvioPessoal {
  aviso: AvisoPessoal & { tag: string };
  aparelho: { endpoint: string; p256dh: string; auth: string };
}

/** Tira da fila o que falta mandar (marcando como enviado), com os aparelhos de cada pessoa. */
export async function tomarAvisosPessoais(b: Banco, limite = 200): Promise<EnvioPessoal[]> {
  const linhas = (
    await b.query<{ id: number; tipo: TipoDeAvisoPessoal; titulo: string; corpo: string; url: string; endpoint: string; p256dh: string; auth: string }>(
      `WITH fila AS (
         UPDATE aviso_pessoal SET enviado_em = now()
          WHERE id IN (SELECT id FROM aviso_pessoal WHERE enviado_em IS NULL ORDER BY id LIMIT $1)
          RETURNING id, jogador_id, tipo, titulo, corpo, url)
       SELECT f.id, f.tipo, f.titulo, f.corpo, f.url, a.endpoint, a.p256dh, a.auth
         FROM fila f JOIN aviso_aparelho a ON a.jogador_id = f.jogador_id ORDER BY f.id`,
      [limite],
    )
  ).rows;
  return linhas.map((l) => ({ aviso: { tipo: l.tipo, titulo: l.titulo, corpo: l.corpo, url: l.url, tag: `pessoal-${l.id}` }, aparelho: { endpoint: l.endpoint, p256dh: l.p256dh, auth: l.auth } }));
}

/** Liga um aparelho à pessoa do Vínculo (os Avisos dos Times continuam como estavam). */
export async function ligarAparelhoAPessoa(b: Banco, endpoint: string, jogadorId: string): Promise<void> {
  await b.query(`UPDATE aviso_aparelho SET jogador_id = $2, atualizado_em = now() WHERE endpoint = $1`, [endpoint, jogadorId]);
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** O Aviso da resposta de um Pedido, Convite, Troca casada ou chamada da Fila. */
export function avisoDaTransferencia(jogadorId: string, mensagem: string): AvisoPessoal {
  return { tipo: 'TRANSFERENCIA', titulo: 'Sua transferência', corpo: maiuscula(mensagem.replace(/\s*⚽\s*$/, '')), url: `#/jogador/${jogadorId}` };
}
