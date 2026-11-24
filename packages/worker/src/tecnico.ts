/**
 * Técnico e Interesse (ADR-0110).
 *
 * O Técnico é uma pessoa fora do Elenco (`jogador_todos.papel = 'TECNICO'`) que cuida de um
 * Time: decide o Plano do Time e os Pedidos, Convites e Trocas casadas. Sem Técnico, quem decide
 * é o Capitão com Vínculo; sem os dois, valem as regras automáticas de antes.
 *
 * Os prazos (24 horas ou até o Corte do próximo jogo do Time) são resolvidos na coleta
 * (`resolverPrazos`): o silêncio do Técnico vale como aceito.
 */
import { CORTE_MINUTOS, FALA_DO_TIME, temRegrasT3, type Posicao, type TimeId } from '@liga/shared';

const NOME_DA_POSICAO: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };
const doTimeCurto = (t: TimeId) => `d${FALA_DO_TIME[t].artigo} ${FALA_DO_TIME[t].curto}`;
import { avisarPessoas, avisoDaTransferencia } from './avisosPessoais.js';
import type { Banco } from './banco.js';
import { LIMITE_POR_POSICAO, transferirJogador, type Resultado } from './coletar.js';
import { seriesAtivas, seriesDaTemporada } from './series.js';
import { capitaoDaPartida, ordemDoCapitao, proximaPartidaDoTime, suspensos } from './temporada2.js';

/** O Técnico tem 24 horas para responder (ou até o Corte, se vier antes). */
export const PRAZO_DO_PEDIDO_MS = 24 * 3600_000;
/** Convites e Trocas casadas abertos ao mesmo tempo, por Time ou por pessoa. */
export const CONVITES_ABERTOS = 3;
export const TROCAS_ABERTAS = 3;
/** Titulares fixados pelo Técnico (ou pelo Capitão, sem Técnico). */
export const MAXIMO_DE_FIXADOS = 3;
/** Jogos seguidos do Time sem nenhuma decisão do Técnico: perde o cargo. */
export const JOGOS_SEM_DECIDIR = 3;

const CORTE_MS = CORTE_MINUTOS * 60_000;
const iso = (d: Date) => d.toISOString();

export interface TecnicoAtivo {
  id: number;
  jogadorId: string;
  username: string;
  apelido: string | null;
  time: TimeId;
}

/** Quem decide pelo Time agora: o Técnico, ou o Capitão com Vínculo (com a Posição dele). */
export type Decisor = { tipo: 'TECNICO'; jogadorId: string; tecnicoId: number } | { tipo: 'CAPITAO'; jogadorId: string; posicao: Posicao };

export async function tecnicoDoTime(b: Banco, time: TimeId): Promise<TecnicoAtivo | null> {
  const r = (
    await b.query<{ id: number; jogador_id: string; username: string; apelido: string | null; time_id: TimeId }>(
      `SELECT t.id, t.jogador_id::text AS jogador_id, j.username, j.apelido, t.time_id FROM tecnico t JOIN jogador_todos j ON j.id = t.jogador_id
       WHERE t.time_id = $1 AND t.status = 'ATIVO'`,
      [time],
    )
  ).rows[0];
  return r ? { id: Number(r.id), jogadorId: r.jogador_id, username: r.username, apelido: r.apelido, time: r.time_id } : null;
}

