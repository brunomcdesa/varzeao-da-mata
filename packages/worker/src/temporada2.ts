/**
 * Regras da Temporada 2 no worker (ADRs 0020 a 0024): Capitão e Postura, Suspensão, Presença
 * e as escolhas feitas pelo site (Especialização, Treino e Canto).
 *
 * Tudo aqui só vale quando a Temporada tem as regras da T2 (`temRegrasT2`). Na Temporada 1,
 * as escolhas são recusadas e a Escalação e a simulação seguem como antes.
 */
import {
  CANTOS,
  ESPECIALIZACOES,
  HABILIDADES,
  NOME_DA_ESPECIALIZACAO,
  POSTURAS,
  temRegrasT2,
  type Canto,
  type Especializacao,
  type HabilidadeId,
  type Posicao,
  type Postura,
  type TimeId,
} from '@liga/shared';
import type { Banco } from './banco.js';
import { CORTE_MINUTOS } from './escalacao.js';
import type { Agenda } from './nuvem.js';

/** A Partida segue as regras da T2? (pela Temporada dela) */
export async function partidaTemRegrasT2(b: Banco, partidaId: number): Promise<boolean> {
  const t = (
    await b.query<{ numero: number }>(`SELECT t.numero FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id WHERE p.id = $1`, [partidaId])
  ).rows[0];
  return !!t && temRegrasT2(t.numero);
}

/** A Temporada em que as escolhas valem agora: a em andamento ou, na Pré-temporada, a próxima. */
async function temporadaAtual(b: Banco): Promise<{ id: number; numero: number; status: string } | null> {
  return (
    (
      await b.query<{ id: number; numero: number; status: string }>(
        `SELECT id, numero, status FROM temporada WHERE status IN ('EM_ANDAMENTO', 'PRE_TEMPORADA') ORDER BY status = 'EM_ANDAMENTO' DESC, numero LIMIT 1`,
      )
    ).rows[0] ?? null
  );
}

/**
 * Suspensos para esta Partida (ADR-0021): quem foi expulso no jogo anterior do Time, ou quem
 * nele completou dois amarelos na Temporada (a cada dois, uma Partida fora).
 */
export async function suspensos(b: Banco, time: TimeId, partidaId: number): Promise<Set<string>> {
  const atual = (
    await b.query<{ temporada_id: number; apito_inicial: Date | string }>(
      `SELECT r.temporada_id, p.apito_inicial FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE p.id = $1`,
      [partidaId],
    )
  ).rows[0];
  if (!atual) return new Set();
  const anterior = (
    await b.query<{ id: number }>(
      `SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE r.temporada_id = $1 AND (p.mandante_id = $2 OR p.visitante_id = $2) AND p.apito_inicial < $3 AND p.resultado IS NOT NULL
       ORDER BY p.apito_inicial DESC LIMIT 1`,
      [atual.temporada_id, time, new Date(atual.apito_inicial).toISOString()],
    )
  ).rows[0];
  if (!anterior) return new Set();
  const linhas = (
    await b.query<{ jogador_id: string; expulso: boolean; amarelos: number | null; antes: string }>(
      `SELECT e.jogador_id::text AS jogador_id, e.expulso, e.amarelos,
              (SELECT coalesce(sum(x.amarelos), 0) FROM escalacao x JOIN partida q ON q.id = x.partida_id JOIN rodada s ON s.id = q.rodada_id
                WHERE x.jogador_id = e.jogador_id AND s.temporada_id = $2 AND NOT x.expulso AND q.apito_inicial < (SELECT apito_inicial FROM partida WHERE id = $1)) AS antes
       FROM escalacao e WHERE e.partida_id = $1 AND e.time_id = $3 AND e.jogador_id IS NOT NULL`,
      [anterior.id, atual.temporada_id, time],
    )
  ).rows;
  const fora = new Set<string>();
  for (const l of linhas) {
    if (l.expulso) {
      fora.add(l.jogador_id);
      continue;
    }
    const antes = Number(l.antes);
    const depois = antes + (l.amarelos ?? 0);
    if (Math.floor(depois / 2) > Math.floor(antes / 2)) fora.add(l.jogador_id);
  }
  return fora;
}

