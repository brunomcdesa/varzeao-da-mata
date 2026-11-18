/**
 * Correção do Limite por Posição (ADR-0080): quem passou do limite antes de a Transferência
 * respeitar a regra. Em cada Time acima do limite numa Posição, o inscrito mais recente dela vai
 * para o Time do mesmo Grupo (ou, sem vaga no Grupo, da mesma Série) com menos gente na Posição,
 * na mesma Posição, sem gastar a Transferência (mudança do dono, ADR-0029).
 *
 * `planejarCorrecao` é pura; `corrigirLimitePorPosicao` lê, planeja e, só com `gravar`, aplica.
 */
import { FALA_DO_TIME, POSICOES, type Posicao, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { LIMITE_POR_POSICAO, moverJogador } from './coletar.js';
import { gruposDaTemporada, seriesDaTemporada } from './series.js';

const NOME_DA_POSICAO_FALADO: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };

export interface JogadorNaPosicao {
  id: string;
  username: string;
  time: TimeId;
  posicao: Posicao;
  inscritoEm: string;
}

export interface Correcao {
  jogador: JogadorNaPosicao;
  para: TimeId;
}

const ordemDeInscricao = (a: JogadorNaPosicao, b: JogadorNaPosicao) => a.inscritoEm.localeCompare(b.inscritoEm) || Number(a.id) - Number(b.id);

/** O plano. `conjuntos`: os Times que podem receber de cada Time (o Grupo dele, depois a Série). */
export function planejarCorrecao(elenco: readonly JogadorNaPosicao[], conjuntos: (t: TimeId) => readonly (readonly TimeId[])[]): Correcao[] {
  const atual = new Map(elenco.map((j) => [j.id, j.time]));
  const na = (t: TimeId, p: Posicao) => elenco.filter((j) => j.posicao === p && atual.get(j.id) === t).length;
  const tamanho = (t: TimeId) => elenco.filter((j) => atual.get(j.id) === t).length;
  const times = [...new Set(elenco.map((j) => j.time))].sort();
  const correcoes: Correcao[] = [];
  for (const time of times) {
    for (const p of POSICOES) {
      while (na(time, p) > LIMITE_POR_POSICAO[p]) {
        const sai = elenco.filter((j) => j.posicao === p && atual.get(j.id) === time).sort(ordemDeInscricao).at(-1)!;
        let para: TimeId | undefined;
        for (const conjunto of conjuntos(time)) {
          const comVaga = conjunto.filter((t) => t !== time && na(t, p) < LIMITE_POR_POSICAO[p]);
          if (!comVaga.length) continue;
          para = [...comVaga].sort((a, b) => na(a, p) - na(b, p) || tamanho(a) - tamanho(b) || a.localeCompare(b))[0];
          break;
        }
        if (!para) break;
        atual.set(sai.id, para);
        correcoes.push({ jogador: sai, para });
      }
    }
  }
  return correcoes;
}

/** O aviso para quem foi movido (rascunho: só sai com a aprovação do dono). */
export function avisoDaCorrecao(c: Correcao): string {
  const de = FALA_DO_TIME[c.jogador.time];
  const para = FALA_DO_TIME[c.para];
  const pos = NOME_DA_POSICAO_FALADO[c.jogador.posicao];
  return (
    `@${c.jogador.username} cada Time pode ter no máximo 4 jogadores por posição (2 goleiros), e ${de.artigo === 'a' ? 'a' : 'o'} ${de.curto} ficou com um a mais. ` +
    `Como você foi o último a chegar, agora é ${pos} ${para.artigo === 'a' ? 'da' : 'do'} ${para.curto}, na Série A. ` +
    `OVR, apelido e Carreira vão junto, e a sua Transferência continua valendo. ⚽`
  );
}

export async function corrigirLimitePorPosicao(banco: Banco, opcoes: { gravar: boolean }): Promise<{ correcoes: Correcao[]; gravado: boolean }> {
  const t = (
    await banco.query<{ id: number }>(`SELECT id FROM temporada ORDER BY (status = 'EM_ANDAMENTO') DESC, (status = 'PRE_TEMPORADA') DESC, numero DESC LIMIT 1`)
  ).rows[0];
  if (!t) throw new Error('Nenhuma Temporada.');
  const series = await seriesDaTemporada(banco, t.id);
  const grupos = await gruposDaTemporada(banco, t.id);
  const conjuntos = (time: TimeId): (readonly TimeId[])[] => {
    const serie = series.A.includes(time) ? series.A : series.B;
    const grupo = grupos ? Object.values(grupos).find((g) => g.includes(time)) : undefined;
    return grupo ? [grupo, serie] : [serie];
  };
  const ativos = new Set([...series.A, ...series.B]);
  const elenco = (
    await banco.query<{ id: string; username: string; time_id: TimeId; posicao: Posicao; inscrito_em: Date | string }>(
      `SELECT id::text AS id, username, time_id, posicao, inscrito_em FROM jogador WHERE NOT banido`,
    )
  ).rows
    .filter((j) => ativos.has(j.time_id))
    .map((j) => ({ id: j.id, username: j.username, time: j.time_id, posicao: j.posicao, inscritoEm: new Date(j.inscrito_em).toISOString() }));
  const correcoes = planejarCorrecao(elenco, conjuntos);
  if (opcoes.gravar) {
    await banco.transacao(async (b) => {
      for (const c of correcoes) await moverJogador(b, c.jogador.username, c.para, c.jogador.posicao, c.jogador.id);
    });
  }
  return { correcoes, gravado: opcoes.gravar };
}
