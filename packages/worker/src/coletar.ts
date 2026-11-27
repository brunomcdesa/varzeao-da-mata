/**
 * Processamento de comentários (job `coletar`, passos 2 a 4 da arquitetura).
 * Cada comentário é gravado em `comando` uma única vez; reprocessar o mesmo comentário
 * não muda nada (idempotência pelo ig_comment_id).
 */
import type { Habilidades, Posicao, TimeId } from '@liga/shared';
import { CANDIDATOS_POR_SERIE, TIMES_DA_EXPANSAO, TIMES_POR_SERIE, temRegrasT3, doTime, numeroDoCandidato, ovrDasHabilidades, temRegrasT2, type Serie } from '@liga/shared';
import type { Banco } from './banco.js';
import { antesDoFimDaSupercopa } from './supercopa.js';
import { soltarFaixa } from './aMao.js';
import { CONTA_DA_LIGA, citacoes, interpretar, type Comando } from './comandos.js';
import { PREFIXO_SEM_ID } from './instagram.js';
import { PRIMO_NA_B, seriesAtivas, timesAtivos, type SeriesDaTemporada } from './series.js';
import { aplicarEscolha } from './temporada2.js';
import { FOLGA_DE_ELENCO, FORMACAO, OVR_INICIAL, OVR_INICIAL_DEPOIS_DA_T1, REALOCAR_QUANDO_CHEIO, habilidadesDe, perfilNaPosicao, sortearHabilidadesIniciais, type FaixaDoOvr } from './regras.js';
import { normalizar } from './vocabulario.js';
import { CORTE_MINUTOS } from './escalacao.js';
import { marcarFundador, temporadaDeFundacao } from './expansao.js';
import { abrirPedido, aceiteNecessario, entrarNaFila, tecnicoQuerJogar, voltarAJogar, type AvisoDoPedido } from './tecnico.js';

const CORTE_MS = CORTE_MINUTOS * 60_000;

/** Um comentário como vem da Graph API (/{media-id}/comments: id, text, from, timestamp). */
export interface Comentario {
  igCommentId: string;
  igMediaId: string;
  igUserId: string;
  username: string;
  texto: string;
  comentadoEm: Date;
}

export type Resultado =
  | 'REPETIDO'
  | 'IGNORADO'
  | 'BANIDO'
  | 'INSCRITO'
  | 'JA_INSCRITO'
  | 'TIME_CHEIO'
  /** Time que ainda não joga nesta Temporada (um Time novo antes da sua estreia): o pedido espera. */
  | 'TIME_ESTREANTE'
  /** O Time pedido estava cheio: entrou no mais vazio, na mesma posição. */
  | 'REALOCADO'
  | 'NOME_BLOQUEADO'
  | 'VOTO_REGISTRADO'
  | 'VOTO_ANTIGO'
  | 'VOTACAO_FECHADA'
  | 'NAO_CANDIDATO'
  | 'SEM_TIME'
  | 'SEM_POSICAO'
  | 'TIMES_DEMAIS'
  | 'POSICOES_DEMAIS'
  | 'MARCOU_TERCEIRO'
  | 'SEM_CANDIDATO'
  /** Transferência (ADR-0012). */
  | 'TRANSFERIDO'
  | 'TRANSFERENCIA_USADA'
  | 'TRANSFERENCIA_FECHADA'
  | 'DESTINO_CHEIO'
  | 'MESMO_LUGAR'
  /** Técnico e Interesse (T3, ADR-0111): o pedido espera o Técnico, ou a pessoa entrou na Fila. */
  | 'PEDIDO_ENVIADO'
  | 'NA_FILA'
  /** Técnico que pendurou as chuteiras e ainda não pode voltar. */
  | 'TECNICO_FORA'
  /** Presença (T2, ADR-0023). */
  | 'PRESENCA_CONFIRMADA'
  | 'PRESENCA_RECUSADA'
  | 'NAO_INSCRITO';

export interface Contexto {
  /** Rodada cujos Candidatos a Craque estão em votação agora, ou null se não há votação aberta. */
  rodadaEmVotacao: number | null;
  /** Post do Resumo dessa votação: só nele vale o voto com o número sozinho ("3"). */
  postDaVotacao?: string | null;
  /** Responde um comentário no Instagram (ex.: avisar quem foi realocado). Erros não param a coleta. */
  responder?: (igCommentId: string, texto: string) => Promise<void>;
  /** Sobrescreve REALOCAR_QUANDO_CHEIO (testes). */
  realocar?: boolean;
  /** Inscrição manual do dono (workflow inscrever-jogador): ignora o equilíbrio de Elencos (ADR-0029). */
  forcar?: boolean;
  /** Quem tem Vínculo (ADR-0111): o Capitão só decide Pedido se tiver. Sem isso, só o Técnico decide. */
  comVinculo?: ReadonlySet<string>;
}

export async function processarComentario(banco: Banco, c: Comentario, ctx: Contexto): Promise<Resultado> {
  return banco.transacao(async (b) => {
    const novo = await b.query<{ id: string }>(
      `INSERT INTO comando (ig_comment_id, ig_media_id, ig_user_id, username, texto, comentado_em)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (ig_comment_id) DO NOTHING RETURNING id`,
      [c.igCommentId, c.igMediaId, c.igUserId, c.username, c.texto, c.comentadoEm.toISOString()],
    );
    if (!novo.rows.length) {
      // Comentário já visto. Só volta a ser lido se tinha sido ignorado e hoje vale como
      // Inscrição (o leitor passou a aceitar "Onça, atacante" sem ENTRO).
      const antes = (await b.query<{ tipo: string | null; resultado: string | null }>(`SELECT tipo, resultado FROM comando WHERE ig_comment_id = $1`, [c.igCommentId])).rows[0];
      // TIME_CHEIO também: quando outros Times recebem gente, abre vaga e a pessoa entra sozinha.
      // TIME_ESTREANTE também: quando a Temporada do Time novo começa, a pessoa entra nele.
      const releitura = antes?.tipo === 'IGNORADO' || ['SEM_POSICAO', 'SEM_TIME', 'TIME_CHEIO', 'TIME_ESTREANTE', 'SEM_CANDIDATO'].includes(antes?.resultado ?? '');
      if (!releitura || `@${c.username}`.toUpperCase() === CONTA_DA_LIGA) return 'REPETIDO';
      // Voto que o leitor antigo não entendeu ("Craque da Temporada 1", "vou de 3"): volta a ser
      // lido, mas só no post da votação aberta, para não puxar voto de outra Rodada (ADR-0076).
      const votoRelido = interpretar(c.texto).tipo === 'VOTO' && !!ctx.postDaVotacao && c.igMediaId === ctx.postDaVotacao;
      if (votoRelido) return lerComando(b, c, ctx, false);
      const inscrito = (await b.query<{ inscrito_em: Date | string }>(`SELECT inscrito_em FROM jogador WHERE ig_user_id = $1`, [c.igUserId])).rows[0];
      const agoraLe = interpretar(c.texto).tipo;
      // Inscrito: só volta a ler pedido de Transferência feito depois de entrar (o leitor
      // passou a entender "posso ir pro time da preguiça?").
      if (inscrito) {
        if (antes?.tipo !== 'IGNORADO' || agoraLe !== 'TRANSFERENCIA' || c.comentadoEm.getTime() < new Date(inscrito.inscrito_em).getTime()) return 'REPETIDO';
      } else if (agoraLe !== 'INSCRICAO' && agoraLe !== 'TRANSFERENCIA' && !(await juntarComOutroComentario(b, c))) return 'REPETIDO';
    }
    return lerComando(b, c, ctx, novo.rows.length > 0);
  });
}

