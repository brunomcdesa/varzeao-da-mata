/**
 * Processamento de comentários (job `coletar`, passos 2 a 4 da arquitetura).
 * Cada comentário é gravado em `comando` uma única vez; reprocessar o mesmo comentário
 * não muda nada (idempotência pelo ig_comment_id).
 */
import type { Posicao, TimeId } from '@liga/shared';
import { TIMES } from '@liga/shared';
import type { Banco } from './banco.js';
import { CONTA_DA_LIGA, citacoes, interpretar, type Comando } from './comandos.js';
import { FOLGA_DE_ELENCO, FORMACAO, sortearHabilidadesIniciais } from './regras.js';
import { normalizar } from './vocabulario.js';

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
  | 'SEM_CANDIDATO';

export interface Contexto {
  /** Rodada cujos Candidatos a Craque estão em votação agora, ou null se não há votação aberta. */
  rodadaEmVotacao: number | null;
  /** Post do Resumo dessa votação: só nele vale o voto com o número sozinho ("3"). */
  postDaVotacao?: string | null;
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
      const jaInscrito = (await b.query(`SELECT 1 FROM jogador WHERE ig_user_id = $1`, [c.igUserId])).rows.length > 0;
      if (jaInscrito || (interpretar(c.texto).tipo !== 'INSCRICAO' && !(await juntarComOutroComentario(b, c)))) return 'REPETIDO';
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
    else if (comando.tipo === 'INVALIDO') resultado = comando.motivo;
    else if (comando.tipo === 'INSCRICAO') resultado = jogador ? 'JA_INSCRITO' : await inscrever(b, c, comando.time, comando.posicao);
    else resultado = await votar(b, c, comando.numero, ctx);

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

async function inscrever(b: Banco, c: Comentario, time: TimeId, pedida: Posicao | undefined): Promise<Resultado> {
  const posicao = pedida ?? (await posicaoMaisVazia(b, time));
  if (await usernameBloqueado(b, c.username)) return 'NOME_BLOQUEADO';

  // Limite de equilíbrio: nenhum Elenco pode passar o menor por mais que FOLGA_DE_ELENCO.
  const contagem = new Map<string, number>(TIMES.map((t) => [t, 0]));
  for (const r of (await b.query<{ time_id: string; n: string }>(`SELECT time_id, count(*) AS n FROM jogador WHERE NOT banido GROUP BY time_id`)).rows) {
    contagem.set(r.time_id, Number(r.n));
  }
  const menor = Math.min(...contagem.values());
  if (contagem.get(time)! >= menor + FOLGA_DE_ELENCO) return 'TIME_CHEIO';

  const { ovr, habilidades } = sortearHabilidadesIniciais(c.igCommentId, posicao as Posicao);
  await b.query(
    `INSERT INTO jogador (ig_user_id, username, time_id, posicao, ovr, habilidades, inscrito_em) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [c.igUserId, c.username, time, posicao, ovr, JSON.stringify(habilidades), c.comentadoEm.toISOString()],
  );
  return 'INSCRITO';
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
