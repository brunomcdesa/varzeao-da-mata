/**
 * Série A e Série B (ADR-0015, GLOSSARY: Série, Acesso, Rebaixamento).
 *
 * A Série de cada Time é um dado da Temporada (tabela serie_do_time), porque muda com o
 * Acesso e o Rebaixamento. Uma Temporada sem essas linhas (a Temporada 1) tem uma Série só,
 * a A, com os 8 Times fundadores.
 */
import { RODADA_DA_FINAL, SERIES, TIMES_FUNDADORES, TIMES_NOVOS, TIMES_POR_SERIE, TIMES_QUE_TROCAM_DE_SERIE, type Serie, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';

export type SeriesDaTemporada = Readonly<Record<Serie, readonly TimeId[]>>;

/** Os Times de cada Série numa Temporada. Temporada sem Séries: só a A, com os fundadores. */
export async function seriesDaTemporada(banco: Banco, temporadaId: number): Promise<SeriesDaTemporada> {
  const linhas = (
    await banco.query<{ time_id: TimeId; serie: Serie }>(`SELECT time_id, serie FROM serie_do_time WHERE temporada_id = $1 ORDER BY time_id`, [temporadaId])
  ).rows;
  if (!linhas.length) return { A: TIMES_FUNDADORES, B: [] };
  return { A: linhas.filter((l) => l.serie === 'A').map((l) => l.time_id), B: linhas.filter((l) => l.serie === 'B').map((l) => l.time_id) };
}

/** As Séries que têm Times nesta Temporada, na ordem (A, depois B). */
export function seriesComTimes(s: SeriesDaTemporada): Serie[] {
  return SERIES.filter((x) => s[x].length > 0);
}

/** A Série de um Time numa Temporada (null se o Time não joga nela). */
export function serieDoTime(s: SeriesDaTemporada, time: TimeId): Serie | null {
  return SERIES.find((x) => s[x].includes(time)) ?? null;
}

/**
 * Times que aceitam Inscrição agora: os da Temporada em andamento ou, se não houver, os da
 * próxima (na Pré-temporada) ou os da última. Sem nenhuma Temporada, os fundadores.
 */
export async function timesAtivos(banco: Banco): Promise<TimeId[]> {
  const t = (
    await banco.query<{ id: number }>(
      `SELECT id FROM temporada ORDER BY (status = 'EM_ANDAMENTO') DESC, (status = 'PRE_TEMPORADA') DESC, numero DESC LIMIT 1`,
    )
  ).rows[0];
  if (!t) return [...TIMES_FUNDADORES];
  const s = await seriesDaTemporada(banco, t.id);
  return [...s.A, ...s.B];
}

/** Grava as Séries de uma Temporada. */
export async function gravarSeries(banco: Banco, temporadaId: number, s: SeriesDaTemporada): Promise<void> {
  for (const serie of SERIES) {
    for (const time of s[serie]) {
      await banco.query(
        `INSERT INTO serie_do_time (temporada_id, time_id, serie) VALUES ($1, $2, $3)
         ON CONFLICT (temporada_id, time_id) DO UPDATE SET serie = EXCLUDED.serie`,
        [temporadaId, time, serie],
      );
    }
  }
}

/**
 * As Séries da Temporada seguinte à `anteriorId` (ADR-0015):
 * - depois de uma Temporada sem Séries, os fundadores ficam na A e os Times novos formam a B;
 * - depois de uma Temporada com Séries, os 2 últimos da Fase de Liga da A descem e os 2
 *   finalistas do Mata-mata da B sobem.
 * Precisa da Final da B já disputada.
 */
export async function seriesDaProximaTemporada(
  banco: Banco,
  anteriorId: number,
  classificacaoDaLiga: (serie: Serie) => Promise<TimeId[]>,
): Promise<SeriesDaTemporada> {
  const s = await seriesDaTemporada(banco, anteriorId);
  if (!s.B.length) return { A: [...TIMES_FUNDADORES], B: [...TIMES_NOVOS] };

  const ordemA = await classificacaoDaLiga('A');
  const rebaixados = ordemA.slice(-TIMES_QUE_TROCAM_DE_SERIE);
  const finalistasB = await finalistas(banco, anteriorId, 'B');
  if (finalistasB.length !== TIMES_QUE_TROCAM_DE_SERIE) throw new Error(`A Final da Série B da Temporada ${anteriorId} ainda não existe`);

  const A = [...s.A.filter((t) => !rebaixados.includes(t)), ...finalistasB];
  const B = [...s.B.filter((t) => !finalistasB.includes(t)), ...rebaixados];
  if (A.length !== TIMES_POR_SERIE || B.length !== TIMES_POR_SERIE) throw new Error(`Séries desequilibradas: A ${A.length}, B ${B.length}`);
  return { A: A.sort(), B: B.sort() };
}

/** Os dois Times da Final de uma Série (vazio se a Final ainda não foi criada). */
export async function finalistas(banco: Banco, temporadaId: number, serie: Serie): Promise<TimeId[]> {
  const final = (
    await banco.query<{ mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE r.temporada_id = $1 AND r.numero = $3 AND p.serie = $2`,
      [temporadaId, serie, RODADA_DA_FINAL],
    )
  ).rows[0];
  return final ? [final.mandante_id, final.visitante_id] : [];
}

/** O vencedor de uma Partida já simulada (pênaltis incluídos), ou null. */
export function vencedorDe(res: ResultadoPartida | null | undefined): TimeId | null {
  return res?.vencedor ? (res.times[res.vencedor] as TimeId) : null;
}
