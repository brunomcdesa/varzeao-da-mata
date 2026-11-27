/**
 * Calendário da Temporada (GLOSSARY: Fase de Liga, Rodada, Apito Inicial, Série).
 * Uma Rodada por dia. Com uma Série só (T1), turno único entre os 8 Times em 7 Rodadas, às 12h,
 * 14h, 16h e 18h. Na T2, só a Série A de 16, em dois Grupos de 8 (ADR-0064): turno único dentro
 * de cada Grupo em 7 Rodadas, 8 jogos por dia, um por hora das 11h às 18h. Da T3 em diante, as
 * duas Séries de 8 em turno único. Com duas Séries, a B joga das 11h às 14h e a A das 15h às 18h (ADR-0050); com
 * 16 Times na A (ADR-0058), ela faz turno único em 15 Rodadas com dois jogos por horário, e a B
 * (8 Times) faz turno e returno em 14 Rodadas, para as duas terminarem juntas.
 * O Mata-mata é criado depois, quando a Fase de Liga termina.
 */
import { DIAS_DA_COPA, DIAS_DA_SUPERCOPA_ANTES_DA_COPA, GRUPOS, HORA_DA_SUPERCOPA, RODADA_DA_SUPERCOPA, TIMES_FUNDADORES, temCopa, temMoedas, type Serie, type TimeId } from '@liga/shared';
import { criarRng } from '@liga/sim';
import type { Banco } from './banco.js';
import { gravarSeries, gruposPara, seriesDaProximaTemporada, seriesComTimes, type GruposDaTemporada, type SeriesDaTemporada } from './series.js';
import { tabela } from './tabela.js';
import { cabeACopa, criarOitavas, formatoDaCopa } from './copa.js';
import { pagarBonusDeLargada } from './moedas.js';
import { timesDaSupercopa } from './supercopa.js';

export const HORARIOS = [12, 14, 16, 18] as const;
/** Com duas Séries (ADR-0050): a B joga antes, a A fecha o dia. */
export const HORARIOS_COM_SERIES: Record<Serie, readonly number[]> = { B: [11, 12, 13, 14], A: [15, 16, 17, 18] };

/** Séries de 10 depois da Expansão (ADR-0093): 10 jogos por dia, um por hora das 9h às 18h. */
export const HORARIOS_COM_SERIES_DE_10: Record<Serie, readonly number[]> = { B: [9, 10, 11, 12, 13], A: [14, 15, 16, 17, 18] };

/** A Série A de 16 em Grupos (T2, ADR-0062 e ADR-0064): 8 jogos por Rodada, um por hora. */
export const HORARIOS_DA_A_DE_16 = [11, 12, 13, 14, 15, 16, 17, 18] as const;

/**
 * Horários da Fase de Liga de uma Série, um por jogo da Rodada. Sem Série B e com 8 jogos (a A de
 * 16, ADR-0062), um jogo por hora das 11h às 18h. Com mais jogos que horários, cada horário recebe
 * mais de um jogo ao mesmo tempo (ADR-0058).
 */
export function horariosDaLiga(serie: Serie, comSeries: boolean, jogos = 4): readonly number[] {
  // Séries de 10 (Expansão, ADR-0093): um jogo por hora, a B das 9h às 13h e a A das 14h às 18h.
  if (comSeries && jogos === 5) return HORARIOS_COM_SERIES_DE_10[serie];
  const base = comSeries ? HORARIOS_COM_SERIES[serie] : jogos > HORARIOS.length ? HORARIOS_DA_A_DE_16 : HORARIOS;
  const porHorario = Math.ceil(jogos / base.length);
  return base.flatMap((h) => Array<number>(porHorario).fill(h)).slice(0, Math.max(jogos, base.length));
}
/** Brasília é UTC−3, sem horário de verão. */
export const FUSO_BRASILIA = -3;

export interface Confronto {
  mandante: TimeId;
  visitante: TimeId;
}

/**
 * Turno único pelo método do círculo: em cada Rodada todo Time joga uma vez, cada par se
 * enfrenta uma única vez e os mandos ficam equilibrados (com 8 Times, 3 ou 4 em casa; com 16,
 * 7 ou 8). A ordem dos Times e dos horários é sorteada pelo seed, então os Clássicos caem em
 * qualquer Rodada.
 */
