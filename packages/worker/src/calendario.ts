/**
 * Calendário da Temporada (GLOSSARY: Fase de Liga, Rodada, Apito Inicial, Série).
 * Turno único entre os 8 Times de cada Série em 7 Rodadas, uma por dia. Com uma Série só, as
 * Partidas são às 12h, 14h, 16h e 18h. Com duas Séries, cada Partida tem o seu horário, de hora
 * em hora: a B das 11h às 14h e a A das 15h às 18h (ADR-0050).
 * O Mata-mata é criado depois, quando a Fase de Liga termina.
 */
import { TIMES_FUNDADORES, type Serie, type TimeId } from '@liga/shared';
import { criarRng } from '@liga/sim';
import type { Banco } from './banco.js';
import { gravarSeries, seriesDaProximaTemporada, seriesComTimes, type SeriesDaTemporada } from './series.js';
import { tabela } from './tabela.js';

export const HORARIOS = [12, 14, 16, 18] as const;
/** Com duas Séries (ADR-0050): a B joga antes, a A fecha o dia. */
export const HORARIOS_COM_SERIES: Record<Serie, readonly number[]> = { B: [11, 12, 13, 14], A: [15, 16, 17, 18] };

/** Horários da Fase de Liga de uma Série. */
export function horariosDaLiga(serie: Serie, comSeries: boolean): readonly number[] {
  return comSeries ? HORARIOS_COM_SERIES[serie] : HORARIOS;
}
/** Brasília é UTC−3, sem horário de verão. */
export const FUSO_BRASILIA = -3;

export interface Confronto {
  mandante: TimeId;
  visitante: TimeId;
}

/**
 * Turno único pelo método do círculo: em cada Rodada todo Time joga uma vez, cada par se
 * enfrenta uma única vez e os mandos ficam equilibrados (3 ou 4 em casa). A ordem dos Times
 * e dos horários é sorteada pelo seed, então os Clássicos caem em qualquer Rodada.
 */
export function faseDeLiga(seed: number, timesDaSerie: readonly TimeId[] = TIMES_FUNDADORES): Confronto[][] {
  // A escolha gulosa dos mandos falha em raros sorteios; aí tenta uma variação do seed.
  for (let tentativa = 0; ; tentativa++) {
    const rodadas = gerarTurno((seed + tentativa * 7919) >>> 0, timesDaSerie);
    const emCasa = new Map<TimeId, number>();
    for (const jogos of rodadas) for (const j of jogos) emCasa.set(j.mandante, (emCasa.get(j.mandante) ?? 0) + 1);
    if (emCasa.size === timesDaSerie.length && [...emCasa.values()].every((n) => n === 3 || n === 4)) return rodadas;
  }
}

function gerarTurno(seed: number, timesDaSerie: readonly TimeId[]): Confronto[][] {
  const rng = criarRng(seed);
  // Ordem fixa antes do sorteio: o calendário depende só do seed e de quais Times jogam.
  const times = [...timesDaSerie].sort();
  for (let i = times.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [times[i], times[j]] = [times[j]!, times[i]!];
  }
  const n = times.length;
  const rodadas: Confronto[][] = [];
  const emCasa = new Map<TimeId, number>(times.map((t) => [t, 0]));
  const ultimoEmCasa = new Map<TimeId, boolean>();
  let roda = times.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const atual = [times[0]!, ...roda];
    const jogos: Confronto[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = atual[i]!;
      const b = atual[n - 1 - i]!;
      // Manda quem tem menos jogos em casa; empate: quem jogou fora na Rodada anterior.
      const ca = emCasa.get(a)!;
      const cb = emCasa.get(b)!;
      const aEmCasa = ca !== cb ? ca < cb : ultimoEmCasa.get(a) === ultimoEmCasa.get(b) ? rng.next() < 0.5 : !ultimoEmCasa.get(a);
      const [m, v] = aEmCasa ? [a, b] : [b, a];
      emCasa.set(m, emCasa.get(m)! + 1);
      ultimoEmCasa.set(m, true);
      ultimoEmCasa.set(v, false);
      jogos.push({ mandante: m, visitante: v });
    }
    // Ordem dos horários sorteada.
    for (let i = jogos.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [jogos[i], jogos[j]] = [jogos[j]!, jogos[i]!];
    }
    rodadas.push(jogos);
    roda = [roda[roda.length - 1]!, ...roda.slice(0, -1)];
  }
  return rodadas;
}

/** Apito Inicial em UTC para um dia (AAAA-MM-DD) e uma hora de Brasília. */
export function apitoInicial(dia: string, horaBrasilia: number): Date {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d, horaBrasilia - FUSO_BRASILIA));
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Seed do calendário de cada Série: a A usa o seed da Temporada (como antes das Séries). */
function seedDaSerie(seed: number, serie: Serie): number {
  return serie === 'A' ? seed : (seed ^ 0x5bd1e995) >>> 0;
}

/**
 * Cria a Temporada com as 7 Rodadas da Fase de Liga a partir de `primeiraRodada`.
 *
 * As Séries vêm de `o.series` ou, se não vierem, da Temporada anterior (Acesso e
 * Rebaixamento, ADR-0017). A Temporada 1 não tem Séries: só os fundadores, na A.
 */
export async function criarTemporada(banco: Banco, o: { numero: number; primeiraRodada: string; seed: number; series?: SeriesDaTemporada }): Promise<number> {
  return banco.transacao(async (b) => {
    let series = o.series ?? null;
    if (!series) {
      const anterior = (await b.query<{ id: number }>(`SELECT id FROM temporada WHERE numero = $1`, [o.numero - 1])).rows[0];
      if (anterior) series = await seriesDaProximaTemporada(b, anterior.id, async (serie) => (await tabela(b, anterior.id, serie)).map((l) => l.time));
    }
    const temporadaId = (
      await b.query<{ id: number }>(`INSERT INTO temporada (numero, inicio) VALUES ($1, $2) RETURNING id`, [o.numero, o.primeiraRodada])
    ).rows[0]!.id;
    if (series) await gravarSeries(b, temporadaId, series);
    const quais = series ? seriesComTimes(series) : (['A'] as Serie[]);
    const comSeries = quais.includes('B');
    const calendarios = quais.map((serie) => ({ serie, rodadas: faseDeLiga(seedDaSerie(o.seed, serie), series ? series[serie] : TIMES_FUNDADORES) }));
    const totalDeRodadas = calendarios[0]!.rodadas.length;
    for (let r = 0; r < totalDeRodadas; r++) {
      const dia = somarDias(o.primeiraRodada, r);
      const rodadaId = (
        await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'LIGA', $3) RETURNING id`, [temporadaId, r + 1, dia])
      ).rows[0]!.id;
      for (const { serie, rodadas } of calendarios) {
        for (const [k, j] of rodadas[r]!.entries()) {
          await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie) VALUES ($1, $2, $3, $4, $5)`, [
            rodadaId,
            j.mandante,
            j.visitante,
            apitoInicial(dia, horariosDaLiga(serie, comSeries)[k]!).toISOString(),
            serie,
          ]);
        }
      }
    }
    return temporadaId;
  });
}
