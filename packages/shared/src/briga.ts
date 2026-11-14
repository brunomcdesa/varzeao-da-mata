/**
 * Briga pelo Mata-mata (ADR-0053): na última Rodada da Fase de Liga, quem já está Garantido,
 * quem já está Eliminado e o que acontece "se acabar assim".
 *
 * A regra é a de "certo de verdade": um Time só é Garantido se nenhum resultado das Partidas
 * que faltam o tira dos 4 primeiros, contando os desempates (vitórias, saldo, gols marcados e
 * sigla, como em `classificar`). Quando o desempate depende de saldo ou gols de uma Partida
 * que ainda vai ser jogada, conta como "pode passar na frente". Por isso nunca erra: no pior
 * caso diz "depende" quando a conta exata daria Garantido.
 */
import { FALA_DO_TIME, type TimeId } from './index.js';
import { RODADAS_DA_LIGA } from './rodada.js';

export const VAGAS_NO_MATA_MATA = 4;

export type SituacaoNaBriga = 'GARANTIDO' | 'ELIMINADO' | 'DEPENDE';
type LadoDaBriga = 'mandante' | 'visitante';

export interface LinhaDaBriga {
  time: TimeId;
  pontos: number;
  vitorias: number;
  saldo: number;
  golsPro: number;
}

export interface JogoQueFalta {
  mandante: TimeId;
  visitante: TimeId;
  /** Hora do Apito Inicial em Brasília (para "o jogo das 18h"). */
  hora: number;
}

/** O que o Narrador e as placas sabem da Briga numa Partida da última Rodada. */
export interface BrigaPeloMataMata {
  /** Série, quando a Temporada tem duas; null com Série única. */
  serie: 'A' | 'B' | null;
  /** Classificação da Série antes do Apito Inicial desta Partida. */
  tabela: LinhaDaBriga[];
  /** Partidas da Série na Fase de Liga que ainda vão ser jogadas depois desta. */
  depois: JogoQueFalta[];
}

export interface PartidaParaBriga {
  id: number;
  fase: 'LIGA' | 'MATA_MATA';
  rodada: number;
  mandante: TimeId;
  visitante: TimeId;
  /** Apito Inicial (ms). */
  apito: number;
  /** Hora do Apito Inicial em Brasília. */
  hora: number;
  /** Placar, se a Partida já foi simulada. */
  gols: { mandante: number; visitante: number } | null;
}

/**
 * A Briga de uma Partida (null fora da última Rodada da Fase de Liga). `partidas`: as da mesma
 * Série e Temporada. Conta só o que foi jogado antes do Apito Inicial desta Partida; o resto da
 * Fase de Liga (inclusive Partida já simulada de horário mais tarde) é o que falta.
 */
export function brigaDaPartida(alvo: PartidaParaBriga, partidas: readonly PartidaParaBriga[], times: readonly TimeId[], serie: 'A' | 'B' | null): BrigaPeloMataMata | null {
  if (alvo.fase !== 'LIGA' || alvo.rodada !== RODADAS_DA_LIGA) return null;
  const linhas = new Map<TimeId, LinhaDaBriga>(times.map((t) => [t, { time: t, pontos: 0, vitorias: 0, saldo: 0, golsPro: 0 }]));
  const depois: JogoQueFalta[] = [];
  for (const p of partidas) {
    if (p.fase !== 'LIGA' || p.id === alvo.id) continue;
    if (p.gols && p.apito < alvo.apito) somar(linhas, p.mandante, p.visitante, p.gols.mandante, p.gols.visitante);
    else depois.push({ mandante: p.mandante, visitante: p.visitante, hora: p.hora });
  }
  return { serie, tabela: [...linhas.values()], depois };
}

function somar(linhas: Map<TimeId, LinhaDaBriga>, mandante: TimeId, visitante: TimeId, gm: number, gv: number): void {
  for (const [t, pro, contra] of [
    [mandante, gm, gv],
    [visitante, gv, gm],
  ] as const) {
    const l = linhas.get(t);
    if (!l) continue;
    l.golsPro += pro;
    l.saldo += pro - contra;
    if (pro > contra) {
      l.vitorias++;
      l.pontos += 3;
    } else if (pro === contra) l.pontos += 1;
  }
}

/**
 * Situação de cada Time da Série. Sem `placar`: antes do Apito Inicial (esta Partida também
 * está em aberto). Com `placar`: "se acabar assim" (ou o final, no apito final).
 */
