/**
 * Job `resumo` (18h10): fecha a Rodada com os Candidatos a Craque e junta o que o Reels
 * do Resumo da Rodada mostra: placares, tabela, Novos Contratados e Candidatos.
 */
import { CANDIDATOS_POR_SERIE, RODADA_DA_FINAL, SERIES, etapaDa, numeroDoCandidato, rotuloDoCandidato, type Posicao, type Serie, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FUSO_BRASILIA } from './calendario.js';
import type { DadosDoResumo } from '@liga/renderer';
import { destaquesDaRodadaNoBanco } from './destaques.js';
import { seriesDaTemporada } from './series.js';
import { tabela } from './tabela.js';

/** Candidatos a Craque por Série em cada Rodada. */
export const CANDIDATOS_POR_RODADA = CANDIDATOS_POR_SERIE;
/** Horário do Resumo da Rodada (Brasília): marca a virada de um dia de Inscrições para o outro. */
export const HORA_DO_RESUMO = 19;

export type { DadosDoResumo } from '@liga/renderer';

/** Para concorrer a Craque da Temporada é preciso ter jogado pelo menos isso. */
export const MIN_JOGOS_CRAQUE_DA_TEMPORADA = 3;

async function ehFinal(banco: Banco, rodadaId: number): Promise<{ final: boolean; temporadaId: number }> {
  const r = (await banco.query<{ fase: 'LIGA' | 'MATA_MATA'; numero: number; temporada_id: number }>(`SELECT fase, numero, temporada_id FROM rodada WHERE id = $1`, [rodadaId])).rows[0]!;
  return { final: etapaDa(r.fase, r.numero) === 'FINAL', temporadaId: r.temporada_id };
}

/** As Séries que jogaram na Rodada (A, ou A e B). */
async function seriesDaRodada(banco: Banco, rodadaId: number): Promise<Serie[]> {
  const tem = new Set((await banco.query<{ serie: Serie }>(`SELECT DISTINCT serie FROM partida WHERE rodada_id = $1`, [rodadaId])).rows.map((r) => r.serie));
  return SERIES.filter((x) => tem.has(x));
}

/**
 * Candidatos a Craque, em cada Série: as 5 maiores Notas da Rodada entre Jogadores (a Base
 * não concorre). Na Final, os Candidatos são a Craque da Temporada: as 5 maiores notas médias
 * da Temporada na Série entre quem jogou nela pelo menos MIN_JOGOS_CRAQUE_DA_TEMPORADA vezes.
 */
export async function fecharRodada(banco: Banco, rodadaId: number): Promise<void> {
  const { final, temporadaId } = await ehFinal(banco, rodadaId);
  for (const serie of await seriesDaRodada(banco, rodadaId)) {
    if (final) {
      await banco.query(
        `INSERT INTO candidato (rodada_id, jogador_id, nota, serie)
         SELECT $1, e.jogador_id, round(avg(e.nota), 2), $5
         FROM escalacao e JOIN partida p ON p.id = e.partida_id JOIN rodada r ON r.id = p.rodada_id
         WHERE r.temporada_id = $2 AND p.serie = $5 AND e.jogador_id IS NOT NULL AND e.nota IS NOT NULL
         GROUP BY e.jogador_id
         HAVING count(*) >= $4
         ORDER BY avg(e.nota) DESC, count(*) DESC, e.jogador_id
         LIMIT $3
         ON CONFLICT DO NOTHING`,
        [rodadaId, temporadaId, CANDIDATOS_POR_RODADA, MIN_JOGOS_CRAQUE_DA_TEMPORADA, serie],
      );
    } else {
      await banco.query(
        `INSERT INTO candidato (rodada_id, jogador_id, nota, serie)
         SELECT $1, e.jogador_id, max(e.nota), $3
         FROM escalacao e JOIN partida p ON p.id = e.partida_id
         WHERE p.rodada_id = $1 AND p.serie = $3 AND e.jogador_id IS NOT NULL AND e.nota IS NOT NULL
         GROUP BY e.jogador_id
         ORDER BY max(e.nota) DESC, e.jogador_id
         LIMIT $2
         ON CONFLICT DO NOTHING`,
        [rodadaId, CANDIDATOS_POR_RODADA, serie],
      );
    }
    await numerarCandidatos(banco, rodadaId, serie);
  }
}

/**
 * Número de cada Candidato na votação (1 = maior nota da Série), o que se comenta para votar.
 * Na B, o número guardado vai de 6 a 10 (o público vê B1 a B5).
 */
