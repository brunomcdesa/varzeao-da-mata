/**
 * Expansão por lotação (ADR-0093). No fim da Fase de Liga de toda Temporada a partir da T3, se
 * 90% das vagas dos Times estão ocupadas (2 goleiros e 4 por Posição de linha em cada Time), a
 * Temporada fica marcada: a seguinte nasce com os 4 Times da Expansão na Série B, ninguém cai da A
 * e 2 sobem da B, e as duas Séries ficam com 10 Times.
 */
import { TIMES_DA_EXPANSAO, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { LIMITE_POR_POSICAO } from './coletar.js';
import { seriesDaTemporada } from './series.js';

export const LOTACAO_DA_EXPANSAO = 0.9;
export const PRIMEIRA_TEMPORADA_COM_EXPANSAO = 3;
/** Vagas de um Time pelo Limite por Posição: 2 goleiros e 4 em cada Posição de linha. Função
 * (e não constante) porque coletar.ts e series.ts se importam em ciclo com este arquivo. */
export const vagasPorTime = (): number => Object.values(LIMITE_POR_POSICAO).reduce((s, n) => s + n, 0);

export interface Lotacao {
  ocupadas: number;
  vagas: number;
  /** Quantas ocupadas a Expansão precisa (90% das vagas, arredondado para cima). */
  precisa: number;
}

/** Quantas vagas dos Times de uma Temporada estão ocupadas agora. */
export async function lotacao(b: Banco, temporadaId: number): Promise<Lotacao> {
  const s = await seriesDaTemporada(b, temporadaId);
  const times: TimeId[] = [...s.A, ...s.B];
  const ocupadas = Number(
    (await b.query<{ n: string }>(`SELECT count(*) AS n FROM jogador WHERE NOT banido AND time_id = ANY($1)`, [times])).rows[0]!.n,
  );
  const vagas = times.length * vagasPorTime();
  return { ocupadas, vagas, precisa: Math.ceil(vagas * LOTACAO_DA_EXPANSAO) };
}

/**
 * Confere o gatilho no fim da Fase de Liga e marca a Temporada. Só uma vez: com os Times da
 * Expansão já numa Série, não há mais Expansão (a próxima depende de outra decisão).
 */
export async function conferirExpansao(b: Banco, temporadaId: number): Promise<boolean> {
  const t = (await b.query<{ numero: number; expansao: boolean }>(`SELECT numero, expansao FROM temporada WHERE id = $1`, [temporadaId])).rows[0];
  if (!t || t.numero < PRIMEIRA_TEMPORADA_COM_EXPANSAO) return false;
  if (t.expansao) return true;
  const s = await seriesDaTemporada(b, temporadaId);
  if (TIMES_DA_EXPANSAO.some((x) => s.A.includes(x) || s.B.includes(x))) return false;
  const l = await lotacao(b, temporadaId);
  if (l.ocupadas < l.precisa) return false;
  await b.query(`UPDATE temporada SET expansao = true WHERE id = $1`, [temporadaId]);
  return true;
}

/** A Temporada foi marcada para a Expansão? */
export async function temExpansao(b: Banco, temporadaId: number): Promise<boolean> {
  return !!(await b.query<{ expansao: boolean }>(`SELECT expansao FROM temporada WHERE id = $1`, [temporadaId])).rows[0]?.expansao;
}

/**
 * Fundação de um Time da Expansão (ADR-0093): na primeira Temporada dele, até o Corte do
 * primeiro jogo (a mesma hora em que fecha a Janela), quem entra no Elenco vira Fundador e o
 * veterano troca para ele de graça. Devolve a Temporada, ou null fora disso.
 */
export async function temporadaDeFundacao(b: Banco, time: TimeId, quando: Date, corteMs: number): Promise<number | null> {
  if (!TIMES_DA_EXPANSAO.includes(time)) return null;
  const t = (
    await b.query<{ id: number; numero: number; primeiro: Date | string | null }>(
      `SELECT t.id, t.numero, (SELECT min(p.apito_inicial) FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id) AS primeiro
         FROM temporada t WHERE t.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY t.status = 'EM_ANDAMENTO' DESC, t.numero LIMIT 1`,
    )
  ).rows[0];
  if (!t) return null;
  const s = await seriesDaTemporada(b, t.id);
  if (!s.A.includes(time) && !s.B.includes(time)) return null;
  // A primeira Temporada do Time: a anterior foi a que marcou a Expansão.
  const anterior = (await b.query<{ expansao: boolean }>(`SELECT expansao FROM temporada WHERE numero = $1`, [t.numero - 1])).rows[0];
  if (!anterior?.expansao) return null;
  if (t.primeiro && quando.getTime() >= new Date(t.primeiro).getTime() - corteMs) return null;
  return t.id;
}

/** Grava o Fundador (o primeiro Time da Expansão em que ele entra fica valendo). */
export async function marcarFundador(b: Banco, jogadorId: string, time: TimeId, temporadaId: number): Promise<void> {
  await b.query(`INSERT INTO fundador (jogador_id, time_id, temporada_id, remanejado) VALUES ($1, $2, $3, false) ON CONFLICT (jogador_id, time_id) DO NOTHING`, [jogadorId, time, temporadaId]);
}
