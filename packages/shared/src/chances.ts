/**
 * Chances da reta final (ADR-0099, ideia de um seguidor): no Resumo da Rodada, da metade da
 * Fase de Liga até a penúltima Rodada, a chance de cada Time ir às Semifinais e de cair.
 *
 * A conta é a "matemática" pura: os jogos que faltam são simulados muitas vezes, todo jogo com
 * a mesma chance para os dois lados e gols sorteados pela média de gols do Grupo (ou da Série).
 * A classificação usa os desempates de `classificar` (pontos, vitórias, saldo, gols marcados e
 * sigla). A simulação tem semente fixa: o mesmo Resumo, gravado de novo, dá os mesmos números.
 *
 * O selo ("Na semi", "Fora", "Caiu", "Salvo") só aparece quando é certo de verdade, pela mesma
 * conta exata da Briga pelo Mata-mata (`certezasNaTabela`). Sem certeza, o número nunca mostra
 * 0% nem 100%: vira "<1%" ou ">99%".
 */
import { certezasNaTabela, type LinhaDaBriga, type SituacaoNaBriga } from './briga.js';
import type { TimeId } from './index.js';

/** Sorteios da simulação: o bastante para o número variar menos de 1 ponto. */
export const SORTEIOS_DAS_CHANCES = 20000;
/** Acima disso a conta exata (3 resultados por jogo) fica cara demais: sem selos. */
const MAX_JOGOS_NA_CONTA_EXATA = 12;
/** Média de gols de um Time por jogo quando ainda não há jogos para tirar a média. */
const GOLS_POR_TIME_SEM_JOGOS = 1.5;

export interface JogoQueFaltaNaConta {
  mandante: TimeId;
  visitante: TimeId;
}

export interface ChancesDoTime {
  time: TimeId;
  /** Chance (0 a 1) de terminar entre os `classificam` primeiros. */
  semifinal: number;
  /** Chance (0 a 1) de terminar entre os `caem` últimos (0 se ninguém cai). */
  queda: number;
  /** Certo de verdade: GARANTIDO (na semi), ELIMINADO (fora) ou null (depende). */
  certezaSemifinal: 'GARANTIDO' | 'ELIMINADO' | null;
  /** Certo de verdade: CAIU, SALVO ou null (depende; sempre null se ninguém cai). */
  certezaQueda: 'CAIU' | 'SALVO' | null;
}

/** A primeira Rodada que mostra as Chances: a metade da Fase de Liga (a 4 de 7). */
export function primeiraRodadaDasChances(rodadasDaLiga: number): number {
  return Math.ceil(rodadasDaLiga / 2);
}

/**
 * Se o Resumo desta Rodada mostra as Chances: da metade até a última Rodada da Fase de Liga. Na
 * última, a cartela vira "Fim da Fase de Liga", só com os selos (nada falta jogar).
 */
export function resumoMostraChances(fase: 'LIGA' | 'MATA_MATA', rodada: number, rodadasDaLiga: number): boolean {
  return fase === 'LIGA' && rodada >= primeiraRodadaDasChances(rodadasDaLiga) && rodada <= rodadasDaLiga;
}

/** Gerador com semente (mulberry32): a mesma conta dá sempre o mesmo número. */
function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gols de um Time num jogo: Poisson com média `media`. */
function gols(sortear: () => number, media: number): number {
  const limite = Math.exp(-media);
  let k = 0;
  let p = sortear();
  while (p > limite) {
    k++;
    p *= sortear();
  }
  return k;
}

const comparar = (a: LinhaDaBriga, b: LinhaDaBriga) =>
  b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro || a.time.localeCompare(b.time);

/**
 * As Chances de cada Time de uma tabela (um Grupo ou uma Série), na ordem da tabela.
 * `tabela`: o que já foi jogado; `faltam`: os jogos da Fase de Liga que ainda vão ser jogados.
 */
