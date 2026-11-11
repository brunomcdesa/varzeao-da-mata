/**
 * Destaques por Posição (ADR-0041): busca os desempenhos da Rodada ou da Temporada e monta o
 * que o Resumo mostra. Só a partir da Temporada 2.
 */
import { destaquesDaRodada, destaquesDaTemporada, type Destaque, type DesempenhoParaDestaque, type Posicao, type Serie, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';

/** Primeira Temporada com Destaques por Posição. */
export const TEMPORADA_DOS_DESTAQUES = 2;

export interface DestaqueDoResumo {
  posicao: Posicao;
  serie?: Serie;
  username: string;
  time: TimeId;
  nota: number;
  numero: { valor: number; legenda: string };
}

type ComTime = DesempenhoParaDestaque & { time: TimeId };

/** Desempenhos das Partidas encerradas, com o Time em que cada um jogou. */
export function desempenhosDasPartidas(partidas: readonly { resultado: ResultadoPartida; serie: Serie }[], comSeries: boolean): ComTime[] {
  return partidas.flatMap(({ resultado, serie }) =>
    resultado.desempenhos.map((d) => ({
      jogadorId: d.jogadorId,
      posicao: d.posicao,
      nota: d.nota,
      gols: d.gols,
      assistencias: d.assistencias,
      desarmes: d.desarmes,
      bloqueios: d.bloqueios,
      defesas: d.defesas,
      golsSofridos: d.golsSofridos,
      time: resultado.times[d.slot.lado],
      ...(comSeries ? { serie } : {}),
    })),
  );
}

/**
 * Junta o @ e o Time de cada Destaque. O Time é o do último jogo dele na Posição (quem foi
 * transferido aparece pelo Time em que jogou).
 */
async function comNomes(banco: Banco, destaques: Destaque[], desempenhos: readonly ComTime[]): Promise<DestaqueDoResumo[]> {
  if (!destaques.length) return [];
  const ids = destaques.map((d) => d.jogadorId);
  const nomes = new Map(
    (await banco.query<{ id: string; username: string }>(`SELECT id::text AS id, username FROM jogador WHERE id = ANY($1::bigint[])`, [ids])).rows.map((r) => [r.id, r.username]),
  );
  return destaques.flatMap((d) => {
    const username = nomes.get(d.jogadorId);
    const ultimo = [...desempenhos].reverse().find((x) => x.jogadorId === d.jogadorId && x.posicao === d.posicao);
    if (!username || !ultimo) return [];
    return [{ posicao: d.posicao, ...(d.serie ? { serie: d.serie } : {}), username, time: ultimo.time, nota: d.nota, numero: d.numero }];
  });
}

async function partidasEncerradas(banco: Banco, filtro: { rodadaId: number } | { temporadaId: number }): Promise<{ resultado: ResultadoPartida; serie: Serie }[]> {
  const [onde, valor] = 'rodadaId' in filtro ? ['p.rodada_id = $1', filtro.rodadaId] : ['r.temporada_id = $1', filtro.temporadaId];
  return (
    await banco.query<{ resultado: ResultadoPartida; serie: Serie }>(
      `SELECT p.resultado, p.serie FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE ${onde} AND p.resultado IS NOT NULL AND p.gols_mandante IS NOT NULL ORDER BY p.apito_inicial`,
      [valor],
    )
  ).rows;
}

/** Destaques da Rodada, por Série. Vazio antes da T2. */
export async function destaquesDaRodadaNoBanco(banco: Banco, rodadaId: number, temporada: number, comSeries: boolean): Promise<DestaqueDoResumo[]> {
  if (temporada < TEMPORADA_DOS_DESTAQUES) return [];
  const ds = desempenhosDasPartidas(await partidasEncerradas(banco, { rodadaId }), comSeries);
  return comNomes(banco, destaquesDaRodada(ds), ds);
}

/** Destaques da Temporada (maior Nota média por Posição), por Série. Vazio antes da T2. */
export async function destaquesDaTemporadaNoBanco(banco: Banco, temporadaId: number, temporada: number, comSeries: boolean): Promise<DestaqueDoResumo[]> {
  if (temporada < TEMPORADA_DOS_DESTAQUES) return [];
  const ds = desempenhosDasPartidas(await partidasEncerradas(banco, { temporadaId }), comSeries);
  return comNomes(banco, destaquesDaTemporada(ds), ds);
}
