/**
 * Evolução das Habilidades (ADR-0010): cada ação vale pontos numa Habilidade; no fim da
 * Partida o total passa pelo ritmo (alto sobe devagar, baixo desce devagar) e pelo teto.
 */
import {
  HABILIDADES,
  HABILIDADE_MAX,
  HABILIDADE_MIN,
  LIMITE_DELTA_HABILIDADE,
  LIMITE_DELTA_HABILIDADE_CLASSICO,
  MULTIPLICADOR_CLASSICO,
  PESOS_OVR,
  type HabilidadeId,
  type Habilidades,
  type Posicao,
} from '@liga/shared';

/** Pontos por ação (ponto de partida do ADR-0010, ajustados pela calibração). */
export const ACOES = {
  // Finalização
  gol: { hab: 'FIN', valor: 0.75 },
  chuteDefendido: { hab: 'FIN', valor: -0.42 },
  chuteFora: { hab: 'FIN', valor: -0.4 },
  chuteBloqueado: { hab: 'FIN', valor: -0.48 },
  venceuChuteMarcado: { hab: 'FIN', valor: 0.2 },
  penaltiConvertido: { hab: 'FIN', valor: 0.5 },
  penaltiPerdido: { hab: 'FIN', valor: -0.6 },
  // Passe
  assistencia: { hab: 'PAS', valor: 0.85 },
  ganhouPosse: { hab: 'PAS', valor: 0.2 },
  perdeuPosse: { hab: 'PAS', valor: -0.15 },
  desarmadoNaCriacao: { hab: 'PAS', valor: -0.3 },
  // Drible
  driblou: { hab: 'DRI', valor: 0.4 },
  desarmadoNoDrible: { hab: 'DRI', valor: -0.4 },
  // Defesa
  desarme: { hab: 'DEF', valor: 0.42 },
  roubouPosse: { hab: 'DEF', valor: 0.3 },
  superadoNaPosse: { hab: 'DEF', valor: -0.28 },
  superadoNaCriacao: { hab: 'DEF', valor: -0.3 },
  foiDriblado: { hab: 'DEF', valor: -0.3 },
  bloqueio: { hab: 'DEF', valor: 0.5 },
  golSofridoZagueiro: { hab: 'DEF', valor: -0.2 },
  // Goleiro
  defesa: { hab: 'GOL', valor: 0.28 },
  penaltiPego: { hab: 'GOL', valor: 1.0 },
  golSofridoGoleiro: { hab: 'GOL', valor: -0.4 },
  // Temporada 2: falta cometida (ADR-0024)
  cometeuFalta: { hab: 'DEF', valor: -0.25 },
  semSofrerGol: { hab: 'GOL', valor: 0.4 },
} as const satisfies Record<string, { hab: HabilidadeId; valor: number }>;

export type Acao = keyof typeof ACOES;

/**
 * Pontos por ação com as regras da Temporada 2 (ADR-0055), só onde mudam. As faltas, a bola
 * parada e as Formações mudam quantas vezes cada ação acontece; sem este ajuste, entre Times
 * iguais, zagueiros e atacantes perdiam OVR só por jogar. Calibrado por `pnpm calibrar t2`.
 */
export const ACOES_T2: Partial<Record<Acao, number>> = {
  // Parte dos desarmes vira falta (ADR-0024): o desarme limpo vale mais e a falta não tira nada.
  desarme: 0.5,
  cometeuFalta: 0,
  // Com a falta na criação, o meia é desarmado menos vezes: o desarme que sobra pesa mais.
  desarmadoNaCriacao: -0.36,
  // A barreira bloqueia muitos chutes de falta (ADR-0024): o chute bloqueado pesa menos.
  chuteBloqueado: -0.3,
};

/** Valor da ação: o da T2 quando ela tem um próprio, senão o de sempre. */
export function valorDaAcao(a: Acao, t2: boolean): number {
  return (t2 ? ACOES_T2[a] : undefined) ?? ACOES[a].valor;
}

/**
 * Ações principais protegem (ADR-0105, VERSAO_SIM 20 na T2 e 21 na T3): cada ação principal da Posição
 * em que o Jogador jogou vale pontos de proteção, que cancelam perdas da mesma Partida. Não
 * somam ganho: quem jogou bem não cai por causa do resto do jogo, sem inflar o OVR.
 */
