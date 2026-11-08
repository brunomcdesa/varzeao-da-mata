/**
 * Processamento de comentários (job `coletar`, passos 2 a 4 da arquitetura).
 * Cada comentário é gravado em `comando` uma única vez; reprocessar o mesmo comentário
 * não muda nada (idempotência pelo ig_comment_id).
 */
import type { Habilidades, Posicao, TimeId } from '@liga/shared';
import { TIMES, doTime, ovrDasHabilidades } from '@liga/shared';
import type { Banco } from './banco.js';
import { CONTA_DA_LIGA, citacoes, interpretar, type Comando } from './comandos.js';
import { FOLGA_DE_ELENCO, FORMACAO, REALOCAR_QUANDO_CHEIO, habilidadesDe, sortearHabilidadesIniciais } from './regras.js';
import { normalizar } from './vocabulario.js';
import { CORTE_MINUTOS } from './escalacao.js';

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
  | 'MESMO_LUGAR';

export interface Contexto {
  /** Rodada cujos Candidatos a Craque estão em votação agora, ou null se não há votação aberta. */
  rodadaEmVotacao: number | null;
  /** Post do Resumo dessa votação: só nele vale o voto com o número sozinho ("3"). */
  postDaVotacao?: string | null;
  /** Responde um comentário no Instagram (ex.: avisar quem foi realocado). Erros não param a coleta. */
  responder?: (igCommentId: string, texto: string) => Promise<void>;
  /** Sobrescreve REALOCAR_QUANDO_CHEIO (testes). */
  realocar?: boolean;
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
      const releitura = antes?.tipo === 'IGNORADO' || ['SEM_POSICAO', 'SEM_TIME', 'TIME_CHEIO'].includes(antes?.resultado ?? '');
      if (!releitura || `@${c.username}`.toUpperCase() === CONTA_DA_LIGA) return 'REPETIDO';
      const inscrito = (await b.query<{ inscrito_em: Date | string }>(`SELECT inscrito_em FROM jogador WHERE ig_user_id = $1`, [c.igUserId])).rows[0];
      const agoraLe = interpretar(c.texto).tipo;
      // Inscrito: só volta a ler pedido de Transferência feito depois de entrar (o leitor
      // passou a entender "posso ir pro time da preguiça?").
      if (inscrito) {
        if (antes?.tipo !== 'IGNORADO' || agoraLe !== 'TRANSFERENCIA' || c.comentadoEm.getTime() < new Date(inscrito.inscrito_em).getTime()) return 'REPETIDO';
      } else if (agoraLe !== 'INSCRICAO' && agoraLe !== 'TRANSFERENCIA' && !(await juntarComOutroComentario(b, c))) return 'REPETIDO';
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
    // Pedido em dois comentários ("Arara" e "Entro como meia"): junta o Time de um com a
    // posição do outro.
    if (!daLiga && !jogador && comando.tipo !== 'INSCRICAO' && comando.tipo !== 'VOTO') {
      const junto = await juntarComOutroComentario(b, c);
      if (junto) comando = junto;
    }
    let resultado: Resultado;
    if (comando.tipo === 'IGNORADO' || (comando.tipo === 'VOTO' && comando.solto && (!ctx.postDaVotacao || c.igMediaId !== ctx.postDaVotacao))) resultado = 'IGNORADO';
    else if (jogador?.banido) resultado = 'BANIDO';
    else if (comando.tipo === 'INVALIDO') {
      resultado = comando.motivo;
      // "Tem transferência?": explica como pedir (só na primeira leitura, para não repetir).
      if (comando.prefixo === 'TRANSFERIR' && novo.rows.length) {
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
    } else resultado = await votar(b, c, comando.numero, ctx);

    const tipo = resultado === 'IGNORADO' || comando.tipo === 'IGNORADO' ? 'IGNORADO' : comando.tipo === 'INVALIDO' ? 'INVALIDO' : comando.tipo;
    await b.query(`UPDATE comando SET tipo = $2, resultado = $3 WHERE ig_comment_id = $1`, [c.igCommentId, tipo, resultado]);
    return resultado;
  });
}