/** Lê o Comando de um comentário já gravado em `comando` e aplica. `primeira`: primeira leitura. */
async function lerComando(b: Banco, c: Comentario, ctx: Contexto, primeira: boolean): Promise<Resultado> {
  // Inscrito à mão pela DM sem o id da conta (id provisório "dm-<@>"): o primeiro comentário
  // do mesmo @ assume o Jogador.
  const semId = c.igUserId.startsWith(PREFIXO_SEM_ID);
  if (!c.igUserId.startsWith('dm-') && !semId) {
    await b.query(`UPDATE jogador_todos SET ig_user_id = $1 WHERE ig_user_id = 'dm-' || lower($2) AND NOT EXISTS (SELECT 1 FROM jogador_todos WHERE ig_user_id = $1)`, [c.igUserId, c.username]);
  }
  // O @ pode mudar; o Jogador é da conta (ig_user_id), então o username só é atualizado.
  const jogador = (
    await b.query<{ id: string; banido: boolean }>(
      `UPDATE jogador SET username = $2 WHERE ig_user_id = $1 RETURNING id, banido`,
      [c.igUserId, c.username],
    )
  ).rows[0];

  // A própria Liga comenta (respostas, instruções): nunca é Inscrição nem voto.
  const daLiga = `@${c.username}`.toUpperCase() === CONTA_DA_LIGA || c.igUserId === process.env.IG_USER_ID;
  let comando: Comando = daLiga ? { tipo: 'IGNORADO' } : interpretar(c.texto);
  // Sem o id da conta, só o voto vale (Inscrição e o resto precisam da conta).
  if (semId && comando.tipo !== 'VOTO') comando = { tipo: 'IGNORADO' };
  // Pedido em dois comentários ("Arara" e "Entro como meia"): junta o Time de um com a
  // posição do outro.
  if (!daLiga && !semId && !jogador && comando.tipo !== 'INSCRICAO' && comando.tipo !== 'VOTO') {
    const junto = await juntarComOutroComentario(b, c);
    if (junto) comando = junto;
  }
  let resultado: Resultado;
  if (comando.tipo === 'IGNORADO' || (comando.tipo === 'VOTO' && comando.solto && (!ctx.postDaVotacao || c.igMediaId !== ctx.postDaVotacao))) resultado = 'IGNORADO';
  else if (jogador?.banido) resultado = 'BANIDO';
  else if (comando.tipo === 'INVALIDO') {
    resultado = comando.motivo;
    // "Tem transferência?": explica como pedir (só na primeira leitura, para não repetir).
    if (comando.prefixo === 'TRANSFERIR' && primeira) {
      await ctx.responder?.(c.igCommentId, `@${c.username} tem sim! Comente TRANSFERIR e o time (e a posição, se quiser), por exemplo: TRANSFERIR Preguiça zagueiro. Vale uma vez por temporada, na Fase de Liga, para um time que não fique desequilibrado. ⚽`);
    }
  }
  else if (comando.tipo === 'INSCRICAO') resultado = jogador ? await jaInscrito(b, c, comando, ctx) : await inscrever(b, c, comando.time, comando.posicao, ctx);
  else if (comando.tipo === 'TRANSFERENCIA') {
    // Quem ainda não joga e pede para "ir pra Preguiça" quer entrar: vira Inscrição.
    if (jogador) resultado = await transferir(b, c, jogador.id, comando, ctx);
    else if (comando.times.length === 1) {
      resultado = await inscrever(b, c, comando.times[0]!, comando.posicao, ctx);
      comando = { tipo: 'INSCRICAO', time: comando.times[0]!, ...(comando.posicao ? { posicao: comando.posicao } : {}) };
    } else resultado = 'IGNORADO';
  } else if (comando.tipo === 'PRESENCA') {
    // Só vale na Temporada 2, para quem já joga (a regra é a mesma do botão do site).
    if (!jogador) resultado = 'NAO_INSCRITO';
    else {
      const r = await aplicarEscolha(b, jogador.id, { tipo: 'PRESENCA' }, c.comentadoEm, async () => new Set());
      resultado = r.ok ? 'PRESENCA_CONFIRMADA' : 'PRESENCA_RECUSADA';
    }
  } else resultado = await votar(b, c, comando, ctx);

  const tipo = resultado === 'IGNORADO' || comando.tipo === 'IGNORADO' ? 'IGNORADO' : comando.tipo === 'INVALIDO' ? 'INVALIDO' : comando.tipo;
  await b.query(`UPDATE comando SET tipo = $2, resultado = $3 WHERE ig_comment_id = $1`, [c.igCommentId, tipo, resultado]);
  return resultado;
}

/**
 * Se a pessoa (ainda não inscrita) mandou, em até 24 h, um comentário só com o Time e outro só
 * com a posição (ou um ENTRO sem Time), devolve a Inscrição juntando os dois. O pedido (ENTRO)
 * pode estar num terceiro comentário, sozinho.
 */
async function juntarComOutroComentario(b: Banco, c: Comentario): Promise<Comando | null> {
  const este = citacoes(c.texto);
  if (este.times.length > 1 || este.posicoes.length > 1 || (este.times.length === 0) === (este.posicoes.length === 0)) return null;
  const outros = (
    await b.query<{ texto: string }>(
      `SELECT texto FROM comando WHERE ig_user_id = $1 AND ig_comment_id <> $2 AND abs(extract(epoch FROM comentado_em - $3::timestamptz)) < 86400 ORDER BY comentado_em DESC`,
      [c.igUserId, c.igCommentId, c.comentadoEm.toISOString()],
    )
  ).rows;
  // Precisa haver um pedido (ENTRO, QUERO, SOU) em algum comentário da pessoa nessas 24 h: no
  // do Time, no da posição ou num terceiro, sozinho ("ENTRO", depois "ATA", depois "Arara").
  // Sem pedido nenhum, "Arara" e "que meia!" são só torcida.
  const pedido = (texto: string) => /\bENTR(O|AR)\b|\bQUERO\b|\bSOU\b/.test(normalizar(texto));
  if (!pedido(c.texto) && !outros.some((o) => pedido(o.texto))) return null;
  for (const o of outros) {
    const outro = citacoes(o.texto);
    if (outro.times.length > 1 || outro.posicoes.length > 1) continue;
    const time = este.times[0] ?? (outro.posicoes.length === 0 ? outro.times[0] : undefined);
    const posicao = este.posicoes[0] ?? (outro.times.length === 0 ? outro.posicoes[0] : undefined);
    if (!time || !posicao) continue;
    return { tipo: 'INSCRICAO', time, posicao };
  }
  return null;
}

const NOME_DA_POSICAO_FALADO: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };

function hashSimples(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 31) + texto.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A posição que o Time mais precisa: a de menos inscritos por vaga na escalação; no empate,
 * a mais divertida de jogar (atacante, meia, zagueiro, goleiro).
 */
