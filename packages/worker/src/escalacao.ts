/**
 * Escalação de uma Partida (job `partida`, passo 1): 7 lugares por Time na FORMACAO, com
 * rodízio do Elenco, Craque da Rodada anterior garantido e Jogadores da Base completando
 * as vagas. Só conta quem se inscreveu até o Corte (30 min antes do Apito Inicial).
 */
import { habilidadesDoPerfil, type Escalacao, type Habilidades, type Posicao, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FORMACAO, OVR_BASE, habilidadesDe } from './regras.js';

export const CORTE_MINUTOS = 30;

export interface EscalacaoMontada {
  escalacao: Escalacao;
  /** @ de cada lugar; null = Jogador da Base. */
  nomes: (string | null)[];
}

interface Disponivel {
  id: string;
  username: string;
  posicao: Posicao;
  ovr: number;
  habilidades: Habilidades;
  jogos: number;
  ultimo: Date | null;
  inscritoEm: Date;
}

/**
 * Ordem do rodízio, por Posição: Craque da Rodada anterior primeiro; depois quem jogou
 * menos na Temporada; empate, quem jogou há mais tempo (ou nunca); depois quem se
 * inscreveu antes.
 */
export function ordemDoRodizio(a: Disponivel, b: Disponivel, craque: string | null): number {
  if (craque) {
    if (a.id === craque && b.id !== craque) return -1;
    if (b.id === craque && a.id !== craque) return 1;
  }
  if (a.jogos !== b.jogos) return a.jogos - b.jogos;
  const ua = a.ultimo?.getTime() ?? -Infinity;
  const ub = b.ultimo?.getTime() ?? -Infinity;
  if (ua !== ub) return ua - ub;
  if (a.inscritoEm.getTime() !== b.inscritoEm.getTime()) return a.inscritoEm.getTime() - b.inscritoEm.getTime();
  return Number(a.id) - Number(b.id);
}

export async function montarEscalacao(
  banco: Banco,
  o: { time: TimeId; temporadaId: number; corte: Date; craque?: string | null },
): Promise<EscalacaoMontada> {
  const disponiveis = (
    await banco.query<{ id: string; username: string; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; jogos: string; ultimo: string | Date | null; inscrito_em: string | Date }>(
      `SELECT j.id::text AS id, j.username, j.posicao, j.ovr, j.habilidades, j.inscrito_em,
              count(p.id) AS jogos, max(p.apito_inicial) AS ultimo
       FROM jogador j
       LEFT JOIN escalacao e ON e.jogador_id = j.id
       LEFT JOIN partida p ON p.id = e.partida_id
         AND p.rodada_id IN (SELECT id FROM rodada WHERE temporada_id = $2)
       WHERE j.time_id = $1 AND NOT j.banido AND j.inscrito_em <= $3
       GROUP BY j.id`,
      [o.time, o.temporadaId, o.corte.toISOString()],
    )
  ).rows.map(
    (r): Disponivel => ({
      id: r.id,
      username: r.username,
      posicao: r.posicao,
      ovr: r.ovr,
      habilidades: habilidadesDe(r.posicao, r.ovr, r.habilidades),
      jogos: Number(r.jogos),
      ultimo: r.ultimo ? new Date(r.ultimo) : null,
      inscritoEm: new Date(r.inscrito_em),
    }),
  );

  const porPosicao = new Map<Posicao, Disponivel[]>();
  for (const d of disponiveis) porPosicao.set(d.posicao, [...(porPosicao.get(d.posicao) ?? []), d]);
  for (const lista of porPosicao.values()) lista.sort((a, b) => ordemDoRodizio(a, b, o.craque ?? null));

  const jogadores: Escalacao['jogadores'][number][] = [];
  const nomes: (string | null)[] = [];
  for (const posicao of FORMACAO) {
    const proximo = porPosicao.get(posicao)?.shift();
    jogadores.push(
      proximo
        ? { jogadorId: proximo.id, posicao, ovr: proximo.ovr, habilidades: proximo.habilidades }
        : { jogadorId: null, posicao, ovr: OVR_BASE, habilidades: habilidadesDoPerfil(posicao, OVR_BASE) },
    );
    nomes.push(proximo ? `@${proximo.username}` : null);
  }
  return { escalacao: { time: o.time, jogadores }, nomes };
}

