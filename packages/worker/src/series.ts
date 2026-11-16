/**
 * Série A e Série B (ADR-0017 e ADR-0058, GLOSSARY: Série, Acesso, Rebaixamento).
 *
 * A Série de cada Time é um dado da Temporada (tabela serie_do_time), porque muda com o
 * Acesso e o Rebaixamento. Uma Temporada sem essas linhas (a Temporada 1) tem uma Série só,
 * a A, com os 8 Times fundadores. A T2 tem só a A, com 16 Times em dois Grupos de 8 (coluna
 * `grupo`); no fim dela, os 4 últimos de cada Grupo caem e formam a B da T3, que tem 8 Times em
 * cada Série (ADR-0062 e ADR-0064).
 */
import { CAEM_POR_GRUPO, GRUPOS, GRUPOS_DA_A_DE_16, SERIES, sqlRodadaDaFinal, TIMES_FUNDADORES, TIMES_NOVOS, TIMES_POR_SERIE, TIMES_QUE_TROCAM_DE_SERIE, type Grupo, type Serie, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';

export type SeriesDaTemporada = Readonly<Record<Serie, readonly TimeId[]>>;
export type GruposDaTemporada = Readonly<Record<Grupo, readonly TimeId[]>>;

/**
 * A Rodada da Final em SQL, para uma Rodada `r` (alias): 2 depois da última Rodada da Fase de
 * Liga da mesma Temporada (3 com 14 Rodadas, ADR-0062).
 */
export const SQL_RODADA_DA_FINAL = (r = 'r') =>
  `(SELECT ${sqlRodadaDaFinal('max(x.numero)')} FROM rodada x WHERE x.temporada_id = ${r}.temporada_id AND x.fase = 'LIGA')`;

/**
 * Time Primo na Série B de cada Time da A (ADR-0058): para onde vai o novato que pede um Time
 * da A já cheio. Cada Clássico da B é Primo de dois Clássicos da A.
 */
export const PRIMO_NA_B: Readonly<Partial<Record<TimeId, TimeId>>> = {
  CAP: 'QUA', LOB: 'QUA',
  ONC: 'GAM', LEA: 'GAM',
  TAT: 'JAB', SUC: 'JAB',
  TAM: 'TEI', JAC: 'TEI',
  PRE: 'ARI', BOT: 'ARI',
  SAG: 'ANT', TAR: 'ANT',
  TUC: 'SER', COR: 'SER',
  ARA: 'BUG', BES: 'BUG',
};

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
  const s = (await seriesAtivas(banco)).series;
  return [...s.A, ...s.B];
}

/** As Séries da Temporada que aceita Inscrição agora (a mesma regra de `timesAtivos`). */
export async function seriesAtivas(banco: Banco): Promise<{ numero: number | null; series: SeriesDaTemporada }> {
  const t = (
    await banco.query<{ id: number; numero: number }>(
      `SELECT id, numero FROM temporada ORDER BY (status = 'EM_ANDAMENTO') DESC, (status = 'PRE_TEMPORADA') DESC, numero DESC LIMIT 1`,
    )
  ).rows[0];
  if (!t) return { numero: null, series: { A: [...TIMES_FUNDADORES], B: [] } };
  return { numero: t.numero, series: await seriesDaTemporada(banco, t.id) };
}

/**
 * Os Grupos de uma Temporada com a Série A de 16 e sem B (ADR-0064): os fixos
 * (`GRUPOS_DA_A_DE_16`), com os Clássicos juntos. null nas outras.
 */
export function gruposPara(s: SeriesDaTemporada): GruposDaTemporada | null {
  if (s.B.length || s.A.length <= TIMES_POR_SERIE.A) return null;
  const todos = new Set(s.A);
  const g = Object.fromEntries(GRUPOS.map((x) => [x, GRUPOS_DA_A_DE_16[x].filter((t) => todos.has(t))])) as Record<Grupo, TimeId[]>;
  if (GRUPOS.reduce((n, x) => n + g[x].length, 0) !== s.A.length) throw new Error('Algum Time da A de 16 está fora dos Grupos');
  return g;
}