/** O cargo de Técnico de uma pessoa (ativo), ou null. */
export async function cargoDe(b: Banco, jogadorId: string): Promise<TecnicoAtivo | null> {
  const r = (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM tecnico WHERE jogador_id = $1 AND status = 'ATIVO'`, [jogadorId])).rows[0];
  return r ? tecnicoDoTime(b, r.time_id) : null;
}

/** Todos os Técnicos ativos (para o site e os Avisos). */
export async function tecnicosAtivos(b: Banco): Promise<TecnicoAtivo[]> {
  return (
    await b.query<{ id: number; jogador_id: string; username: string; apelido: string | null; time_id: TimeId }>(
      `SELECT t.id, t.jogador_id::text AS jogador_id, j.username, j.apelido, t.time_id FROM tecnico t JOIN jogador_todos j ON j.id = t.jogador_id
       WHERE t.status = 'ATIVO' ORDER BY t.time_id`,
    )
  ).rows.map((r) => ({ id: Number(r.id), jogadorId: r.jogador_id, username: r.username, apelido: r.apelido, time: r.time_id }));
}

/**
 * Quem decide pelo Time: o Técnico ativo; senão o Capitão do próximo jogo, se tem Vínculo (só
 * quem tem Vínculo decide pelo site); senão ninguém (valem as regras automáticas).
 */
export async function quemDecide(b: Banco, time: TimeId, agora: Date, comVinculo: ReadonlySet<string>): Promise<Decisor | null> {
  const t = await tecnicoDoTime(b, time);
  if (t) return { tipo: 'TECNICO', jogadorId: t.jogadorId, tecnicoId: t.id };
  const p = await proximaPartidaDoTime(b, time, agora);
  let capitao: string | null;
  if (p) capitao = await capitaoDaPartida(b, p.id, time, comVinculo);
  else {
    // Antes de existir jogo do Time (Pré-temporada sem calendário): o primeiro da ordem com Vínculo.
    capitao = (await ordemDoCapitao(b, time)).find((id) => comVinculo.has(id)) ?? null;
  }
  if (!capitao || !comVinculo.has(capitao)) return null;
  const posicao = (await b.query<{ posicao: Posicao }>(`SELECT posicao FROM jogador WHERE id = $1`, [capitao])).rows[0]?.posicao;
  return posicao ? { tipo: 'CAPITAO', jogadorId: capitao, posicao } : null;
}

/** Prazo de uma decisão: 24 horas, ou o Corte do próximo jogo do Time, o que vier antes. */
export async function prazoDoTime(b: Banco, time: TimeId, quando: Date): Promise<Date> {
  const ate = new Date(quando.getTime() + PRAZO_DO_PEDIDO_MS);
  const p = (
    await b.query<{ apito_inicial: Date | string }>(
      `SELECT apito_inicial FROM partida WHERE (mandante_id = $1 OR visitante_id = $1) AND status = 'PENDENTE' AND apito_inicial > $2 ORDER BY apito_inicial LIMIT 1`,
      [time, iso(quando)],
    )
  ).rows[0];
  if (!p) return ate;
  const corte = new Date(new Date(p.apito_inicial).getTime() - CORTE_MS);
  return corte > quando && corte < ate ? corte : ate;
}

/** Registra uma decisão do Técnico (3 jogos sem nenhuma, ele perde o cargo). */
export async function marcarDecisao(b: Banco, jogadorId: string, agora: Date): Promise<void> {
  await b.query(`UPDATE tecnico SET decidiu_em = $2 WHERE jogador_id = $1 AND status = 'ATIVO'`, [jogadorId, iso(agora)]);
}

// ------------------------------------------------------------------ o cargo

export interface Aprovacao {
  jogadorId: string;
  /** Seguidor que nunca jogou (ganhou uma linha nova). */
  novo: boolean;
  /** Jogador que pendurou as chuteiras para virar Técnico. */
  pendurou: boolean;
}

/**
 * Aprova um Técnico (ADR-0110): um seguidor que pediu na DM ou um Jogador que pediu pelo site
 * para pendurar as chuteiras. O Time não pode ter Técnico ativo. Quem já é Técnico de outro
 * Time muda de Time só na Janela (`naJanela`).
 */
export async function aprovarTecnico(
  b: Banco,
  o: { username: string; igUserId?: string | null; time: TimeId; agora: Date; naJanela: boolean },
): Promise<Aprovacao> {
  const { series } = await seriesAtivas(b);
  if (![...series.A, ...series.B].includes(o.time)) throw new Error(`O ${o.time} não joga esta Temporada.`);
  const outro = await tecnicoDoTime(b, o.time);
  const nome = o.username.replace(/^@/, '').trim();
  const pessoa = (
    await b.query<{ id: string; papel: string; banido: boolean; time_id: TimeId }>(
      `SELECT id::text AS id, papel, banido, time_id FROM jogador_todos WHERE lower(username) = lower($1) ORDER BY (papel = 'JOGADOR') DESC, id LIMIT 1`,
      [nome],
    )
  ).rows[0];
  if (pessoa?.banido) throw new Error(`@${nome} está banido.`);
  if (outro && outro.jogadorId !== pessoa?.id) throw new Error(`O ${o.time} já tem Técnico (@${outro.username}).`);
  if (outro) throw new Error(`@${nome} já é o Técnico do ${o.time}.`);
  const temporada = (await b.query<{ id: number; numero: number }>(`SELECT id, numero FROM temporada WHERE status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY status = 'EM_ANDAMENTO' DESC, numero LIMIT 1`)).rows[0];

  let jogadorId: string;
  let novo = false;
  let pendurou = false;
  if (!pessoa) {
    // Seguidor que nunca jogou: uma linha fora do Elenco, só para o cargo, o Vínculo e as Moedas.
    jogadorId = (
      await b.query<{ id: string }>(
        `INSERT INTO jogador_todos (ig_user_id, username, time_id, posicao, ovr, inscrito_em, papel, nunca_jogou)
         VALUES ($1, $2, $3, 'MEI', 60, $4, 'TECNICO', true) RETURNING id::text AS id`,
        [o.igUserId || `dm-${nome.toLowerCase()}`, nome, o.time, iso(o.agora)],
      )
    ).rows[0]!.id;
    novo = true;
  } else {
    jogadorId = pessoa.id;
    const cargo = await cargoDe(b, jogadorId);
    if (cargo) {
      if (!o.naJanela) throw new Error(`@${nome} já é Técnico do ${cargo.time}: o Técnico só muda de Time na Janela.`);
      await deixarCargo(b, cargo.id, 'MUDOU_DE_TIME', o.agora);
    }
    if (pessoa.papel === 'JOGADOR') {
      // Pendura as chuteiras: sai do Elenco e guarda boneco, Carreira, Moedas e Itens.
      await b.query(`DELETE FROM capitao_a_mao WHERE jogador_id = $1`, [jogadorId]);
      await b.query(`UPDATE jogador_todos SET papel = 'TECNICO', pendurou_na_temporada = $2 WHERE id = $1`, [jogadorId, temporada?.numero ?? null]);
      await b.query(`UPDATE fila_espera SET status = 'SAIU' WHERE jogador_id = $1 AND status = 'ESPERANDO'`, [jogadorId]);
      await b.query(`UPDATE pedido_transferencia SET status = 'CAIU', motivo = 'VIROU_TECNICO', decidido_em = $2 WHERE jogador_id = $1 AND status = 'ABERTO'`, [jogadorId, iso(o.agora)]);
      pendurou = true;
    }
    await b.query(`UPDATE jogador_todos SET time_id = $2 WHERE id = $1`, [jogadorId, o.time]);
  }
  // O pedido pelo site (se houve) vira o cargo; senão, um cargo novo.
  const pedido = (await b.query<{ id: number }>(`SELECT id FROM tecnico WHERE jogador_id = $1 AND status = 'PEDIDO'`, [jogadorId])).rows[0];
  if (pedido) {
    await b.query(`UPDATE tecnico SET status = 'ATIVO', time_id = $2, aprovado_em = $3, decidiu_em = $3 WHERE id = $1`, [pedido.id, o.time, iso(o.agora)]);
  } else {
    await b.query(`INSERT INTO tecnico (jogador_id, time_id, status, pedido_em, aprovado_em, decidiu_em) VALUES ($1, $2, 'ATIVO', $3, $3, $3)`, [jogadorId, o.time, iso(o.agora)]);
  }
  return { jogadorId, novo, pendurou };
}

/**
 * Pedido de um Jogador, pelo site, para pendurar as chuteiras e treinar um Time sem Técnico.
 * Só vira cargo quando o dono aprova (o Jogador segue jogando até lá).
 */
export async function pedirParaSerTecnico(b: Banco, jogadorId: string, time: TimeId, agora: Date): Promise<{ ok: boolean; mensagem: string }> {
  const t = (await b.query<{ numero: number }>(`SELECT numero FROM temporada WHERE status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY status = 'EM_ANDAMENTO' DESC, numero LIMIT 1`)).rows[0];
  if (!t || !temRegrasT3(t.numero)) return { ok: false, mensagem: 'O Técnico chega na Temporada 3.' };
  const j = (await b.query<{ banido: boolean }>(`SELECT banido FROM jogador WHERE id = $1`, [jogadorId])).rows[0];
  if (!j || j.banido) return { ok: false, mensagem: 'Jogador não encontrado.' };
  const { series } = await seriesAtivas(b);
  if (![...series.A, ...series.B].includes(time)) return { ok: false, mensagem: 'Esse Time não joga esta Temporada.' };
  if (await tecnicoDoTime(b, time)) return { ok: false, mensagem: 'Esse Time já tem Técnico.' };
  await b.query(`DELETE FROM tecnico WHERE jogador_id = $1 AND status = 'PEDIDO'`, [jogadorId]);
  await b.query(`INSERT INTO tecnico (jogador_id, time_id, status, pedido_em) VALUES ($1, $2, 'PEDIDO', $3)`, [jogadorId, time, iso(agora)]);
  return { ok: true, mensagem: 'Pedido para ser Técnico enviado. Você segue jogando até a Liga aprovar; aprovado, pendura as chuteiras e cuida do Time.' };
}

/** Tira o Técnico do cargo. Os pedidos que ele decidiria passam para o Capitão (quemDecide). */
export async function deixarCargo(b: Banco, tecnicoId: number, motivo: string, agora: Date): Promise<void> {
  await b.query(`UPDATE tecnico SET status = 'SAIU', saiu_em = $2, motivo = $3 WHERE id = $1 AND status = 'ATIVO'`, [tecnicoId, iso(agora), motivo]);
  // O que estava aberto para ele decidir fica sem decisor; a coleta recalcula na hora do prazo.
  const jogador = (await b.query<{ jogador_id: string }>(`SELECT jogador_id::text AS jogador_id FROM tecnico WHERE id = $1`, [tecnicoId])).rows[0];
  if (jogador) await b.query(`UPDATE pedido_transferencia SET decisor_id = NULL WHERE decisor_id = $1 AND status = 'ABERTO'`, [jogador.jogador_id]);
}

/**
 * Técnicos sem nenhuma decisão em 3 jogos seguidos do Time (já jogados desde a última decisão)
 * perdem o cargo. Devolve os Times que ficaram sem Técnico.
 */
export async function conferirInatividade(b: Banco, agora: Date): Promise<TimeId[]> {
  const ativos = (
    await b.query<{ id: number; time_id: TimeId; desde: Date | string }>(`SELECT id, time_id, coalesce(decidiu_em, aprovado_em, pedido_em) AS desde FROM tecnico WHERE status = 'ATIVO'`)
  ).rows;
  const sairam: TimeId[] = [];
  for (const t of ativos) {
    const jogos = Number(
      (
        await b.query<{ n: string }>(
          `SELECT count(*) AS n FROM partida WHERE (mandante_id = $1 OR visitante_id = $1) AND resultado IS NOT NULL AND apito_inicial > $2 AND apito_inicial <= $3`,
          [t.time_id, iso(new Date(t.desde)), iso(agora)],
        )
      ).rows[0]!.n,
    );
    if (jogos >= JOGOS_SEM_DECIDIR) {
      await deixarCargo(b, Number(t.id), 'INATIVO', agora);
      sairam.push(t.time_id);
    }
  }
  return sairam;
}

/**
 * Inscrição (ENTRO) de quem está fora do Elenco como Técnico (ADR-0110). Quem nunca jogou entra
 * como novato e perde o cargo; quem pendurou as chuteiras volta só numa Janela de Temporada
 * seguinte, com o OVR de quando parou. Devolve null quando a pessoa não é Técnico.
 */
export async function tecnicoQuerJogar(
  b: Banco,
  igUserId: string,
  agora: Date,
): Promise<{ jogadorId: string; nuncaJogou: boolean; podeVoltar: boolean; mensagem?: string } | null> {
  const p = (
    await b.query<{ id: string; nunca_jogou: boolean; pendurou_na_temporada: number | null }>(
      `SELECT id::text AS id, nunca_jogou, pendurou_na_temporada FROM jogador_todos WHERE ig_user_id = $1 AND papel = 'TECNICO'`,
      [igUserId],
    )
  ).rows[0];
  if (!p) return null;
  if (p.nunca_jogou) return { jogadorId: p.id, nuncaJogou: true, podeVoltar: true };
  const t = (
    await b.query<{ numero: number; status: string; primeiro: Date | string | null }>(
      `SELECT t.numero, t.status, (SELECT min(pa.apito_inicial) FROM partida pa JOIN rodada r ON r.id = pa.rodada_id WHERE r.temporada_id = t.id) AS primeiro
         FROM temporada t WHERE t.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY t.status = 'EM_ANDAMENTO' DESC, t.numero LIMIT 1`,
    )
  ).rows[0];
  const naJanela = !!t && (t.primeiro ? agora.getTime() < new Date(t.primeiro).getTime() - CORTE_MS : t.status === 'PRE_TEMPORADA');
  const seguinte = !!t && (p.pendurou_na_temporada === null || t.numero > p.pendurou_na_temporada);
  if (naJanela && seguinte) return { jogadorId: p.id, nuncaJogou: false, podeVoltar: true };
  return {
    jogadorId: p.id,
    nuncaJogou: false,
    podeVoltar: false,
    mensagem: 'você pendurou as chuteiras para ser Técnico. Dá para voltar a jogar na Janela da próxima temporada, com o OVR de quando parou. ⚽',
  };
}

/** Tira o cargo de quem voltou a jogar e põe a pessoa de volta no Elenco. */
export async function voltarAJogar(b: Banco, jogadorId: string, agora: Date): Promise<void> {
  const cargo = (await b.query<{ id: number }>(`SELECT id FROM tecnico WHERE jogador_id = $1 AND status = 'ATIVO'`, [jogadorId])).rows[0];
  if (cargo) await deixarCargo(b, Number(cargo.id), 'VOLTOU_A_JOGAR', agora);
  await b.query(`DELETE FROM tecnico WHERE jogador_id = $1 AND status = 'PEDIDO'`, [jogadorId]);
  await b.query(`UPDATE jogador_todos SET papel = 'JOGADOR', nunca_jogou = false, pendurou_na_temporada = NULL WHERE id = $1`, [jogadorId]);
}

// ------------------------------------------------------------------ Pedido de Transferência

/**
 * Se a troca precisa do aceite do Time de destino, devolve quem decide (null quando decide o
 * prazo: o Capitão da mesma Posição do pedido) e o prazo. Sem decisor nenhum, ou nas exceções,
 * a troca é direta (devolve null).
 */
export async function aceiteNecessario(
  b: Banco,
  o: { de: TimeId; para: TimeId; posicao: Posicao; temporadaId: number; janela: boolean; gratis: boolean; quando: Date; comVinculo: ReadonlySet<string> },
): Promise<{ decisorId: string | null; prazo: Date } | null> {
  const t = (await b.query<{ numero: number }>(`SELECT numero FROM temporada WHERE id = $1`, [o.temporadaId])).rows[0];
  if (!t || !temRegrasT3(t.numero)) return null;
  // Quem caiu na T2 (os Times da Série B da T3) troca direto para a Série A na Janela da T3 (ADR-0062).
  if (o.janela && t.numero === 3) {
    const s = await seriesDaTemporada(b, o.temporadaId);
    if (s.B.includes(o.de) && s.A.includes(o.para)) return null;
  }
  const d = await quemDecide(b, o.para, o.quando, o.comVinculo);
  if (!d) return null;
  const prazo = await prazoDoTime(b, o.para, o.quando);
  // O Capitão não decide pedido da própria Posição: vale o prazo.
  const decisorId = d.tipo === 'CAPITAO' && d.posicao === o.posicao ? null : d.jogadorId;
  return { decisorId, prazo };
}

export async function abrirPedido(
  b: Banco,
  o: { jogadorId: string; temporadaId: number; de: TimeId; para: TimeId; posicao: Posicao; ref: string; quando: Date; prazo: Date; decisorId: string | null; origem?: 'PEDIDO' | 'FILA' },
): Promise<number> {
  // Um pedido aberto por Jogador: o novo substitui o anterior.
  await b.query(`UPDATE pedido_transferencia SET status = 'CAIU', motivo = 'NOVO_PEDIDO', decidido_em = $2 WHERE jogador_id = $1 AND status = 'ABERTO'`, [o.jogadorId, iso(o.quando)]);
  const id = Number(
    (
      await b.query<{ id: number }>(
        `INSERT INTO pedido_transferencia (jogador_id, temporada_id, de_time, para_time, posicao, origem, ref, pedido_em, prazo, decisor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [o.jogadorId, o.temporadaId, o.de, o.para, o.posicao, o.origem ?? 'PEDIDO', o.ref, iso(o.quando), iso(o.prazo), o.decisorId],
      )
    ).rows[0]!.id,
  );
  // Aviso pessoal para quem decide (ADR-0110).
  if (o.decisorId) {
    const quem = (await b.query<{ nome: string }>(`SELECT coalesce(apelido, '@' || username) AS nome FROM jogador_todos WHERE id = $1`, [o.jogadorId])).rows[0]?.nome ?? 'Um Jogador';
    await avisarPessoas(b, [o.decisorId], {
      tipo: 'PEDIDO',
      titulo: 'Pedido de Transferência',
      corpo: `${quem} (${NOME_DA_POSICAO[o.posicao]}) quer jogar no seu Time. Sem resposta até o prazo, vale como aceito.`,
      url: `#/time/${o.para}`,
    });
  }
  return id;
}