export async function posicaoMaisVazia(b: Banco, time: TimeId): Promise<Posicao> {
  const contagem = new Map<string, number>();
  for (const r of (await b.query<{ posicao: string; n: string }>(`SELECT posicao, count(*) AS n FROM jogador WHERE time_id = $1 AND NOT banido GROUP BY posicao`, [time])).rows) {
    contagem.set(r.posicao, Number(r.n));
  }
  const vagas = (p: Posicao) => FORMACAO.filter((x) => x === p).length;
  const ordem: Posicao[] = ['ATA', 'MEI', 'ZAG', 'GOL'];
  return ordem.reduce((melhor, p) => ((contagem.get(p) ?? 0) / vagas(p) < (contagem.get(melhor) ?? 0) / vagas(melhor) ? p : melhor));
}

/**
 * Faixa do OVR inicial (ADR-0056): depois que a Temporada 1 termina (ou já existe a T2), quem
 * entra sorteia no máximo o Piso da Temporada 1.
 */
export async function faixaDoOvrInicial(b: Banco): Promise<FaixaDoOvr> {
  const depois = (await b.query(`SELECT 1 FROM temporada WHERE numero >= 2 OR (numero = 1 AND status = 'ENCERRADA') LIMIT 1`)).rows.length > 0;
  return depois ? OVR_INICIAL_DEPOIS_DA_T1 : OVR_INICIAL;
}

/**
 * Limite por Posição de cada Time: o dobro das vagas da Escalação (2 goleiros e 4 em cada
 * Posição de linha). Na T2 (Série A de 16, sem B, ADR-0062), o novato entra no Time pedido
 * enquanto a Posição dele tem vaga; cheia, vai para o Time da A com menos gente nela.
 */
export const LIMITE_POR_POSICAO: Readonly<Record<Posicao, number>> = Object.fromEntries(
  (['GOL', 'ZAG', 'MEI', 'ATA'] as const).map((p) => [p, 2 * FORMACAO.filter((x) => x === p).length]),
) as Record<Posicao, number>;


/**
 * O Time onde o novato entra. Sem Séries (T1): o pedido, ou o Time mais vazio se o pedido passou
 * do equilíbrio de Elencos. Com a A de 16 Times (ADR-0058): o Time pedido, se tem vaga na
 * Posição; senão, outro Time da A com vaga nela; sem vaga em nenhum, o Time Primo na B (ou, sem
 * Série B, o Time da A com menos gente na Posição). Na B vale o equilíbrio entre os Times da B.
 */
function destinoDoNovato(
  pedido: TimeId,
  series: SeriesDaTemporada,
  contagem: ReadonlyMap<string, number>,
  desempate: number,
  naPosicaoDaA: ReadonlyMap<string, number> | null,
  limite: number,
  /** T3 em diante (A e B de 8): quantos cada Time ativo tem na Posição pedida (ADR-0080). */
  naPosicaoDeTodos: ReadonlyMap<string, number> | null = null,
): { time: TimeId; motivo: Motivo } {
  const maisVazio = (times: readonly TimeId[], ideal?: TimeId): TimeId => {
    const menor = Math.min(...times.map((t) => contagem.get(t) ?? 0));
    if (ideal && (contagem.get(ideal) ?? 0) < menor + FOLGA_DE_ELENCO) return ideal;
    const vazios = times.filter((t) => (contagem.get(t) ?? 0) === menor);
    return vazios[desempate % vazios.length]!;
  };
  // A Série A de 16 (T2, ADR-0058 e ADR-0062): Limite por Posição entre os Times da A.
  // A Série A de 16 sem B é só a T2; Séries de 10 (Expansão, ADR-0093) seguem a regra das duas Séries.
  const comAGrande = series.A.length > TIMES_POR_SERIE.A && !series.B.length;
  if (comAGrande && series.A.includes(pedido) && naPosicaoDaA) {
    const na = (t: TimeId) => naPosicaoDaA.get(t) ?? 0;
    if (na(pedido) < limite) return { time: pedido, motivo: 'PEDIDO' };
    // Posição cheia no pedido: outro Time da A com vaga nela (o que tem menos gente na Posição,
    // depois o menor Elenco). Sem vaga em nenhum, a B, no Time Primo.
    const comVaga = series.A.filter((t) => na(t) < limite);
    if (comVaga.length) {
      const menor = Math.min(...comVaga.map(na));
      const menores = comVaga.filter((t) => na(t) === menor);
      const elenco = Math.min(...menores.map((t) => contagem.get(t) ?? 0));
      const empatados = menores.filter((t) => (contagem.get(t) ?? 0) === elenco);
      return { time: empatados[desempate % empatados.length]!, motivo: 'OUTRO_DA_A' };
    }
    // Sem Série B (T2, ADR-0062): o Time da A com menos gente na Posição.
    if (!series.B.length) {
      const menor = Math.min(...series.A.map(na));
      const menores = series.A.filter((t) => na(t) === menor);
      return { time: menores[desempate % menores.length]!, motivo: 'OUTRO_DA_A' };
    }
    const primo = PRIMO_NA_B[pedido];
    return { time: maisVazio(series.B, primo && series.B.includes(primo) ? primo : undefined), motivo: 'SERIE_B' };
  }
  const daSerie = comAGrande ? series.B : [...series.A, ...series.B];
  const time = maisVazio(daSerie, pedido);
  // Limite por Posição com A e B de 8 (T3, ADR-0080): Posição cheia no Time escolhido, vai para o
  // Time com vaga nela que tem menos gente na Posição, primeiro na mesma Série, depois na outra.
  // Sem vaga em nenhum, fica onde estava (não acontece antes da Expansão, ADR-0093).
  if (naPosicaoDeTodos && (naPosicaoDeTodos.get(time) ?? 0) >= limite) {
    const na = (t: TimeId) => naPosicaoDeTodos.get(t) ?? 0;
    const mesma = series.A.includes(time) ? series.A : series.B;
    const outra = mesma === series.A ? series.B : series.A;
    for (const grupo of [mesma, outra]) {
      const comVaga = grupo.filter((t) => na(t) < limite);
      if (!comVaga.length) continue;
      const menor = Math.min(...comVaga.map(na));
      const menores = comVaga.filter((t) => na(t) === menor);
      const elenco = Math.min(...menores.map((t) => contagem.get(t) ?? 0));
      const empatados = menores.filter((t) => (contagem.get(t) ?? 0) === elenco);
      return { time: empatados[desempate % empatados.length]!, motivo: 'OUTRO_TIME' };
    }
  }
  return { time, motivo: time === pedido ? 'PEDIDO' : 'EQUILIBRIO' };
}

type Motivo = 'PEDIDO' | 'EQUILIBRIO' | 'OUTRO_DA_A' | 'SERIE_B' | 'OUTRO_TIME';

/** Quantos Jogadores cada Time tem numa Posição. */
async function naPosicaoPorTime(b: Banco, times: readonly TimeId[], posicao: Posicao, menos?: string): Promise<Map<string, number>> {
  const r = await b.query<{ time_id: string; n: string }>(
    `SELECT time_id, count(*) AS n FROM jogador WHERE posicao = $1 AND NOT banido AND time_id = ANY($2) AND id <> $3 GROUP BY time_id`,
    [posicao, [...times], menos ?? '-1'],
  );
  return new Map(r.rows.map((x) => [x.time_id, Number(x.n)]));
}

