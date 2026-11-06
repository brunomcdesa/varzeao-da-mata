/** Vocabulário de domínio compartilhado entre sim, worker, renderer e site. Ver GLOSSARY.md. */

export const POSICOES = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
export type Posicao = (typeof POSICOES)[number];

export const TIMES = ['CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA'] as const;
export type TimeId = (typeof TIMES)[number];

/** Pares de rivais fixos (docs/times.md). */
export const CLASSICOS: ReadonlyArray<readonly [TimeId, TimeId]> = [
  ['CAP', 'ONC'],
  ['TAT', 'TAM'],
  ['PRE', 'SAG'],
  ['TUC', 'ARA'],
];

export function ehClassico(a: TimeId, b: TimeId): boolean {
  return CLASSICOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Formação society: 1 GOL, 2 ZAG, 2 MEI, 2 ATA. */
export const FORMACAO: Readonly<Record<Posicao, number>> = { GOL: 1, ZAG: 2, MEI: 2, ATA: 2 };
export const TAMANHO_ESCALACAO = 7;

export const OVR_MIN = 40;
export const OVR_MAX = 99;
/** OVR do Jogador da Base, que completa vagas sem inscrito. */
export const OVR_JOGADOR_DA_BASE = 45;

/** Limite de variação de OVR por Partida (Clássico: 1,5 × 3 = 4,5, arredondado para 4). */
export const LIMITE_DELTA_OVR = 3;
export const LIMITE_DELTA_OVR_CLASSICO = 4;
export const MULTIPLICADOR_CLASSICO = 1.5;

/** Um lugar na Escalação. `jogadorId` nulo = Jogador da Base. */
export interface JogadorEscalado {
  jogadorId: string | null;
  posicao: Posicao;
  ovr: number;
}

export interface Escalacao {
  time: TimeId;
  jogadores: readonly JogadorEscalado[];
}
