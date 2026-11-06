/**
 * Job `resumo` (18h10): fecha a Rodada com os Candidatos a Craque e junta o que o Reels
 * do Resumo da Rodada mostra: placares, tabela, Novos Contratados e Candidatos.
 */
import type { Posicao, TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FUSO_BRASILIA } from './calendario.js';
import type { DadosDoResumo } from '@liga/renderer';
import { tabela } from './tabela.js';

export const CANDIDATOS_POR_RODADA = 5;
/** Horário do Resumo da Rodada (Brasília): marca a virada de um dia de Inscrições para o outro. */
export const HORA_DO_RESUMO = 19;

export type { DadosDoResumo } from '@liga/renderer';

/** Candidatos a Craque: as 5 maiores Notas da Rodada entre Jogadores (a Base não concorre). */
export async function fecharRodada(banco: Banco, rodadaId: number): Promise<void> {
  await banco.query(
    `INSERT INTO candidato (rodada_id, jogador_id, nota)
     SELECT $1, e.jogador_id, max(e.nota)
     FROM escalacao e JOIN partida p ON p.id = e.partida_id
     WHERE p.rodada_id = $1 AND e.jogador_id IS NOT NULL AND e.nota IS NOT NULL
     GROUP BY e.jogador_id
     ORDER BY max(e.nota) DESC, e.jogador_id
     LIMIT $2
     ON CONFLICT DO NOTHING`,
    [rodadaId, CANDIDATOS_POR_RODADA],
  );
}

function horaBrasilia(d: Date): number {
  return (d.getUTCHours() + FUSO_BRASILIA + 24) % 24;
}

export async function dadosDoResumo(banco: Banco, rodadaId: number, o: { maxNovos?: number } = {}): Promise<DadosDoResumo> {
  const r = (
    await banco.query<{ temporada_id: number; temporada: number; numero: number; fase: 'LIGA' | 'MATA_MATA'; data: string | Date }>(
      `SELECT r.temporada_id, t.numero AS temporada, r.numero, r.fase, r.data FROM rodada r JOIN temporada t ON t.id = r.temporada_id WHERE r.id = $1`,
      [rodadaId],
    )
  ).rows[0];
  if (!r) throw new Error(`Rodada ${rodadaId} não existe`);

  const placares = (
    await banco.query<{ mandante_id: TimeId; visitante_id: TimeId; gols_mandante: number; gols_visitante: number; penaltis: { placar: { mandante: number; visitante: number } } | null; apito_inicial: string | Date }>(
      `SELECT mandante_id, visitante_id, gols_mandante, gols_visitante, penaltis, apito_inicial
       FROM partida WHERE rodada_id = $1 AND gols_mandante IS NOT NULL ORDER BY apito_inicial`,
      [rodadaId],
    )
  ).rows.map((p) => ({
    mandante: p.mandante_id,
    visitante: p.visitante_id,
    golsMandante: p.gols_mandante,
    golsVisitante: p.gols_visitante,
    penaltis: p.penaltis ? p.penaltis.placar : null,
    hora: horaBrasilia(new Date(p.apito_inicial)),
  }));

  // Novos Contratados: inscritos desde o Resumo anterior (19h do dia anterior) até este.
  const dia = typeof r.data === 'string' ? r.data.slice(0, 10) : r.data.toISOString().slice(0, 10);
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const ate = new Date(Date.UTC(a, m - 1, d, HORA_DO_RESUMO - FUSO_BRASILIA));
  const desde = r.numero === 1 ? new Date(0) : new Date(ate.getTime() - 24 * 3600_000);
  const novos = (
    await banco.query<{ username: string; time_id: TimeId; posicao: Posicao }>(
      `SELECT username, time_id, posicao FROM jogador
       WHERE NOT banido AND inscrito_em > $1 AND inscrito_em <= $2 ORDER BY inscrito_em`,
      [desde.toISOString(), ate.toISOString()],
    )
  ).rows;

  const candidatos = (
    await banco.query<{ username: string; time_id: TimeId; posicao: Posicao; nota: string; gols: string }>(
      `SELECT j.username, j.time_id, j.posicao, c.nota,
              (SELECT count(*) FROM partida p
                 JOIN escalacao e ON e.partida_id = p.id
                 CROSS JOIN LATERAL jsonb_array_elements(p.lances) l
                WHERE p.rodada_id = c.rodada_id AND e.jogador_id = j.id AND l->>'tipo' = 'GOL'
                  AND (l->'finalizador'->>'indice')::int = e.lugar
                  AND ((l->'finalizador'->>'lado') = 'mandante') = (e.time_id = p.mandante_id)) AS gols
       FROM candidato c JOIN jogador j ON j.id = c.jogador_id
       WHERE c.rodada_id = $1 ORDER BY c.nota DESC, j.id`,
      [rodadaId],
    )
  ).rows.map((c) => ({ username: c.username, time: c.time_id, posicao: c.posicao, nota: Number(c.nota), gols: Number(c.gols) }));

  const max = o.maxNovos ?? 12;
  return {
    temporada: r.temporada,
    rodada: r.numero,
    fase: r.fase,
    placares,
    tabela: await tabela(banco, r.temporada_id),
    novosContratados: novos.slice(0, max).map((n) => ({ username: n.username, time: n.time_id, posicao: n.posicao })),
    totalNovos: novos.length,
    candidatos,
  };
}

/** Rodada com Candidatos cuja Rodada seguinte ainda não começou: é a que está em votação. */
export async function rodadaEmVotacao(b: Banco): Promise<number | null> {
  const r = (
    await b.query<{ id: number }>(
      `SELECT r.id FROM rodada r
       WHERE EXISTS (SELECT 1 FROM candidato c WHERE c.rodada_id = r.id)
         AND NOT EXISTS (SELECT 1 FROM rodada s JOIN partida p ON p.rodada_id = s.id
                         WHERE s.temporada_id = r.temporada_id AND s.numero = r.numero + 1 AND p.status <> 'PENDENTE')
       ORDER BY r.numero DESC LIMIT 1`,
    )
  ).rows[0];
  return r?.id ?? null;
}

/** Craque da Rodada: o Candidato mais votado (empate: maior Nota). */
export async function craqueDaRodada(b: Banco, rodadaId: number): Promise<{ id: string; username: string } | null> {
  const r = (
    await b.query<{ id: string; username: string }>(
      `SELECT j.id::text AS id, j.username FROM candidato c JOIN jogador j ON j.id = c.jogador_id
       LEFT JOIN voto v ON v.rodada_id = c.rodada_id AND v.jogador_id = c.jogador_id
       WHERE c.rodada_id = $1 GROUP BY j.id, c.nota ORDER BY count(v.ig_user_id) DESC, c.nota DESC, j.id LIMIT 1`,
      [rodadaId],
    )
  ).rows[0];
  return r ?? null;
}
