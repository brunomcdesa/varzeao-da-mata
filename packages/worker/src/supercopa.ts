/**
 * Supercopa (ADR-0118): jogo único entre o campeão da Série A e o campeão da Copa da Temporada
 * anterior (mesmo Time nos dois: entra o vice da Série A), no domingo às 18h, dia seguinte ao
 * nascimento da Temporada. A Janela de Transferências só abre quando ela termina, e só joga
 * quem estava no Elenco na Final da Série A da Temporada anterior. Empate vai para os pênaltis;
 * Cartões não valem nada fora dela. O campeão leva o Título da Supercopa e 20 Moedas.
 */
import { CORTE_MINUTOS, MOEDAS, duracaoAoVivoMs, temMoedas, temSupercopa, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { lancar } from './carteira.js';
import { SQL_RODADA_DA_FINAL } from './series.js';

/** Os dois Times da Supercopa da Temporada `numero`: [campeão da Série A, campeão da Copa (ou o vice da A)]. */
export async function timesDaSupercopa(b: Banco, numero: number): Promise<readonly [TimeId, TimeId] | null> {
  if (!temSupercopa(numero)) return null;
  const ant = (
    await b.query<{ id: number; liga: TimeId | null; copa: TimeId | null }>(`SELECT id, campeao_id AS liga, campeao_copa_id AS copa FROM temporada WHERE numero = $1`, [numero - 1])
  ).rows[0];
  if (!ant?.liga || !ant.copa) return null;
  if (ant.liga !== ant.copa) return [ant.liga, ant.copa];
  // O mesmo Time ganhou a Série A e a Copa: entra o vice da Série A (quem perdeu a Final dela).
  const final = (
    await b.query<{ mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE r.temporada_id = $1 AND r.fase = 'MATA_MATA' AND r.numero = ${SQL_RODADA_DA_FINAL()} AND p.serie = 'A' LIMIT 1`,
      [ant.id],
    )
  ).rows[0];
  if (!final) return null;
  return [ant.liga, final.mandante_id === ant.liga ? final.visitante_id : final.mandante_id];
}

/** A próxima Temporada (`numero`) vai ter Supercopa? (Pré-temporada um dia maior: a Copa começa na terça.) */
export async function haveraSupercopa(b: Banco, numero: number): Promise<boolean> {
  return (await timesDaSupercopa(b, numero)) !== null;
}

/**
 * Antes do fim da Supercopa da Temporada (o fim do Ao Vivo dela): a Janela ainda não abriu.
 * Falso quando a Temporada não tem Supercopa.
 */
export async function antesDoFimDaSupercopa(b: Banco, temporadaId: number, quando: Date): Promise<boolean> {
  const p = (
    await b.query<{ apito: Date | string }>(
      `SELECT p.apito_inicial AS apito FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa = 'SUPERCOPA' LIMIT 1`,
      [temporadaId],
    )
  ).rows[0];
  return !!p && quando.getTime() < new Date(p.apito).getTime() + duracaoAoVivoMs('MATA_MATA');
}

/** Até quando a inscrição vale para a Supercopa: o Corte da Final da Série A da Temporada anterior (o Elenco campeão). */
export async function fimDaInscricaoNaSupercopa(b: Banco, temporadaId: number): Promise<Date | null> {
  const r = (
    await b.query<{ apito: Date | string | null }>(
      `SELECT max(p.apito_inicial) AS apito FROM partida p JOIN rodada r ON r.id = p.rodada_id
       JOIN temporada ant ON ant.id = r.temporada_id JOIN temporada t ON t.numero = ant.numero + 1
       WHERE t.id = $1 AND r.fase = 'MATA_MATA' AND p.copa_etapa IS NULL AND p.serie = 'A'`,
      [temporadaId],
    )
  ).rows[0];
  return r?.apito ? new Date(new Date(r.apito).getTime() - CORTE_MINUTOS * 60_000) : null;
}

/**
 * Fecha a Supercopa já jogada e ainda sem campeão (os jobs `escalar` e `resumo` chamam): grava o
 * campeão e paga o Título (20 Moedas para quem entrou em campo pelo campeão e para o Técnico ativo).
 */
export async function fecharSupercopaPendente(b: Banco): Promise<TimeId | null> {
  const p = (
    await b.query<{ temporada_id: number; numero: number; campeao: TimeId | null; apito: Date | string; desempenhos: { jogadorId: string | null; slot: { lado: 'mandante' | 'visitante' } }[] }>(
      `SELECT r.temporada_id, t.numero, p.resultado->'times'->>(p.resultado->>'vencedor') AS campeao, p.apito_inicial AS apito, p.resultado->'desempenhos' AS desempenhos
       FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id
       WHERE p.copa_etapa = 'SUPERCOPA' AND p.resultado IS NOT NULL AND t.campeao_supercopa_id IS NULL
       ORDER BY t.numero LIMIT 1`,
    )
  ).rows[0];
  if (!p?.campeao) return null;
  const r = await b.query(`UPDATE temporada SET campeao_supercopa_id = $2 WHERE id = $1 AND campeao_supercopa_id IS NULL RETURNING id`, [p.temporada_id, p.campeao]);
  if (!r.rows.length) return null;
  if (temMoedas(p.numero)) {
    const resultado = (await b.query<{ times: Record<'mandante' | 'visitante', TimeId> }>(`SELECT p.resultado->'times' AS times FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa = 'SUPERCOPA'`, [p.temporada_id])).rows[0]!;
    const lado = resultado.times.mandante === p.campeao ? 'mandante' : 'visitante';
    const jogaram = new Set(p.desempenhos.filter((d) => d.jogadorId && d.slot.lado === lado).map((d) => d.jogadorId!));
    const tecnicos = (await b.query<{ id: string }>(`SELECT jogador_id::text AS id FROM tecnico WHERE time_id = $1 AND status = 'ATIVO'`, [p.campeao])).rows.map((x) => x.id);
    const visivelEm = new Date(new Date(p.apito).getTime() + duracaoAoVivoMs('MATA_MATA'));
    for (const id of [...jogaram, ...tecnicos]) {
      await lancar(b, { jogadorId: id, tipo: 'TITULO_SUPERCOPA', referencia: `s${p.temporada_id}`, valor: MOEDAS.TITULO_SUPERCOPA, descricao: 'Título da Supercopa', visivelEm });
    }
  }
  return p.campeao;
}

/** A Supercopa da Temporada `numero` (Times e dia), para a legenda do Resumo da Temporada anterior. */
export async function supercopaDaTemporada(b: Banco, numero: number): Promise<{ mandante: TimeId; visitante: TimeId; dia: string } | null> {
  const p = (
    await b.query<{ mandante: TimeId; visitante: TimeId; dia: string }>(
      `SELECT p.mandante_id AS mandante, p.visitante_id AS visitante, to_char(r.data, 'YYYY-MM-DD') AS dia FROM partida p JOIN rodada r ON r.id = p.rodada_id
       JOIN temporada t ON t.id = r.temporada_id WHERE t.numero = $1 AND p.copa_etapa = 'SUPERCOPA' LIMIT 1`,
      [numero],
    )
  ).rows[0];
  return p ?? null;
}
