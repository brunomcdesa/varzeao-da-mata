/**
 * Recompensa da Temporada 1 (ADR-0047, GLOSSARY: Selo da Temporada 1, Piso da Temporada 1,
 * Bônus da Temporada 1).
 *
 * Roda uma vez, na Pré-temporada da T2: todo Jogador que se inscreveu até o último jogo da T1
 * ganha o Selo da Temporada 1, e quem está abaixo do Piso sobe a Habilidade principal da
 * Posição até o OVR chegar nele. O Bônus (ganhos maiores nas primeiras Rodadas da T2) é lido na
 * Escalação, a partir do Selo.
 *
 * `aplicarPiso` é pura (testável sem banco); `recompensarT1` lê, planeja e, só com `gravar`,
 * aplica. Sem `gravar`, é a simulação que o dono aprova antes.
 */
import {
  HABILIDADE_MAX,
  PESOS_OVR,
  PISO_DA_TEMPORADA_1,
  PRIMEIRA_TEMPORADA_COM_REGRAS_T2,
  PRINCIPAL,
  ovrDasHabilidades,
  ovrExato,
  type Habilidades,
  type Posicao,
} from '@liga/shared';
import type { Banco } from './banco.js';
import { habilidadesDe } from './regras.js';

/**
 * Sobe só a Habilidade principal da Posição até o OVR (arredondado) chegar no piso. Quem já está
 * no piso ou acima fica igual. A Habilidade não passa de 99.
 */
export function aplicarPiso(posicao: Posicao, habilidades: Habilidades, piso = PISO_DA_TEMPORADA_1): Habilidades {
  if (ovrDasHabilidades(posicao, habilidades) >= piso) return habilidades;
  const principal = PRINCIPAL[posicao];
  const peso = PESOS_OVR[posicao][principal]!;
  const depois = { ...habilidades };
  // Sobe de 0,1 em 0,1 a partir do mínimo necessário, até o arredondamento bater o piso.
  depois[principal] = Math.min(HABILIDADE_MAX, Math.ceil((habilidades[principal] + (piso - 0.5 - ovrExato(posicao, habilidades)) / peso) * 10) / 10);
  while (ovrDasHabilidades(posicao, depois) < piso && depois[principal] < HABILIDADE_MAX) {
    depois[principal] = Math.min(HABILIDADE_MAX, Math.round((depois[principal] + 0.1) * 10) / 10);
  }
  return depois;
}

export interface RecompensadoT1 {
  id: string;
  username: string;
  posicao: Posicao;
  ovrAntes: number;
  ovrDepois: number;
  habilidades: Habilidades;
}

export interface ResultadoDaRecompensaT1 {
  /** Todos os que ganham o Selo, com o OVR antes e depois do Piso. */
  recompensados: RecompensadoT1[];
  gravado: boolean;
}

/**
 * Na Pré-temporada da T2 e uma vez só: dá o Selo da Temporada 1 a quem se inscreveu até o Apito
 * Inicial do último jogo da T1 e aplica o Piso. Com `gravar`, numa transação.
 */
export async function recompensarT1(banco: Banco, opcoes: { gravar: boolean; agora?: Date }): Promise<ResultadoDaRecompensaT1> {
  const t2 = (
    await banco.query<{ id: number; status: string }>(`SELECT id, status FROM temporada WHERE numero = $1`, [PRIMEIRA_TEMPORADA_COM_REGRAS_T2])
  ).rows[0];
  if (!t2 || t2.status !== 'PRE_TEMPORADA') throw new Error('A Recompensa da Temporada 1 só roda na Pré-temporada da Temporada 2.');
  if ((await banco.query(`SELECT 1 FROM selo_temporada1 LIMIT 1`)).rows.length) throw new Error('A Recompensa da Temporada 1 já foi aplicada.');
  const fim = (
    await banco.query<{ fim: Date | string | null }>(
      `SELECT max(p.apito_inicial) AS fim FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id WHERE t.numero = 1`,
    )
  ).rows[0]?.fim;
  if (!fim) throw new Error('A Temporada 1 não tem jogos.');

  const jogadores = (
    await banco.query<{ id: string; username: string; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null }>(
      `SELECT id::text AS id, username, posicao, ovr, habilidades FROM jogador WHERE NOT banido AND inscrito_em <= $1 ORDER BY inscrito_em, id`,
      [fim],
    )
  ).rows;
  const recompensados = jogadores.map((j): RecompensadoT1 => {
    const antes = habilidadesDe(j.posicao, j.ovr, j.habilidades);
    const depois = aplicarPiso(j.posicao, antes);
    return { id: j.id, username: j.username, posicao: j.posicao, ovrAntes: j.ovr, ovrDepois: Math.max(j.ovr, ovrDasHabilidades(j.posicao, depois)), habilidades: depois };
  });
  if (!opcoes.gravar) return { recompensados, gravado: false };

  const agora = opcoes.agora ?? new Date();
  await banco.transacao(async (b) => {
    for (const r of recompensados) {
      if (r.ovrDepois > r.ovrAntes) {
        await b.query(`UPDATE jogador SET ovr = $2, habilidades = $3 WHERE id = $1`, [r.id, r.ovrDepois, JSON.stringify(r.habilidades)]);
      }
      await b.query(`INSERT INTO selo_temporada1 (jogador_id, ovr_antes, ovr_depois, recompensado_em) VALUES ($1, $2, $3, $4)`, [r.id, r.ovrAntes, r.ovrDepois, agora]);
    }
  });
  return { recompensados, gravado: true };
}

/** Quem tem o Selo da Temporada 1. */
export async function comSeloT1(banco: Banco): Promise<Set<string>> {
  return new Set((await banco.query<{ jogador_id: string }>(`SELECT jogador_id::text AS jogador_id FROM selo_temporada1`)).rows.map((r) => r.jogador_id));
}

/**
 * Números do Reels de agradecimento da T1 (ADR-0047): quem se inscreveu (o mesmo critério do
 * Selo), Partidas jogadas e gols (sem os pênaltis da disputa).
 */
export async function numerosDaTemporada1(banco: Banco): Promise<{ inscritos: number; jogos: number; gols: number }> {
  const jogos = (
    await banco.query<{ jogos: number; gols: number; fim: Date | string | null }>(
      `SELECT count(*)::int AS jogos, coalesce(sum(p.gols_mandante + p.gols_visitante), 0)::int AS gols, max(p.apito_inicial) AS fim
         FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id
        WHERE t.numero = 1 AND p.gols_mandante IS NOT NULL AND p.gols_visitante IS NOT NULL`,
    )
  ).rows[0]!;
  if (!jogos.jogos) throw new Error('A Temporada 1 ainda não tem jogos.');
  // Depois da Recompensa, conta quem ganhou o Selo; antes, o mesmo critério dela.
  const comSelo = (await banco.query<{ n: number }>(`SELECT count(*)::int AS n FROM selo_temporada1`)).rows[0]!.n;
  const inscritos = comSelo
    ? comSelo
    : (await banco.query<{ n: number }>(`SELECT count(*)::int AS n FROM jogador WHERE NOT banido AND inscrito_em <= $1`, [jogos.fim])).rows[0]!.n;
  return { inscritos, jogos: jogos.jogos, gols: jogos.gols };
}