async function inscrever(b: Banco, c: Comentario, pedido: TimeId, pedida: Posicao | undefined, ctx: Contexto): Promise<Resultado> {
  if (await usernameBloqueado(b, c.username)) return 'NOME_BLOQUEADO';
  // Técnico (ADR-0111): quem nunca jogou entra e perde o cargo; quem pendurou volta numa Janela seguinte.
  const tecnico = await tecnicoQuerJogar(b, c.igUserId, c.comentadoEm);
  if (tecnico && !tecnico.podeVoltar) {
    if (tecnico.mensagem) await ctx.responder?.(c.igCommentId, `@${c.username} ${tecnico.mensagem}`);
    return 'TECNICO_FORA';
  }

  // Só os Times que jogam a Temporada (com a Série B, os 24; antes dela, os fundadores).
  const { series } = await seriesAtivas(b);
  const ativos = [...series.A, ...series.B];
  if (!ativos.includes(pedido)) return 'TIME_ESTREANTE';
  // Time cheio: entra em outro Time (empate decidido pelo id do comentário, para espalhar),
  // na posição pedida, e recebe uma resposta explicando.
  const contagem = await elencos(b, ativos);
  let time = pedido;
  let motivo: Motivo = 'PEDIDO';
  // Posição no Time pedido: a pedida, ou a mais vazia dele (só o Time).
  const noPedido = pedida ?? (await posicaoMaisVazia(b, pedido));
  if (!ctx.forcar) {
    const naPosicaoDaA = series.A.includes(pedido) ? await naPosicaoPorTime(b, series.A, noPedido) : null;
    // A e B de 8 (T3 em diante): o Limite por Posição vale em todos os Times (ADR-0080).
    const comDuasDeOito = series.B.length > 0;
    const naPosicaoDeTodos = comDuasDeOito ? await naPosicaoPorTime(b, ativos, noPedido) : null;
    const d = destinoDoNovato(pedido, series, contagem, hashSimples(c.igCommentId), naPosicaoDaA, LIMITE_POR_POSICAO[noPedido], naPosicaoDeTodos);
    if (d.motivo === 'EQUILIBRIO' && !(ctx.realocar ?? REALOCAR_QUANDO_CHEIO)) return 'TIME_CHEIO';
    ({ time, motivo } = d);
  }
  // Mudou por Posição cheia (outro da A ou a B): segue na mesma Posição; realocado por
  // equilíbrio, a pedida ou a mais vazia do Time novo.
  const posicao = motivo === 'SERIE_B' || motivo === 'OUTRO_DA_A' || motivo === 'OUTRO_TIME' ? noPedido : (pedida ?? (time === pedido ? noPedido : await posicaoMaisVazia(b, time)));

  // T3 (ADR-0111): sem vaga na Posição em nenhum Time, o novato entra na Fila do Time pedido.
  if (!ctx.forcar && series.B.length && (await temporadaAtualComT3(b))) {
    const na = await naPosicaoPorTime(b, [time], posicao as Posicao);
    if ((na.get(time) ?? 0) >= LIMITE_POR_POSICAO[posicao as Posicao]) {
      const t = (await b.query<{ id: number }>(`SELECT id FROM temporada WHERE status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY status = 'EM_ANDAMENTO' DESC, numero LIMIT 1`)).rows[0]!;
      const vez = await entrarNaFila(b, { time: pedido, posicao: posicao as Posicao, jogadorId: null, igUserId: c.igUserId, username: c.username, ref: c.igCommentId, agora: c.comentadoEm, temporadaId: t.id });
      await ctx.responder?.(
        c.igCommentId,
        `@${c.username} as vagas de ${NOME_DA_POSICAO_FALADO[posicao as Posicao]} estão completas em todos os times. Você entrou na Fila de espera ${doTime(pedido)} e é o ${vez}º: quando abrir vaga, você entra sozinho. ⚽`,
      );
      return 'NA_FILA';
    }
  }
  const pendurado = tecnico && !tecnico.nuncaJogou ? (await b.query<{ posicao: Posicao; ovr: number; habilidades: Habilidades | string | null }>(`SELECT posicao, ovr, habilidades FROM jogador_todos WHERE id = $1`, [tecnico.jogadorId])).rows[0] : null;
  const { ovr, habilidades } = pendurado
    ? naPosicao(tecnico!.jogadorId, pendurado.posicao, posicao as Posicao, pendurado.ovr, pendurado.habilidades)
    : sortearHabilidadesIniciais(c.igCommentId, posicao as Posicao, await faixaDoOvrInicial(b));
  let novo: string;
  if (tecnico) {
    // Quem era Técnico volta para o Elenco na mesma linha (Carreira, Moedas e Itens seguem).
    await voltarAJogar(b, tecnico.jogadorId, c.comentadoEm);
    await b.query(
      `UPDATE jogador_todos SET username = $2, time_id = $3, posicao = $4, ovr = $5, habilidades = $6${tecnico.nuncaJogou ? ', inscrito_em = $7' : ''} WHERE id = $1`,
      [tecnico.jogadorId, c.username, time, posicao, ovr, JSON.stringify(habilidades), ...(tecnico.nuncaJogou ? [c.comentadoEm.toISOString()] : [])],
    );
    novo = tecnico.jogadorId;
  } else {
    novo = (
      await b.query<{ id: string }>(
        `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text AS id`,
        [c.igUserId, c.username, time, posicao, ovr, JSON.stringify(habilidades), c.comentadoEm.toISOString()],
      )
    ).rows[0]!.id;
  }
  // Entrou num Time da Expansão antes do primeiro jogo dele: Fundador (ADR-0093).
  const fundacao = await temporadaDeFundacao(b, time, c.comentadoEm, CORTE_MS);
  if (fundacao) await marcarFundador(b, novo, time, fundacao);
  const fundador = fundacao ? ` Você é Fundador ${doTime(time)}, um dos Times novos da Liga!` : '';
  // Resposta no comentário: a pessoa fica sabendo que entrou (e onde, se foi realocada).
  const vaga = `${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(time)}, OVR ${ovr}`;
  await ctx.responder?.(
    c.igCommentId,
    motivo === 'PEDIDO'
      ? `@${c.username} você entrou no Varzeão da Mata! Agora é ${vaga}.${fundador} Seu boneco já está no site (link na bio). ⚽`
      : motivo === 'OUTRO_TIME'
        ? `@${c.username} as vagas de ${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(pedido)} já estão completas, então você entrou no time ${doTime(time)}, da Série ${series.A.includes(time) ? 'A' : 'B'}. Agora é ${vaga}. Bem-vindo ao Varzeão! ⚽`
      : motivo === 'OUTRO_DA_A'
        ? `@${c.username} as vagas de ${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(pedido)} já estão completas, então você entrou no time ${doTime(time)}, também da Série A. Agora é ${vaga}. Bem-vindo ao Varzeão! ⚽`
        : motivo === 'SERIE_B'
        ? `@${c.username} as vagas de ${NOME_DA_POSICAO_FALADO[posicao]} estão completas em todos os times da Série A, então você começa na Série B, no time ${doTime(time)}. Agora é ${vaga}. Dá para subir com o time ou transferir na próxima Janela. Bem-vindo ao Varzeão! ⚽`
        : TIMES_DA_EXPANSAO.includes(time)
          ? `@${c.username} o time ${doTime(pedido)} encheu, então você entrou no time ${doTime(time)}, um dos Times novos da Liga. Agora é ${vaga}.${fundador} Bem-vindo ao Varzeão! ⚽`
          : `@${c.username} o time ${doTime(pedido)} encheu, então você entrou no time ${doTime(time)} para equilibrar a Liga. Agora é ${vaga}. Bem-vindo ao Varzeão! ⚽`,
  );
  return time === pedido ? 'INSCRITO' : 'REALOCADO';
}

