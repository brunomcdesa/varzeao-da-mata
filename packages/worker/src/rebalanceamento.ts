/**
 * Rebalanceamento da Temporada 2 (ADR-0036 e ADR-0058, GLOSSARY: Rebalanceamento, Time Primo,
 * Fundador).
 *
 * Roda uma vez, quando a T2 nasce. Ninguém desce para a Série B (ADR-0058): de cada Time
 * fundador acima do tamanho-alvo saem os inscritos mais recentes para o Time Primo, um dos 8
 * Times que chegaram na T2 direto na Série A, na mesma Posição. Depois, todo o Elenco desses
 * Times vira Fundador.
 *
 * `planejarRebalanceamento` é pura (testável sem banco); `rebalancear` lê, planeja e, só com
 * `gravar`, aplica. Sem `gravar`, é a simulação que o dono aprova antes.
 */
import { FALA_DO_TIME, POSICOES, temRegrasT2, type Posicao, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FORMACAO } from './regras.js';
import { seriesDaTemporada, type SeriesDaTemporada } from './series.js';

/** Time Primo de cada Time fundador (ADR-0036): os Clássicos fundadores viram os Clássicos que chegaram na T2. */
export const TIME_PRIMO: Readonly<Partial<Record<TimeId, TimeId>>> = {
  CAP: 'SUC',
  ONC: 'JAC',
  TAT: 'LEA',
  TAM: 'LOB',
  PRE: 'COR',
  SAG: 'BES',
  TUC: 'BOT',
  ARA: 'TAR',
};

/** Quantos Jogadores cada Time fundador mantém: uma Escalação inteira, sem rodízio. */
export const TAMANHO_DA_A = 7;

const VAGAS: Record<Posicao, number> = Object.fromEntries(POSICOES.map((p) => [p, FORMACAO.filter((x) => x === p).length])) as Record<Posicao, number>;

export interface JogadorNoElenco {
  id: string;
  username: string;
  time: TimeId;
  posicao: Posicao;
  inscritoEm: string;
  numero: number | null;
}

export interface Remanejamento {
  jogador: JogadorNoElenco;
  para: TimeId;
  /** false quando o Time Primo estava cheio na Posição e o destino foi outro Time que recebe. */
  noPrimo: boolean;
}

export interface PlanoDeRebalanceamento {
  remanejados: Remanejamento[];
  /** O Elenco de cada Time depois do plano. */
  elencos: Record<string, JogadorNoElenco[]>;
}

const ordemDeInscricao = (a: JogadorNoElenco, b: JogadorNoElenco) => a.inscritoEm.localeCompare(b.inscritoEm) || Number(a.id) - Number(b.id);

/**
 * Os Times que recebem Jogadores no Rebalanceamento: os Times Primos que jogam a Temporada (na
 * T2, os 8 que chegaram direto na Série A, ADR-0058).
 */
export function timesQueRecebem(series: SeriesDaTemporada): TimeId[] {
  const todos = [...series.A, ...series.B];
  return [...new Set(Object.values(TIME_PRIMO))].filter((t): t is TimeId => !!t && todos.includes(t));
}

/**
 * O plano: para cada Time fundador com mais de `tamanho` Jogadores, sai o mais recente da
 * Posição com mais sobra em relação à Escalação (no empate, a que o Time Primo mais precisa),
 * até o Time ficar com `tamanho`. O destino é o Time Primo, ou, se ele já tem a Posição
 * completa, o Time que recebe com menos Jogadores nela.
 */