export const PROTECAO: Readonly<Record<Posicao, Partial<Record<Acao, number>>>> = {
  ATA: { gol: 1.5, assistencia: 1 },
  MEI: { gol: 1.5, assistencia: 1 },
  ZAG: { gol: 1.5, assistencia: 1, desarme: 0.3, bloqueio: 0.3 },
  GOL: { defesa: 0.3, penaltiPego: 1, semSofrerGol: 0.5 },
};

/**
 * Gasta a proteção nas perdas: primeiro na Habilidade que mais pesa no OVR da Posição, depois
 * nas outras. Só reduz pontos negativos; os positivos ficam iguais.
 */
export function protegerPerdas(pontos: Record<HabilidadeId, number>, protecao: number, posicao: Posicao): Record<HabilidadeId, number> {
  const depois = { ...pontos };
  let resta = protecao;
  const peso = (h: HabilidadeId) => PESOS_OVR[posicao][h] ?? 0;
  const ordem = [...HABILIDADES].sort((a, b) => peso(b) - peso(a));
  for (const h of ordem) {
    if (resta <= 0) break;
    if (depois[h] >= 0) continue;
    const usado = Math.min(resta, -depois[h]);
    depois[h] += usado;
    resta -= usado;
  }
  return depois;
}

/** Ritmo: perto de 99 o ganho encolhe; perto de 40 a perda encolhe. */
export const RITMO = { tetoGanho: 99, referenciaGanho: 62, pisoPerda: 40, referenciaPerda: 62, minimo: 0.1 };

/** `referencia`: de onde o ganho começa a encolher (62; na T2, 70, ADR-0056). */
export function fatorDeGanho(h: number, referencia: number = RITMO.referenciaGanho): number {
  return Math.max(RITMO.minimo, Math.min(1, (RITMO.tetoGanho - h) / (RITMO.tetoGanho - referencia)));
}
export function fatorDePerda(h: number): number {
  return Math.max(RITMO.minimo, Math.min(1, (h - RITMO.pisoPerda) / (RITMO.referenciaPerda - RITMO.pisoPerda)));
}

const umaCasa = (x: number) => Math.round(x * 10) / 10;
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function zeradas(): Record<HabilidadeId, number> {
  return { FIN: 0, PAS: 0, DRI: 0, DEF: 0, GOL: 0 };
}

/** Aplica o total de pontos de ação de uma Partida às Habilidades. */
/**
 * `treino` (Temporada 2, ADR-0023): na Habilidade de foco, os ganhos são multiplicados por
 * `multiplicadorTreino`; o teto por Partida continua o mesmo.
 * `ganhos` (Resenha, ADR-0034; Ganho maior da T2, ADR-0056): multiplica os ganhos de todas as Habilidades.
 * `referenciaGanho`: de onde o ganho começa a encolher (na T2, 70, ADR-0056). Com Treino, os
 * dois bônus somam na Habilidade de foco (1,5 e 1,5 viram 2).
 */
export function evoluir(
  antes: Habilidades,
  pontos: Record<HabilidadeId, number>,
  classico: boolean,
  treino?: { hab: HabilidadeId; multiplicador: number },
  ganhos = 1,
  referenciaGanho: number = RITMO.referenciaGanho,
): { depois: Habilidades; delta: Record<HabilidadeId, number> } {
  const depois = { ...antes };
  const delta = zeradas();
  const mult = classico ? MULTIPLICADOR_CLASSICO : 1;
  const teto = classico ? LIMITE_DELTA_HABILIDADE_CLASSICO : LIMITE_DELTA_HABILIDADE;
  for (const hab of HABILIDADES) {
    const bonus = pontos[hab] > 0 ? ganhos + (treino && treino.hab === hab ? treino.multiplicador - 1 : 0) : 1;
    const p = pontos[hab] * mult * bonus;
    if (p === 0) continue;
    const bruto = p > 0 ? p * fatorDeGanho(antes[hab], referenciaGanho) : p * fatorDePerda(antes[hab]);
    const d = umaCasa(limitar(bruto, -teto, teto));
    depois[hab] = umaCasa(limitar(antes[hab] + d, HABILIDADE_MIN, HABILIDADE_MAX));
    delta[hab] = umaCasa(depois[hab] - antes[hab]);
  }
  return { depois, delta };
}
