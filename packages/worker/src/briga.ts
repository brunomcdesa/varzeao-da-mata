/**
 * Briga pelo Mata-mata (ADR-0053): monta, a partir do banco, o que o Narrador e as placas sabem
 * numa Partida da última Rodada da Fase de Liga.
 */
import { CAEM_POR_GRUPO, CLASSIFICAM_POR_GRUPO, brigaDaPartida, timesQueCaem, grupoDoTime, type BrigaPeloMataMata, type PartidaParaBriga, type Serie, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FUSO_BRASILIA } from './calendario.js';
import { gruposDaTemporada, seriesDaTemporada } from './series.js';

export const horaDeBrasilia = (apito: Date) => (apito.getUTCHours() + FUSO_BRASILIA + 24) % 24;

interface Linha {
  id: number;
  fase: 'LIGA' | 'MATA_MATA';
  rodada: number;
  mandante_id: TimeId;
  visitante_id: TimeId;
  apito_inicial: string | Date;
  gols_mandante: number | null;
  gols_visitante: number | null;
}

export const paraBriga = (p: Linha): PartidaParaBriga => {
  const apito = new Date(p.apito_inicial);
  return {
    id: p.id,
    fase: p.fase,
    rodada: p.rodada,
    mandante: p.mandante_id,
    visitante: p.visitante_id,
    apito: apito.getTime(),
    hora: horaDeBrasilia(apito),
    gols: p.gols_mandante == null || p.gols_visitante == null ? null : { mandante: p.gols_mandante, visitante: p.gols_visitante },
  };
};

/** A Briga de uma Partida (null fora da última Rodada da Fase de Liga). */
export async function brigaDe(banco: Banco, partidaId: number): Promise<BrigaPeloMataMata | null> {
  const alvo = (
    await banco.query<Linha & { temporada_id: number; serie: Serie }>(
      `SELECT p.id, r.fase, r.numero AS rodada, p.mandante_id, p.visitante_id, p.apito_inicial, p.gols_mandante, p.gols_visitante, r.temporada_id, p.serie
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE p.id = $1`,
      [partidaId],
    )
  ).rows[0];
  if (!alvo) return null;
  const doAlvo = paraBriga(alvo);
  if (doAlvo.fase !== 'LIGA') return null;
  const partidas = (
    await banco.query<Linha>(
      `SELECT p.id, r.fase, r.numero AS rodada, p.mandante_id, p.visitante_id, p.apito_inicial, p.gols_mandante, p.gols_visitante
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.serie = $2 AND r.fase = 'LIGA'`,
      [alvo.temporada_id, alvo.serie],
    )
  ).rows.map(paraBriga);
  const series = await seriesDaTemporada(banco, alvo.temporada_id);
  // Com Grupos (T2, ADR-0064): a Briga é dentro do Grupo da Partida, com 2 vagas.
  const grupos = await gruposDaTemporada(banco, alvo.temporada_id);
  const grupo = grupoDoTime(grupos, alvo.mandante_id);
  if (grupos && grupo) {
    const times = grupos[grupo];
    const doGrupo = partidas.filter((p) => times.includes(p.mandante) && times.includes(p.visitante));
    return brigaDaPartida(doAlvo, doGrupo, times, null, { grupo, vagas: CLASSIFICAM_POR_GRUPO, caem: CAEM_POR_GRUPO });
  }
  // Rebaixamento (ADR-0115): só a Série A tem quem cai, com as mesmas contas do Resumo.
  const comSerieB = series.B.length > 0;
  const caem = alvo.serie === 'A' ? timesQueCaem({ temSerieB: comSerieB, porGrupo: false }) : 0;
  return brigaDaPartida(doAlvo, partidas, series[alvo.serie], comSerieB ? alvo.serie : null, { caem });
}