/** Os Grupos de uma Temporada (null se ela não tem Grupos). */
export async function gruposDaTemporada(banco: Banco, temporadaId: number): Promise<GruposDaTemporada | null> {
  const linhas = (
    await banco.query<{ time_id: TimeId; grupo: Grupo }>(`SELECT time_id, grupo FROM serie_do_time WHERE temporada_id = $1 AND grupo IS NOT NULL ORDER BY time_id`, [temporadaId])
  ).rows;
  if (!linhas.length) return null;
  return Object.fromEntries(GRUPOS.map((g) => [g, linhas.filter((l) => l.grupo === g).map((l) => l.time_id)])) as Record<Grupo, TimeId[]>;
}

/** Grava as Séries de uma Temporada (e os Grupos, quando há). */
export async function gravarSeries(banco: Banco, temporadaId: number, s: SeriesDaTemporada, grupos: GruposDaTemporada | null = gruposPara(s)): Promise<void> {
  const grupoDe = (t: TimeId) => (grupos ? (GRUPOS.find((g) => grupos[g].includes(t)) ?? null) : null);
  for (const serie of SERIES) {
    for (const time of s[serie]) {
      await banco.query(
        `INSERT INTO serie_do_time (temporada_id, time_id, serie, grupo) VALUES ($1, $2, $3, $4)
         ON CONFLICT (temporada_id, time_id) DO UPDATE SET serie = EXCLUDED.serie, grupo = EXCLUDED.grupo`,
        [temporadaId, time, serie, grupoDe(time)],
      );
    }
  }
}

/**
 * As Séries da Temporada seguinte à `anteriorId` (ADR-0017, ADR-0058 e ADR-0062):
 * - depois da Temporada 1 (8 Times, uma Série só), ninguém desce: os fundadores e os 8 Times
 *   que chegam formam a Série A de 16, sem Série B;
 * - depois de uma Temporada com a A de 16 em Grupos (a T2, ADR-0064), os 4 últimos de cada
 *   Grupo caem e formam a Série B; os 4 primeiros de cada Grupo ficam na A;
 * - depois de uma Temporada com as duas Séries, os 2 últimos da Fase de Liga da A descem e os 2
 *   finalistas do Mata-mata da B sobem (precisa da Final da B já disputada).
 */
export async function seriesDaProximaTemporada(
  banco: Banco,
  anteriorId: number,
  classificacaoDaLiga: (serie: Serie, grupo?: Grupo) => Promise<TimeId[]>,
): Promise<SeriesDaTemporada> {
  const s = await seriesDaTemporada(banco, anteriorId);
  if (!s.B.length && s.A.length <= TIMES_FUNDADORES.length) return { A: [...TIMES_FUNDADORES, ...TIMES_NOVOS].sort(), B: [] };

  if (!s.B.length) {
    const caem: TimeId[] = [];
    for (const g of GRUPOS) caem.push(...(await classificacaoDaLiga('A', g)).slice(-CAEM_POR_GRUPO));
    return { A: s.A.filter((t) => !caem.includes(t)).sort(), B: [...caem].sort() };
  }

  const ordemA = await classificacaoDaLiga('A');

  const rebaixados = ordemA.slice(-TIMES_QUE_TROCAM_DE_SERIE);
  const finalistasB = await finalistas(banco, anteriorId, 'B');
  if (finalistasB.length !== TIMES_QUE_TROCAM_DE_SERIE) throw new Error(`A Final da Série B da Temporada ${anteriorId} ainda não existe`);

  const A = [...s.A.filter((t) => !rebaixados.includes(t)), ...finalistasB];
  const B = [...s.B.filter((t) => !finalistasB.includes(t)), ...rebaixados];
  if (A.length !== TIMES_POR_SERIE.A || B.length !== TIMES_POR_SERIE.B) throw new Error(`Séries desequilibradas: A ${A.length}, B ${B.length}`);
  return { A: A.sort(), B: B.sort() };
}

/** Os dois Times da Final de uma Série (vazio se a Final ainda não foi criada). */
export async function finalistas(banco: Banco, temporadaId: number, serie: Serie): Promise<TimeId[]> {
  const final = (
    await banco.query<{ mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE r.temporada_id = $1 AND r.fase = 'MATA_MATA' AND r.numero = ${SQL_RODADA_DA_FINAL()} AND p.serie = $2`,
      [temporadaId, serie],
    )
  ).rows[0];
  return final ? [final.mandante_id, final.visitante_id] : [];
}

/** O vencedor de uma Partida já simulada (pênaltis incluídos), ou null. */
export function vencedorDe(res: ResultadoPartida | null | undefined): TimeId | null {
  return res?.vencedor ? (res.times[res.vencedor] as TimeId) : null;
}
