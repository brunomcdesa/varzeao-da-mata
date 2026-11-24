/**
 * Regras da Temporada 2 no worker (ADRs 0020 a 0024 e 0044): Capitão, Postura e Formação, Suspensão, Presença
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
  FORMACAO_PADRAO,
  ehFormacao,
  temRegrasT2,
  temRegrasT3,
  temMoedas,
  QUANTIDADE_DE_BATEDORES,
  type Canto,
  type Formacao,
  type Especializacao,
  type HabilidadeId,
  type Posicao,
  type Postura,
  type TimeId,
} from '@liga/shared';
import type { Banco } from './banco.js';
import { registrarPalpite } from './carteira.js';
import { comprarItem, equiparItem, tirarItem } from './loja.js';
import { CORTE_MINUTOS } from './escalacao.js';
import { chamarPresenca, decidirEscanteio, decidirMarcacao, decidirPlano, escolherGrito, planosDaPartida } from './planoDoTime.js';
import { cargoDe, convidar, decidirPedido, deixarCargo, pedirParaSerTecnico, proporTroca, responderConvite, responderTroca, tecnicoDoTime } from './tecnico.js';
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
  // Uma consulta só (ADR-0094): o jogo anterior do Time na mesma Temporada e os cartões dele.
  const linhas = (
    await b.query<{ jogador_id: string; expulso: boolean; amarelos: number | null; antes: string }>(
      `WITH atual AS (
         SELECT r.temporada_id, p.apito_inicial FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE p.id = $1
       ), anterior AS (
         SELECT p.id, p.apito_inicial, a.temporada_id FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN atual a ON r.temporada_id = a.temporada_id
         WHERE (p.mandante_id = $2 OR p.visitante_id = $2) AND p.apito_inicial < a.apito_inicial AND p.resultado IS NOT NULL
         ORDER BY p.apito_inicial DESC LIMIT 1
       )
       SELECT e.jogador_id::text AS jogador_id, e.expulso, e.amarelos,
              (SELECT coalesce(sum(x.amarelos), 0) FROM escalacao x JOIN partida q ON q.id = x.partida_id JOIN rodada s ON s.id = q.rodada_id
                WHERE x.jogador_id = e.jogador_id AND s.temporada_id = an.temporada_id AND NOT x.expulso AND q.apito_inicial < an.apito_inicial) AS antes
       FROM escalacao e JOIN anterior an ON an.id = e.partida_id WHERE e.time_id = $2 AND e.jogador_id IS NOT NULL`,
      [partidaId, time],
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

/**
 * Ordem da faixa de Capitão (ADR-0020): mais Partidas pelo Time; empate, quem chegou antes.
 * O Capitão à mão (ADR-0079), se ainda está no Time, vem na frente de todos.
 */
