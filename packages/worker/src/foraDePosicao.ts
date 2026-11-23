/**
 * Correção do OVR de quem jogou fora de posição (ADR-0098).
 *
 * Até a correção, o job `partida` gravava no Jogador o OVR da vaga (ADR-0044): um meia que
 * jogava de zagueiro saía da Partida com o OVR de zagueiro, bem mais baixo. As Habilidades
 * estavam certas; só o número do OVR ficava errado até o próximo jogo na Posição dele.
 *
 * Corrige quem ainda está com esse OVR: o último jogo foi fora de posição e o OVR gravado é o
 * da vaga. O OVR volta a ser o das Habilidades com os pesos da Posição dele. As Habilidades e
 * as Partidas já jogadas não mudam.
 */
import { ovrDasHabilidades, type Habilidades, type Posicao } from '@liga/shared';
import type { Banco } from './banco.js';
import { habilidadesDe } from './regras.js';

export interface CorrecaoForaDePosicao {
  id: string;
  username: string;
  antes: number;
  depois: number;
}

/** Pura: o OVR certo para quem ficou com o da vaga, ou null se já está certo. */
export function ovrCorrigido(posicao: Posicao, ovr: number, habilidades: Habilidades): number | null {
  const certo = ovrDasHabilidades(posicao, habilidades);
  return certo === ovr ? null : certo;
}

export async function corrigirOvrForaDePosicao(b: Banco): Promise<CorrecaoForaDePosicao[]> {
  // O último jogo de cada Jogador (titular ou reserva que entrou), com a vaga em que jogou.
  const linhas = (
    await b.query<{ id: string; username: string; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; vaga: Posicao; ovr_depois: number }>(
      `SELECT DISTINCT ON (j.id) j.id::text AS id, j.username, j.posicao, j.ovr, j.habilidades,
              coalesce(s.posicao, e.posicao) AS vaga, e.ovr_depois
         FROM escalacao e
         JOIN jogador j ON j.id = e.jogador_id
         JOIN partida p ON p.id = e.partida_id
         LEFT JOIN escalacao s ON e.entrou AND s.partida_id = e.partida_id AND s.time_id = e.time_id AND s.lugar = e.lugar_em_campo
        WHERE e.ovr_depois IS NOT NULL AND (NOT e.reserva OR e.entrou) AND NOT j.banido
        ORDER BY j.id, p.apito_inicial DESC`,
    )
  ).rows;
  const feitas: CorrecaoForaDePosicao[] = [];
  for (const l of linhas) {
    // Só quem jogou o último jogo fora de posição e ainda tem o OVR que saiu dele.
    if (l.vaga === l.posicao || l.ovr !== l.ovr_depois) continue;
    const depois = ovrCorrigido(l.posicao, l.ovr, habilidadesDe(l.posicao, l.ovr, l.habilidades));
    if (depois === null) continue;
    await b.query(`UPDATE jogador SET ovr = $2 WHERE id = $1`, [l.id, depois]);
    feitas.push({ id: l.id, username: l.username, antes: l.ovr, depois });
  }
  return feitas;
}

export interface TrocaAfetada {
  username: string;
  de: Posicao;
  para: Posicao;
  /** OVR que a troca manteve (o da vaga) e o que ele tinha de verdade na Posição de antes. */
  ovrNaTroca: number;
  ovrCerto: number;
}

/**
 * Só leitura: quem trocou de posição pela Transferência logo depois de um jogo fora de posição.
 * A troca mantém o OVR e refaz as Habilidades a partir dele (ADR-0030); com o OVR da vaga, as
 * Habilidades novas ficaram mais baixas. O dono decide o ajuste (OVR à mão, ADR-0079).
 */
export async function trocasDepoisDeJogoFora(b: Banco): Promise<TrocaAfetada[]> {
  const linhas = (
    await b.query<{ username: string; de: Posicao; para: Posicao; vaga: Posicao; ovr_depois: number; habilidades_depois: Habilidades | string }>(
      `SELECT DISTINCT ON (t.id) j.username, t.de_posicao AS de, t.para_posicao AS para,
              coalesce(s.posicao, e.posicao) AS vaga, e.ovr_depois, e.habilidades_depois
         FROM transferencia t
         JOIN jogador j ON j.id = t.jogador_id
         JOIN escalacao e ON e.jogador_id = t.jogador_id AND e.ovr_depois IS NOT NULL AND (NOT e.reserva OR e.entrou)
         JOIN partida p ON p.id = e.partida_id AND p.apito_inicial < t.feita_em
         LEFT JOIN escalacao s ON e.entrou AND s.partida_id = e.partida_id AND s.time_id = e.time_id AND s.lugar = e.lugar_em_campo
        WHERE t.de_posicao <> t.para_posicao AND e.habilidades_depois IS NOT NULL
        ORDER BY t.id, p.apito_inicial DESC`,
    )
  ).rows;
  return linhas.flatMap((l) => {
    if (l.vaga === l.de) return [];
    const h = typeof l.habilidades_depois === 'string' ? (JSON.parse(l.habilidades_depois) as Habilidades) : l.habilidades_depois;
    const ovrCerto = ovrDasHabilidades(l.de, h);
    return ovrCerto > l.ovr_depois ? [{ username: l.username, de: l.de, para: l.para, ovrNaTroca: l.ovr_depois, ovrCerto }] : [];
  });
}