export function chancesDaTabela(
  tabela: readonly (LinhaDaBriga & { jogos?: number })[],
  faltam: readonly JogoQueFaltaNaConta[],
  o: { classificam: number; caem: number; sorteios?: number; semente?: number },
): ChancesDoTime[] {
  const n = tabela.length;
  const caem = Math.min(o.caem, n);
  const jogos = tabela.reduce((s, l) => s + (l.jogos ?? 0), 0);
  const golsFeitos = tabela.reduce((s, l) => s + l.golsPro, 0);
  const media = jogos > 0 ? golsFeitos / jogos : GOLS_POR_TIME_SEM_JOGOS;

  const sorteios = faltam.length ? (o.sorteios ?? SORTEIOS_DAS_CHANCES) : 1;
  const sortear = sorteador(o.semente ?? 2026);
  const naSemi = new Map<TimeId, number>(tabela.map((l) => [l.time, 0]));
  const caiu = new Map<TimeId, number>(tabela.map((l) => [l.time, 0]));
  for (let s = 0; s < sorteios; s++) {
    const linhas = new Map(tabela.map((l) => [l.time, { time: l.time, pontos: l.pontos, vitorias: l.vitorias, saldo: l.saldo, golsPro: l.golsPro }]));
    for (const j of faltam) {
      const gm = gols(sortear, media);
      const gv = gols(sortear, media);
      for (const [t, pro, contra] of [
        [j.mandante, gm, gv],
        [j.visitante, gv, gm],
      ] as const) {
        const l = linhas.get(t);
        if (!l) continue;
        l.golsPro += pro;
        l.saldo += pro - contra;
        if (pro > contra) (l.pontos += 3), l.vitorias++;
        else if (pro === contra) l.pontos += 1;
      }
    }
    const ordem = [...linhas.values()].sort(comparar);
    ordem.forEach((l, k) => {
      if (k < o.classificam) naSemi.set(l.time, naSemi.get(l.time)! + 1);
      if (caem > 0 && k >= n - caem) caiu.set(l.time, caiu.get(l.time)! + 1);
    });
  }

  const exata = faltam.length <= MAX_JOGOS_NA_CONTA_EXATA;
  const certoSemi: Map<TimeId, SituacaoNaBriga> = exata ? certezasNaTabela(tabela, faltam, o.classificam) : new Map();
  // Cair = ficar fora das n - caem primeiras posições.
  const certoFica: Map<TimeId, SituacaoNaBriga> = exata && caem > 0 ? certezasNaTabela(tabela, faltam, n - caem) : new Map();

  return tabela.map((l) => {
    const semi = certoSemi.get(l.time);
    const fica = certoFica.get(l.time);
    const certezaSemifinal = semi === 'GARANTIDO' ? 'GARANTIDO' : semi === 'ELIMINADO' ? 'ELIMINADO' : null;
    const certezaQueda = fica === 'GARANTIDO' ? 'SALVO' : fica === 'ELIMINADO' ? 'CAIU' : null;
    return {
      time: l.time,
      semifinal: certezaSemifinal === 'GARANTIDO' ? 1 : certezaSemifinal === 'ELIMINADO' ? 0 : naSemi.get(l.time)! / sorteios,
      queda: caem === 0 || certezaQueda === 'SALVO' ? 0 : certezaQueda === 'CAIU' ? 1 : caiu.get(l.time)! / sorteios,
      certezaSemifinal,
      certezaQueda,
    };
  });
}

/** Porcentagem inteira para a tela, sem 0% nem 100% quando não é certo: "<1%", "37%", ">99%". */
export function porcentagem(p: number): string {
  const x = Math.round(p * 100);
  if (x <= 0) return '<1%';
  if (x >= 100) return '>99%';
  return `${x}%`;
}

/** O que a coluna de Semifinal mostra: o selo, se for certo, ou a porcentagem. */
export function textoDaSemifinal(c: ChancesDoTime): string {
  return c.certezaSemifinal === 'GARANTIDO' ? 'Na semi' : c.certezaSemifinal === 'ELIMINADO' ? 'Fora' : porcentagem(c.semifinal);
}

/** O que a coluna de Queda mostra: o selo, se for certo, ou a porcentagem. */
export function textoDaQueda(c: ChancesDoTime): string {
  return c.certezaQueda === 'CAIU' ? 'Caiu' : c.certezaQueda === 'SALVO' ? 'Salvo' : porcentagem(c.queda);
}