/** Aviso de uma decisão para quem pediu: a resposta no comentário (ref) ou no site. */
export interface AvisoDoPedido {
  jogadorId: string;
  ref: string;
  mensagem: string;
}

interface PedidoAberto {
  id: number;
  jogador_id: string;
  para_time: TimeId;
  posicao: Posicao;
  ref: string;
  pedido_em: Date | string;
  decisor_id: string | null;
}

/** Avisos pessoais (no App) das respostas de Pedido, Troca casada e Fila. */
async function avisarTransferencias(b: Banco, avisos: readonly AvisoDoPedido[]): Promise<void> {
  for (const a of avisos) await avisarPessoas(b, [a.jogadorId], avisoDaTransferencia(a.jogadorId, a.mensagem));
}

/** Aplica um Pedido aceito: a Transferência de verdade, conferindo tudo de novo. */
async function efetivarPedido(b: Banco, p: PedidoAberto, agora: Date, comoAceito: string): Promise<AvisoDoPedido> {
  const r = await transferirJogador(b, p.jogador_id, { times: [p.para_time], posicao: p.posicao }, { quando: new Date(p.pedido_em), ref: p.ref, semAceite: true, origemFila: true });
  const ok = r.resultado === 'TRANSFERIDO';
  await b.query(`UPDATE pedido_transferencia SET status = $2, decidido_em = $3, motivo = $4 WHERE id = $1`, [p.id, ok ? 'ACEITO' : 'CAIU', iso(agora), ok ? comoAceito : r.resultado]);
  return {
    jogadorId: p.jogador_id,
    ref: p.ref,
    mensagem: ok ? `o pedido foi aceito: ${r.mensagem ?? ''}`.trim() : `o pedido para o time ${p.para_time} caiu (${motivoDaQueda(r.resultado)}). Não gastou a sua troca. ⚽`,
  };
}

