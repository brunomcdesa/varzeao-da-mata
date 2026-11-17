/**
 * Quantos lances cabem no Reels (ADR-0073). O teto vale para o vídeo final, já esticado para a
 * narração caber, e não para o roteiro planejado: entram lances até o vídeo chegar a
 * DURACAO_MAXIMA_DO_REELS, sem passar dos 3 minutos do Instagram.
 */
import type { Lado } from '@liga/sim';
import { estimarDuracao } from './aoVivo.js';
import { exigenciasDaNarracao, montarNarracao, type OpcoesNarracao } from './narracao.js';
import { Roteiro, type OpcoesRoteiro } from './roteiro.js';
import type { Timeline } from './timeline.js';

/** Vídeo final do Reels, já com a narração (s). Fica abaixo dos 3 min em que o Instagram para de recomendar. */
export const DURACAO_MAXIMA_DO_REELS = 170;
/** Passo do teto planejado ao procurar o maior que cabe (s). */
const PASSO = 5;
/** Folga na duração estimada da voz: a voz real costuma sair um pouco mais lenta. */
const FOLGA_DA_VOZ = 1.1;

/**
 * O maior teto planejado (`duracaoMaxima` do Roteiro) cujo vídeo final, com a narração
 * esticando os trechos, fica dentro de `limite`. `duracao` dá quanto cada fala dura; sem ela,
 * usa a estimativa pelo texto (com folga). Gol nunca sai, então um jogo de muitos gols pode
 * passar do limite mesmo com o menor teto.
 */
export function tetoDoReels(
  timeline: Timeline,
  opcoes: OpcoesRoteiro = {},
  apelidos?: Record<Lado, (string | null)[]>,
  narracao: OpcoesNarracao = {},
  duracao?: (texto: string) => number,
  limite = DURACAO_MAXIMA_DO_REELS,
): number {
  const dur = duracao ?? ((texto: string) => estimarDuracao(texto) * FOLGA_DA_VOZ);
  // Começa no teto em que todos os lances cabem e desce até o vídeo final caber.
  const tudo = new Roteiro(timeline, { ...opcoes, duracaoMaxima: Infinity }).duracao;
  let teto = Math.ceil(tudo / PASSO) * PASSO;
  for (; teto > PASSO; teto -= PASSO) if (duracaoFinal(timeline, { ...opcoes, duracaoMaxima: teto }, apelidos, narracao, dur) <= limite) return teto;
  return teto;
}

/** Duração do vídeo final com este Roteiro, depois de esticar para a narração caber. */
export function duracaoFinal(
  timeline: Timeline,
  opcoes: OpcoesRoteiro,
  apelidos: Record<Lado, (string | null)[]> | undefined,
  narracao: OpcoesNarracao,
  duracao: (texto: string) => number,
): number {
  const base = new Roteiro(timeline, opcoes);
  const falas = montarNarracao(base, apelidos, narracao);
  const porId = new Map(falas.map((f) => [f.id, f.texto]));
  return new Roteiro(timeline, { ...opcoes, minimos: exigenciasDaNarracao(base, falas, (id) => duracao(porId.get(id)!)) }).duracao;
}