/**
 * Se a pessoa (ainda não inscrita) mandou, em até 24 h, um comentário só com o Time e outro só
 * com a posição (ou um ENTRO sem Time), devolve a Inscrição juntando os dois.
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
  // O comentário com a posição precisa ser um pedido (ENTRO); o do Time pode ser só o nome.
  const pedido = (texto: string) => /\bENTR(O|AR)\b|\bQUERO\b|\bSOU\b/.test(normalizar(texto));
  for (const o of outros) {
    const outro = citacoes(o.texto);
    if (outro.times.length > 1 || outro.posicoes.length > 1) continue;
    const time = este.times[0] ?? (outro.posicoes.length === 0 ? outro.times[0] : undefined);
    const posicao = este.posicoes[0] ?? (outro.times.length === 0 ? outro.posicoes[0] : undefined);
    if (!time || !posicao) continue;
    if (!pedido(este.posicoes.length ? c.texto : o.texto) && !pedido(este.times.length ? c.texto : o.texto)) continue;
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

async function inscrever(b: Banco, c: Comentario, pedido: TimeId, pedida: Posicao | undefined, ctx: Contexto): Promise<Resultado> {
  if (await usernameBloqueado(b, c.username)) return 'NOME_BLOQUEADO';

  // Limite de equilíbrio: nenhum Elenco pode passar o menor por mais que FOLGA_DE_ELENCO.
  const contagem = new Map<string, number>(TIMES.map((t) => [t, 0]));
  for (const r of (await b.query<{ time_id: string; n: string }>(`SELECT time_id, count(*) AS n FROM jogador WHERE NOT banido GROUP BY time_id`)).rows) {
    contagem.set(r.time_id, Number(r.n));
  }
  const menor = Math.min(...contagem.values());
  // Time cheio: entra no mais vazio (empate decidido pelo id do comentário, para espalhar),
  // na posição pedida, e recebe uma resposta explicando.
  let time = pedido;
  if (contagem.get(pedido)! >= menor + FOLGA_DE_ELENCO) {
    if (!(ctx.realocar ?? REALOCAR_QUANDO_CHEIO)) return 'TIME_CHEIO';
    const vazios = TIMES.filter((t) => contagem.get(t) === menor);
    time = vazios[hashSimples(c.igCommentId) % vazios.length]!;
  }
  const posicao = pedida ?? (await posicaoMaisVazia(b, time));

  const { ovr, habilidades } = sortearHabilidadesIniciais(c.igCommentId, posicao as Posicao);
  await b.query(
    `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [c.igUserId, c.username, time, posicao, ovr, JSON.stringify(habilidades), c.comentadoEm.toISOString()],
  );
  // Resposta no comentário: a pessoa fica sabendo que entrou (e onde, se foi realocada).
  const vaga = `${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(time)}, OVR ${ovr}`;
  await ctx.responder?.(
    c.igCommentId,
    time === pedido
      ? `@${c.username} você entrou no Varzeão da Mata! Agora é ${vaga}. Seu boneco já está no site (link na bio). ⚽`
      : `@${c.username} o time ${doTime(pedido)} encheu, então você entrou no time ${doTime(time)} para equilibrar a Liga. Agora é ${vaga}. Bem-vindo ao Varzeão! ⚽`,
  );
  return time === pedido ? 'INSCRITO' : 'REALOCADO';
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
  const r = await transferirJogador(b, jogadorId, pedido, { quando: c.comentadoEm, ref: c.igCommentId });
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
  o: { quando: Date; ref: string },
): Promise<{ resultado: Resultado; mensagem?: string }> {
  const j = (await b.query<{ time_id: TimeId; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null }>(`SELECT time_id, posicao, ovr, habilidades FROM jogador WHERE id = $1`, [jogadorId])).rows[0];
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
  const usada = (await b.query(`SELECT 1 FROM transferencia WHERE jogador_id = $1 AND temporada_id = $2`, [jogadorId, temporada])).rows[0];
  if (usada) return { resultado: 'TRANSFERENCIA_USADA', mensagem: 'você já usou a transferência desta temporada. Dá para transferir de novo na próxima. ⚽' };

  if (destino !== j.time_id) {
    // Equilíbrio: conta os Elencos sem ele (ele sai da origem) e aplica a regra da Inscrição.
    const contagem = new Map<string, number>(TIMES.map((t) => [t, 0]));
    for (const r of (await b.query<{ time_id: string; n: string }>(`SELECT time_id, count(*) AS n FROM jogador WHERE NOT banido AND id <> $1 GROUP BY time_id`, [jogadorId])).rows) {
      contagem.set(r.time_id, Number(r.n));
    }
    const menor = Math.min(...contagem.values());
    if (contagem.get(destino)! >= menor + FOLGA_DE_ELENCO) {
      const vazios = TIMES.filter((t) => contagem.get(t) === menor && t !== j.time_id).map((t) => doTime(t).replace(/^d[oa] /, ''));
      return { resultado: 'DESTINO_CHEIO', mensagem: `o time ${doTime(destino)} está cheio agora, então a transferência não deu. Times com vaga: ${vazios.join(', ')}. ⚽` };
    }
  }

  const habilidades = habilidadesDe(j.posicao, j.ovr, j.habilidades);
  const ovr = ovrDasHabilidades(posicao, habilidades);
  await b.query(`UPDATE jogador SET time_id = $2, posicao = $3, ovr = $4, habilidades = $5 WHERE id = $1`, [jogadorId, destino, posicao, ovr, JSON.stringify(habilidades)]);
  await b.query(
    `INSERT INTO transferencia (jogador_id, temporada_id, de_time, para_time, de_posicao, para_posicao, ig_comment_id, feita_em) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [jogadorId, temporada, j.time_id, destino, j.posicao, posicao, o.ref, o.quando.toISOString()],
  );
  const vaga = `${NOME_DA_POSICAO_FALADO[posicao]} ${doTime(destino)}, OVR ${ovr}`;
  return {
    resultado: 'TRANSFERIDO',
    mensagem: `${destino === j.time_id ? 'mudança de posição feita' : 'transferência feita'}! Agora você é ${vaga}. Vale a partir do próximo jogo escalado. Esta foi a sua transferência da temporada. ⚽`,
  };
}

/**
 * Temporada em que a Transferência conta, ou null se estão fechadas: só antes do último
 * jogo da Fase de Liga (a partir dele, as Escalações que faltam são do Mata-mata).
 */
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

async function votar(b: Banco, c: Comentario, numero: number, ctx: Contexto): Promise<Resultado> {
  if (ctx.rodadaEmVotacao === null) return 'VOTACAO_FECHADA';
  const candidato = (
    await b.query<{ jogador_id: string }>(`SELECT jogador_id FROM candidato WHERE rodada_id = $1 AND numero = $2`, [ctx.rodadaEmVotacao, numero])
  ).rows[0];
  if (!candidato) return 'NAO_CANDIDATO';
  // Um voto por @ por Rodada; vale o último (comentários podem chegar fora de ordem).
  const r = await b.query(
    `INSERT INTO voto (rodada_id, ig_user_id, jogador_id, votado_em) VALUES ($1, $2, $3, $4)
     ON CONFLICT (rodada_id, ig_user_id) DO UPDATE SET jogador_id = EXCLUDED.jogador_id, votado_em = EXCLUDED.votado_em
     WHERE voto.votado_em <= EXCLUDED.votado_em
     RETURNING jogador_id`,
    [ctx.rodadaEmVotacao, c.igUserId, candidato.jogador_id, c.comentadoEm.toISOString()],
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