function motivoDaQueda(r: Resultado): string {
  if (r === 'DESTINO_CHEIO') return 'a vaga acabou enquanto esperava';
  if (r === 'TRANSFERENCIA_USADA') return 'você já tinha usado a troca';
  if (r === 'TRANSFERENCIA_FECHADA') return 'as transferências fecharam';
  return 'não deu mais para trocar';
}

/**
 * Decisão do Técnico (ou do Capitão) sobre um Pedido do Time dele. Recusa não gasta a troca.
 */
export async function decidirPedido(
  b: Banco,
  decisorId: string,
  pedidoId: number,
  aceitar: boolean,
  agora: Date,
  comVinculo: ReadonlySet<string>,
): Promise<{ ok: boolean; mensagem: string; aviso?: AvisoDoPedido }> {
  const p = (
    await b.query<PedidoAberto & { posicao: Posicao }>(
      `SELECT id, jogador_id::text AS jogador_id, para_time, posicao, ref, pedido_em, decisor_id::text AS decisor_id FROM pedido_transferencia WHERE id = $1 AND status = 'ABERTO'`,
      [pedidoId],
    )
  ).rows[0];
  if (!p) return { ok: false, mensagem: 'Esse pedido já foi decidido.' };
  const d = await quemDecide(b, p.para_time, agora, comVinculo);
  if (!d || d.jogadorId !== decisorId) return { ok: false, mensagem: 'Só o Técnico (ou o Capitão, sem Técnico) do Time decide os pedidos.' };
  if (d.tipo === 'CAPITAO' && d.posicao === p.posicao) return { ok: false, mensagem: 'O Capitão não decide pedido da própria Posição: vale o prazo.' };
  await marcarDecisao(b, decisorId, agora);
  if (!aceitar) {
    await b.query(`UPDATE pedido_transferencia SET status = 'RECUSADO', decidido_em = $2, motivo = 'RECUSADO' WHERE id = $1`, [p.id, iso(agora)]);
    const recusa = { jogadorId: p.jogador_id, ref: p.ref, mensagem: `o time ${p.para_time} recusou o pedido. Não gastou a sua troca: dá para pedir outro time. ⚽` };
    await avisarTransferencias(b, [recusa]);
    return { ok: true, mensagem: 'Pedido recusado.', aviso: recusa };
  }
  const aviso = await efetivarPedido(b, p, agora, 'ACEITO');
  await avisarTransferencias(b, [aviso]);
  return { ok: true, mensagem: aviso.mensagem.startsWith('o pedido foi aceito') ? 'Pedido aceito: o Jogador já é do Time.' : 'Não deu para aceitar: o pedido caiu.', aviso };
}

