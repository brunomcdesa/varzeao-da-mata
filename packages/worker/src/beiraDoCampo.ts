/**
 * Beira do campo (ADRs 0111 e 0112): o Técnico de cada Time congelado na Escalação (com os Itens
 * da Loja do Técnico) e o lugar do Capitão, para o boneco à beira do campo e a Braçadeira.
 */
import { itensValidos, type ItensEquipados, type TimeId } from '@liga/shared';
import { faseDaLoja } from './loja.js';
import type { Banco } from './banco.js';
import { tecnicoDoTime } from './tecnico.js';

type Lado = 'mandante' | 'visitante';

export interface TecnicoDaPartida {
  /** O @ (a aparência do boneco sai dele). */
  nome: string;
  apelido: string | null;
  itens?: ItensEquipados | null;
}

export interface BeiraDoCampo {
  /** Presente (mesmo vazio) a partir da T3: o lado sem Técnico fica com a beira vazia. */
  tecnicos: Partial<Record<Lado, TecnicoDaPartida>>;
  capitaes: Partial<Record<Lado, number>>;
}

const itensDe = (v: unknown): ItensEquipados | null => {
  const x = typeof v === 'string' ? (JSON.parse(v) as unknown) : v;
  return itensValidos(x) && Object.keys(x).length ? x : null;
};

/**
 * Grava o Técnico de cada Time na hora da Escalação, a partir do dia da Rodada 4 da Fase de Liga
 * da T3 (a Loja fase 2). Time sem Técnico ganha a linha vazia: a beira do campo aparece vazia.
 */
export async function congelarTecnicos(b: Banco, partidaId: number, times: readonly TimeId[], apito: Date): Promise<void> {
  if ((await faseDaLoja(b, apito)) < 2) return;
  for (const time of times) {
    const t = await tecnicoDoTime(b, time);
    if (!t) {
      await b.query(`INSERT INTO tecnico_na_partida (partida_id, time_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [partidaId, time]);
      continue;
    }
    const itens = (await b.query<{ itens: unknown }>(`SELECT itens FROM jogador_todos WHERE id = $1`, [t.jogadorId])).rows[0]?.itens;
    const i = itensDe(itens);
    await b.query(
      `INSERT INTO tecnico_na_partida (partida_id, time_id, jogador_id, username, apelido, itens) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [partidaId, time, t.jogadorId, t.username, t.apelido, i ? JSON.stringify(i) : null],
    );
  }
}

/** A beira do campo de várias Partidas de uma vez (o site lê todas). Só as escaladas com a beira (Rodada 4 da T3 em diante). */
export async function beirasDasPartidas(b: Banco, ids: readonly number[]): Promise<Map<number, BeiraDoCampo>> {
  const r = new Map<number, BeiraDoCampo>();
  if (!ids.length) return r;
  const partidas = (
    await b.query<{ id: number; mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.id, p.mandante_id, p.visitante_id FROM partida p WHERE p.id = ANY($1::int[]) AND EXISTS (SELECT 1 FROM tecnico_na_partida x WHERE x.partida_id = p.id)`,
      [ids],
    )
  ).rows;
  if (!partidas.length) return r;
  const so = partidas.map((p) => p.id);
  const lado = new Map(partidas.map((p) => [p.id, (t: TimeId): Lado => (t === p.mandante_id ? 'mandante' : 'visitante')]));
  for (const p of partidas) r.set(p.id, { tecnicos: {}, capitaes: {} });
  for (const t of (await b.query<{ partida_id: number; time_id: TimeId; username: string; apelido: string | null; itens: unknown }>(`SELECT partida_id, time_id, username, apelido, itens FROM tecnico_na_partida WHERE partida_id = ANY($1::int[]) AND username IS NOT NULL`, [so])).rows) {
    const i = itensDe(t.itens);
    r.get(t.partida_id)!.tecnicos[lado.get(t.partida_id)!(t.time_id)] = { nome: t.username, apelido: t.apelido, ...(i ? { itens: i } : {}) };
  }
  for (const c of (await b.query<{ partida_id: number; time_id: TimeId; lugar: number }>(`SELECT partida_id, time_id, lugar FROM escalacao WHERE partida_id = ANY($1::int[]) AND capitao AND NOT reserva`, [so])).rows) {
    r.get(c.partida_id)!.capitaes[lado.get(c.partida_id)!(c.time_id)] = c.lugar;
  }
  return r;
}

export async function beiraDaPartida(b: Banco, partidaId: number): Promise<BeiraDoCampo | null> {
  return (await beirasDasPartidas(b, [partidaId])).get(partidaId) ?? null;
}