async function numerarCandidatos(banco: Banco, rodadaId: number, serie: Serie): Promise<void> {
  await banco.query(
    `UPDATE candidato c SET numero = x.n + $3
     FROM (SELECT jogador_id, row_number() OVER (ORDER BY nota DESC, jogador_id) AS n FROM candidato WHERE rodada_id = $1 AND serie = $2) x
     WHERE c.rodada_id = $1 AND c.jogador_id = x.jogador_id`,
    [rodadaId, serie, numeroDoCandidato(serie, 0)],
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
    await banco.query<{ mandante_id: TimeId; visitante_id: TimeId; gols_mandante: number; gols_visitante: number; penaltis: { placar: { mandante: number; visitante: number } } | null; apito_inicial: string | Date; serie: Serie }>(
      `SELECT mandante_id, visitante_id, gols_mandante, gols_visitante, penaltis, apito_inicial, serie
       FROM partida WHERE rodada_id = $1 AND gols_mandante IS NOT NULL ORDER BY serie, apito_inicial`,
      [rodadaId],
    )
  ).rows.map((p) => ({
    mandante: p.mandante_id,
    visitante: p.visitante_id,
    golsMandante: p.gols_mandante,
    golsVisitante: p.gols_visitante,
    penaltis: p.penaltis ? p.penaltis.placar : null,
    hora: horaBrasilia(new Date(p.apito_inicial)),
    serie: p.serie,
  }));
  const comSeries = (await seriesDaTemporada(banco, r.temporada_id)).B.length > 0;

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
    await banco.query<{ username: string; apelido: string | null; time_id: TimeId; posicao: Posicao; nota: string; gols: string; numero: number | null; serie: Serie }>(
      `SELECT j.username, j.apelido, j.time_id, j.posicao, c.nota, c.numero, c.serie,
              (SELECT count(*) FROM partida p
                 JOIN escalacao e ON e.partida_id = p.id
                 CROSS JOIN LATERAL jsonb_array_elements(p.lances) l
                WHERE (p.rodada_id = c.rodada_id OR ($2 AND p.rodada_id IN (SELECT id FROM rodada WHERE temporada_id = $3)))
                  AND e.jogador_id = j.id AND l->>'tipo' = 'GOL'
                  AND (l->'finalizador'->>'indice')::int = e.lugar
                  AND ((l->'finalizador'->>'lado') = 'mandante') = (e.time_id = p.mandante_id)) AS gols
       FROM candidato c JOIN jogador j ON j.id = c.jogador_id
       WHERE c.rodada_id = $1 ORDER BY c.numero NULLS LAST, c.nota DESC, j.id`,
      [rodadaId, etapaDa(r.fase, r.numero) === 'FINAL', r.temporada_id],
    )
  ).rows.map((c, i) => ({ numero: c.numero ?? i + 1, rotulo: rotuloDoCandidato(c.numero ?? i + 1, comSeries), serie: c.serie, username: c.username, apelido: c.apelido ?? null, time: c.time_id, posicao: c.posicao, nota: Number(c.nota), gols: Number(c.gols) }));

  const max = o.maxNovos ?? 12;
  const final = etapaDa(r.fase, r.numero) === 'FINAL';
  const campeoes = final
    ? (await banco.query<{ campeao_id: TimeId | null; campeao_b_id: TimeId | null }>(`SELECT campeao_id, campeao_b_id FROM temporada WHERE id = $1`, [r.temporada_id])).rows[0]
    : undefined;
  const campeao = campeoes?.campeao_id;
  const campeaoB = campeoes?.campeao_b_id;
  // Anúncio do Craque da Rodada anterior, um por Série (ADR-0017).
  const craqueAnterior = await anuncioDoCraque(banco, r.temporada_id, r.numero, 'A');
  const craqueAnteriorB = comSeries ? await anuncioDoCraque(banco, r.temporada_id, r.numero, 'B') : null;
  // Resumo das Semifinais (ADR-0048): a Final de cada Série, criada logo antes deste Resumo.
  const jogosDaFinal =
    etapaDa(r.fase, r.numero) === 'SEMIFINAL'
      ? (
          await banco.query<{ mandante_id: TimeId; visitante_id: TimeId; apito_inicial: string | Date; serie: Serie }>(
            `SELECT p.mandante_id, p.visitante_id, p.apito_inicial, p.serie FROM partida p JOIN rodada f ON f.id = p.rodada_id
             WHERE f.temporada_id = $1 AND f.numero = $2 ORDER BY p.serie, p.apito_inicial`,
            [r.temporada_id, RODADA_DA_FINAL],
          )
        ).rows.map((p) => ({ mandante: p.mandante_id, visitante: p.visitante_id, hora: horaBrasilia(new Date(p.apito_inicial)), ...(comSeries ? { serie: p.serie } : {}) }))
      : [];
  // Seleção da Rodada (ADR-0041), a partir da T2.
  const destaques = await destaquesDaRodadaNoBanco(banco, rodadaId, r.temporada, comSeries);
  return {
    ...(final ? { votacao: 'TEMPORADA' as const } : {}),
    ...(campeao ? { campeao } : {}),
    ...(campeaoB ? { campeaoB } : {}),
    ...(jogosDaFinal.length ? { final: jogosDaFinal } : {}),
    temporada: r.temporada,
    rodada: r.numero,
    fase: r.fase,
    placares,
    tabela: await tabela(banco, r.temporada_id, 'A'),
    ...(comSeries ? { tabelaB: await tabela(banco, r.temporada_id, 'B') } : {}),
    novosContratados: novos.slice(0, max).map((n) => ({ username: n.username, time: n.time_id, posicao: n.posicao })),
    totalNovos: novos.length,
    candidatos,
    ...(destaques.length ? { destaques } : {}),
    ...(craqueAnterior ? { craqueDaRodada: craqueAnterior } : {}),
    ...(craqueAnteriorB ? { craqueDaRodadaB: craqueAnteriorB } : {}),
  };
}