/**
 * Prazos vencidos (na coleta): o Pedido sem resposta vale como aceito; o Convite expira; a
 * Troca casada com os dois Jogadores de acordo é feita; a Fila chama quem tem vaga.
 */
export async function resolverPrazos(b: Banco, agora: Date): Promise<AvisoDoPedido[]> {
  const avisos: AvisoDoPedido[] = [];
  const vencidos = (
    await b.query<PedidoAberto>(
      `SELECT id, jogador_id::text AS jogador_id, para_time, posicao, ref, pedido_em, decisor_id::text AS decisor_id FROM pedido_transferencia
       WHERE status = 'ABERTO' AND prazo <= $1 ORDER BY pedido_em`,
      [iso(agora)],
    )
  ).rows;
  for (const p of vencidos) avisos.push(await efetivarPedido(b, p, agora, 'PRAZO'));
  await b.query(`UPDATE convite SET status = 'EXPIRADO', decidido_em = $1 WHERE status = 'ABERTO' AND expira_em <= $1`, [iso(agora)]);
  avisos.push(...(await resolverTrocasVencidas(b, agora)));
  avisos.push(...(await chamarFila(b, agora)));
  await avisarTransferencias(b, avisos);
  return avisos;
}

// ------------------------------------------------------------------ Convite

/** Posição cheia num Time (Limite por Posição), sem contar `menos`. */
export async function posicaoCheia(b: Banco, time: TimeId, posicao: Posicao, menos?: string): Promise<boolean> {
  const n = Number(
    (await b.query<{ n: string }>(`SELECT count(*) AS n FROM jogador WHERE time_id = $1 AND posicao = $2 AND NOT banido AND id::text <> $3`, [time, posicao, menos ?? '-1'])).rows[0]!.n,
  );
  return n >= LIMITE_POR_POSICAO[posicao];
}