/** Ordem da faixa de Capitão (ADR-0020): mais Partidas pelo Time; empate, quem chegou antes. */
export async function ordemDoCapitao(b: Banco, time: TimeId): Promise<string[]> {
  return (
    await b.query<{ id: string }>(
      `SELECT j.id::text AS id FROM jogador j
       LEFT JOIN escalacao e ON e.jogador_id = j.id AND e.time_id = j.time_id
       WHERE j.time_id = $1 AND NOT j.banido
       GROUP BY j.id ORDER BY count(e.partida_id) DESC, j.inscrito_em, j.id`,
      [time],
    )
  ).rows.map((r) => r.id);
}

/**
 * Capitão do Time nesta Partida: o primeiro da ordem que não está suspenso e tem Vínculo (só
 * quem tem Vínculo escolhe pelo site). Ninguém com Vínculo: o primeiro não suspenso, que
 * leva a faixa mas não escolhe (a Postura fica Equilibrada).
 */
export async function capitaoDaPartida(b: Banco, partidaId: number, time: TimeId, comVinculo: ReadonlySet<string>): Promise<string | null> {
  const ordem = await ordemDoCapitao(b, time);
  const fora = await suspensos(b, time, partidaId);
  const aptos = ordem.filter((id) => !fora.has(id));
  return aptos.find((id) => comVinculo.has(id)) ?? aptos[0] ?? null;
}

/**
 * Capitão entre os escalados: o Capitão da Partida se ele entrou; senão o primeiro da ordem
 * que entrou, preferindo quem tem Vínculo. null quando só a Base joga.
 */
export async function capitaoEmCampo(b: Banco, partidaId: number, time: TimeId, emCampo: ReadonlySet<string>, comVinculo: ReadonlySet<string>): Promise<string | null> {
  const c = await capitaoDaPartida(b, partidaId, time, comVinculo);
  if (c && emCampo.has(c)) return c;
  const ordem = (await ordemDoCapitao(b, time)).filter((id) => emCampo.has(id));
  return ordem.find((id) => comVinculo.has(id)) ?? ordem[0] ?? null;
}

/** Postura de cada Time na Partida (sem escolha, Equilibrada). */
export async function posturasDaPartida(b: Banco, partidaId: number, mandante: TimeId, visitante: TimeId): Promise<{ mandante: Postura; visitante: Postura }> {
  const linhas = (await b.query<{ time_id: TimeId; postura: Postura }>(`SELECT time_id, postura FROM postura WHERE partida_id = $1`, [partidaId])).rows;
  const de = (t: TimeId) => linhas.find((l) => l.time_id === t)?.postura ?? 'EQUILIBRADA';
  return { mandante: de(mandante), visitante: de(visitante) };
}

/** Quem confirmou Presença para esta Partida. */
export async function confirmados(b: Banco, partidaId: number): Promise<Set<string>> {
  return new Set((await b.query<{ id: string }>(`SELECT jogador_id::text AS id FROM presenca WHERE partida_id = $1`, [partidaId])).rows.map((r) => r.id));
}

/** O próximo jogo do Time que ainda aceita escolhas (não escalado e antes do Corte). */
export async function proximaPartidaDoTime(b: Banco, time: TimeId, agora: Date): Promise<{ id: number; apito: Date } | null> {
  const p = (
    await b.query<{ id: number; apito_inicial: Date | string }>(
      `SELECT id, apito_inicial FROM partida
       WHERE (mandante_id = $1 OR visitante_id = $1) AND status = 'PENDENTE' AND apito_inicial > $2
       ORDER BY apito_inicial LIMIT 1`,
      [time, new Date(agora.getTime() + CORTE_MINUTOS * 60_000).toISOString()],
    )
  ).rows[0];
  return p ? { id: p.id, apito: new Date(p.apito_inicial) } : null;
}