export interface PartidaEscalada {
  partidaId: number;
  escalacoes: { mandante: Escalacao; visitante: Escalacao };
  nomes: { mandante: (string | null)[]; visitante: (string | null)[] };
}

/**
 * Escala as duas equipes de uma Partida e grava em `escalacao` (status → ESCALADA).
 * Se a Partida já foi escalada, devolve a Escalação gravada: reexecutar retoma de onde parou.
 */
export async function escalarPartida(banco: Banco, partidaId: number, o: { craque?: string | null } = {}): Promise<PartidaEscalada> {
  return banco.transacao(async (b) => {
    const p = (
      await b.query<{ mandante_id: TimeId; visitante_id: TimeId; apito_inicial: string | Date; status: string; temporada_id: number }>(
        `SELECT p.mandante_id, p.visitante_id, p.apito_inicial, p.status, r.temporada_id
         FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE p.id = $1 FOR UPDATE OF p`,
        [partidaId],
      )
    ).rows[0];
    if (!p) throw new Error(`Partida ${partidaId} não existe`);

    if (p.status !== 'PENDENTE') return lerEscalacao(b, partidaId, p.mandante_id, p.visitante_id);

    const corte = new Date(new Date(p.apito_inicial).getTime() - CORTE_MINUTOS * 60_000);
    const mandante = await montarEscalacao(b, { time: p.mandante_id, temporadaId: p.temporada_id, corte, craque: o.craque ?? null });
    const visitante = await montarEscalacao(b, { time: p.visitante_id, temporadaId: p.temporada_id, corte, craque: o.craque ?? null });
    for (const m of [mandante, visitante]) {
      for (const [lugar, j] of m.escalacao.jogadores.entries()) {
        await b.query(
          `INSERT INTO escalacao (partida_id, time_id, lugar, jogador_id, posicao, ovr_antes, habilidades_antes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [partidaId, m.escalacao.time, lugar, j.jogadorId, j.posicao, j.ovr, JSON.stringify(j.habilidades)],
        );
      }
    }
    await b.query(`UPDATE partida SET status = 'ESCALADA' WHERE id = $1`, [partidaId]);
    return {
      partidaId,
      escalacoes: { mandante: mandante.escalacao, visitante: visitante.escalacao },
      nomes: { mandante: mandante.nomes, visitante: visitante.nomes },
    };
  });
}

async function lerEscalacao(b: Banco, partidaId: number, mandante: TimeId, visitante: TimeId): Promise<PartidaEscalada> {
  const linhas = (
    await b.query<{ time_id: TimeId; jogador_id: string | null; posicao: Posicao; ovr_antes: number; habilidades_antes: Habilidades | string | null; username: string | null }>(
      `SELECT e.time_id, e.jogador_id::text AS jogador_id, e.posicao, e.ovr_antes, e.habilidades_antes, j.username
       FROM escalacao e LEFT JOIN jogador j ON j.id = e.jogador_id
       WHERE e.partida_id = $1 ORDER BY e.lugar`,
      [partidaId],
    )
  ).rows;
  const de = (time: TimeId) => {
    const minhas = linhas.filter((l) => l.time_id === time);
    return {
      escalacao: {
        time,
        jogadores: minhas.map((l) => ({ jogadorId: l.jogador_id, posicao: l.posicao, ovr: l.ovr_antes, habilidades: habilidadesDe(l.posicao, l.ovr_antes, l.habilidades_antes) })),
      } as Escalacao,
      nomes: minhas.map((l) => (l.username ? `@${l.username}` : null)),
    };
  };
  const m = de(mandante);
  const v = de(visitante);
  return { partidaId, escalacoes: { mandante: m.escalacao, visitante: v.escalacao }, nomes: { mandante: m.nomes, visitante: v.nomes } };
}