export async function convidar(
  b: Banco,
  o: { autorId: string; jogadorId: string; agora: Date; comVinculo: ReadonlySet<string> },
): Promise<{ ok: boolean; mensagem: string }> {
  const alvo = (await b.query<{ time_id: TimeId; posicao: Posicao; banido: boolean }>(`SELECT time_id, posicao, banido FROM jogador WHERE id = $1`, [o.jogadorId])).rows[0];
  if (!alvo || alvo.banido) return { ok: false, mensagem: 'Jogador não encontrado.' };
  if (!o.comVinculo.has(o.jogadorId)) return { ok: false, mensagem: 'Só dá para convidar quem tem Vínculo (para aceitar pelo site).' };
  const cargo = await cargoDe(b, o.autorId);
  const time =
    cargo?.time ?? (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE id = $1`, [o.autorId])).rows[0]?.time_id;
  if (!time) return { ok: false, mensagem: 'Você não cuida de nenhum Time.' };
  const d = await quemDecide(b, time, o.agora, o.comVinculo);
  if (!d || d.jogadorId !== o.autorId) return { ok: false, mensagem: 'Só o Técnico (ou o Capitão, sem Técnico) convida.' };
  if (alvo.time_id === time) return { ok: false, mensagem: 'Esse Jogador já é do seu Time.' };
  if (await posicaoCheia(b, time, alvo.posicao)) return { ok: false, mensagem: 'A Posição dele está cheia no seu Time: proponha uma Troca casada.' };
  const abertos = Number((await b.query<{ n: string }>(`SELECT count(*) AS n FROM convite WHERE time_id = $1 AND status = 'ABERTO'`, [time])).rows[0]!.n);
  if (abertos >= CONVITES_ABERTOS) return { ok: false, mensagem: `O Time já tem ${CONVITES_ABERTOS} Convites abertos.` };
  const expira = await prazoDoTime(b, time, o.agora);
  await b.query(
    `INSERT INTO convite (time_id, autor_id, jogador_id, posicao, criado_em, expira_em) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (time_id, jogador_id) WHERE status = 'ABERTO' DO NOTHING`,
    [time, o.autorId, o.jogadorId, alvo.posicao, iso(o.agora), iso(expira)],
  );
  await marcarDecisao(b, o.autorId, o.agora);
  await avisarPessoas(b, [o.jogadorId], {
    tipo: 'CONVITE',
    titulo: `Convite ${doTimeCurto(time)}`,
    corpo: `${cargo ? 'O Técnico' : 'O Capitão'} ${doTimeCurto(time)} quer você no Time. Responda no site: vale 24 horas (ou até o Corte).`,
    url: `#/jogador/${o.jogadorId}`,
  });
  return { ok: true, mensagem: 'Convite enviado. Vale 24 horas (ou até o Corte).' };
}

/** O Jogador responde a um Convite. Aceito, troca na hora, usando a troca dele. */
export async function responderConvite(b: Banco, jogadorId: string, conviteId: number, aceitar: boolean, agora: Date): Promise<{ ok: boolean; mensagem: string }> {
  const c = (
    await b.query<{ id: number; time_id: TimeId; posicao: Posicao }>(`SELECT id, time_id, posicao FROM convite WHERE id = $1 AND jogador_id = $2 AND status = 'ABERTO' AND expira_em > $3`, [
      conviteId,
      jogadorId,
      iso(agora),
    ])
  ).rows[0];
  if (!c) return { ok: false, mensagem: 'Esse Convite não vale mais.' };
  if (!aceitar) {
    await b.query(`UPDATE convite SET status = 'RECUSADO', decidido_em = $2 WHERE id = $1`, [c.id, iso(agora)]);
    return { ok: true, mensagem: 'Convite recusado.' };
  }
  const r = await transferirJogador(b, jogadorId, { times: [c.time_id], posicao: c.posicao }, { quando: agora, ref: `convite:${c.id}`, semAceite: true, origemFila: true });
  const ok = r.resultado === 'TRANSFERIDO';
  await b.query(`UPDATE convite SET status = $2, decidido_em = $3 WHERE id = $1`, [c.id, ok ? 'ACEITO' : 'CAIU', iso(agora)]);
  if (ok) await b.query(`UPDATE convite SET status = 'CAIU', decidido_em = $2 WHERE jogador_id = $1 AND status = 'ABERTO'`, [jogadorId, iso(agora)]);
  return { ok, mensagem: ok ? `Convite aceito: ${r.mensagem ?? ''}`.trim() : `Não deu: ${motivoDaQueda(r.resultado)}.` };
}

// ------------------------------------------------------------------ Troca casada

/**
 * Propõe uma Troca casada: o autor é um dos dois Jogadores, ou o Técnico (ou o Capitão) do Time
 * de um deles. Os dois precisam ter Vínculo, a mesma Posição e a troca ainda não usada.
 */
export async function proporTroca(
  b: Banco,
  o: { autorId: string; jogadorA: string; jogadorB: string; agora: Date; comVinculo: ReadonlySet<string>; trocaUsada: (jogadorId: string) => Promise<boolean> },
): Promise<{ ok: boolean; mensagem: string }> {
  const [a, bb] = await Promise.all(
    [o.jogadorA, o.jogadorB].map(async (id) => (await b.query<{ id: string; time_id: TimeId; posicao: Posicao }>(`SELECT id::text AS id, time_id, posicao FROM jogador WHERE id = $1 AND NOT banido`, [id])).rows[0]),
  );
  if (!a || !bb) return { ok: false, mensagem: 'Jogador não encontrado.' };
  if (a.time_id === bb.time_id) return { ok: false, mensagem: 'Os dois já são do mesmo Time.' };
  if (a.posicao !== bb.posicao) return { ok: false, mensagem: 'A Troca casada é entre Jogadores da mesma Posição.' };
  if (!o.comVinculo.has(a.id) || !o.comVinculo.has(bb.id)) return { ok: false, mensagem: 'Os dois precisam ter Vínculo para aceitar pelo site.' };
  const ehJogador = o.autorId === a.id || o.autorId === bb.id;
  if (!ehJogador) {
    const [da, db] = await Promise.all([quemDecide(b, a.time_id, o.agora, o.comVinculo), quemDecide(b, bb.time_id, o.agora, o.comVinculo)]);
    if (da?.jogadorId !== o.autorId && db?.jogadorId !== o.autorId) return { ok: false, mensagem: 'Só um dos Jogadores ou o Técnico de um dos Times propõe.' };
  }
  if ((await o.trocaUsada(a.id)) || (await o.trocaUsada(bb.id))) return { ok: false, mensagem: 'Um dos dois já usou a troca.' };
  const abertas = Number((await b.query<{ n: string }>(`SELECT count(*) AS n FROM troca_casada WHERE autor_id = $1 AND status = 'ABERTA'`, [o.autorId])).rows[0]!.n);
  if (abertas >= TROCAS_ABERTAS) return { ok: false, mensagem: `Você já tem ${TROCAS_ABERTAS} propostas abertas.` };
  const expira = new Date(Math.min((await prazoDoTime(b, a.time_id, o.agora)).getTime(), (await prazoDoTime(b, bb.time_id, o.agora)).getTime()));
  await b.query(
    `INSERT INTO troca_casada (autor_id, jogador_a, jogador_b, time_a, time_b, posicao, criada_em, expira_em, aceite_a, aceite_b) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [o.autorId, a.id, bb.id, a.time_id, bb.time_id, a.posicao, iso(o.agora), iso(expira), o.autorId === a.id, o.autorId === bb.id],
  );
  if (!ehJogador) await marcarDecisao(b, o.autorId, o.agora);
  // Avisos pessoais: os dois Jogadores e quem decide em cada Time (menos quem propôs).
  const [da, db] = await Promise.all([quemDecide(b, a.time_id, o.agora, o.comVinculo), quemDecide(b, bb.time_id, o.agora, o.comVinculo)]);
  const avisar = [a.id, bb.id, da?.jogadorId, db?.jogadorId].filter((x) => x && x !== o.autorId);
  await avisarPessoas(b, avisar, (id) => ({
    tipo: 'TROCA',
    titulo: 'Troca casada',
    corpo: `Proposta: ${NOME_DA_POSICAO[a.posicao]} ${doTimeCurto(a.time_id)} ⇄ ${doTimeCurto(bb.time_id)}. Responda no site até o prazo.`,
    url: id === a.id || id === bb.id ? `#/jogador/${id}` : `#/time/${id === da?.jogadorId ? a.time_id : bb.time_id}`,
  }));
  return { ok: true, mensagem: 'Troca casada proposta. Os dois Jogadores precisam aceitar; os Times têm até o prazo.' };
}

