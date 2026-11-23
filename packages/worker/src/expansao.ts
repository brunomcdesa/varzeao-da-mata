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
