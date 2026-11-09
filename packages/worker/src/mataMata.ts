/**
 * Mata-mata: depois da 7ª Rodada, os 4 melhores da Fase de Liga jogam as Semifinais no dia
 * seguinte (1º × 4º às 14h, 2º × 3º às 16h) e a Final no
 * outro dia, às 18h. Empate em qualquer jogo do Mata-mata vai para os pênaltis. O melhor colocado é o mandante.
 * Com duas Séries, cada uma tem o seu Mata-mata, nos mesmos horários (ADR-0015).
 *
 * `avancarMataMata` é idempotente: o job `resumo` chama todo dia e ela só faz o próximo passo
 * quando ele está pronto.
 */
import { RODADA_DA_FINAL, RODADA_DAS_SEMIFINAIS, RODADAS_DA_LIGA, type Serie, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { apitoInicial } from './calendario.js';
import { seriesComTimes, seriesDaTemporada } from './series.js';
import { tabela } from './tabela.js';

export const HORARIOS_DAS_SEMIFINAIS = [14, 16] as const;
export const HORARIO_DA_FINAL = 18;

export type PassoDoMataMata = 'NADA' | 'SEMIFINAIS_CRIADAS' | 'FINAL_CRIADA' | 'TEMPORADA_ENCERRADA';

interface LinhaRodada {
  id: number;
  numero: number;
  data: string | Date;
  jogos: number;
  prontos: number;
}

const diaTexto = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
function diaSeguinte(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Campeão de uma Série na Temporada (null enquanto a Final não foi simulada). */
export async function campeao(banco: Banco, temporadaId: number, serie: Serie = 'A'): Promise<TimeId | null> {
  const r = (
    await banco.query<{ resultado: ResultadoPartida | null }>(
      `SELECT p.resultado FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = $2 AND p.serie = $3`,
      [temporadaId, RODADA_DA_FINAL, serie],
    )
  ).rows[0];
  const res = r?.resultado;
  return res?.vencedor ? res.times[res.vencedor] : null;
}

export async function avancarMataMata(banco: Banco, temporadaId: number): Promise<PassoDoMataMata> {
  return banco.transacao(async (b) => {
    const rodadas = (
      await b.query<LinhaRodada>(
        `SELECT r.id, r.numero, r.data, count(p.id)::int AS jogos, count(p.resultado)::int AS prontos
         FROM rodada r LEFT JOIN partida p ON p.rodada_id = r.id WHERE r.temporada_id = $1 GROUP BY r.id ORDER BY r.numero`,
        [temporadaId],
      )
    ).rows;
    const da = (n: number) => rodadas.find((r) => r.numero === n);
    const completa = (r: LinhaRodada | undefined) => !!r && r.jogos > 0 && r.prontos === r.jogos;

    if (rodadas.some((r) => r.prontos > 0)) await b.query(`UPDATE temporada SET status = 'EM_ANDAMENTO' WHERE id = $1 AND status = 'PRE_TEMPORADA'`, [temporadaId]);

    const series = seriesComTimes(await seriesDaTemporada(b, temporadaId));
    const liga = rodadas.filter((r) => r.numero <= RODADAS_DA_LIGA);
    const semis = da(RODADA_DAS_SEMIFINAIS);
    const final = da(RODADA_DA_FINAL);

    if (!semis) {
      if (liga.length < RODADAS_DA_LIGA || !liga.every(completa)) return 'NADA';
      const dia = diaSeguinte(diaTexto(da(RODADAS_DA_LIGA)!.data));
      const id = (
        await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', $3) RETURNING id`, [temporadaId, RODADA_DAS_SEMIFINAIS, dia])
      ).rows[0]!.id;
      for (const serie of series) {
        const t = await tabela(b, temporadaId, serie);
        const [p1, p2, p3, p4] = t.map((l) => l.time) as [TimeId, TimeId, TimeId, TimeId];
        for (const [k, [m, v]] of ([[p1, p4], [p2, p3]] as const).entries()) {
          await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie) VALUES ($1, $2, $3, $4, $5)`, [
            id,
            m,
            v,
            apitoInicial(dia, HORARIOS_DAS_SEMIFINAIS[k]!).toISOString(),
            serie,
          ]);
        }
      }
      return 'SEMIFINAIS_CRIADAS';
    }

    if (!final) {
      if (!completa(semis)) return 'NADA';
      const dia = diaSeguinte(diaTexto(semis.data));
      const id = (
        await b.query<{ id: number }>(`INSERT INTO rodada (temporada_id, numero, fase, data) VALUES ($1, $2, 'MATA_MATA', $3) RETURNING id`, [temporadaId, RODADA_DA_FINAL, dia])
      ).rows[0]!.id;
      for (const serie of series) {
        const jogos = (
          await b.query<{ resultado: ResultadoPartida }>(`SELECT resultado FROM partida WHERE rodada_id = $1 AND serie = $2 ORDER BY apito_inicial`, [semis.id, serie])
        ).rows.map((r) => r.resultado.times[r.resultado.vencedor!]);
        // Manda o jogo quem terminou a Fase de Liga mais bem colocado.
        const ordem = (await tabela(b, temporadaId, serie)).map((l) => l.time);
        const [m, v] = [...jogos].sort((a, c) => ordem.indexOf(a) - ordem.indexOf(c)) as [TimeId, TimeId];
        await b.query(`INSERT INTO partida (rodada_id, mandante_id, visitante_id, apito_inicial, serie) VALUES ($1, $2, $3, $4, $5)`, [
          id,
          m,
          v,
          apitoInicial(dia, HORARIO_DA_FINAL).toISOString(),
          serie,
        ]);
      }
      return 'FINAL_CRIADA';
    }

    if (!completa(final)) return 'NADA';
    const campeaoId = await campeao(b, temporadaId, 'A');
    const campeaoB = series.includes('B') ? await campeao(b, temporadaId, 'B') : null;
    const r = await b.query(`UPDATE temporada SET status = 'ENCERRADA', campeao_id = $2, campeao_b_id = $3 WHERE id = $1 AND status <> 'ENCERRADA' RETURNING id`, [
      temporadaId,
      campeaoId,
      campeaoB,
    ]);
    return r.rows.length ? 'TEMPORADA_ENCERRADA' : 'NADA';
  });
}
