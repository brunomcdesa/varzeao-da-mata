/**
 * Números da Temporada atual para a página da Temporada (regras testáveis fora do navegador).
 * Tudo sai do que o site já recebe (liga.json e jogadores.json), sem nada novo do worker.
 */
import type { JogadorPublico, LigaPublica, LinhaTabelaPublica, PartidaNoCalendario, Serie } from '@liga/shared';
import { situacaoAgora } from './calendario.js';

/** Goleiro só entra na disputa com pelo menos 3 jogos (a mesma regra da História). */
export const MIN_JOGOS_GOLEIRO = 3;

export interface Lider {
  jogador: JogadorPublico;
  valor: number;
  jogos: number;
}

/** Desempate de todos os rankings: menos jogos, depois quem se inscreveu antes (o mesmo do artilheiro no worker). */
const desempate = (a: JogadorPublico, b: JogadorPublico) => a.nestaTemporada.jogos - b.nestaTemporada.jogos || Number(a.id) - Number(b.id);

/** Artilharia: mais gols na Temporada. */
export function artilharia(js: JogadorPublico[], n = 5): Lider[] {
  return js
    .filter((j) => j.nestaTemporada.gols > 0)
    .sort((a, b) => b.nestaTemporada.gols - a.nestaTemporada.gols || desempate(a, b))
    .slice(0, n)
    .map((j) => ({ jogador: j, valor: j.nestaTemporada.gols, jogos: j.nestaTemporada.jogos }));
}

/** Líderes em assistências na Temporada. */
export function assistencias(js: JogadorPublico[], n = 5): Lider[] {
  return js
    .filter((j) => j.nestaTemporada.assistencias > 0)
    .sort((a, b) => b.nestaTemporada.assistencias - a.nestaTemporada.assistencias || desempate(a, b))
    .slice(0, n)
    .map((j) => ({ jogador: j, valor: j.nestaTemporada.assistencias, jogos: j.nestaTemporada.jogos }));
}

/**
 * Goleiros: maior nota média, com pelo menos 3 jogos; desempate: menos gols sofridos por jogo.
 * `valor` é a nota média.
 */
export function goleiros(js: JogadorPublico[], n = 3): Lider[] {
  const sofridosPorJogo = (j: JogadorPublico) => j.nestaTemporada.golsSofridos / j.nestaTemporada.jogos;
  return js
    .filter((j) => j.posicao === 'GOL' && j.nestaTemporada.jogos >= MIN_JOGOS_GOLEIRO && j.nestaTemporada.notaMedia !== null)
    .sort((a, b) => b.nestaTemporada.notaMedia! - a.nestaTemporada.notaMedia! || sofridosPorJogo(a) - sofridosPorJogo(b) || Number(a.id) - Number(b.id))
    .slice(0, n)
    .map((j) => ({ jogador: j, valor: j.nestaTemporada.notaMedia!, jogos: j.nestaTemporada.jogos }));
}

/** Partidas já encerradas pelo relógio de quem vê (nada antes do fim do Ao Vivo), da mais recente para a mais antiga. */
export function encerradas(l: LigaPublica, agora = Date.now()): PartidaNoCalendario[] {
  return l.calendario.filter((p) => p.placar && situacaoAgora(p, agora) === 'ENCERRADA').sort((a, b) => Date.parse(b.apito) - Date.parse(a.apito) || b.id - a.id);
}

export interface Panorama {
  jogos: number;
  totalDeJogos: number;
  gols: number;
  mediaDeGols: number | null;
  /** Fase de Liga: Rodadas já completas de 7; no Mata-mata, null. */
  rodadasJogadas: number;
  totalDeRodadas: number;
}

export function panorama(l: LigaPublica, agora = Date.now()): Panorama {
  const feitas = encerradas(l, agora);
  const gols = feitas.reduce((s, p) => s + p.placar!.mandante + p.placar!.visitante, 0);
  const daLiga = l.calendario.filter((p) => p.fase === 'LIGA');
  const rodadas = [...new Set(daLiga.map((p) => p.rodada))];
  const completas = rodadas.filter((r) => daLiga.filter((p) => p.rodada === r).every((p) => feitas.includes(p)));
  return {
    jogos: feitas.length,
    totalDeJogos: l.calendario.length,
    gols,
    mediaDeGols: feitas.length ? gols / feitas.length : null,
    rodadasJogadas: completas.length,
    totalDeRodadas: rodadas.length,
  };
}

/** Melhor ataque e melhor defesa de uma tabela (desempate: a ordem da tabela). */
export function ataqueEDefesa(tabela: LinhaTabelaPublica[]): { ataque: LinhaTabelaPublica; defesa: LinhaTabelaPublica } | null {
  const jogaram = tabela.filter((t) => t.jogos > 0);
  if (!jogaram.length) return null;
  const ataque = jogaram.reduce((m, t) => (t.golsPro > m.golsPro ? t : m));
  const defesa = jogaram.reduce((m, t) => (t.golsContra < m.golsContra ? t : m));
  return { ataque, defesa };
}

/** Aproveitamento em % (pontos ganhos sobre os possíveis). */
export const aproveitamento = (t: LinhaTabelaPublica): number | null => (t.jogos ? Math.round((t.pontos / (t.jogos * 3)) * 100) : null);

/** Maior goleada da Temporada (maior diferença; desempate: mais gols, depois a mais antiga). */
export function maiorGoleada(l: LigaPublica, serie?: Serie, agora = Date.now()): PartidaNoCalendario | null {
  const dif = (p: PartidaNoCalendario) => Math.abs(p.placar!.mandante - p.placar!.visitante);
  const total = (p: PartidaNoCalendario) => p.placar!.mandante + p.placar!.visitante;
  const lista = encerradas(l, agora).filter((p) => !serie || (p.serie ?? 'A') === serie);
  const melhor = lista.reduce<PartidaNoCalendario | null>((m, p) => (!m || dif(p) > dif(m) || (dif(p) === dif(m) && (total(p) > total(m) || (total(p) === total(m) && Date.parse(p.apito) < Date.parse(m.apito)))) ? p : m), null);
  return melhor && dif(melhor) >= 2 ? melhor : null;
}
