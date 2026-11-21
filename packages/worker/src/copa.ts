/**
 * Copa A+B (ADR-0088): criação das Oitavas de Clássico junto com a Temporada e avanço da chave
 * (Quartas, Semifinais, Final). `avancarCopa` é idempotente: os jobs chamam sempre que podem e
 * ela só faz o próximo passo quando a etapa anterior terminou.
 */
import {
  ETAPA_SEGUINTE,
  HORARIOS_DA_COPA,
  OITAVAS_DE_CLASSICO,
  RODADA_DA_COPA,
  RODADA_DA_ETAPA,
  mandanteDaCopa,
  proximaEtapa,
  type EtapaDaCopa,
  type TimeId,
} from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { apitoInicial, somarDias } from './calendario.js';
import { pagarTituloDaCopa } from './moedas.js';

export type PassoDaCopa = 'NADA' | 'QUARTAS_CRIADAS' | 'SEMIFINAIS_CRIADAS' | 'FINAL_CRIADA' | 'COPA_ENCERRADA';

/** Os 16 Times de duas Séries de 8 têm exatamente as Oitavas de Clássico; senão, sem Copa. */
export function cabeACopa(times: readonly TimeId[]): boolean {
  const todos = new Set(times);
  return todos.size === 16 && OITAVAS_DE_CLASSICO.every(([a, b]) => todos.has(a) && todos.has(b));
}

/** Cria a Rodada das Oitavas (dia `dia`) dentro da transação da criação da Temporada. */
export async function criarOitavas(b: Banco, temporadaId: number, dia: string, serieDe: (t: TimeId) => 'A' | 'B'): Promise<void> {
  const rodadaId = await rodadaDaCopa(b, temporadaId, RODADA_DA_COPA.OITAVAS, dia);
  for (const [k, [a, c]] of OITAVAS_DE_CLASSICO.entries()) await inserir(b, rodadaId, 'OITAVAS', k, dia, mandanteDaCopa(a, c, serieDe), serieDe);
}

async function rodadaDaCopa(b: Banco, temporadaId: number, numero: number, dia: string): Promise<number> {
  const existente = (await b.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND numero = $2`, [temporadaId, numero])).rows[0];
  if (existente) return existente.id;
  return (await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', $3) RETURNING id`, [temporadaId, numero, dia])).rows[0]!.id;
}

async function inserir(b: Banco, rodadaId: number, etapa: EtapaDaCopa, k: number, dia: string, [m, v]: readonly [TimeId, TimeId], serieDe: (t: TimeId) => 'A' | 'B'): Promise<void> {
  await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie, copa_etapa) VALUES ($1, $2, $3, $4, $5, $6)`, [
    rodadaId,
    m,
    v,
    apitoInicial(dia, HORARIOS_DA_COPA[etapa][k]!).toISOString(),
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
    // A última etapa que já existe.
    const atual = (['FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS'] as const).find((e) => da(e).length)!;
    const desta = da(atual);
    if (!desta.every((j) => j.resultado?.vencedor)) return 'NADA';
    const vencedores = desta.map((j) => j.resultado!.times[j.resultado!.vencedor!]);
    const proxima = ETAPA_SEGUINTE[atual];
    if (!proxima) {
      const r = await b.query(`UPDATE temporada SET campeao_copa_id = $2 WHERE id = $1 AND campeao_copa_id IS NULL RETURNING id`, [temporadaId, vencedores[0]]);
      if (!r.rows.length) return 'NADA';
      // Título da Copa (ADR-0088): 40 Moedas para quem jogou pelo campeão na Copa.
      await pagarTituloDaCopa(b, temporadaId);
      return 'COPA_ENCERRADA';
    }
    // Quartas no dia seguinte às Oitavas; Semifinais no mesmo dia das Quartas; Final no dia seguinte.
    const diaDaAtual = diaTexto(desta[0]!.data);
    const dia = proxima === 'SEMIFINAL' ? diaDaAtual : somarDias(diaDaAtual, 1);
    const rodadaId = await rodadaDaCopa(b, temporadaId, RODADA_DA_ETAPA[proxima], dia);
    for (const [k, par] of proximaEtapa(vencedores).entries()) await inserir(b, rodadaId, proxima, k, dia, mandanteDaCopa(par[0], par[1], serieDe), serieDe);
    return proxima === 'QUARTAS' ? 'QUARTAS_CRIADAS' : proxima === 'SEMIFINAL' ? 'SEMIFINAIS_CRIADAS' : 'FINAL_CRIADA';
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