export function faseDeLiga(seed: number, timesDaSerie: readonly TimeId[] = TIMES_FUNDADORES): Confronto[][] {
  const metade = (timesDaSerie.length - 1) / 2;
  // A escolha gulosa dos mandos falha em raros sorteios; aí tenta uma variação do seed.
  for (let tentativa = 0; ; tentativa++) {
    const rodadas = gerarTurno((seed + tentativa * 7919) >>> 0, timesDaSerie);
    const emCasa = new Map<TimeId, number>();
    for (const jogos of rodadas) for (const j of jogos) emCasa.set(j.mandante, (emCasa.get(j.mandante) ?? 0) + 1);
    if (emCasa.size === timesDaSerie.length && [...emCasa.values()].every((n) => n === Math.floor(metade) || n === Math.ceil(metade))) return rodadas;
  }
}

/**
 * Turno e returno (ADR-0058): o turno único e, depois, os mesmos confrontos com o mando
 * trocado. Todo Time joga em casa e fora contra cada adversário.
 */
export function turnoEReturno(seed: number, timesDaSerie: readonly TimeId[]): Confronto[][] {
  const turno = faseDeLiga(seed, timesDaSerie);
  return [...turno, ...turno.map((jogos) => jogos.map((j) => ({ mandante: j.visitante, visitante: j.mandante })))];
}

/**
 * Turno único dentro de cada Grupo (ADR-0064), as Rodadas dos dois Grupos juntas: em cada Rodada,
 * os jogos se alternam entre os Grupos (Barro, Galho, Barro, Galho...).
 */
export function faseDeGrupos(seed: number, grupos: GruposDaTemporada): Confronto[][] {
  const porGrupo = GRUPOS.map((g, k) => faseDeLiga((seed ^ (0x9e3779b9 * (k + 1))) >>> 0, grupos[g]));
  return porGrupo[0]!.map((_, r) => porGrupo[0]![r]!.flatMap((j, i) => [j, ...porGrupo.slice(1).map((pg) => pg[r]![i]!)]));
}

/**
 * O calendário de cada Série: turno único; a Série menor faz turno e returno quando o turno
 * dela cabe duas vezes no turno da maior (a B, com 8 Times, ao lado da A com 16, ADR-0058). Com
 * Grupos (T2, ADR-0064), a A joga turno único dentro de cada Grupo.
 */
