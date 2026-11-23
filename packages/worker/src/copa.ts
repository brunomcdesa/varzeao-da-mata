/**
 * Copa A+B (ADR-0088): criação das Oitavas de Clássico junto com a Temporada e avanço da chave
 * (Quartas, Semifinais, Final). `avancarCopa` é idempotente: os jobs chamam sempre que podem e
 * ela só faz o próximo passo quando a etapa anterior terminou.
 */
import {
  ETAPAS_DA_COPA_DE_16,
  ETAPAS_DA_COPA_DE_20,
  FASE_DO_CLASSICO,
  HORARIOS_DA_COPA,
  HORARIOS_DA_COPA_DE_20,
  MESMO_DIA_DA_ANTERIOR,
  OITAVAS_DE_CLASSICO,
  RODADA_DA_COPA,
  RODADA_DA_ETAPA,
  RODADA_DA_ETAPA_DE_20,
  mandanteDaCopa,
  proximaEtapa,
  quartasComRepescagem,
  repescagemDaCopa,
  type EtapaDaCopa,
  type TimeId,
} from '@liga/shared';
import { tabela } from './tabela.js';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { apitoInicial, somarDias } from './calendario.js';
import { pagarTituloDaCopa } from './moedas.js';

export type PassoDaCopa = 'NADA' | 'REPESCAGEM_CRIADA' | 'QUARTAS_CRIADAS' | 'SEMIFINAIS_CRIADAS' | 'FINAL_CRIADA' | 'COPA_ENCERRADA';

/** O formato da Copa pelos Times: 16 (Oitavas de Clássico) ou 20 (Fase do Clássico, ADR-0093). */
export function formatoDaCopa(times: readonly TimeId[]): 16 | 20 | null {
  const todos = new Set(times);
  if (todos.size === 16 && OITAVAS_DE_CLASSICO.every(([a, b]) => todos.has(a) && todos.has(b))) return 16;
  if (todos.size === 20 && FASE_DO_CLASSICO.every(([a, b]) => todos.has(a) && todos.has(b))) return 20;
  return null;
}
/** Os Times das duas Séries têm a chave de uma das Copas; senão, sem Copa. */
export const cabeACopa = (times: readonly TimeId[]): boolean => formatoDaCopa(times) !== null;

const PRIMEIRA: Record<16 | 20, EtapaDaCopa> = { 16: 'OITAVAS', 20: 'CLASSICO' };
const JOGOS_DA_PRIMEIRA = { 16: OITAVAS_DE_CLASSICO, 20: FASE_DO_CLASSICO };
const HORARIOS = { 16: HORARIOS_DA_COPA, 20: HORARIOS_DA_COPA_DE_20 };
const RODADAS = { 16: RODADA_DA_ETAPA, 20: RODADA_DA_ETAPA_DE_20 };
const ETAPAS = { 16: ETAPAS_DA_COPA_DE_16, 20: ETAPAS_DA_COPA_DE_20 };

/** Cria a primeira etapa da Copa (dia `dia`) dentro da transação da criação da Temporada. */
export async function criarOitavas(b: Banco, temporadaId: number, dia: string, serieDe: (t: TimeId) => 'A' | 'B', formato: 16 | 20 = 16): Promise<void> {
  const rodadaId = await rodadaDaCopa(b, temporadaId, RODADA_DA_COPA.OITAVAS, dia);
  for (const [k, [a, c]] of JOGOS_DA_PRIMEIRA[formato].entries()) await inserir(b, rodadaId, PRIMEIRA[formato], k, dia, mandanteDaCopa(a, c, serieDe), serieDe, HORARIOS[formato]);
}

/**
 * Os Times da melhor para a pior campanha na Temporada anterior (ADR-0093): primeiro a Série A
 * pela tabela da Fase de Liga, depois a B; quem não jogou a anterior (Time novo) fica no fim.
 */
export async function ordemDaTemporadaAnterior(b: Banco, temporadaId: number, times: readonly TimeId[]): Promise<TimeId[]> {
  const ant = (
    await b.query<{ id: number }>(`SELECT a.id FROM temporada a JOIN temporada t ON t.numero = a.numero + 1 WHERE t.id = $1`, [temporadaId])
  ).rows[0];
  const ordem: TimeId[] = [];
  if (ant) for (const serie of ['A', 'B'] as const) ordem.push(...(await tabela(b, ant.id, serie)).map((l) => l.time));
  const pos = (t: TimeId) => (ordem.includes(t) ? ordem.indexOf(t) : ordem.length + times.indexOf(t));
  return [...times].sort((x, y) => pos(x) - pos(y));
}

async function rodadaDaCopa(b: Banco, temporadaId: number, numero: number, dia: string): Promise<number> {
  const existente = (await b.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = $2`, [temporadaId, numero])).rows[0];
  if (existente) return existente.id;
  return (await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', $3) RETURNING id`, [temporadaId, numero, dia])).rows[0]!.id;
}

