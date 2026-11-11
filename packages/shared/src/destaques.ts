/**
 * Destaques por Posição (ADR-0041): o Jogador de maior Nota em cada Posição, na Rodada (por
 * Série) e na Temporada (maior Nota média). Premia goleiros e zagueiros tanto quanto quem faz
 * gol, porque a Nota já é medida contra a expectativa da Posição e do OVR (ADR-0004).
 * Não mexe na Escalação nem na simulação: é reconhecimento (Resumo e Carreira).
 */
import type { Posicao, Serie } from './index.js';

/** Nome de cada Destaque. Não repete nomes de Especialização (ADR-0023). */
export const DESTAQUE_DA_POSICAO: Readonly<Record<Posicao, string>> = {
  GOL: 'Muralha',
  ZAG: 'Carrapato',
  MEI: 'Garçom',
  ATA: 'Matador',
};

/** Ordem em que os Destaques aparecem (de trás para a frente, como a Escalação). */
export const ORDEM_DOS_DESTAQUES: readonly Posicao[] = ['GOL', 'ZAG', 'MEI', 'ATA'];

/** Mínimo de jogos na Posição para concorrer ao Destaque da Temporada. */
export const MIN_JOGOS_DESTAQUE_DA_TEMPORADA = 3;

/** O que interessa de um desempenho para escolher o Destaque. */
export interface DesempenhoParaDestaque {
  /** null = Jogador da Base, que não concorre. */
  jogadorId: string | null;
  posicao: Posicao;
  nota: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  bloqueios?: number;
  defesas: number;
  golsSofridos: number;
  serie?: Serie;
}

/** O número que a cartela mostra embaixo do nome, por Posição. */
export interface NumeroDoDestaque {
  valor: number;
  legenda: string;
}

/** Destaque escolhido. Na Temporada, `nota` é a Nota média e `jogos` conta os jogos na Posição. */
export interface Destaque {
  posicao: Posicao;
  jogadorId: string;
  nota: number;
  jogos: number;
  numero: NumeroDoDestaque;
  serie?: Serie;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** Número-chave da Posição: defesas, desarmes + bloqueios, assistências, gols. */
export function numeroDoDestaque(posicao: Posicao, s: { gols: number; assistencias: number; desarmes: number; bloqueios?: number; defesas: number }): NumeroDoDestaque {
  switch (posicao) {
    case 'GOL':
      return { valor: s.defesas, legenda: plural(s.defesas, 'defesa', 'defesas') };
    case 'ZAG': {
      const v = s.desarmes + (s.bloqueios ?? 0);
      return { valor: v, legenda: plural(v, 'desarme', 'desarmes') };
    }
    case 'MEI':
      return { valor: s.assistencias, legenda: plural(s.assistencias, 'assistência', 'assistências') };
    case 'ATA':
      return { valor: s.gols, legenda: plural(s.gols, 'gol', 'gols') };
  }
}

interface Acumulado {
  jogadorId: string;
  posicao: Posicao;
  serie?: Serie;
  notas: number;
  jogos: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  bloqueios: number;
  defesas: number;
  golsSofridos: number;
}

function acumular(desempenhos: readonly DesempenhoParaDestaque[]): Acumulado[] {
  const porChave = new Map<string, Acumulado>();
  for (const d of desempenhos) {
    if (!d.jogadorId) continue;
    // A mesma pessoa pode ter jogado em Posições diferentes: cada Posição conta à parte.
    const chave = `${d.serie ?? 'A'}|${d.posicao}|${d.jogadorId}`;
    const a = porChave.get(chave) ?? { jogadorId: d.jogadorId, posicao: d.posicao, ...(d.serie ? { serie: d.serie } : {}), notas: 0, jogos: 0, gols: 0, assistencias: 0, desarmes: 0, bloqueios: 0, defesas: 0, golsSofridos: 0 };
    a.notas += d.nota;
    a.jogos++;
    a.gols += d.gols;
    a.assistencias += d.assistencias;
    a.desarmes += d.desarmes;
    a.bloqueios += d.bloqueios ?? 0;
    a.defesas += d.defesas;
    a.golsSofridos += d.golsSofridos;
    porChave.set(chave, a);
  }
  return [...porChave.values()];
}

/**
 * Desempate: maior Nota (média), depois o maior número-chave, depois menos gols sofridos por
 * jogo, depois o id mais antigo (quem se inscreveu antes).
 */
function melhorPrimeiro(a: Acumulado, b: Acumulado): number {
  const media = (x: Acumulado) => x.notas / x.jogos;
  return (
    media(b) - media(a) ||
    numeroDoDestaque(b.posicao, b).valor - numeroDoDestaque(a.posicao, a).valor ||
    a.golsSofridos / a.jogos - b.golsSofridos / b.jogos ||
    Number(a.jogadorId) - Number(b.jogadorId)
  );
}

function escolher(desempenhos: readonly DesempenhoParaDestaque[], minJogos: number): Destaque[] {
  const todos = acumular(desempenhos).filter((a) => a.jogos >= minJogos);
  const series = [...new Set(todos.map((a) => a.serie))];
  const destaques: Destaque[] = [];
  for (const serie of series) {
    for (const posicao of ORDEM_DOS_DESTAQUES) {
      const [melhor] = todos.filter((a) => a.serie === serie && a.posicao === posicao).sort(melhorPrimeiro);
      if (!melhor) continue;
      destaques.push({
        posicao,
        jogadorId: melhor.jogadorId,
        nota: Math.round((melhor.notas / melhor.jogos) * 100) / 100,
        jogos: melhor.jogos,
        numero: numeroDoDestaque(posicao, melhor),
        ...(serie ? { serie } : {}),
      });
    }
  }
  return destaques;
}

/** Destaques da Rodada: maior Nota de cada Posição, por Série. */
export function destaquesDaRodada(desempenhos: readonly DesempenhoParaDestaque[]): Destaque[] {
  return escolher(desempenhos, 1);
}

/** Destaques da Temporada: maior Nota média de cada Posição, com o mínimo de jogos. */
export function destaquesDaTemporada(desempenhos: readonly DesempenhoParaDestaque[]): Destaque[] {
  return escolher(desempenhos, MIN_JOGOS_DESTAQUE_DA_TEMPORADA);
}
