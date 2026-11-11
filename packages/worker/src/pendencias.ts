/**
 * A coleta lista no KV só o que a borda marcou como pendente (ADR-0035): o plano grátis tem
 * 1.000 listagens por dia e a coleta roda 144 vezes. Uma vez por hora ela varre tudo, como
 * rede de segurança para uma marca perdida (a hora da última varredura fica no banco).
 */
import { CHAVE_PENDENCIAS, TIPOS_DE_PENDENCIA, ehHoraDaVarredura, type Pendencias, type TipoDePendencia } from '@liga/shared';
import type { Banco } from './banco.js';
import type { Agenda } from './nuvem.js';

export type Pendente = (tipo: TipoDePendencia) => boolean;

/** Tudo pendente: para os jobs que precisam ver o KV inteiro (Partida, workflows à mão). */
export const TUDO_PENDENTE: Pendente = () => true;

/**
 * Lê e limpa as marcas da borda. A marca é apagada antes de a coleta listar: o que a borda
 * marcar enquanto isso fica para a próxima coleta.
 */
export async function tomarPendencias(banco: Banco, agenda: Agenda, agora: Date): Promise<Pendente> {
  const r = (await banco.query<{ valor: { em: string } }>(`SELECT valor FROM config WHERE chave = 'kv_varredura'`)).rows[0];
  const varrer = ehHoraDaVarredura(r ? new Date(r.valor.em) : null, agora);
  const marcas = await agenda.ler<Pendencias>(CHAVE_PENDENCIAS);
  if (marcas) await agenda.apagar(CHAVE_PENDENCIAS);
  if (varrer) {
    await banco.query(
      `INSERT INTO config (chave, valor) VALUES ('kv_varredura', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = now()`,
      [JSON.stringify({ em: agora.toISOString() })],
    );
    return TUDO_PENDENTE;
  }
  const tipos = new Set(TIPOS_DE_PENDENCIA.filter((t) => marcas?.[t]));
  return (tipo) => tipos.has(tipo);
}