export async function ordemDoCapitao(b: Banco, time: TimeId): Promise<string[]> {
  return (
    await b.query<{ id: string }>(
      `SELECT j.id::text AS id FROM jogador j
       LEFT JOIN escalacao e ON e.jogador_id = j.id AND e.time_id = j.time_id AND (NOT e.reserva OR e.entrou)
       LEFT JOIN capitao_a_mao m ON m.time_id = j.time_id AND m.jogador_id = j.id
       WHERE j.time_id = $1 AND NOT j.banido
       GROUP BY j.id, j.inscrito_em, m.jogador_id ORDER BY (m.jogador_id IS NOT NULL) DESC, count(e.partida_id) DESC, j.inscrito_em, j.id`,
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
  const [ordem, fora] = await Promise.all([ordemDoCapitao(b, time), suspensos(b, time, partidaId)]);
  return escolherCapitao(ordem, fora, comVinculo);
}

/** A regra do Capitão sobre a ordem já lida: o primeiro não suspenso com Vínculo; senão, o primeiro não suspenso. */
function escolherCapitao(ordem: readonly string[], fora: ReadonlySet<string>, comVinculo: ReadonlySet<string>): string | null {
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
  // O Plano que vale (ADR-0111): o Técnico decide; o que ele não decidiu, a Sugestão do Capitão.
  const planos = await planosDaPartida(b, partidaId);
  const de = (t: TimeId) => planos.get(t)?.postura ?? 'EQUILIBRADA';
  return { mandante: de(mandante), visitante: de(visitante) };
}

/** Formação de cada Time na Partida (ADR-0044; sem escolha, 2-2-2). */
export async function formacoesDaPartida(b: Banco, partidaId: number, mandante: TimeId, visitante: TimeId): Promise<{ mandante: Formacao; visitante: Formacao }> {
  const planos = await planosDaPartida(b, partidaId);
  const de = (t: TimeId) => planos.get(t)?.formacao ?? FORMACAO_PADRAO;
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
  /** Formação escolhida para o próximo jogo (ADR-0044). */
  formacao: Formacao;
  /** Este Jogador já confirmou Presença no próximo jogo (pelo site ou com CONFIRMO). */
  presenca: boolean;
  /** O próximo jogo do Time: Apito Inicial (ISO) e adversário, para o selo de Presença. */
  jogo: { apito: string; adversario: TimeId };
  /** T3 (ADR-0091): os Batedores escolhidos (ids, em ordem) e o Elenco para escolher. */
  batedores?: string[];
  elenco?: { id: string; nome: string; posicao: Posicao }[];
}

/**
 * Capitania do próximo jogo aberto do Time do Jogador; null fora da T2 ou sem jogo aberto.
 * Mesma regra de `aplicarEscolha`: o primeiro da ordem, não suspenso, com Vínculo.
 */
export async function capitaniaDoJogador(b: Banco, jogadorId: string, agora: Date, comVinculo: () => Promise<ReadonlySet<string>>): Promise<Capitania | null> {
  // A página espera por isto (ADR-0094): o que não depende de nada vai junto, e a lista de
  // Vínculos começa já, em paralelo com o banco.
  const vinculos = comVinculo();
  vinculos.catch(() => {});
  const [t, j] = await Promise.all([
    temporadaAtual(b),
    b.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE id = $1 AND NOT banido`, [jogadorId]).then((r) => r.rows[0]),
  ]);
  if (!t || !temRegrasT2(t.numero) || !j) return null;
  const p = await proximaPartidaDoTime(b, j.time_id, agora);
  if (!p) return null;
  const [ordem, fora, nomes, escolha, lados, presenca, comV] = await Promise.all([
    ordemDoCapitao(b, j.time_id),
    suspensos(b, j.time_id, p.id),
    b.query<{ id: string; username: string; apelido: string | null; posicao: Posicao; banido: boolean }>(`SELECT id::text AS id, username, apelido, posicao, banido FROM jogador WHERE time_id = $1`, [j.time_id]).then((r) => r.rows),
    b.query<{ postura: Postura; formacao: Formacao; batedores: string[] | null }>(`SELECT postura, formacao, batedores FROM postura WHERE partida_id = $1 AND time_id = $2`, [p.id, j.time_id]).then((r) => r.rows[0]),
    b.query<{ mandante_id: TimeId; visitante_id: TimeId }>(`SELECT mandante_id, visitante_id FROM partida WHERE id = $1`, [p.id]).then((r) => r.rows[0]!),
    b.query(`SELECT 1 FROM presenca WHERE partida_id = $1 AND jogador_id = $2`, [p.id, jogadorId]).then((r) => r.rows.length > 0),
    vinculos,
  ]);
  const id = escolherCapitao(ordem, fora, comV);
  const capitao = id ? (nomes.find((n) => n.id === id)?.username ?? null) : null;
  return {
    eu: id === jogadorId,
    capitao,
    postura: escolha?.postura ?? 'EQUILIBRADA',
    formacao: escolha?.formacao ?? FORMACAO_PADRAO,
    presenca,
    jogo: { apito: p.apito.toISOString(), adversario: lados.mandante_id === j.time_id ? lados.visitante_id : lados.mandante_id },
    // T3 (ADR-0091): Batedores e o Elenco para a lista (a resposta só vai para quem é do Time).
    ...(temRegrasT3(t.numero)
      ? {
          batedores: (escolha?.batedores ?? []).map(String),
          elenco: nomes.filter((n) => !n.banido).map((n) => ({ id: n.id, nome: n.apelido ?? `@${n.username}`, posicao: n.posicao })),
        }
      : {}),
  };
}

/** Cópia da lista de quem tem Vínculo, para não listar as sessões a cada coleta (ADR-0035). */
export const CHAVE_VINCULOS = 'vinculos-cache';

/**
 * Os Jogadores com Vínculo (sessões do site guardadas na Agenda pela borda, ADR-0013). Com
 * `recarregar: false`, usa a cópia guardada (uma leitura) e só lista se ela não existir.
 */
export async function jogadoresComVinculo(agenda: Agenda, o: { recarregar?: boolean } = {}): Promise<Set<string>> {
  if (o.recarregar === false) {
    const copia = await agenda.ler<string[]>(CHAVE_VINCULOS);
    if (copia) return new Set(copia);
  }
  const ids = new Set<string>();
  for (const chave of await agenda.listar('vinculo/sessao/')) {
    const s = await agenda.ler<{ jogadorId?: string }>(chave);
    if (s?.jogadorId) ids.add(s.jogadorId);
  }
  const lista = [...ids].sort();
  const anterior = await agenda.ler<string[]>(CHAVE_VINCULOS);
  if (!anterior || anterior.join(',') !== lista.join(',')) await agenda.gravar(CHAVE_VINCULOS, lista);
  return ids;
}

/** Escolha feita pelo site por quem tem Vínculo (ADRs 0020 e 0023). */
export type Escolha =
  | { tipo: 'ESPECIALIZACAO'; valor: Especializacao | null }
  | { tipo: 'TREINO'; valor: HabilidadeId | null }
  | { tipo: 'CANTO'; valor: Canto | null }
  | { tipo: 'PRESENCA' }
  | { tipo: 'POSTURA'; valor: Postura }
  | { tipo: 'FORMACAO'; valor: Formacao }
  /** Batedores (ADR-0091): ids dos Jogadores do Time, em ordem; lista vazia volta à ordem automática. */
  | { tipo: 'BATEDORES'; valor: string[] }
  /** Palpite (ADR-0089): "partida:mandante-visitante", até o Corte. */
  | { tipo: 'PALPITE'; valor: string }
  /** Loja (ADR-0101): comprar (e equipar) ou equipar pelo código do Item; tirar pelo Encaixe. */
  | { tipo: 'COMPRA'; valor: string }
  | { tipo: 'EQUIPAR'; valor: string }
  | { tipo: 'TIRAR'; valor: string }
  /** Técnico e Interesse (ADR-0111). Decisões: "ACEITAR:<id>" ou "RECUSAR:<id>". */
  | { tipo: 'FIXADOS'; valor: string[] }
  | { tipo: 'PEDIDO'; valor: string }
  | { tipo: 'CONVIDAR'; valor: string }
  | { tipo: 'CONVITE'; valor: string }
  /** "<jogador A>:<jogador B>". */
  | { tipo: 'TROCA_PROPOR'; valor: string }
  | { tipo: 'TROCA'; valor: string }
  /** Pedir para pendurar as chuteiras e treinar este Time. */
  | { tipo: 'SER_TECNICO'; valor: string }
  | { tipo: 'SAIR_DO_CARGO' }
  /** Capitão em campo (ADR-0112). Marcação: "<marcador>:<alvo>" ou vazio. */
  | { tipo: 'ESCANTEIO'; valor: string[] }
  | { tipo: 'MARCACAO'; valor: string }
  | { tipo: 'GRITO'; valor: string }
  | { tipo: 'CHAMADA' };

export interface ResultadoDaEscolha {
  ok: boolean;
  mensagem: string;
}

/** Dia da Liga (horário de Brasília) de um instante: a Especialização troca uma vez por dia. */
const diaDaLiga = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/**
 * Aplica uma escolha do site. Recusa fora da Temporada 2 e fora das regras de cada escolha.
 * `comVinculo` só é usado na Postura e na Formação (para saber quem é o Capitão).
 */
export async function aplicarEscolha(b: Banco, jogadorId: string, e: Escolha, agora: Date, comVinculo: () => Promise<ReadonlySet<string>>): Promise<ResultadoDaEscolha> {
  const t = await temporadaAtual(b);
  if (!t || !temRegrasT2(t.numero)) return { ok: false, mensagem: 'Isso chega na Temporada 2.' };
  // Técnico e Interesse (ADR-0111) e Capitão em campo (ADR-0112).
  const doTecnico = await escolhaDoTecnico(b, jogadorId, e, agora, comVinculo, t.numero);
  if (doTecnico) return doTecnico;
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
      // Com Técnico (ADR-0111), o Capitão sugere; o Técnico decide.
      if (await tecnicoDoTime(b, j.time_id)) return decidirPlano(b, jogadorId, 'postura', e.valor, agora, await comVinculo());
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
    case 'FORMACAO': {
      // ADR-0044: mesma regra da Postura (só o Capitão, até o Corte); a linha guarda as duas.
      if (!ehFormacao(e.valor)) return { ok: false, mensagem: 'Formação desconhecida.' };
      // Com Técnico (ADR-0111), o Capitão sugere; o Técnico decide.
      if (await tecnicoDoTime(b, j.time_id)) return decidirPlano(b, jogadorId, 'formacao', e.valor, agora, await comVinculo());
      const p = await proximaPartidaDoTime(b, j.time_id, agora);
      if (!p) return { ok: false, mensagem: 'Não há jogo do seu Time aberto para escolher a Formação agora.' };
      const capitao = await capitaoDaPartida(b, p.id, j.time_id, await comVinculo());
      if (capitao !== jogadorId) return { ok: false, mensagem: 'Só o Capitão do Time escolhe a Formação.' };
      await b.query(
        `INSERT INTO postura (partida_id, time_id, formacao, capitao_id, escolhida_em) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (partida_id, time_id) DO UPDATE SET formacao = EXCLUDED.formacao, capitao_id = EXCLUDED.capitao_id, escolhida_em = EXCLUDED.escolhida_em`,
        [p.id, j.time_id, e.valor, jogadorId, agora.toISOString()],
      );
      return { ok: true, mensagem: `Formação ${e.valor} no próximo jogo.` };
    }
    case 'PALPITE':
      return registrarPalpite(b, jogadorId, String(e.valor ?? ''), agora);
    case 'COMPRA':
    case 'EQUIPAR':
    case 'TIRAR': {
      if (!temMoedas(t.numero)) return { ok: false, mensagem: 'A Loja abre na Temporada 3.' };
      const valor = String(e.valor ?? '');
      if (e.tipo === 'COMPRA') return comprarItem(b, jogadorId, valor, agora);
      return e.tipo === 'EQUIPAR' ? equiparItem(b, jogadorId, valor, agora) : tirarItem(b, jogadorId, valor);
    }
    case 'BATEDORES': {
      // ADR-0091: mesma regra da Postura (só o Capitão, até o Corte), a partir da T3.
      if (!temRegrasT3(t.numero)) return { ok: false, mensagem: 'Os Batedores chegam na Temporada 3.' };
      const ids = Array.isArray(e.valor) ? e.valor.map(String) : [];
      if (ids.length > QUANTIDADE_DE_BATEDORES) return { ok: false, mensagem: `Escolha no máximo ${QUANTIDADE_DE_BATEDORES} Batedores.` };
      if (new Set(ids).size !== ids.length) return { ok: false, mensagem: 'Cada Jogador só pode aparecer uma vez na lista.' };
      const p = await proximaPartidaDoTime(b, j.time_id, agora);
      if (!p) return { ok: false, mensagem: 'Não há jogo do seu Time aberto para escolher os Batedores agora.' };
      const capitao = await capitaoDaPartida(b, p.id, j.time_id, await comVinculo());
      if (capitao !== jogadorId) return { ok: false, mensagem: 'Só o Capitão do Time escolhe os Batedores.' };
      if (ids.length) {
        const doTime = (await b.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE time_id = $1 AND NOT banido AND id::text = ANY($2)`, [j.time_id, ids])).rows;
        if (doTime.length !== ids.length) return { ok: false, mensagem: 'Só dá para escolher Jogadores do seu Time.' };
      }
      await b.query(
        `INSERT INTO postura (partida_id, time_id, batedores, capitao_id, escolhida_em) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (partida_id, time_id) DO UPDATE SET batedores = EXCLUDED.batedores, capitao_id = EXCLUDED.capitao_id, escolhida_em = EXCLUDED.escolhida_em`,
        [p.id, j.time_id, JSON.stringify(ids), jogadorId, agora.toISOString()],
      );
      return { ok: true, mensagem: ids.length ? `${ids.length === 1 ? 'Batedor salvo' : `${ids.length} Batedores salvos`} para o próximo jogo.` : 'Ordem automática dos pênaltis no próximo jogo.' };
    }
    default:
      return { ok: false, mensagem: 'Escolha desconhecida.' };
  }
}

