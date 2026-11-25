/**
 * Suspensão e Pendurado (ADRs 0021 e 0116): a regra dos Cartões num lugar só, usada pela
 * Escalação (quem fica fora), pelo site (selos e "Fora" da Partida) e pela transmissão
 * (o Narrador e o cartão gigante avisam que o Jogador está fora do próximo jogo).
 */

/** Os Cartões de um Jogador numa Partida. */
export interface CartoesNoJogo {
  amarelos: number;
  expulso: boolean;
}

/** Por que o Jogador está fora: expulso no jogo anterior ou completou dois amarelos. */
export type MotivoDaSuspensao = 'EXPULSAO' | 'AMARELOS';

/**
 * Amarelos que contam para a Suspensão: os de jogos em que ele não foi expulso (o vermelho já
 * dá a Suspensão sozinho, e o segundo amarelo na mesma Partida vira vermelho).
 */
export function amarelosQueContam(jogos: readonly CartoesNoJogo[]): number {
  return jogos.reduce((s, j) => s + (j.expulso ? 0 : j.amarelos), 0);
}

/**
 * A Suspensão que o `jogo` dá para a próxima Partida do Time, sabendo os jogos da Temporada
 * antes dele. A cada dois amarelos, uma Partida fora.
 */
export function suspensaoPeloJogo(antes: readonly CartoesNoJogo[], jogo: CartoesNoJogo): MotivoDaSuspensao | null {
  if (jogo.expulso) return 'EXPULSAO';
  const a = amarelosQueContam(antes);
  return Math.floor((a + jogo.amarelos) / 2) > Math.floor(a / 2) ? 'AMARELOS' : null;
}

/** Pendurado: mais um amarelo e ele cumpre Suspensão no jogo seguinte. */
export function estaPendurado(jogos: readonly CartoesNoJogo[]): boolean {
  return amarelosQueContam(jogos) % 2 === 1;
}

/** O que o site mostra no Elenco e na página do Jogador, para o próximo jogo do Time. */
export interface SituacaoDosCartoes {
  /** Amarelos que contam na Temporada. */
  amarelos: number;
  /** Fora do próximo jogo do Time. */
  suspenso?: MotivoDaSuspensao;
  /** Com um amarelo na série: o próximo dá Suspensão. */
  pendurado?: true;
}

/**
 * Situação para o próximo jogo do Time. `jogos`: os da Temporada, em ordem, cada um com o id da
 * Partida; `ultimoDoTime`: a última Partida encerrada do Time atual dele (a Suspensão só sai do
 * jogo anterior do Time, ADR-0021); `haProximo`: o Time ainda tem jogo na Temporada.
 */
export function situacaoDosCartoes(
  jogos: readonly (CartoesNoJogo & { partidaId: number })[],
  ultimoDoTime: number | null,
  haProximo: boolean,
): SituacaoDosCartoes | null {
  const i = ultimoDoTime === null ? -1 : jogos.findIndex((j) => j.partidaId === ultimoDoTime);
  const suspenso = haProximo && i >= 0 ? suspensaoPeloJogo(jogos.slice(0, i), jogos[i]!) : null;
  const amarelos = amarelosQueContam(jogos);
  if (!suspenso && !amarelos) return null;
  return {
    amarelos,
    ...(suspenso ? { suspenso } : {}),
    ...(!suspenso && haProximo && estaPendurado(jogos) ? { pendurado: true as const } : {}),
  };
}

/** Texto curto do motivo, para o site ("2º amarelo", "expulso"). */
export function textoDaSuspensao(m: MotivoDaSuspensao, amarelos: number): string {
  return m === 'EXPULSAO' ? 'expulso no último jogo' : `${amarelos}º amarelo`;
}
