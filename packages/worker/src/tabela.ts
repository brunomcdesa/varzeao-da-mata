/**
 * Classificação da Fase de Liga: 3 pontos por vitória, 1 por empate. Desempate por
 * vitórias, saldo de gols, gols marcados e, por fim, sigla (para a ordem ser estável).
 */
import { TIMES, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';

export interface LinhaDaTabela {
  time: TimeId;
  jogos: number;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
}

export function classificar(partidas: { mandante: TimeId; visitante: TimeId; gm: number; gv: number }[]): LinhaDaTabela[] {
  const linhas = new Map<TimeId, LinhaDaTabela>(
    TIMES.map((t) => [t, { time: t, jogos: 0, pontos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0 }]),
  );
  for (const p of partidas) {
    for (const [time, pro, contra] of [
      [p.mandante, p.gm, p.gv],
      [p.visitante, p.gv, p.gm],
    ] as const) {
      const l = linhas.get(time)!;
      l.jogos++;
      l.golsPro += pro;
      l.golsContra += contra;
      l.saldo = l.golsPro - l.golsContra;
      if (pro > contra) {
        l.vitorias++;
        l.pontos += 3;
      } else if (pro === contra) {
        l.empates++;
        l.pontos += 1;
      } else l.derrotas++;
    }
  }
  return [...linhas.values()].sort(
    (a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro || a.time.localeCompare(b.time),
  );
}

export async function tabela(banco: Banco, temporadaId: number): Promise<LinhaDaTabela[]> {
  const partidas = (
    await banco.query<{ mandante: TimeId; visitante: TimeId; gm: number; gv: number }>(
      `SELECT p.mandante_id AS mandante, p.visitante_id AS visitante, p.gols_mandante AS gm, p.gols_visitante AS gv
       FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE r.temporada_id = $1 AND r.fase = 'LIGA' AND p.gols_mandante IS NOT NULL`,
      [temporadaId],
    )
  ).rows;
  return classificar(partidas);
}