/**
 * As escolhas novas da T3 (ADRs 0111 e 0112) e tudo o que o Técnico faz; null quando a escolha
 * segue as regras de antes.
 */
async function escolhaDoTecnico(
  b: Banco,
  pessoaId: string,
  e: Escolha,
  agora: Date,
  comVinculo: () => Promise<ReadonlySet<string>>,
  numero: number,
): Promise<ResultadoDaEscolha | null> {
  const novas = ['FIXADOS', 'PEDIDO', 'CONVIDAR', 'CONVITE', 'TROCA_PROPOR', 'TROCA', 'SER_TECNICO', 'SAIR_DO_CARGO', 'ESCANTEIO', 'MARCACAO', 'GRITO', 'CHAMADA'];
  const cargo = await cargoDe(b, pessoaId);
  if (!cargo && !novas.includes(e.tipo)) return null;
  if (!temRegrasT3(numero)) return { ok: false, mensagem: 'Isso chega na Temporada 3.' };
  const v = 'valor' in e ? e.valor : undefined;
  const decisao = (x: unknown): { aceitar: boolean; id: number } | null => {
    const m = /^(ACEITAR|RECUSAR):(\d+)$/.exec(String(x ?? ''));
    return m ? { aceitar: m[1] === 'ACEITAR', id: Number(m[2]) } : null;
  };
  switch (e.tipo) {
    case 'POSTURA':
    case 'FORMACAO':
      return decidirPlano(b, pessoaId, e.tipo === 'POSTURA' ? 'postura' : 'formacao', v, agora, await comVinculo());
    case 'FIXADOS':
      return decidirPlano(b, pessoaId, 'fixados', v, agora, await comVinculo());
    case 'PEDIDO': {
      const d = decisao(v);
      if (!d) return { ok: false, mensagem: 'Pedido não entendido.' };
      const r = await decidirPedido(b, pessoaId, d.id, d.aceitar, agora, await comVinculo());
      return { ok: r.ok, mensagem: r.mensagem };
    }
    case 'CONVIDAR':
      return convidar(b, { autorId: pessoaId, jogadorId: String(v ?? ''), agora, comVinculo: await comVinculo() });
    case 'CONVITE': {
      const d = decisao(v);
      return d ? responderConvite(b, pessoaId, d.id, d.aceitar, agora) : { ok: false, mensagem: 'Convite não entendido.' };
    }
    case 'TROCA_PROPOR': {
      const [a, bb] = String(v ?? '').split(':');
      const usada = async (id: string) =>
        (await b.query(`SELECT 1 FROM transferencia x JOIN temporada t ON t.id = x.temporada_id WHERE x.jogador_id::text = $1 AND t.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') AND NOT x.gratis AND x.janela = $2`, [
          id,
          await naJanela(b, agora),
        ])).rows.length > 0;
      return proporTroca(b, { autorId: pessoaId, jogadorA: a ?? '', jogadorB: bb ?? '', agora, comVinculo: await comVinculo(), trocaUsada: usada });
    }
    case 'TROCA': {
      const d = decisao(v);
      if (!d) return { ok: false, mensagem: 'Troca não entendida.' };
      const r = await responderTroca(b, { pessoaId, trocaId: d.id, aceitar: d.aceitar, agora, comVinculo: await comVinculo() });
      return { ok: r.ok, mensagem: r.mensagem };
    }
    case 'SER_TECNICO':
      return pedirParaSerTecnico(b, pessoaId, String(v ?? '') as TimeId, agora);
    case 'SAIR_DO_CARGO': {
      if (!cargo) return { ok: false, mensagem: 'Você não é Técnico.' };
      await deixarCargo(b, cargo.id, 'PEDIU', agora);
      return { ok: true, mensagem: 'Você deixou o cargo de Técnico.' };
    }
    case 'ESCANTEIO':
      return decidirEscanteio(b, pessoaId, Array.isArray(v) ? v.map(String) : [], agora, await comVinculo());
    case 'MARCACAO':
      return decidirMarcacao(b, pessoaId, String(v ?? ''), agora, await comVinculo());
    case 'GRITO':
      return escolherGrito(b, pessoaId, Number(v), agora, await comVinculo());
    case 'CHAMADA':
      return chamarPresenca(b, pessoaId, agora, await comVinculo());
    default:
      // O Técnico não joga: Presença, Treino, Palpite e o resto são do Jogador.
      return { ok: false, mensagem: 'Isso é do Jogador; o Técnico cuida do Time.' };
  }
}