/** Tamanho do Elenco de cada Time ativo, sem contar o Jogador `menos` (quem está saindo). */
async function elencos(b: Banco, ativos: readonly TimeId[], menos?: string): Promise<Map<string, number>> {
  const contagem = new Map<string, number>(ativos.map((t) => [t, 0]));
  for (const r of (
    await b.query<{ time_id: string; n: string }>(`SELECT time_id, count(*) AS n FROM jogador WHERE NOT banido AND id <> $1 GROUP BY time_id`, [menos ?? '-1'])
  ).rows) {
    if (contagem.has(r.time_id)) contagem.set(r.time_id, Number(r.n));
  }
  return contagem;
}

/** "ENTRO Preguiça" de quem já joga: não troca de Time, mas a Liga explica como pedir. */
async function jaInscrito(b: Banco, c: Comentario, pedido: { time: TimeId; posicao?: Posicao }, ctx: Contexto): Promise<Resultado> {
  const j = (await b.query<{ time_id: TimeId; posicao: Posicao }>(`SELECT time_id, posicao FROM jogador WHERE ig_user_id = $1`, [c.igUserId])).rows[0]!;
  if (pedido.time !== j.time_id || (pedido.posicao && pedido.posicao !== j.posicao)) {
    await ctx.responder?.(
      c.igCommentId,
      `@${c.username} você já joga no Varzeão: é ${NOME_DA_POSICAO_FALADO[j.posicao]} ${doTime(j.time_id)}. Para mudar, comente TRANSFERIR e o time (e a posição, se quiser). Dá para transferir uma vez por temporada. ⚽`,
    );
  }
  return 'JA_INSCRITO';
}

/**
 * Transferência (ADR-0012): uma por Temporada, só na Fase de Liga, para um Time que não
 * fique desequilibrado (mesma regra da Inscrição). Vale para as Escalações a partir do
 * próximo Corte (as já feitas ficam como estão). O Jogador leva as Habilidades; o OVR é o
 * delas na posição nova.
 */
async function transferir(b: Banco, c: Comentario, jogadorId: string, pedido: { times: TimeId[]; posicao?: Posicao }, ctx: Contexto): Promise<Resultado> {
  const r = await transferirJogador(b, jogadorId, pedido, { quando: c.comentadoEm, ref: c.igCommentId, ...(ctx.comVinculo ? { comVinculo: ctx.comVinculo } : {}) });
  if (r.mensagem) await ctx.responder?.(c.igCommentId, `@${c.username} ${r.mensagem}`);
  return r.resultado;
}

/**
 * Núcleo da Transferência (ADR-0012), usado pelo comentário e pelo site. Devolve o
 * resultado e a mensagem para o Jogador (em "você"), ou sem mensagem quando não deve
 * responder. `ref`: o comentário ou o pedido do site que originou.
 */