export function situacoesNaBriga(
  b: BrigaPeloMataMata,
  times: Record<LadoDaBriga, TimeId>,
  placar: Record<LadoDaBriga, number> | null,
  /** Sem placar: fixa só quem vence esta Partida (o placar exato segue em aberto). */
  resultado?: ResultadoDaPartida,
): Map<TimeId, SituacaoNaBriga> {
  const base = new Map(b.tabela.map((l) => [l.time, { ...l }]));
  if (placar) somar(base, times.mandante, times.visitante, placar.mandante, placar.visitante);
  const abertos: { mandante: TimeId; visitante: TimeId; fixo?: number }[] = [
    ...(placar ? [] : [{ ...times, ...(resultado ? { fixo: RESULTADOS.indexOf(resultado) } : {}) }]),
    ...b.depois,
  ];
  /** Quem ainda joga: o saldo e os gols dele não são conhecidos. */
  const incertos = new Set(abertos.flatMap((j) => [j.mandante, j.visitante]));
  const garantido = new Map<TimeId, boolean>([...base.keys()].map((t) => [t, true]));
  const eliminado = new Map<TimeId, boolean>([...base.keys()].map((t) => [t, true]));

  const total = 3 ** abertos.length;
  for (let c = 0; c < total; c++) {
    const pts = new Map([...base.values()].map((l) => [l.time, { pontos: l.pontos, vitorias: l.vitorias }]));
    let k = c;
    let repetido = false;
    for (const j of abertos) {
      const r = k % 3;
      k = Math.floor(k / 3);
      if (j.fixo !== undefined && r !== j.fixo) repetido = true;
      const m = pts.get(j.mandante);
      const v = pts.get(j.visitante);
      if (r === 0) {
        if (m) (m.pontos += 3), m.vitorias++;
      } else if (r === 1) {
        if (m) m.pontos += 1;
        if (v) v.pontos += 1;
      } else if (v) (v.pontos += 3), v.vitorias++;
    }
    if (repetido) continue;
    for (const x of base.values()) {
      const px = pts.get(x.time)!;
      let frente = 0;
      let talvez = 0;
      for (const y of base.values()) {
        if (y.time === x.time) continue;
        const py = pts.get(y.time)!;
        const d = py.pontos - px.pontos || py.vitorias - px.vitorias;
        if (d > 0) frente++;
        else if (d === 0) {
          if (incertos.has(x.time) || incertos.has(y.time)) talvez++;
          else if ((y.saldo - x.saldo || y.golsPro - x.golsPro || x.time.localeCompare(y.time)) > 0) frente++;
        }
      }
      if (frente + talvez >= VAGAS_NO_MATA_MATA) garantido.set(x.time, false);
      if (frente < VAGAS_NO_MATA_MATA) eliminado.set(x.time, false);
    }
  }
  return new Map([...base.keys()].map((t) => [t, garantido.get(t) ? 'GARANTIDO' : eliminado.get(t) ? 'ELIMINADO' : 'DEPENDE']));
}

export type ResultadoDaPartida = 'mandante' | 'empate' | 'visitante';
const RESULTADOS: readonly ResultadoDaPartida[] = ['mandante', 'empate', 'visitante'];

/** Do que um Time precisa (ADR-0053): a situação dele se vencer, empatar ou perder esta Partida. */
export interface Necessidade {
  vitoria: SituacaoNaBriga;
  empate: SituacaoNaBriga;
  derrota: SituacaoNaBriga;
}

export function necessidadeNaBriga(b: BrigaPeloMataMata, times: Record<LadoDaBriga, TimeId>, lado: LadoDaBriga): Necessidade {
  const rival: ResultadoDaPartida = lado === 'mandante' ? 'visitante' : 'mandante';
  const t = times[lado];
  return {
    vitoria: situacoesNaBriga(b, times, null, lado).get(t)!,
    empate: situacoesNaBriga(b, times, null, 'empate').get(t)!,
    derrota: situacoesNaBriga(b, times, null, rival).get(t)!,
  };
}

/**
 * Texto curto do que o Time precisa, para a plaquinha do começo do jogo: "Vencendo, classifica",
 * "Empate basta", "Vence e torce" (mesmo vencendo depende dos outros jogos).
 */
export function textoDaNecessidade(n: Necessidade): string {
  if (n.derrota === 'GARANTIDO') return 'Já garantido';
  if (n.vitoria === 'ELIMINADO') return 'Já eliminado';
  if (n.empate === 'GARANTIDO') return 'Empate basta';
  if (n.vitoria === 'GARANTIDO') return 'Vencendo, classifica';
  if (n.empate === 'ELIMINADO') return 'Vence e torce';
  return 'Depende dos outros';
}

/** "do jogo das 18h" ou "dos outros jogos": de quem ainda depende. */
export function deQuemDepende(b: BrigaPeloMataMata): string {
  return b.depois.length === 1 ? `do jogo das ${b.depois[0]!.hora}h` : 'dos outros jogos';
}

/** "a Arara", "a Arara e o Tatu", "a Arara, a Onça e o Tatu". */
export function listaDeTimes(ts: readonly TimeId[]): string {
  const nomes = ts.map((t) => `${FALA_DO_TIME[t].artigo} ${FALA_DO_TIME[t].curto}`);
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** "garantida", "garantido", "garantidas", "garantidos" (masculino se houver um Time masculino). */
export function concordar(ts: readonly TimeId[], raiz: string): string {
  const fem = ts.every((t) => FALA_DO_TIME[t].artigo === 'a');
  return `${raiz}${fem ? 'a' : 'o'}${ts.length > 1 ? 's' : ''}`;
}