export function calendariosDasSeries(seed: number, quais: readonly Serie[], timesDe: (s: Serie) => readonly TimeId[], grupos: GruposDaTemporada | null = null): { serie: Serie; rodadas: Confronto[][] }[] {
  const maior = Math.max(...quais.map((s) => timesDe(s).length - 1));
  return quais.map((serie) => {
    if (grupos && serie === 'A') return { serie, rodadas: faseDeGrupos(seed, grupos) };
    const times = timesDe(serie);
    const duasVezes = 2 * (times.length - 1) <= maior;
    return { serie, rodadas: duasVezes ? turnoEReturno(seedDaSerie(seed, serie), times) : faseDeLiga(seedDaSerie(seed, serie), times) };
  });
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
 * Cria a Temporada com as Rodadas da Fase de Liga (7: turno único entre 8 Times, ou em cada Grupo) a partir de
 * `primeiraRodada`.
 *
 * As Séries vêm de `o.series` ou, se não vierem, da Temporada anterior (Acesso e
 * Rebaixamento, ADR-0017). A Temporada 1 não tem Séries: só os fundadores, na A.
 */
export async function criarTemporada(banco: Banco, o: { numero: number; primeiraRodada: string; seed: number; series?: SeriesDaTemporada }): Promise<number> {
  return banco.transacao(async (b) => {
    let series = o.series ?? null;
    if (!series) {
      const anterior = (await b.query<{ id: number }>(`SELECT id FROM temporada WHERE numero = $1`, [o.numero - 1])).rows[0];
      if (anterior) series = await seriesDaProximaTemporada(b, anterior.id, async (serie, grupo) => (await tabela(b, anterior.id, serie, grupo)).map((l) => l.time));
    }
    const temporadaId = (
      await b.query<{ id: number }>(`INSERT INTO temporada (numero, inicio) VALUES ($1, $2) RETURNING id`, [o.numero, o.primeiraRodada])
    ).rows[0]!.id;
    const grupos = series ? gruposPara(series) : null;
    if (series) await gravarSeries(b, temporadaId, series, grupos);
    const quais = series ? seriesComTimes(series) : (['A'] as Serie[]);
    const comSeries = quais.includes('B');
    const calendarios = calendariosDasSeries(o.seed, quais, (serie) => (series ? series[serie] : TIMES_FUNDADORES), grupos);
    const totalDeRodadas = Math.max(...calendarios.map((c) => c.rodadas.length));
    // Copa A+B (ADR-0088): da T3 em diante, os 3 primeiros dias são dela; a Fase de Liga vem depois.
    const comCopa = temCopa(o.numero) && !!series && comSeries && cabeACopa([...series.A, ...series.B]);
    if (comCopa) await criarOitavas(b, temporadaId, o.primeiraRodada, (t) => (series!.B.includes(t) ? 'B' : 'A'), formatoDaCopa([...series!.A, ...series!.B])!);
    // Supercopa (ADR-0118): campeão da Série A × campeão da Copa da anterior, 2 dias antes da Copa (o domingo).
    if (comCopa) await criarSupercopa(b, temporadaId, o.numero, o.primeiraRodada);
    const inicioDaLiga = comCopa ? somarDias(o.primeiraRodada, DIAS_DA_COPA) : o.primeiraRodada;
    // Moedas (ADR-0087): a primeira Temporada com elas abre a Loja com o bônus de largada dos veteranos.
    if (temMoedas(o.numero) && !temMoedas(o.numero - 1)) await pagarBonusDeLargada(b, new Date());
    for (let r = 0; r < totalDeRodadas; r++) {
      const dia = somarDias(inicioDaLiga, r);
      const rodadaId = (
        await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'LIGA', $3) RETURNING id`, [temporadaId, r + 1, dia])
      ).rows[0]!.id;
      for (const { serie, rodadas } of calendarios) {
        // A Série com menos Rodadas (a B, na T2) folga nos últimos dias da Fase de Liga.
        if (!rodadas[r]) continue;
        const horarios = horariosDaLiga(serie, comSeries, rodadas[r]!.length);
        for (const [k, j] of rodadas[r]!.entries()) {
          await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie) VALUES ($1, $2, $3, $4, $5)`, [
            rodadaId,
            j.mandante,
            j.visitante,
            apitoInicial(dia, horarios[k]!).toISOString(),
            serie,
          ]);
        }
      }
    }
    return temporadaId;
  });
}

/**
 * Cria a Supercopa (dentro da criação da Temporada): Rodada 100 no dia `DIAS_DA_SUPERCOPA_ANTES_DA_COPA`
 * antes do primeiro dia da Copa, às 18h. O campeão da Série A manda o jogo.
 */
export async function criarSupercopa(b: Banco, temporadaId: number, numero: number, primeiroDiaDaCopa: string): Promise<boolean> {
  const times = await timesDaSupercopa(b, numero);
  if (!times) return false;
  const dia = somarDias(primeiroDiaDaCopa, -DIAS_DA_SUPERCOPA_ANTES_DA_COPA);
  const rodadaId = (
    await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', $3) RETURNING id`, [temporadaId, RODADA_DA_SUPERCOPA, dia])
  ).rows[0]!.id;
  const serie = (await b.query<{ serie: 'A' | 'B' }>(`SELECT serie FROM serie_do_time WHERE temporada_id = $1 AND time_id = $2`, [temporadaId, times[0]])).rows[0]?.serie ?? 'A';
  await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie, copa_etapa) VALUES ($1, $2, $3, $4, $5, 'SUPERCOPA')`, [
    rodadaId,
    times[0],
    times[1],
    apitoInicial(dia, HORA_DA_SUPERCOPA).toISOString(),
    serie,
  ]);
  return true;
}