export function planejarRebalanceamento(elenco: readonly JogadorNoElenco[], series: SeriesDaTemporada, tamanho = TAMANHO_DA_A): PlanoDeRebalanceamento {
  const elencos: Record<string, JogadorNoElenco[]> = Object.fromEntries([...series.A, ...series.B].map((t) => [t, [] as JogadorNoElenco[]]));
  for (const j of [...elenco].sort(ordemDeInscricao)) elencos[j.time]?.push(j);
  const naPosicao = (t: TimeId, p: Posicao) => elencos[t]!.filter((j) => j.posicao === p).length;
  const remanejados: Remanejamento[] = [];
  const recebem = timesQueRecebem(series);
  if (!recebem.length) return { remanejados, elencos };

  for (const time of [...series.A, ...series.B]) {
    const primo = TIME_PRIMO[time];
    if (!primo) continue;
    const daB = recebem.includes(primo) ? primo : null;
    while (elencos[time]!.length > tamanho) {
      const sobra = (p: Posicao) => naPosicao(time, p) - VAGAS[p];
      const falta = (p: Posicao) => (daB ? VAGAS[p] - naPosicao(daB, p) : 0);
      const posicao = POSICOES.filter((p) => naPosicao(time, p) > 0).reduce((melhor, p) =>
        sobra(p) > sobra(melhor) || (sobra(p) === sobra(melhor) && falta(p) > falta(melhor)) ? p : melhor,
      );
      const sai = elencos[time]!.filter((j) => j.posicao === posicao).at(-1)!;
      const noPrimo = daB !== null && naPosicao(daB, posicao) < VAGAS[posicao];
      const para = noPrimo
        ? daB
        : [...recebem].sort((a, b) => naPosicao(a, posicao) - naPosicao(b, posicao) || elencos[a]!.length - elencos[b]!.length || a.localeCompare(b))[0]!;
      elencos[time] = elencos[time]!.filter((j) => j !== sai);
      const movido = { ...sai, time: para };
      elencos[para]!.push(movido);
      elencos[para]!.sort(ordemDeInscricao);
      remanejados.push({ jogador: sai, para, noPrimo });
    }
  }
  return { remanejados, elencos };
}

/** A resposta para cada remanejado (rascunho: só sai com a aprovação do dono). */
export function avisoDoRemanejado(r: Remanejamento): string {
  const de = FALA_DO_TIME[r.jogador.time];
  const para = FALA_DO_TIME[r.para];
  const destino = `${para.artigo === 'a' ? 'da' : 'do'} ${para.curto}`;
  return (
    `@${r.jogador.username} a Série A agora tem 16 times e você vai jogar todas as partidas! ` +
    `Para todo mundo entrar em campo, ${de.artigo === 'a' ? 'a' : 'o'} ${de.curto} ficou com os 7 primeiros inscritos e você virou Fundador ${destino}, na mesma posição e na Série A. ` +
    `OVR, apelido e Carreira vão junto, e na próxima Janela você pode voltar sem gastar a Transferência. ⚽`
  );
}

export interface ResultadoDoRebalanceamento {
  temporada: number;
  plano: PlanoDeRebalanceamento;
  gravado: boolean;
  /** Fundadores gravados (só com `gravar`). */
  fundadores: number;
}

/**
 * Lê os Elencos, planeja e, com `gravar`, aplica numa transação: muda o Time de cada
 * remanejado (mesma Posição; a camisa fica se estiver livre no Time novo, e o mais antigo
 * fica com ela no empate), marca todo o Elenco da B como Fundador e registra que a Temporada
 * já foi rebalanceada. Só numa Temporada com as regras da T2, na Pré-temporada, e uma vez.
 */