/**
 * Craque da Rodada anterior, para o anúncio no Resumo (a votação fechou no Corte do primeiro
 * jogo do dia, e o eleito já jogou com vaga garantida). Nota e gols são os daquela Rodada.
 */
async function anuncioDoCraque(banco: Banco, temporadaId: number, numero: number, serie: Serie): Promise<DadosDoResumo['craqueDaRodada'] | null> {
  const anterior = (await banco.query<{ id: number; numero: number; fase: 'LIGA' | 'MATA_MATA' }>(`SELECT id, numero, fase FROM rodada WHERE temporada_id = $1 AND numero = $2`, [temporadaId, numero - 1])).rows[0];
  if (!anterior) return null;
  const eleito = await craqueDaRodada(banco, anterior.id, serie);
  if (!eleito) return null;
  const x = (
    await banco.query<{ username: string; apelido: string | null; time_id: TimeId; posicao: Posicao; nota: string; votos: string; gols: string }>(
      `SELECT j.username, j.apelido, j.time_id, j.posicao, c.nota,
              (SELECT count(*) FROM voto_total v WHERE v.rodada_id = c.rodada_id AND v.jogador_id = c.jogador_id) AS votos,
              (SELECT count(*) FROM partida p
                 JOIN escalacao e ON e.partida_id = p.id
                 CROSS JOIN LATERAL jsonb_array_elements(p.lances) l
                WHERE p.rodada_id = c.rodada_id AND e.jogador_id = j.id AND l->>'tipo' = 'GOL'
                  AND (l->'finalizador'->>'indice')::int = e.lugar
                  AND ((l->'finalizador'->>'lado') = 'mandante') = (e.time_id = p.mandante_id)) AS gols
       FROM candidato c JOIN jogador j ON j.id = c.jogador_id WHERE c.rodada_id = $1 AND c.jogador_id = $2`,
      [anterior.id, eleito.id],
    )
  ).rows[0];
  if (!x) return null;
  return { rodada: anterior.numero, fase: anterior.fase, username: x.username, apelido: x.apelido ?? null, time: x.time_id, posicao: x.posicao, nota: Number(x.nota), gols: Number(x.gols), votos: Number(x.votos) };
}

/** Rodada com Candidatos cuja Rodada seguinte ainda não começou: é a que está em votação. */
export async function rodadaEmVotacao(b: Banco): Promise<number | null> {
  const r = (
    await b.query<{ id: number }>(
      `SELECT r.id FROM rodada r JOIN temporada t ON t.id = r.temporada_id
       WHERE EXISTS (SELECT 1 FROM candidato c WHERE c.rodada_id = r.id)
         AND NOT EXISTS (SELECT 1 FROM rodada s JOIN partida p ON p.rodada_id = s.id
                         WHERE s.temporada_id = r.temporada_id AND s.numero = r.numero + 1 AND p.status <> 'PENDENTE')
         -- a votação da Final (Craque da Temporada) fecha quando o Craque é decidido
         AND NOT (r.numero = ${RODADA_DA_FINAL} AND t.craque_jogador_id IS NOT NULL)
         -- e nenhuma votação passa para a Temporada seguinte
         AND NOT EXISTS (SELECT 1 FROM temporada n JOIN rodada nr ON nr.temporada_id = n.id JOIN partida np ON np.rodada_id = nr.id
                         WHERE n.numero > t.numero AND np.status <> 'PENDENTE')
       ORDER BY r.data DESC, r.numero DESC LIMIT 1`,
    )
  ).rows[0];
  return r?.id ?? null;
}

/** Craque da Rodada de uma Série: o Candidato dela mais votado (empate: maior Nota). */
export async function craqueDaRodada(b: Banco, rodadaId: number, serie: Serie = 'A'): Promise<{ id: string; username: string } | null> {
  const r = (
    await b.query<{ id: string; username: string }>(
      `SELECT j.id::text AS id, j.username FROM candidato c JOIN jogador j ON j.id = c.jogador_id
       LEFT JOIN voto_total v ON v.rodada_id = c.rodada_id AND v.jogador_id = c.jogador_id
       WHERE c.rodada_id = $1 AND c.serie = $2 GROUP BY j.id, c.nota ORDER BY count(v.eleitor) DESC, c.nota DESC, j.id LIMIT 1`,
      [rodadaId, serie],
    )
  ).rows[0];
  return r ?? null;
}
