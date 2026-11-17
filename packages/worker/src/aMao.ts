/**
 * Ajustes à mão do dono (ADR-0079): Capitão à mão e OVR à mão. Rodam pelos workflows
 * `capitao` e `ovr` (ou `pnpm liga capitao` / `pnpm liga ovr`). Sem `gravar`, é a simulação:
 * mostra o antes e o depois e não muda nada.
 */
import { HABILIDADES, habilidadesComOvr, ovrDasHabilidades, type Habilidades, type Posicao, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { habilidadesDe } from './regras.js';
import { ordemDoCapitao } from './temporada2.js';

interface Achado {
  id: string;
  username: string;
  time_id: TimeId;
  posicao: Posicao;
  ovr: number;
  habilidades: Habilidades | string | null;
}

/** O Jogador (não banido) com esse @; com `id`, exatamente esse (quando há dois com o mesmo @). */
async function acharJogador(b: Banco, username: string, id?: string): Promise<Achado> {
  const u = username.replace(/^@/, '').trim();
  const achados = (
    await b.query<Achado>(
      `SELECT id::text AS id, username, time_id, posicao, ovr, habilidades FROM jogador WHERE lower(username) = lower($1) AND NOT banido AND ($2::text IS NULL OR id::text = $2)`,
      [u, id || null],
    )
  ).rows;
  if (achados.length > 1) throw new Error(`Há ${achados.length} Jogadores @${u} (ids ${achados.map((x) => x.id).join(', ')}): informe o ID.`);
  const j = achados[0];
  if (!j) throw new Error(`Nenhum Jogador @${u}.`);
  return j;
}

async function arrobaDe(b: Banco, id: string | undefined): Promise<string | null> {
  if (!id) return null;
  return (await b.query<{ username: string }>(`SELECT username FROM jogador WHERE id = $1`, [id])).rows[0]?.username ?? null;
}

export interface ResultadoDoCapitao {
  time: TimeId;
  /** @ de quem encabeçava a ordem da faixa antes e depois (sem contar suspensão e Vínculo). */
  antes: string | null;
  depois: string | null;
  gravado: boolean;
}

/**
 * Capitão à mão: o Jogador passa a encabeçar a ordem da faixa do Time dele, no lugar de quem
 * tinha mais Partidas. Substitui um Capitão à mão anterior do mesmo Time. Suspenso ou sem
 * Vínculo num jogo, a faixa segue a regra de sempre naquele jogo (ADR-0020).
 */
export async function forcarCapitao(b: Banco, username: string, opcoes: { gravar: boolean; id?: string; agora?: Date }): Promise<ResultadoDoCapitao> {
  const j = await acharJogador(b, username, opcoes.id);
  const antes = await arrobaDe(b, (await ordemDoCapitao(b, j.time_id))[0]);
  if (!opcoes.gravar) return { time: j.time_id, antes, depois: j.username, gravado: false };
  await b.transacao(async (t) => {
    await t.query(`DELETE FROM capitao_a_mao WHERE time_id = $1 OR jogador_id = $2`, [j.time_id, j.id]);
    await t.query(`INSERT INTO capitao_a_mao (time_id, jogador_id, escolhido_em) VALUES ($1, $2, $3)`, [j.time_id, j.id, opcoes.agora ?? new Date()]);
  });
  return { time: j.time_id, antes, depois: await arrobaDe(b, (await ordemDoCapitao(b, j.time_id))[0]), gravado: true };
}

/** Tira o Capitão à mão do Time: a faixa volta à ordem de mais Partidas. */
export async function tirarCapitao(b: Banco, time: TimeId, opcoes: { gravar: boolean }): Promise<ResultadoDoCapitao> {
  const antes = await arrobaDe(b, (await ordemDoCapitao(b, time))[0]);
  const tinha = (await b.query(`SELECT 1 FROM capitao_a_mao WHERE time_id = $1`, [time])).rows.length > 0;
  if (!tinha) throw new Error(`O ${time} não tem Capitão à mão.`);
  if (!opcoes.gravar) {
    const semMao = (
      await b.query<{ id: string }>(
        `SELECT j.id::text AS id FROM jogador j
         LEFT JOIN escalacao e ON e.jogador_id = j.id AND e.time_id = j.time_id AND (NOT e.reserva OR e.entrou)
         WHERE j.time_id = $1 AND NOT j.banido GROUP BY j.id ORDER BY count(e.partida_id) DESC, j.inscrito_em, j.id LIMIT 1`,
        [time],
      )
    ).rows[0]?.id;
    return { time, antes, depois: await arrobaDe(b, semMao), gravado: false };
  }
  await b.query(`DELETE FROM capitao_a_mao WHERE time_id = $1`, [time]);
  return { time, antes, depois: await arrobaDe(b, (await ordemDoCapitao(b, time))[0]), gravado: true };
}

/** Quem muda de Time perde a faixa à mão do Time antigo (chamado em toda troca de Time). */
export async function soltarFaixa(b: Banco, jogadorId: string): Promise<void> {
  await b.query(`DELETE FROM capitao_a_mao WHERE jogador_id = $1`, [jogadorId]);
}

export interface ResultadoDoOvr {
  username: string;
  posicao: Posicao;
  ovrAntes: number;
  ovrDepois: number;
  habilidadesAntes: Habilidades;
  habilidadesDepois: Habilidades;
  gravado: boolean;
}

/**
 * OVR à mão: sobe ou desce todas as Habilidades na mesma proporção até o OVR dar `alvo`. Depois
 * disso o Jogador evolui normalmente nas Partidas. Vale a partir da próxima Escalação; Partidas
 * já jogadas não mudam.
 */
export async function forcarOvr(b: Banco, username: string, alvo: number, opcoes: { gravar: boolean; id?: string; agora?: Date }): Promise<ResultadoDoOvr> {
  const j = await acharJogador(b, username, opcoes.id);
  const antes = habilidadesDe(j.posicao, j.ovr, j.habilidades);
  const depois = habilidadesComOvr(j.posicao, antes, alvo);
  const r: ResultadoDoOvr = {
    username: j.username,
    posicao: j.posicao,
    ovrAntes: j.ovr,
    ovrDepois: ovrDasHabilidades(j.posicao, depois),
    habilidadesAntes: antes,
    habilidadesDepois: depois,
    gravado: false,
  };
  if (!opcoes.gravar) return r;
  await b.transacao(async (t) => {
    await t.query(`UPDATE jogador SET ovr = $2, habilidades = $3 WHERE id = $1`, [j.id, r.ovrDepois, JSON.stringify(depois)]);
    await t.query(
      `INSERT INTO ovr_a_mao (jogador_id, ovr_antes, ovr_depois, habilidades_antes, habilidades_depois, feito_em) VALUES ($1, $2, $3, $4, $5, $6)`,
      [j.id, r.ovrAntes, r.ovrDepois, JSON.stringify(antes), JSON.stringify(depois), opcoes.agora ?? new Date()],
    );
  });
  return { ...r, gravado: true };
}

/** Uma linha "FIN 70 → 75 · PAS …" para o log. */
export function habilidadesNoLog(antes: Habilidades, depois: Habilidades): string {
  return HABILIDADES.map((h) => `${h} ${antes[h]} → ${depois[h]}`).join(' · ');
}