export async function rebalancear(banco: Banco, opcoes: { gravar: boolean; agora?: Date; tamanho?: number }): Promise<ResultadoDoRebalanceamento> {
  const t = (
    await banco.query<{ id: number; numero: number }>(`SELECT id, numero FROM temporada WHERE status = 'PRE_TEMPORADA' ORDER BY numero LIMIT 1`)
  ).rows[0];
  if (!t) throw new Error('Nenhuma Temporada na Pré-temporada: o Rebalanceamento só roda antes do primeiro jogo.');
  if (!temRegrasT2(t.numero)) throw new Error(`A Temporada ${t.numero} não tem as regras da T2: o Rebalanceamento só vale a partir da Temporada 2.`);
  if ((await banco.query(`SELECT 1 FROM rebalanceamento WHERE temporada_id = $1`, [t.id])).rows.length) {
    throw new Error(`A Temporada ${t.numero} já foi rebalanceada.`);
  }
  const series = await seriesDaTemporada(banco, t.id);
  if (!timesQueRecebem(series).length) throw new Error(`A Temporada ${t.numero} não tem Times Primos para receber Jogadores.`);

  const elenco = (
    await banco.query<{ id: string; username: string; time_id: TimeId; posicao: Posicao; inscrito_em: Date | string; numero: number | null }>(
      `SELECT id::text AS id, username, time_id, posicao, inscrito_em, numero FROM jogador WHERE NOT banido`,
    )
  ).rows.map((j) => ({ id: j.id, username: j.username, time: j.time_id, posicao: j.posicao, inscritoEm: new Date(j.inscrito_em).toISOString(), numero: j.numero }));
  const plano = planejarRebalanceamento(elenco, series, opcoes.tamanho);
  if (!opcoes.gravar) return { temporada: t.numero, plano, gravado: false, fundadores: 0 };

  const agora = opcoes.agora ?? new Date();
  let fundadores = 0;
  await banco.transacao(async (b) => {
    // A camisa: libera de todos os que mudam e devolve, por ordem de Inscrição, se estiver livre.
    const movidos = [...plano.remanejados].sort((x, y) => ordemDeInscricao(x.jogador, y.jogador));
    for (const r of movidos) await b.query(`UPDATE jogador SET time_id = $2, numero = NULL WHERE id = $1`, [r.jogador.id, r.para]);
    for (const r of movidos) {
      if (r.jogador.numero === null) continue;
      const ocupada = (await b.query(`SELECT 1 FROM jogador WHERE time_id = $1 AND numero = $2 AND NOT banido`, [r.para, r.jogador.numero])).rows.length > 0;
      if (!ocupada) await b.query(`UPDATE jogador SET numero = $2 WHERE id = $1`, [r.jogador.id, r.jogador.numero]);
    }
    const remanejados = new Set(plano.remanejados.map((r) => r.jogador.id));
    for (const time of timesQueRecebem(series)) {
      for (const j of plano.elencos[time] ?? []) {
        await b.query(
          `INSERT INTO fundador (jogador_id, time_id, temporada_id, remanejado) VALUES ($1, $2, $3, $4) ON CONFLICT (jogador_id, time_id) DO NOTHING`,
          [j.id, time, t.id, remanejados.has(j.id)],
        );
        fundadores++;
      }
    }
    await b.query(`INSERT INTO rebalanceamento (temporada_id, feito_em, movidos) VALUES ($1, $2, $3)`, [t.id, agora.toISOString(), plano.remanejados.length]);
  });
  return { temporada: t.numero, plano, gravado: true, fundadores };
}

/** O Time do qual o Jogador é Fundador (null se não é). */
export async function fundadorDe(banco: Banco): Promise<Map<string, { time: TimeId; temporada: number }>> {
  const linhas = (
    await banco.query<{ jogador_id: string; time_id: TimeId; numero: number }>(
      `SELECT f.jogador_id::text AS jogador_id, f.time_id, t.numero FROM fundador f JOIN temporada t ON t.id = f.temporada_id`,
    )
  ).rows;
  return new Map(linhas.map((l) => [l.jogador_id, { time: l.time_id, temporada: l.numero }]));
}

/**
 * Camisa na Pré-temporada (ADR-0036): num Time que tem Fundadores, só eles escolhem o número
 * até a Temporada começar. Devolve a recusa, ou null se pode escolher.
 */
export async function recusaDaCamisaNaPreTemporada(b: Banco, jogadorId: string, time: TimeId): Promise<string | null> {
  const t = (await b.query<{ id: number; numero: number }>(`SELECT id, numero FROM temporada WHERE status = 'PRE_TEMPORADA' ORDER BY numero LIMIT 1`)).rows[0];
  if (!t || !temRegrasT2(t.numero)) return null;
  const doTime = (await b.query<{ jogador_id: string }>(`SELECT jogador_id::text AS jogador_id FROM fundador WHERE time_id = $1 AND temporada_id = $2`, [time, t.id])).rows;
  if (!doTime.length || doTime.some((f) => f.jogador_id === jogadorId)) return null;
  const nome = FALA_DO_TIME[time];
  return `Na Pré-temporada, os Fundadores ${nome.artigo === 'a' ? 'da' : 'do'} ${nome.curto} escolhem a camisa primeiro. Você escolhe a sua quando a Temporada começar.`;
}
