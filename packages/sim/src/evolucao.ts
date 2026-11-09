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
  type HabilidadeId,
  type Habilidades,
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

/** Ritmo: perto de 99 o ganho encolhe; perto de 40 a perda encolhe. */
export const RITMO = { tetoGanho: 99, referenciaGanho: 62, pisoPerda: 40, referenciaPerda: 62, minimo: 0.1 };

export function fatorDeGanho(h: number): number {
  return Math.max(RITMO.minimo, Math.min(1, (RITMO.tetoGanho - h) / (RITMO.tetoGanho - RITMO.referenciaGanho)));
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
 */
export function evoluir(
  antes: Habilidades,
  pontos: Record<HabilidadeId, number>,
  classico: boolean,
  treino?: { hab: HabilidadeId; multiplicador: number },
): { depois: Habilidades; delta: Record<HabilidadeId, number> } {
  const depois = { ...antes };
  const delta = zeradas();
  const mult = classico ? MULTIPLICADOR_CLASSICO : 1;
  const teto = classico ? LIMITE_DELTA_HABILIDADE_CLASSICO : LIMITE_DELTA_HABILIDADE;
  for (const hab of HABILIDADES) {
    const p = pontos[hab] * mult * (treino && treino.hab === hab && pontos[hab] > 0 ? treino.multiplicador : 1);
    if (p === 0) continue;
    const bruto = p > 0 ? p * fatorDeGanho(antes[hab]) : p * fatorDePerda(antes[hab]);
    const d = umaCasa(limitar(bruto, -teto, teto));
    depois[hab] = umaCasa(limitar(antes[hab] + d, HABILIDADE_MIN, HABILIDADE_MAX));
    delta[hab] = umaCasa(depois[hab] - antes[hab]);
  }
  return { depois, delta };
}