export async function transferirJogador(
  b: Banco,
  jogadorId: string,
  pedido: { times: TimeId[]; posicao?: Posicao },
  o: {
    quando: Date;
    ref: string;
    /** Quem tem Vínculo (ADR-0111): o Capitão só decide Pedido se tiver. */
    comVinculo?: ReadonlySet<string>;
    /** Pedido já aceito, Convite aceito ou Troca casada: aplica sem pedir aceite de novo. */
    semAceite?: boolean;
    /** Troca casada: os Times trocam um por um, então o Limite e o equilíbrio não mudam. */
    ignorarLimite?: boolean;
    /** Chamado pela Fila: Posição cheia de novo não volta para a Fila. */
    origemFila?: boolean;
    /**
     * Quando a troca acontece de fato (o aceite de um Pedido), se for depois de `quando` (a hora
     * do pedido). A Janela vale pela hora do pedido; a Copa em andamento, pela hora da troca.
     */
    efetivaEm?: Date;
  },
): Promise<{ resultado: Resultado; mensagem?: string }> {
  const j = (await b.query<{ time_id: TimeId; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; ig_user_id: string; username: string }>(`SELECT time_id, posicao, ovr, habilidades, ig_user_id, username FROM jogador WHERE id = $1`, [jogadorId])).rows[0];
  if (!j) return { resultado: 'IGNORADO' };
  // Citou dois Times ("sair da Onça e ir pra Preguiça"): um tem que ser o dele, e o destino
  // é o outro. Se nenhum é o dele, o pedido não é claro: não mexe nem responde.
  if (pedido.times.length === 2 && !pedido.times.includes(j.time_id)) return { resultado: 'IGNORADO' };
  const destino = pedido.times.find((t) => t !== j.time_id) ?? pedido.times[0] ?? j.time_id;
  const posicao = pedido.posicao ?? j.posicao;
  if (destino === j.time_id && posicao === j.posicao) {
    return { resultado: 'MESMO_LUGAR', mensagem: `você já é ${NOME_DA_POSICAO_FALADO[j.posicao]} ${doTime(j.time_id)}. 😄` };
  }

  const temporada = await temporadaDaTransferencia(b, o.quando);
  if (!temporada) {
    return { resultado: 'TRANSFERENCIA_FECHADA', mensagem: 'as transferências estão fechadas: só valem na Fase de Liga. Elas reabrem na próxima temporada. ⚽' };
  }
  if (await copaEmAndamento(b, temporada, o.efetivaEm ?? o.quando)) {
    return { resultado: 'TRANSFERENCIA_FECHADA', mensagem: FECHADO_NA_COPA };
  }
  if (await antesDoFimDaSupercopa(b, temporada, o.efetivaEm ?? o.quando)) {
    return { resultado: 'TRANSFERENCIA_FECHADA', mensagem: FECHADO_ATE_A_SUPERCOPA };
  }
  // Janela de Transferências (T2, ADR-0022): na Pré-temporada, a troca não gasta a da Temporada.
  const janela = await emJanela(b, temporada, o.quando);
  // Para um Time da Expansão antes do primeiro jogo dele (ADR-0093): de graça e vira Fundador.
  const fundacao = destino !== j.time_id ? await temporadaDeFundacao(b, destino, o.quando, CORTE_MS) : null;
  const gratis = fundacao !== null;
  const usada = (await b.query(`SELECT 1 FROM transferencia WHERE jogador_id = $1 AND temporada_id = $2 AND janela = $3 AND NOT gratis`, [jogadorId, temporada, janela])).rows[0];
  if (usada && !gratis) {
    return janela
      ? { resultado: 'TRANSFERENCIA_USADA', mensagem: 'você já trocou de time nesta Janela. Durante a temporada ainda vale uma transferência. ⚽' }
      : { resultado: 'TRANSFERENCIA_USADA', mensagem: 'você já usou a transferência desta temporada. Dá para transferir de novo na próxima. ⚽' };
  }

  if (destino !== j.time_id) {
    const { series } = await seriesAtivas(b);
    const todos = [...series.A, ...series.B];
    if (!todos.includes(destino)) {
      return { resultado: 'DESTINO_CHEIO', mensagem: `o time ${doTime(destino)} ainda não estreou: ele entra na Liga com a Série B. Você pode pedir de novo quando a temporada dele começar. ⚽` };
    }
    // Equilíbrio: conta os Elencos sem ele (ele sai da origem) e aplica a regra da Inscrição,
    // comparando com os Times da mesma Série do destino (ADR-0058).
    const ativos = series.B.includes(destino) ? series.B : series.B.length ? series.A : todos;
    const contagem = await elencos(b, ativos, jogadorId);
    const menor = Math.min(...contagem.values());
    if (!o.ignorarLimite && contagem.get(destino)! >= menor + FOLGA_DE_ELENCO) {
      const vazios = ativos.filter((t) => contagem.get(t) === menor && t !== j.time_id).map((t) => doTime(t).replace(/^d[oa] /, ''));
      return { resultado: 'DESTINO_CHEIO', mensagem: `o time ${doTime(destino)} está cheio agora, então a transferência não deu. Times com vaga: ${vazios.join(', ')}. ⚽` };
    }
  }

  // Limite por Posição (ADR-0080): a Transferência (e a troca de Posição no mesmo Time) segue a
  // mesma regra da Inscrição. Conta o destino sem ele; cheia, a troca não acontece.
  const t3 = await temporadaComRegrasT3(b, temporada);
  if (!o.ignorarLimite && (destino !== j.time_id || posicao !== j.posicao)) {
    const { series } = await seriesAtivas(b);
    const todos = [...series.A, ...series.B];
    const mesmaSerie = series.B.includes(destino) ? series.B : series.A.includes(destino) ? series.A : todos;
    const na = await naPosicaoPorTime(b, mesmaSerie, posicao, jogadorId);
    const limite = LIMITE_POR_POSICAO[posicao];
    if ((na.get(destino) ?? 0) >= limite) {
      const comVaga = mesmaSerie
        .filter((t) => t !== destino && t !== j.time_id && (na.get(t) ?? 0) < limite)
        .sort((x, y) => (na.get(x) ?? 0) - (na.get(y) ?? 0) || x.localeCompare(y))
        .slice(0, 4)
        .map((t) => doTime(t).replace(/^d[oa] /, ''));
      // T3 (ADR-0111): a troca de Time para uma Posição cheia entra na Fila de espera do Time.
      if (t3 && destino !== j.time_id && !o.origemFila) {
        const vez = await entrarNaFila(b, { time: destino, posicao, jogadorId, igUserId: j.ig_user_id, username: j.username, ref: o.ref, agora: o.quando, temporadaId: temporada });
        return {
          resultado: 'NA_FILA',
          mensagem: `as vagas de ${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(destino)} já estão completas. Você entrou na Fila de espera e é o ${vez}º: quando abrir vaga, o pedido vai para o time. Não gastou a sua troca.${comVaga.length ? ` Times com vaga nessa posição agora: ${comVaga.join(', ')}.` : ''} ⚽`,
        };
      }
      return {
        resultado: 'DESTINO_CHEIO',
        mensagem: `as vagas de ${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(destino)} já estão completas, então a ${destino === j.time_id ? 'mudança de posição' : 'transferência'} não deu.${comVaga.length ? ` Times com vaga nessa posição: ${comVaga.join(', ')}.` : ''} ⚽`,
      };
    }
  }

  // Pedido de Transferência (T3, ADR-0111): com Técnico (ou Capitão com Vínculo) no destino, a
  // troca espera o aceite, até o prazo. Recusado ou caído, não gasta a troca.
  if (t3 && destino !== j.time_id && !o.semAceite) {
    const aceite = await aceiteNecessario(b, { de: j.time_id, para: destino, posicao, temporadaId: temporada, janela, gratis, quando: o.quando, comVinculo: o.comVinculo ?? new Set() });
    if (aceite) {
      await abrirPedido(b, { jogadorId, temporadaId: temporada, de: j.time_id, para: destino, posicao, ref: o.ref, quando: o.quando, prazo: aceite.prazo, decisorId: aceite.decisorId, ...(o.origemFila ? { origem: 'FILA' as const } : {}) });
      const horas = Math.max(1, Math.round((aceite.prazo.getTime() - o.quando.getTime()) / 3600_000));
      return {
        resultado: 'PEDIDO_ENVIADO',
        mensagem: `o pedido para ser ${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(destino)} foi para ${aceite.decisorId ? 'o time decidir' : 'o time'}. Se ninguém responder em ${horas === 1 ? '1 hora' : `${horas} horas`}, você entra. Recusado, não gasta a sua troca. ⚽`,
      };
    }
  }

  const { ovr, habilidades } = naPosicao(jogadorId, j.posicao, posicao, j.ovr, j.habilidades);
  // A camisa vai junto, a não ser que o número já tenha dono no Time novo.
  const camisa = destino === j.time_id ? null : (await b.query<{ numero: number | null }>(`SELECT numero FROM jogador WHERE id = $1`, [jogadorId])).rows[0]?.numero ?? null;
  const perdeCamisa = camisa !== null && (await b.query(`SELECT 1 FROM jogador WHERE time_id = $1 AND numero = $2 AND id <> $3 AND NOT banido`, [destino, camisa, jogadorId])).rows.length > 0;
  await b.query(`UPDATE jogador SET time_id = $2, posicao = $3, ovr = $4, habilidades = $5${perdeCamisa ? ', numero = NULL' : ''} WHERE id = $1`, [jogadorId, destino, posicao, ovr, JSON.stringify(habilidades)]);
  if (destino !== j.time_id) await soltarFaixa(b, jogadorId);
  await b.query(
    `INSERT INTO transferencia (jogador_id, temporada_id, de_time, para_time, de_posicao, para_posicao, ig_comment_id, feita_em, janela, gratis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${janela ? 'true' : 'false'}, $9)`,
    [jogadorId, temporada, j.time_id, destino, j.posicao, posicao, o.ref, o.quando.toISOString(), gratis],
  );
  if (fundacao) await marcarFundador(b, jogadorId, destino, fundacao);
  const vaga = `${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(destino)}, OVR ${ovr}`;
  return {
    resultado: 'TRANSFERIDO',
    mensagem: `${destino === j.time_id ? 'mudança de posição feita' : 'transferência feita'}! Agora você é ${vaga}. Vale a partir do próximo jogo escalado. ${gratis ? `Foi de graça: a troca para um Time novo não gasta a da Janela nem a da temporada. Você é Fundador ${doTime(destino)}!` : janela ? 'Foi a troca da Janela: durante a temporada ainda vale uma transferência.' : 'Esta foi a sua transferência da temporada.'}${perdeCamisa ? ` A camisa ${camisa} já tem dono ${doTime(destino)}: escolha outro número no site.` : ''} ⚽`,
  };
}

/**
 * OVR e Habilidades depois de uma troca (ADR-0030). Mesma posição: tudo igual. Posição nova: o
 * OVR continua o mesmo e as Habilidades são refeitas no perfil da posição nova (quem tinha
 * perfil de atacante não vira um goleiro de OVR 34).
 */