async function inserir(b: Banco, rodadaId: number, etapa: EtapaDaCopa, k: number, dia: string, [m, v]: readonly [TimeId, TimeId], serieDe: (t: TimeId) => 'A' | 'B', horarios: Record<EtapaDaCopa, readonly number[]> = HORARIOS_DA_COPA): Promise<void> {
  await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie, copa_etapa) VALUES ($1, $2, $3, $4, $5, $6)`, [
    rodadaId,
    m,
    v,
    apitoInicial(dia, horarios[etapa][k]!).toISOString(),
    serieDe(m),
    etapa,
  ]);
}

interface JogoDaCopa {
  etapa: EtapaDaCopa;
  data: string | Date;
  apito: Date | string;
  resultado: ResultadoPartida | null;
}

const diaTexto = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export async function avancarCopa(banco: Banco, temporadaId: number): Promise<PassoDaCopa> {
  return banco.transacao(async (b) => {
    const jogos = (
      await b.query<JogoDaCopa>(
        `SELECT p.copa_etapa AS etapa, r.data, p.apito_inicial AS apito, p.resultado FROM partida p JOIN rodada r ON r.id = p.rodada_id
         WHERE r.temporada_id = $1 AND p.copa_etapa IS NOT NULL ORDER BY p.apito_inicial`,
        [temporadaId],
      )
    ).rows;
    if (!jogos.length) return 'NADA';
    const series = new Map(
      (await b.query<{ time_id: TimeId; serie: 'A' | 'B' }>(`SELECT time_id, serie FROM serie_do_time WHERE temporada_id = $1`, [temporadaId])).rows.map((x) => [x.time_id, x.serie] as const),
    );
    const serieDe = (t: TimeId) => series.get(t) ?? 'A';
    const da = (e: EtapaDaCopa) => jogos.filter((j) => j.etapa === e);
    const formato: 16 | 20 = da('CLASSICO').length ? 20 : 16;
    const etapas = ETAPAS[formato];
    // A última etapa que já existe.
    const atual = [...etapas].reverse().find((e) => da(e).length)!;
    const desta = da(atual);
    if (!desta.every((j) => j.resultado?.vencedor)) return 'NADA';
    const venc = (j: JogoDaCopa) => j.resultado!.times[j.resultado!.vencedor!] as TimeId;
    const vencedores = desta.map(venc);
    const proxima = etapas[etapas.indexOf(atual) + 1];
    if (!proxima) {
      const r = await b.query(`UPDATE temporada SET campeao_copa_id = $2 WHERE id = $1 AND campeao_copa_id IS NULL RETURNING id`, [temporadaId, vencedores[0]]);
      if (!r.rows.length) return 'NADA';
      // Título da Copa (ADR-0088): 40 Moedas para quem jogou pelo campeão na Copa.
      await pagarTituloDaCopa(b, temporadaId);
      return 'COPA_ENCERRADA';
    }
    // Com 16: Quartas no dia seguinte às Oitavas, Semifinais no mesmo dia, Final no outro.
    // Com 20: Repescagem no dia seguinte à Fase do Clássico, Quartas no mesmo dia, Semifinais no
    // outro e a Final no mesmo dia delas.
    const diaDaAtual = diaTexto(desta[0]!.data);
    const dia = MESMO_DIA_DA_ANTERIOR[formato].has(proxima) ? diaDaAtual : somarDias(diaDaAtual, 1);
    let pares: (readonly [TimeId, TimeId])[];
    if (proxima === 'REPESCAGEM') {
      pares = repescagemDaCopa(await ordemDaTemporadaAnterior(b, temporadaId, vencedores));
    } else if (atual === 'REPESCAGEM') {
      const doClassico = await ordemDaTemporadaAnterior(b, temporadaId, da('CLASSICO').map(venc));
      pares = quartasComRepescagem(doClassico.slice(0, 6), [vencedores[0]!, vencedores[1]!]);
    } else {
      pares = proximaEtapa(vencedores);
    }
    const rodadaId = await rodadaDaCopa(b, temporadaId, RODADAS[formato][proxima], dia);
    for (const [k, par] of pares.entries()) await inserir(b, rodadaId, proxima, k, dia, mandanteDaCopa(par[0], par[1], serieDe), serieDe, HORARIOS[formato]);
    return proxima === 'REPESCAGEM' ? 'REPESCAGEM_CRIADA' : proxima === 'QUARTAS' ? 'QUARTAS_CRIADAS' : proxima === 'SEMIFINAL' ? 'SEMIFINAIS_CRIADAS' : 'FINAL_CRIADA';
  });
}

/**
 * Avança a Copa da Temporada que ainda não tem campeão da Copa (se houver). Os jobs `escalar` e
 * `resumo` chamam antes de procurar Partidas: as Semifinais nascem no mesmo dia das Quartas.
 */
export async function avancarCopaPendente(banco: Banco): Promise<PassoDaCopa> {
  const t = (
    await banco.query<{ id: number }>(
      `SELECT t.id FROM temporada t WHERE t.campeao_copa_id IS NULL
         AND EXISTS (SELECT 1 FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id AND p.copa_etapa IS NOT NULL)
       ORDER BY t.numero LIMIT 1`,
    )
  ).rows[0];
  return t ? avancarCopa(banco, t.id) : 'NADA';
}
