/** Vocabulário de domínio compartilhado entre sim, worker, renderer e site. Ver GLOSSARY.md. */

export const POSICOES = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
export type Posicao = (typeof POSICOES)[number];

export const TIMES = ['CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA'] as const;
export type TimeId = (typeof TIMES)[number];

/** Identidade visual dos Times (docs/times.md). */
export const IDENTIDADE: Readonly<Record<TimeId, { nome: string; sigla: string; bicho: string; primaria: string; secundaria: string }>> = {
  CAP: { nome: 'Esporte Clube Capivara', sigla: 'CAP', bicho: 'capivara', primaria: '#C98A4B', secundaria: '#3FB8A8' },
  ONC: { nome: 'Onça Futebol Clube', sigla: 'ONÇ', bicho: 'onca', primaria: '#F2B705', secundaria: '#1A1A1A' },
  TAT: { nome: 'Atlético Tatu', sigla: 'TAT', bicho: 'tatu', primaria: '#4A4F57', secundaria: '#1F6F78' },
  TAM: { nome: 'Tamanduá Sport Club', sigla: 'TAM', bicho: 'tamandua', primaria: '#A8432E', secundaria: '#F3E6C9' },
  PRE: { nome: 'Associação Preguiça', sigla: 'PRE', bicho: 'preguica', primaria: '#5E6B3A', secundaria: '#E2D3B0' },
  SAG: { nome: 'Sagui Futebol Clube', sigla: 'SAG', bicho: 'sagui', primaria: '#6B3FA0', secundaria: '#FFFFFF' },
  TUC: { nome: 'Tucano Esporte Clube', sigla: 'TUC', bicho: 'tucano', primaria: '#161616', secundaria: '#F28C1C' },
  ARA: { nome: 'Arara Azul Futebol Clube', sigla: 'ARA', bicho: 'arara', primaria: '#1F4FD1', secundaria: '#FFD23F' },
};

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

const NOMES_CLASSICOS: Readonly<Record<string, string>> = {
  'CAP-ONC': 'Clássico da Margem',
  'TAM-TAT': 'Clássico do Cupinzeiro',
  'PRE-SAG': 'Clássico do Galho',
  'ARA-TUC': 'Clássico das Penas',
};

/** Nome do Clássico entre dois Times, ou null se não forem rivais (docs/times.md). */
export function nomeDoClassico(a: TimeId, b: TimeId): string | null {
  return NOMES_CLASSICOS[[a, b].sort().join('-')] ?? null;
}

/** Como o Locutor da Liga fala de cada Time: nome curto, artigo e bordão (docs/times.md). */
export const FALA_DO_TIME: Readonly<Record<TimeId, { curto: string; artigo: 'o' | 'a'; bordao: string }>> = {
  CAP: { curto: 'Capivara', artigo: 'a', bordao: 'Calma que dá.' },
  ONC: { curto: 'Onça', artigo: 'a', bordao: 'Quem tem medo não entra no mato.' },
  TAT: { curto: 'Tatu', artigo: 'o', bordao: 'Aqui não passa nada.' },
  TAM: { curto: 'Tamanduá', artigo: 'o', bordao: 'Uma formiga de cada vez.' },
  PRE: { curto: 'Preguiça', artigo: 'a', bordao: 'Sem pressa pra ganhar.' },
  SAG: { curto: 'Sagui', artigo: 'o', bordao: 'Tamanho não joga.' },
  TUC: { curto: 'Tucano', artigo: 'o', bordao: 'Falo e faço.' },
  ARA: { curto: 'Arara', artigo: 'a', bordao: 'Ganhar é bom, ganhar bonito é melhor.' },
};

/** "da Capivara", "do Tatu". */
export function doTime(t: TimeId): string {
  const f = FALA_DO_TIME[t];
  return `${f.artigo === 'a' ? 'da' : 'do'} ${f.curto}`;
}

/** Formação society: 1 GOL, 2 ZAG, 2 MEI, 2 ATA. */
export const FORMACAO: Readonly<Record<Posicao, number>> = { GOL: 1, ZAG: 2, MEI: 2, ATA: 2 };
export const TAMANHO_ESCALACAO = 7;

export const OVR_MIN = 40;
export const OVR_MAX = 99;
/** OVR do Jogador da Base, que completa vagas sem inscrito (ADR-0010: perfil da Posição com OVR 55). */
export const OVR_JOGADOR_DA_BASE = 55;

/** Quanto cada Habilidade pode mudar numa Partida (no Clássico, ações valem o dobro e o teto também). */
export const LIMITE_DELTA_HABILIDADE = 2;
export const LIMITE_DELTA_HABILIDADE_CLASSICO = 4;
export const MULTIPLICADOR_CLASSICO = 2;

/** Um lugar na Escalação. `jogadorId` nulo = Jogador da Base. */
export interface JogadorEscalado {
  jogadorId: string | null;
  posicao: Posicao;
  /** Resumo das Habilidades (ovrDasHabilidades). */
  ovr: number;
  habilidades: Habilidades;
}

export interface Escalacao {
  time: TimeId;
  jogadores: readonly JogadorEscalado[];
}
export * from './site.js';
export * from './rodada.js';
export * from './habilidades.js';
import type { Habilidades } from './habilidades.js';
export * from './aparencia.js';