export function naPosicao(
  semente: string,
  de: Posicao,
  para: Posicao,
  ovr: number,
  gravadas: Habilidades | string | null | undefined,
): { ovr: number; habilidades: Habilidades } {
  if (de === para) return { ovr, habilidades: habilidadesDe(de, ovr, gravadas) };
  return { ovr, habilidades: perfilNaPosicao(`troca:${semente}`, para, ovr) };
}

/**
 * Liga à conta do Instagram o Jogador inscrito com id provisório (inscrição pela DM, "dm-…"):
 * pega o id da conta no comentário mais recente desse @. Sem isso, voto e vínculo pela DM
 * não acham o Jogador e um novo ENTRO criaria outro.
 */
export async function vincularConta(b: Banco, username: string): Promise<{ id: string; de: string; para: string }> {
  const nome = username.replace(/^@/, '').trim();
  const j = (await b.query<{ id: string; ig_user_id: string }>(`SELECT id::text AS id, ig_user_id FROM jogador WHERE lower(username) = lower($1) AND ig_user_id LIKE 'dm-%'`, [nome])).rows;
  if (j.length !== 1) throw new Error(j.length ? `Há ${j.length} Jogadores @${nome} com id provisório.` : `Nenhum Jogador @${nome} com id provisório.`);
  const conta = (
    await b.query<{ ig_user_id: string }>(
      `SELECT ig_user_id FROM comando WHERE lower(username) = lower($1) AND ig_user_id NOT LIKE 'dm-%' AND ig_media_id <> 'dm' ORDER BY comentado_em DESC LIMIT 1`,
      [nome],
    )
  ).rows[0];
  if (!conta) throw new Error(`Nenhum comentário de @${nome}: não dá para saber o id da conta.`);
  const dono = (await b.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [conta.ig_user_id])).rows[0];
  if (dono) throw new Error(`A conta ${conta.ig_user_id} já é do Jogador ${dono.id}.`);
  await b.query(`UPDATE jogador SET ig_user_id = $2 WHERE id = $1`, [j[0]!.id, conta.ig_user_id]);
  return { id: j[0]!.id, de: j[0]!.ig_user_id, para: conta.ig_user_id };
}

/**
 * Corrige quem trocou de posição pela regra antiga (ADR-0030): volta ao OVR que tinha na
 * posição de antes da troca, com as Habilidades no perfil da posição atual. Só sobe o OVR;
 * Partidas já jogadas não mudam.
 */
export async function corrigirTrocasDePosicao(b: Banco): Promise<{ username: string; antes: number; depois: number }[]> {
  const trocas = (
    await b.query<{ id: string; username: string; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; de_posicao: Posicao }>(
      `SELECT DISTINCT ON (j.id) j.id::text AS id, j.username, j.posicao, j.ovr, j.habilidades, t.de_posicao
         FROM transferencia t JOIN jogador j ON j.id = t.jogador_id
        WHERE t.de_posicao <> t.para_posicao AND j.posicao = t.para_posicao AND NOT j.banido
        ORDER BY j.id, t.feita_em DESC`,
    )
  ).rows;
  const feitas: { username: string; antes: number; depois: number }[] = [];
  for (const t of trocas) {
    const ovr = Math.round(ovrDasHabilidades(t.de_posicao, habilidadesDe(t.posicao, t.ovr, t.habilidades)));
    if (ovr <= t.ovr) continue;
    await b.query(`UPDATE jogador SET ovr = $2, habilidades = $3 WHERE id = $1`, [t.id, ovr, JSON.stringify(perfilNaPosicao(`troca:${t.id}`, t.posicao, ovr))]);
    feitas.push({ username: t.username, antes: t.ovr, depois: ovr });
  }
  return feitas;
}

/** O Jogador com esse @ (sem diferenciar maiúsculas), ou null. */
export async function jogadorPeloUsername(b: Banco, username: string): Promise<{ id: string; time_id: TimeId; posicao: Posicao } | null> {
  return (
    (await b.query<{ id: string; time_id: TimeId; posicao: Posicao }>(`SELECT id::text AS id, time_id, posicao FROM jogador WHERE lower(username) = lower($1) AND NOT banido ORDER BY id LIMIT 1`, [username.replace(/^@/, '').trim()])).rows[0] ?? null
  );
}

/**
 * Mudança de Time feita à mão pelo dono (ADR-0029): ignora o equilíbrio de Elencos e não gasta
 * a Transferência do Jogador. Leva as Habilidades; o OVR é o delas na posição nova. A camisa vai
 * junto, a não ser que o número já tenha dono no Time novo. Vale a partir do próximo Corte.
 */
export async function moverJogador(
  b: Banco,
  username: string,
  destino: TimeId,
  posicaoPedida?: Posicao,
  id?: string,
): Promise<{ de: TimeId; para: TimeId; posicao: Posicao; ovr: number; perdeuCamisa: boolean }> {
  const achados = (
    await b.query<{ id: string; time_id: TimeId; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; numero: number | null }>(
      `SELECT id::text AS id, time_id, posicao, ovr, habilidades, numero FROM jogador WHERE lower(username) = lower($1) AND NOT banido AND ($2::text IS NULL OR id::text = $2)`,
      [username.replace(/^@/, '').trim(), id ?? null],
    )
  ).rows;
  if (achados.length > 1) throw new Error(`Há ${achados.length} Jogadores @${username} (ids ${achados.map((x) => x.id).join(', ')}): informe o ID.`);
  const j = achados[0];
  if (!j) throw new Error(`Nenhum Jogador @${username}.`);
  if (!(await timesAtivos(b)).includes(destino)) throw new Error(`O time ${destino} não joga esta Temporada.`);
  const posicao = posicaoPedida ?? j.posicao;
  const { ovr, habilidades } = naPosicao(j.id, j.posicao, posicao, j.ovr, j.habilidades);
  const perdeuCamisa =
    destino !== j.time_id &&
    j.numero !== null &&
    (await b.query(`SELECT 1 FROM jogador WHERE time_id = $1 AND numero = $2 AND id <> $3 AND NOT banido`, [destino, j.numero, j.id])).rows.length > 0;
  await b.query(`UPDATE jogador SET time_id = $2, posicao = $3, ovr = $4, habilidades = $5${perdeuCamisa ? ', numero = NULL' : ''} WHERE id = $1`, [
    j.id, destino, posicao, ovr, JSON.stringify(habilidades),
  ]);
  if (destino !== j.time_id) await soltarFaixa(b, j.id);
  return { de: j.time_id, para: destino, posicao, ovr, perdeuCamisa };
}

/**
 * Temporada em que a Transferência conta, ou null se estão fechadas: só antes do último
 * jogo da Fase de Liga (a partir dele, as Escalações que faltam são do Mata-mata).
 */
/**
 * O pedido caiu na Janela (ADR-0022, ADR-0096)? Só a partir da T2, e vale a hora do pedido, não a
 * hora em que a coleta o processou: a Janela vai até o Corte do primeiro jogo da Temporada. Sem
 * jogos marcados ainda, vale o status (Pré-temporada).
 */
async function emJanela(b: Banco, temporadaId: number, quando: Date): Promise<boolean> {
  const t = (
    await b.query<{ numero: number; status: string; primeiro: Date | string | null }>(
      `SELECT t.numero, t.status, (SELECT min(p.apito_inicial) FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id AND p.copa_etapa IS DISTINCT FROM 'SUPERCOPA') AS primeiro
         FROM temporada t WHERE t.id = $1`,
      [temporadaId],
    )
  ).rows[0];
  if (!t || !temRegrasT2(t.numero)) return false;
  // Com Supercopa (ADR-0118), a Janela só abre quando ela termina.
  if (await antesDoFimDaSupercopa(b, temporadaId, quando)) return false;
  if (!t.primeiro) return t.status === 'PRE_TEMPORADA';
  return quando.getTime() < new Date(t.primeiro).getTime() - CORTE_MS;
}

