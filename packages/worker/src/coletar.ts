/**
 * Processamento de comentários (job `coletar`, passos 2 a 4 da arquitetura).
 * Cada comentário é gravado em `comando` uma única vez; reprocessar o mesmo comentário
 * não muda nada (idempotência pelo ig_comment_id).
 */
import type { Posicao, TimeId } from '@liga/shared';
import { TIMES } from '@liga/shared';
import type { Banco } from './banco.js';
import { interpretar } from './comandos.js';
import { FOLGA_DE_ELENCO, sortearHabilidadesIniciais } from './regras.js';
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
    if (!novo.rows.length) return 'REPETIDO';

    // O @ pode mudar; o Jogador é da conta (ig_user_id), então o username só é atualizado.
    const jogador = (
      await b.query<{ id: string; banido: boolean }>(
        `UPDATE jogador SET username = $2 WHERE ig_user_id = $1 RETURNING id, banido`,
        [c.igUserId, c.username],
      )
    ).rows[0];

    const comando = interpretar(c.texto);
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

async function inscrever(b: Banco, c: Comentario, time: TimeId, posicao: string): Promise<Resultado> {
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