/** Quem é o Capitão do próximo jogo do Time de um Jogador, para o painel do site. */
export interface Capitania {
  /** Este Jogador é o Capitão: só ele vê a escolha de Postura. */
  eu: boolean;
  /** @ do Capitão (null quando o Time não tem ninguém apto). */
  capitao: string | null;
  postura: Postura;
}

/**
 * Capitania do próximo jogo aberto do Time do Jogador; null fora da T2 ou sem jogo aberto.
 * Mesma regra de `aplicarEscolha`: o primeiro da ordem, não suspenso, com Vínculo.
 */
export async function capitaniaDoJogador(b: Banco, jogadorId: string, agora: Date, comVinculo: () => Promise<ReadonlySet<string>>): Promise<Capitania | null> {
  const t = await temporadaAtual(b);
  if (!t || !temRegrasT2(t.numero)) return null;
  const j = (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE id = $1 AND NOT banido`, [jogadorId])).rows[0];
  if (!j) return null;
  const p = await proximaPartidaDoTime(b, j.time_id, agora);
  if (!p) return null;
  const id = await capitaoDaPartida(b, p.id, j.time_id, await comVinculo());
  const capitao = id ? ((await b.query<{ username: string }>(`SELECT username FROM jogador WHERE id = $1`, [id])).rows[0]?.username ?? null) : null;
  const postura = (await b.query<{ postura: Postura }>(`SELECT postura FROM postura WHERE partida_id = $1 AND time_id = $2`, [p.id, j.time_id])).rows[0]?.postura ?? 'EQUILIBRADA';
  return { eu: id === jogadorId, capitao, postura };
}

/** Os Jogadores com Vínculo (sessões do site guardadas na Agenda pela borda, ADR-0013). */
export async function jogadoresComVinculo(agenda: Agenda): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const chave of await agenda.listar('vinculo/sessao/')) {
    const s = await agenda.ler<{ jogadorId?: string }>(chave);
    if (s?.jogadorId) ids.add(s.jogadorId);
  }
  return ids;
}

/** Escolha feita pelo site por quem tem Vínculo (ADRs 0020 e 0023). */
export type Escolha =
  | { tipo: 'ESPECIALIZACAO'; valor: Especializacao | null }
  | { tipo: 'TREINO'; valor: HabilidadeId | null }
  | { tipo: 'CANTO'; valor: Canto | null }
  | { tipo: 'PRESENCA' }
  | { tipo: 'POSTURA'; valor: Postura };

export interface ResultadoDaEscolha {
  ok: boolean;
  mensagem: string;
}

/** Dia da Liga (horário de Brasília) de um instante: a Especialização troca uma vez por dia. */
const diaDaLiga = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/**
 * Aplica uma escolha do site. Recusa fora da Temporada 2 e fora das regras de cada escolha.
 * `comVinculo` só é usado na Postura (para saber quem é o Capitão).
 */
export async function aplicarEscolha(b: Banco, jogadorId: string, e: Escolha, agora: Date, comVinculo: () => Promise<ReadonlySet<string>>): Promise<ResultadoDaEscolha> {
  const t = await temporadaAtual(b);
  if (!t || !temRegrasT2(t.numero)) return { ok: false, mensagem: 'Isso chega na Temporada 2.' };
  const j = (
    await b.query<{ posicao: Posicao; time_id: TimeId; especializacao_em: Date | string | null; banido: boolean }>(
      `SELECT posicao, time_id, especializacao_em, banido FROM jogador WHERE id = $1`,
      [jogadorId],
    )
  ).rows[0];
  if (!j || j.banido) return { ok: false, mensagem: 'Jogador não encontrado.' };

  switch (e.tipo) {
    case 'ESPECIALIZACAO': {
      if (e.valor !== null && !(ESPECIALIZACOES[j.posicao] as readonly string[]).includes(e.valor)) {
        return { ok: false, mensagem: 'Essa Especialização não é da sua Posição.' };
      }
      if (j.especializacao_em && diaDaLiga(new Date(j.especializacao_em)) === diaDaLiga(agora)) {
        return { ok: false, mensagem: 'Você já trocou a Especialização hoje. Dá para trocar de novo amanhã.' };
      }
      await b.query(`UPDATE jogador SET especializacao = $2, especializacao_em = $3 WHERE id = $1`, [jogadorId, e.valor, agora.toISOString()]);
      return { ok: true, mensagem: e.valor ? `Especialização: ${NOME_DA_ESPECIALIZACAO[e.valor]}. Vale a partir do próximo jogo.` : 'Sem Especialização a partir do próximo jogo.' };
    }
    case 'TREINO': {
      if (e.valor !== null && !(HABILIDADES as readonly string[]).includes(e.valor)) return { ok: false, mensagem: 'Habilidade desconhecida.' };
      await b.query(`UPDATE jogador SET treino = $2 WHERE id = $1`, [jogadorId, e.valor]);
      return { ok: true, mensagem: e.valor ? 'Treino salvo. Vale a partir do próximo jogo.' : 'Sem Treino a partir do próximo jogo.' };
    }
    case 'CANTO': {
      if (e.valor !== null && !(CANTOS as readonly string[]).includes(e.valor)) return { ok: false, mensagem: 'Canto desconhecido.' };
      await b.query(`UPDATE jogador SET canto = $2 WHERE id = $1`, [jogadorId, e.valor]);
      return { ok: true, mensagem: e.valor ? 'Canto salvo para os pênaltis.' : 'Canto sorteado a cada pênalti.' };
    }
    case 'PRESENCA': {
      const p = await proximaPartidaDoTime(b, j.time_id, agora);
      if (!p) return { ok: false, mensagem: 'Não há jogo do seu Time aberto para confirmar agora.' };
      await b.query(`INSERT INTO presenca (partida_id, jogador_id, confirmado_em) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [p.id, jogadorId, agora.toISOString()]);
      return { ok: true, mensagem: 'Presença confirmada no próximo jogo do seu Time.' };
    }
    case 'POSTURA': {
      if (!(POSTURAS as readonly string[]).includes(e.valor)) return { ok: false, mensagem: 'Postura desconhecida.' };
      const p = await proximaPartidaDoTime(b, j.time_id, agora);
      if (!p) return { ok: false, mensagem: 'Não há jogo do seu Time aberto para escolher a Postura agora.' };
      const capitao = await capitaoDaPartida(b, p.id, j.time_id, await comVinculo());
      if (capitao !== jogadorId) return { ok: false, mensagem: 'Só o Capitão do Time escolhe a Postura.' };
      await b.query(
        `INSERT INTO postura (partida_id, time_id, postura, capitao_id, escolhida_em) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (partida_id, time_id) DO UPDATE SET postura = EXCLUDED.postura, capitao_id = EXCLUDED.capitao_id, escolhida_em = EXCLUDED.escolhida_em`,
        [p.id, j.time_id, e.valor, jogadorId, agora.toISOString()],
      );
      return { ok: true, mensagem: `Postura ${e.valor.toLowerCase()} no próximo jogo.` };
    }
  }
}

/** Tamanho de cada Elenco (Jogadores não banidos), para a Arquibancada da T2 (ADR-0019). */
export async function tamanhoDosElencos(b: Banco): Promise<Map<TimeId, number>> {
  const r = await b.query<{ time_id: TimeId; n: string }>(`SELECT time_id, count(*) AS n FROM jogador WHERE NOT banido GROUP BY time_id`);
  return new Map(r.rows.map((l) => [l.time_id, Number(l.n)]));
}