interface TrocaAberta {
  id: number;
  jogador_a: string;
  jogador_b: string;
  time_a: TimeId;
  time_b: TimeId;
  posicao: Posicao;
  aceite_a: boolean;
  aceite_b: boolean;
  time_a_ok: boolean | null;
  time_b_ok: boolean | null;
  expira_em: Date | string;
}

const SELECT_TROCA = `SELECT id, jogador_a::text AS jogador_a, jogador_b::text AS jogador_b, time_a, time_b, posicao, aceite_a, aceite_b, time_a_ok, time_b_ok, expira_em FROM troca_casada`;

/**
 * Resposta a uma Troca casada: de um dos Jogadores (explícita) ou do Técnico/Capitão de um dos
 * Times. Com os dois Jogadores e os dois Times de acordo, a troca acontece na hora.
 */
export async function responderTroca(
  b: Banco,
  o: { pessoaId: string; trocaId: number; aceitar: boolean; agora: Date; comVinculo: ReadonlySet<string> },
): Promise<{ ok: boolean; mensagem: string; avisos?: AvisoDoPedido[] }> {
  const t = (await b.query<TrocaAberta>(`${SELECT_TROCA} WHERE id = $1 AND status = 'ABERTA' AND expira_em > $2`, [o.trocaId, iso(o.agora)])).rows[0];
  if (!t) return { ok: false, mensagem: 'Essa Troca casada não vale mais.' };
  const campos: string[] = [];
  if (o.pessoaId === t.jogador_a) campos.push('aceite_a');
  if (o.pessoaId === t.jogador_b) campos.push('aceite_b');
  for (const [lado, time] of [['time_a_ok', t.time_a], ['time_b_ok', t.time_b]] as const) {
    const d = await quemDecide(b, time, o.agora, o.comVinculo);
    // O Capitão não decide Troca da própria Posição (vale o prazo).
    if (d?.jogadorId === o.pessoaId && !(d.tipo === 'CAPITAO' && d.posicao === t.posicao)) campos.push(lado);
  }
  if (!campos.length) return { ok: false, mensagem: 'Essa Troca casada não é sua para responder.' };
  if (!o.aceitar) {
    await b.query(`UPDATE troca_casada SET status = 'RECUSADA', decidida_em = $2 WHERE id = $1`, [t.id, iso(o.agora)]);
    if (campos.some((c) => c.startsWith('time'))) await marcarDecisao(b, o.pessoaId, o.agora);
    return { ok: true, mensagem: 'Troca casada recusada.' };
  }
  await b.query(`UPDATE troca_casada SET ${campos.map((c) => `${c} = true`).join(', ')} WHERE id = $1`, [t.id]);
  if (campos.some((c) => c.startsWith('time'))) await marcarDecisao(b, o.pessoaId, o.agora);
  const atual = (await b.query<TrocaAberta>(`${SELECT_TROCA} WHERE id = $1`, [t.id])).rows[0]!;
  if (atual.aceite_a && atual.aceite_b && atual.time_a_ok === true && atual.time_b_ok === true) {
    const avisos = await fazerTroca(b, atual, o.agora);
    await avisarTransferencias(b, avisos);
    return { ok: true, mensagem: 'Troca casada feita.', avisos };
  }
  return { ok: true, mensagem: 'Resposta salva. A troca acontece quando todos aceitarem (ou no prazo, se os Times não responderem).' };
}

/** Faz a Troca casada: cada um vai para o Time do outro, gastando a troca de cada um. */
async function fazerTroca(b: Banco, t: TrocaAberta, agora: Date): Promise<AvisoDoPedido[]> {
  // As vagas se compensam: cada Time perde e ganha um Jogador da mesma Posição. Primeiro um
  // sai (vai temporariamente sem conferir a vaga), depois o outro entra no lugar.
  const ref = `troca:${t.id}`;
  const ra = await transferirJogador(b, t.jogador_a, { times: [t.time_b], posicao: t.posicao }, { quando: agora, ref, semAceite: true, ignorarLimite: true });
  if (ra.resultado !== 'TRANSFERIDO') {
    await b.query(`UPDATE troca_casada SET status = 'CAIU', decidida_em = $2 WHERE id = $1`, [t.id, iso(agora)]);
    return [];
  }
  const rb = await transferirJogador(b, t.jogador_b, { times: [t.time_a], posicao: t.posicao }, { quando: agora, ref, semAceite: true, ignorarLimite: true });
  if (rb.resultado !== 'TRANSFERIDO') throw new Error(`Troca casada ${t.id}: a segunda metade não passou (${rb.resultado}).`);
  await b.query(`UPDATE troca_casada SET status = 'FEITA', decidida_em = $2 WHERE id = $1`, [t.id, iso(agora)]);
  return [
    { jogadorId: t.jogador_a, ref, mensagem: `Troca casada feita: ${ra.mensagem ?? ''}`.trim() },
    { jogadorId: t.jogador_b, ref, mensagem: `Troca casada feita: ${rb.mensagem ?? ''}`.trim() },
  ];
}

