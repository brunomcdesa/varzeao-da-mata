/**
 * Painel do Time e Mercado do Jogador para o site (ADR-0111), pedidos pela borda com o Vínculo.
 * O painel é de quem decide (Técnico ou Capitão): Plano do Time, Pedidos, Convites, Trocas
 * casadas e Fila. O Mercado é de cada Jogador: os Convites e Trocas casadas que recebeu, o seu
 * Pedido e a sua vez na Fila. O Plano é segredo do Time: só vai para quem é dele.
 */
import type { Formacao, Posicao, Postura, TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { LIMITE_POR_POSICAO } from './coletar.js';
import { fixadosNoJogoAnterior, planosDaPartida } from './planoDoTime.js';
import { cargoDe, quemDecide, tecnicoDoTime, vezNaFila } from './tecnico.js';
import { capitaoDaPartida, proximaPartidaDoTime } from './temporada2.js';

export interface PessoaNoPainel {
  id: string;
  nome: string;
  posicao: Posicao;
  ovr: number;
  time?: TimeId;
  vinculo?: boolean;
}

export interface PainelDoTime {
  papel: 'TECNICO' | 'CAPITAO' | 'JOGADOR';
  time: TimeId;
  tecnico: { username: string; apelido: string | null } | null;
  capitao: string | null;
  jogo: { apito: string; adversario: TimeId } | null;
  plano: {
    postura: Postura;
    formacao: Formacao;
    fixados: string[];
    /** Fixados no jogo anterior: neste jogo, só pela Presença. */
    descanso: string[];
    escanteio: string[];
    /** Só para o próprio Time (segredo para o rival). */
    marcacao: { marcador: string; alvo: string } | null;
    sugestao: { postura?: Postura; formacao?: Formacao; fixados?: string[] } | null;
  } | null;
  elenco: PessoaNoPainel[];
  /** Rivais de linha do próximo jogo (para a Marcação), só para o Capitão. */
  adversarios?: PessoaNoPainel[];
  vagas: Record<Posicao, { ocupadas: number; limite: number; fila: number }>;
  /** Só para quem decide. */
  pedidos?: { id: number; jogador: PessoaNoPainel & { de: TimeId }; prazo: string; peloPrazo: boolean }[];
  convites?: { id: number; jogador: PessoaNoPainel; expira: string }[];
  trocas?: { id: number; a: PessoaNoPainel; b: PessoaNoPainel; aceiteA: boolean; aceiteB: boolean; timeA: boolean | null; timeB: boolean | null; expira: string; euDecido: boolean }[];
  fila?: { posicao: Posicao; lista: { username: string; time: TimeId | null; ovr: number | null }[] }[];
  grito?: number | null;
}

export interface MercadoDoJogador {
  convites: { id: number; time: TimeId; autor: string; posicao: Posicao; expira: string }[];
  trocas: { id: number; comQuem: PessoaNoPainel; aceitei: boolean; outroAceitou: boolean; expira: string }[];
  pedido: { para: TimeId; posicao: Posicao; prazo: string } | null;
  fila: { time: TimeId; posicao: Posicao; vez: number } | null;
  /** Pedido para pendurar as chuteiras e ser Técnico, esperando a aprovação. */
  serTecnico: TimeId | null;
}

const nomeDe = (r: { username: string; apelido: string | null }) => r.apelido ?? `@${r.username}`;

async function pessoas(b: Banco, onde: string, params: unknown[]): Promise<(PessoaNoPainel & { time: TimeId })[]> {
  return (
    await b.query<{ id: string; username: string; apelido: string | null; posicao: Posicao; ovr: number; time_id: TimeId }>(
      `SELECT id::text AS id, username, apelido, posicao, ovr, time_id FROM jogador_todos WHERE ${onde}`,
      params,
    )
  ).rows.map((r) => ({ id: r.id, nome: nomeDe(r), posicao: r.posicao, ovr: r.ovr, time: r.time_id }));
}

/** O painel do Time da pessoa (Técnico ou Jogador). null fora da T3 ou sem Time. */
export async function painelDoTime(b: Banco, pessoaId: string, agora: Date, comVinculo: ReadonlySet<string>): Promise<PainelDoTime | null> {
  const cargo = await cargoDe(b, pessoaId);
  const time = cargo?.time ?? (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM jogador WHERE id = $1 AND NOT banido`, [pessoaId])).rows[0]?.time_id;
  if (!time) return null;
  const tec = await tecnicoDoTime(b, time);
  const p = await proximaPartidaDoTime(b, time, agora);
  const capitaoId = p ? await capitaoDaPartida(b, p.id, time, comVinculo) : null;
  const papel: PainelDoTime['papel'] = cargo ? 'TECNICO' : capitaoId === pessoaId && comVinculo.has(pessoaId) ? 'CAPITAO' : 'JOGADOR';
  const decide = await quemDecide(b, time, agora, comVinculo);
  const euDecido = decide?.jogadorId === pessoaId;

  const elenco = (await pessoas(b, `time_id = $1 AND papel = 'JOGADOR' AND NOT banido ORDER BY posicao, ovr DESC`, [time])).map((x) => ({ ...x, vinculo: comVinculo.has(x.id) }));
  const vagas = Object.fromEntries(
    (['GOL', 'ZAG', 'MEI', 'ATA'] as const).map((pos) => [pos, { ocupadas: elenco.filter((x) => x.posicao === pos).length, limite: LIMITE_POR_POSICAO[pos], fila: 0 }]),
  ) as PainelDoTime['vagas'];
  const filas = (
    await b.query<{ posicao: Posicao; username: string; jogador_id: string | null; time_id: TimeId | null; ovr: number | null }>(
      `SELECT f.posicao, f.username, f.jogador_id::text AS jogador_id, j.time_id, j.ovr FROM fila_espera f LEFT JOIN jogador j ON j.id = f.jogador_id
       WHERE f.time_id = $1 AND f.status = 'ESPERANDO' ORDER BY f.entrou_em`,
      [time],
    )
  ).rows;
  for (const f of filas) vagas[f.posicao].fila++;

  let adversario: TimeId | null = null;
  let plano: PainelDoTime['plano'] = null;
  if (p) {
    const lados = (await b.query<{ mandante_id: TimeId; visitante_id: TimeId }>(`SELECT mandante_id, visitante_id FROM partida WHERE id = $1`, [p.id])).rows[0]!;
    adversario = lados.mandante_id === time ? lados.visitante_id : lados.mandante_id;
    const pl = (await planosDaPartida(b, p.id)).get(time);
    type Sugestao = NonNullable<PainelDoTime['plano']>['sugestao'];
    const sug = (await b.query<{ sugestao: Sugestao }>(`SELECT sugestao FROM postura WHERE partida_id = $1 AND time_id = $2`, [p.id, time])).rows[0]?.sugestao ?? null;
    plano = {
      postura: pl?.postura ?? 'EQUILIBRADA',
      formacao: pl?.formacao ?? '2-2-2',
      fixados: pl?.fixados ?? [],
      // Uma vez a cada 2 jogos (ADR-0111): quem foi fixado no jogo anterior não pode ser fixado agora.
      descanso: [...(await fixadosNoJogoAnterior(b, time, p.id))],
      escanteio: pl?.escanteio ?? [],
      marcacao: pl?.marcacao ?? null,
      sugestao: tec ? sug : null,
    };
  }
  const capitao = capitaoId ? ((await b.query<{ username: string }>(`SELECT username FROM jogador WHERE id = $1`, [capitaoId])).rows[0]?.username ?? null) : null;
  const t = (await b.query<{ id: number }>(`SELECT id FROM temporada WHERE status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY status = 'EM_ANDAMENTO' DESC, numero LIMIT 1`)).rows[0];
  const grito = t ? ((await b.query<{ opcao: number }>(`SELECT opcao FROM grito_da_temporada WHERE temporada_id = $1 AND time_id = $2`, [t.id, time])).rows[0]?.opcao ?? null) : null;

  const painel: PainelDoTime = {
    papel,
    time,
    tecnico: tec ? { username: tec.username, apelido: tec.apelido } : null,
    capitao,
    jogo: p && adversario ? { apito: p.apito.toISOString(), adversario } : null,
    plano,
    elenco,
    vagas,
    grito,
  };
  if (papel === 'CAPITAO' && adversario) {
    painel.adversarios = await pessoas(b, `time_id = $1 AND papel = 'JOGADOR' AND NOT banido AND posicao <> 'GOL' ORDER BY posicao, ovr DESC`, [adversario]);
  }
  if (euDecido) {
    const pedidos = (
      await b.query<{ id: number; jogador_id: string; de_time: TimeId; posicao: Posicao; prazo: Date | string; decisor_id: string | null }>(
        `SELECT id, jogador_id::text AS jogador_id, de_time, posicao, prazo, decisor_id::text AS decisor_id FROM pedido_transferencia WHERE para_time = $1 AND status = 'ABERTO' ORDER BY prazo`,
        [time],
      )
    ).rows;
    const quem = new Map((await pessoas(b, `id::text = ANY($1)`, [pedidos.map((x) => x.jogador_id)])).map((x) => [x.id, x]));
    painel.pedidos = pedidos.flatMap((x) => {
      const j = quem.get(x.jogador_id);
      return j ? [{ id: Number(x.id), jogador: { ...j, posicao: x.posicao, de: x.de_time }, prazo: new Date(x.prazo).toISOString(), peloPrazo: x.decisor_id === null }] : [];
    });
    const convites = (
      await b.query<{ id: number; jogador_id: string; expira_em: Date | string }>(`SELECT id, jogador_id::text AS jogador_id, expira_em FROM convite WHERE time_id = $1 AND status = 'ABERTO' ORDER BY expira_em`, [time])
    ).rows;
    const convidados = new Map((await pessoas(b, `id::text = ANY($1)`, [convites.map((x) => x.jogador_id)])).map((x) => [x.id, x]));
    painel.convites = convites.flatMap((x) => (convidados.get(x.jogador_id) ? [{ id: Number(x.id), jogador: convidados.get(x.jogador_id)!, expira: new Date(x.expira_em).toISOString() }] : []));
    painel.fila = (['GOL', 'ZAG', 'MEI', 'ATA'] as const)
      .map((pos) => ({ posicao: pos, lista: filas.filter((f) => f.posicao === pos).map((f) => ({ username: f.username, time: f.time_id, ovr: f.ovr })) }))
      .filter((f) => f.lista.length);
  }
  // Trocas casadas que passam pelo Time (para quem decide) ou que envolvem a pessoa.
  const trocas = (
    await b.query<{ id: number; jogador_a: string; jogador_b: string; time_a: TimeId; time_b: TimeId; aceite_a: boolean; aceite_b: boolean; time_a_ok: boolean | null; time_b_ok: boolean | null; expira_em: Date | string }>(
      `SELECT id, jogador_a::text AS jogador_a, jogador_b::text AS jogador_b, time_a, time_b, aceite_a, aceite_b, time_a_ok, time_b_ok, expira_em FROM troca_casada
       WHERE status = 'ABERTA' AND expira_em > $2 AND (time_a = $1 OR time_b = $1) ORDER BY expira_em`,
      [time, agora.toISOString()],
    )
  ).rows;
  if (euDecido && trocas.length) {
    const envolvidos = new Map((await pessoas(b, `id::text = ANY($1)`, [trocas.flatMap((x) => [x.jogador_a, x.jogador_b])])).map((x) => [x.id, x]));
    painel.trocas = trocas.flatMap((x) => {
      const a = envolvidos.get(x.jogador_a);
      const bb = envolvidos.get(x.jogador_b);
      return a && bb
        ? [{ id: Number(x.id), a, b: bb, aceiteA: x.aceite_a, aceiteB: x.aceite_b, timeA: x.time_a_ok, timeB: x.time_b_ok, expira: new Date(x.expira_em).toISOString(), euDecido: true }]
        : [];
    });
  }
  // A Marcação e os Batedores são do Time: o rival nunca recebe este painel.
  return painel;
}

/** O que chegou para o Jogador (Convites e Trocas casadas) e o que ele pediu. */
export async function mercadoDoJogador(b: Banco, jogadorId: string, agora: Date): Promise<MercadoDoJogador> {
  const convites = (
    await b.query<{ id: number; time_id: TimeId; posicao: Posicao; expira_em: Date | string; autor: string }>(
      `SELECT c.id, c.time_id, c.posicao, c.expira_em, coalesce(a.apelido, '@' || a.username) AS autor FROM convite c JOIN jogador_todos a ON a.id = c.autor_id
       WHERE c.jogador_id = $1 AND c.status = 'ABERTO' AND c.expira_em > $2 ORDER BY c.expira_em`,
      [jogadorId, agora.toISOString()],
    )
  ).rows.map((c) => ({ id: Number(c.id), time: c.time_id, autor: c.autor, posicao: c.posicao, expira: new Date(c.expira_em).toISOString() }));
  const linhas = (
    await b.query<{ id: number; jogador_a: string; jogador_b: string; aceite_a: boolean; aceite_b: boolean; expira_em: Date | string }>(
      `SELECT id, jogador_a::text AS jogador_a, jogador_b::text AS jogador_b, aceite_a, aceite_b, expira_em FROM troca_casada
       WHERE status = 'ABERTA' AND expira_em > $2 AND (jogador_a = $1 OR jogador_b = $1) ORDER BY expira_em`,
      [jogadorId, agora.toISOString()],
    )
  ).rows;
  const outros = new Map((await pessoas(b, `id::text = ANY($1)`, [linhas.map((t) => (t.jogador_a === jogadorId ? t.jogador_b : t.jogador_a))])).map((x) => [x.id, x]));
  const trocas = linhas.flatMap((t) => {
    const souA = t.jogador_a === jogadorId;
    const outro = outros.get(souA ? t.jogador_b : t.jogador_a);
    return outro ? [{ id: Number(t.id), comQuem: outro, aceitei: souA ? t.aceite_a : t.aceite_b, outroAceitou: souA ? t.aceite_b : t.aceite_a, expira: new Date(t.expira_em).toISOString() }] : [];
  });
  const p = (
    await b.query<{ para_time: TimeId; posicao: Posicao; prazo: Date | string }>(`SELECT para_time, posicao, prazo FROM pedido_transferencia WHERE jogador_id = $1 AND status = 'ABERTO'`, [jogadorId])
  ).rows[0];
  const ig = (await b.query<{ ig_user_id: string }>(`SELECT ig_user_id FROM jogador_todos WHERE id = $1`, [jogadorId])).rows[0]?.ig_user_id;
  const f = ig ? (await b.query<{ time_id: TimeId; posicao: Posicao }>(`SELECT time_id, posicao FROM fila_espera WHERE ig_user_id = $1 AND status = 'ESPERANDO'`, [ig])).rows[0] : undefined;
  const pedidoTecnico = (await b.query<{ time_id: TimeId }>(`SELECT time_id FROM tecnico WHERE jogador_id = $1 AND status = 'PEDIDO'`, [jogadorId])).rows[0];
  return {
    convites,
    trocas,
    pedido: p ? { para: p.para_time, posicao: p.posicao, prazo: new Date(p.prazo).toISOString() } : null,
    fila: f && ig ? { time: f.time_id, posicao: f.posicao, vez: await vezNaFila(b, ig) } : null,
    serTecnico: pedidoTecnico?.time_id ?? null,
  };
}