async function temporadaAtualComT3(b: Banco): Promise<boolean> {
  const t = (await b.query<{ numero: number }>(`SELECT numero FROM temporada WHERE status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY status = 'EM_ANDAMENTO' DESC, numero LIMIT 1`)).rows[0];
  return !!t && temRegrasT3(t.numero);
}

/**
 * A Fila chamou um novato (ADR-0111): entra no Time e na Posição da Fila, como uma Inscrição
 * do dono (a vaga já foi conferida).
 */
export async function inscreverDaFila(b: Banco, n: { igUserId: string; username: string; ref: string; time: TimeId; posicao: Posicao }, agora: Date): Promise<AvisoDoPedido | null> {
  let resposta = '';
  const r = await inscrever(
    b,
    { igCommentId: n.ref, igMediaId: 'fila', igUserId: n.igUserId, username: n.username, texto: '', comentadoEm: agora },
    n.time,
    n.posicao,
    { rodadaEmVotacao: null, forcar: true, responder: async (_id, texto) => void (resposta = texto) },
  );
  if (r !== 'INSCRITO' && r !== 'REALOCADO') return null;
  const id = (await b.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [n.igUserId])).rows[0]?.id;
  return id ? { jogadorId: id, ref: n.ref, mensagem: resposta.replace(/^@\S+ /, '') } : null;
}

async function temporadaComRegrasT3(b: Banco, temporadaId: number): Promise<boolean> {
  const t = (await b.query<{ numero: number }>(`SELECT numero FROM temporada WHERE id = $1`, [temporadaId])).rows[0];
  return !!t && temRegrasT3(t.numero);
}

async function temporadaDaTransferencia(b: Banco, agora: Date): Promise<number | null> {
  const t = (
    await b.query<{ id: number; ultimo_da_liga: Date | string | null }>(
      `SELECT t.id, (SELECT max(p.apito_inicial) FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id AND r.fase = 'LIGA') AS ultimo_da_liga
         FROM temporada t WHERE t.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO') ORDER BY t.status = 'EM_ANDAMENTO' DESC, t.id LIMIT 1`,
    )
  ).rows[0];
  if (!t) return null;
  if (t.ultimo_da_liga && agora.getTime() >= new Date(t.ultimo_da_liga).getTime() - CORTE_MS) return null;
  return t.id;
}

/**
 * Copa em andamento (ADR-0088): da hora em que a Janela fecha (Corte do primeiro jogo da Copa)
 * até a Copa ter campeão, ninguém troca de Time. Assim quem cai na Copa não vai jogar o resto
 * dela por outro Time.
 */
export async function copaEmAndamento(b: Banco, temporadaId: number, agora: Date): Promise<boolean> {
  const r = (
    await b.query<{ primeiro: Date | string | null; campeao: string | null }>(
      `SELECT (SELECT min(p.apito_inicial) FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = t.id AND p.copa_etapa IS NOT NULL AND p.copa_etapa <> 'SUPERCOPA') AS primeiro,
              t.campeao_copa_id AS campeao
         FROM temporada t WHERE t.id = $1`,
      [temporadaId],
    )
  ).rows[0];
  if (!r?.primeiro || r.campeao) return false;
  return agora.getTime() >= new Date(r.primeiro).getTime() - CORTE_MS;
}

/**
 * Por que as trocas de Time estão fechadas agora: a Copa em andamento (ADR-0088) ou a Supercopa
 * ainda por jogar (ADR-0118). Convite e Troca casada nem nascem. null: não estão fechadas por isso.
 */
export async function trocasFechadasAgora(b: Banco, agora: Date): Promise<'COPA' | 'SUPERCOPA' | null> {
  const t = await temporadaDaTransferencia(b, agora);
  if (t === null) return null;
  if (await antesDoFimDaSupercopa(b, t, agora)) return 'SUPERCOPA';
  return (await copaEmAndamento(b, t, agora)) ? 'COPA' : null;
}

/** As trocas de Time estão fechadas agora pela Copa ou pela Supercopa? */
export async function trocasFechadasPelaCopa(b: Banco, agora: Date): Promise<boolean> {
  return (await trocasFechadasAgora(b, agora)) !== null;
}

/** A mensagem de quando a troca não vale porque a Copa está em andamento. */
export const FECHADO_NA_COPA = 'durante a Copa ninguém troca de time. As transferências reabrem depois da Final da Copa, antes da Fase de Liga. ⚽';
/** A mensagem de quando a troca não vale porque a Supercopa ainda não acabou (ADR-0118). */
export const FECHADO_ATE_A_SUPERCOPA = 'a Janela abre depois da Supercopa (domingo, 18h). Até lá ninguém troca de time. ⚽';

/** Voto no Craque: "3" e "A3" são o 3 da Série A; "B3" é o 3 da Série B (ADR-0017). */
async function votar(b: Banco, c: Comentario, voto: { numero: number; serie?: Serie }, ctx: Contexto): Promise<Resultado> {
  if (ctx.rodadaEmVotacao === null) return 'VOTACAO_FECHADA';
  if (voto.numero > CANDIDATOS_POR_SERIE) return 'NAO_CANDIDATO';
  const numero = numeroDoCandidato(voto.serie ?? 'A', voto.numero);
  const candidato = (
    await b.query<{ jogador_id: string; serie: Serie }>(`SELECT jogador_id, serie FROM candidato WHERE rodada_id = $1 AND numero = $2`, [ctx.rodadaEmVotacao, numero])
  ).rows[0];
  if (!candidato) return 'NAO_CANDIDATO';
  // Um voto por @ por Rodada em cada Série; vale o último (comentários podem chegar fora de ordem).
  const r = await b.query(
    `INSERT INTO voto (rodada_id, ig_user_id, jogador_id, votado_em, serie) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (rodada_id, ig_user_id, serie) DO UPDATE SET jogador_id = EXCLUDED.jogador_id, votado_em = EXCLUDED.votado_em
     WHERE voto.votado_em <= EXCLUDED.votado_em
     RETURNING jogador_id`,
    [ctx.rodadaEmVotacao, c.igUserId, candidato.jogador_id, c.comentadoEm.toISOString(), candidato.serie],
  );
  return r.rows.length ? 'VOTO_REGISTRADO' : 'VOTO_ANTIGO';
}

/**
 * Filtro de @ ofensivo (o @ aparece na tela). A lista fica no banco, em config 'bloqueio'
 * (array de trechos), para poder ser atualizada sem deploy.
 */
async function usernameBloqueado(b: Banco, username: string): Promise<boolean> {
  const linha = (await b.query<{ valor: string[] }>(`SELECT valor FROM config WHERE chave = 'bloqueio'`)).rows[0];
  if (!linha?.valor?.length) return false;
  const nome = normalizar(username).replace(/[._]/g, '');
  return linha.valor.some((trecho) => trecho && nome.includes(normalizar(trecho).replace(/[._\s]/g, '')));
}