/** A Janela de Transferências está aberta agora (Pré-temporada até o Corte do primeiro jogo)? */
async function naJanela(b: Banco, agora: Date): Promise<boolean> {
  const t = (
    await b.query<{ status: string; primeiro: Date | string | null }>(
      `SELECT t.status, (SELECT min(p.apito_inicial) FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id) AS primeiro
         FROM temporada t WHERE t.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY t.status = 'EM_ANDAMENTO' DESC, t.numero LIMIT 1`,
    )
  ).rows[0];
  if (!t) return false;
  return t.primeiro ? agora.getTime() < new Date(t.primeiro).getTime() - CORTE_MINUTOS * 60_000 : t.status === 'PRE_TEMPORADA';
}

/** Batedores de cada Time na Partida (ADR-0091; sem escolha, lista vazia e vale a ordem automática). */
export async function batedoresDaPartida(b: Banco, partidaId: number, mandante: TimeId, visitante: TimeId): Promise<{ mandante: string[]; visitante: string[] }> {
  const linhas = (await b.query<{ time_id: TimeId; batedores: string[] | null }>(`SELECT time_id, batedores FROM postura WHERE partida_id = $1`, [partidaId])).rows;
  const de = (t: TimeId) => (linhas.find((l) => l.time_id === t)?.batedores ?? []).map(String);
  return { mandante: de(mandante), visitante: de(visitante) };
}

/** Tamanho de cada Elenco (Jogadores não banidos), para a Arquibancada da T2 (ADR-0019). */
export async function tamanhoDosElencos(b: Banco): Promise<Map<TimeId, number>> {
  const r = await b.query<{ time_id: TimeId; n: string }>(`SELECT time_id, count(*) AS n FROM jogador WHERE NOT banido GROUP BY time_id`);
  return new Map(r.rows.map((l) => [l.time_id, Number(l.n)]));
}