/** Prazo da Troca casada: os dois Jogadores de acordo e os Times sem recusar, ela acontece. */
async function resolverTrocasVencidas(b: Banco, agora: Date): Promise<AvisoDoPedido[]> {
  const vencidas = (await b.query<TrocaAberta>(`${SELECT_TROCA} WHERE status = 'ABERTA' AND expira_em <= $1 ORDER BY id`, [iso(agora)])).rows;
  const avisos: AvisoDoPedido[] = [];
  for (const t of vencidas) {
    if (t.aceite_a && t.aceite_b && t.time_a_ok !== false && t.time_b_ok !== false) avisos.push(...(await fazerTroca(b, t, agora)));
    else await b.query(`UPDATE troca_casada SET status = 'EXPIRADA', decidida_em = $2 WHERE id = $1`, [t.id, iso(agora)]);
  }
  return avisos;
}

// ------------------------------------------------------------------ Fila de espera

/** Entra na Fila (uma por pessoa: a nova substitui a anterior). Devolve a vez. */
export async function entrarNaFila(
  b: Banco,
  o: { time: TimeId; posicao: Posicao; jogadorId: string | null; igUserId: string; username: string; ref: string; agora: Date; temporadaId: number },
): Promise<number> {
  await b.query(`UPDATE fila_espera SET status = 'SAIU' WHERE ig_user_id = $1 AND status = 'ESPERANDO'`, [o.igUserId]);
  await b.query(
    `INSERT INTO fila_espera (time_id, posicao, jogador_id, ig_user_id, username, ref, entrou_em, temporada_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [o.time, o.posicao, o.jogadorId, o.igUserId, o.username, o.ref, iso(o.agora), o.temporadaId],
  );
  return vezNaFila(b, o.igUserId);
}

export async function vezNaFila(b: Banco, igUserId: string): Promise<number> {
  const r = (
    await b.query<{ vez: string }>(
      `SELECT count(*) AS vez FROM fila_espera f JOIN fila_espera eu ON eu.ig_user_id = $1 AND eu.status = 'ESPERANDO'
       WHERE f.status = 'ESPERANDO' AND f.time_id = eu.time_id AND f.posicao = eu.posicao AND f.entrou_em <= eu.entrou_em`,
      [igUserId],
    )
  ).rows[0];
  return Number(r?.vez ?? 0);
}

/** Quem a Fila chama agora: veterano vira Pedido (ou troca direto sem decisor); novato entra. */
export type ChamadaDaFila = { novato: { igUserId: string; username: string; ref: string; time: TimeId; posicao: Posicao } } | AvisoDoPedido;
/** Chama o primeiro da Fila de cada Time e Posição que tem vaga. */
async function chamarFila(b: Banco, agora: Date): Promise<AvisoDoPedido[]> {
  // A Fila expira com a Temporada: quem esperou noutra Temporada sai.
  await b.query(`UPDATE fila_espera f SET status = 'SAIU' FROM temporada t WHERE t.id = f.temporada_id AND f.status = 'ESPERANDO' AND t.status = 'ENCERRADA'`);
  const grupos = (await b.query<{ time_id: TimeId; posicao: Posicao }>(`SELECT DISTINCT time_id, posicao FROM fila_espera WHERE status = 'ESPERANDO'`)).rows;
  const avisos: AvisoDoPedido[] = [];
  for (const g of grupos) {
    if (await posicaoCheia(b, g.time_id, g.posicao)) continue;
    // Já existe um pedido da Fila esperando o Técnico nessa vaga: espera ele.
    const esperando = (await b.query(`SELECT 1 FROM pedido_transferencia WHERE para_time = $1 AND posicao = $2 AND origem = 'FILA' AND status = 'ABERTO'`, [g.time_id, g.posicao])).rows.length;
    if (esperando) continue;
    const prox = (
      await b.query<{ id: number; jogador_id: string | null; ig_user_id: string; username: string; ref: string; temporada_id: number }>(
        `SELECT id, jogador_id::text AS jogador_id, ig_user_id, username, ref, temporada_id FROM fila_espera WHERE status = 'ESPERANDO' AND time_id = $1 AND posicao = $2 ORDER BY entrou_em LIMIT 1`,
        [g.time_id, g.posicao],
      )
    ).rows[0];
    if (!prox) continue;
    await b.query(`UPDATE fila_espera SET status = 'CHAMADO' WHERE id = $1`, [prox.id]);
    if (!prox.jogador_id) {
      const { inscreverDaFila } = await import('./coletar.js');
      const a = await inscreverDaFila(b, { igUserId: prox.ig_user_id, username: prox.username, ref: prox.ref, time: g.time_id, posicao: g.posicao }, agora);
      if (a) avisos.push(a);
      continue;
    }
    // Veterano: o mesmo caminho do TRANSFERIR (vira Pedido se o Time tem quem decida).
    const r = await transferirJogador(b, prox.jogador_id, { times: [g.time_id], posicao: g.posicao }, { quando: agora, ref: prox.ref, origemFila: true });
    avisos.push({ jogadorId: prox.jogador_id, ref: prox.ref, mensagem: `abriu vaga na Fila: ${r.mensagem ?? r.resultado}` });
  }
  return avisos;
}
