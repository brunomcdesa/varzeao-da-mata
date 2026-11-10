/** Vocabulário de domínio compartilhado entre sim, worker, renderer e site. Ver GLOSSARY.md. */

export const POSICOES = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
export type Posicao = (typeof POSICOES)[number];

/** Os 16 Times da Liga: os 8 fundadores (Temporada 1) e os 8 que chegaram com a Série B (ADR-0017). */
export const TIMES = ['CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA', 'JAC', 'SUC', 'LOB', 'CDM', 'BOT', 'PIR', 'COR', 'MOR'] as const;
export type TimeId = (typeof TIMES)[number];

/** Os Times da Temporada 1, que formam a Série A na primeira Temporada com Séries. */
export const TIMES_FUNDADORES: readonly TimeId[] = ['CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA'];
/** Os Times que chegaram com a Série B. */
export const TIMES_NOVOS: readonly TimeId[] = ['JAC', 'SUC', 'LOB', 'CDM', 'BOT', 'PIR', 'COR', 'MOR'];

/** As duas Séries da Liga (GLOSSARY: Série). */
export const SERIES = ['A', 'B'] as const;
export type Serie = (typeof SERIES)[number];
/** Times por Série. */
export const TIMES_POR_SERIE = 8;
/** Quantos Times descem da A e sobem da B a cada Temporada (ADR-0017). */
export const TIMES_QUE_TROCAM_DE_SERIE = 2;

/**
 * Candidatos a Craque por Série. Por dentro, o número do Candidato é único na Rodada: A de 1
 * a 5 e B de 6 a 10. O público vê e vota "A3" ou "B3" (ADR-0017).
 */
export const CANDIDATOS_POR_SERIE = 5;
/** O número interno de "A3" (3) ou "B3" (8). */
export function numeroDoCandidato(serie: Serie, n: number): number {
  return serie === 'B' ? n + CANDIDATOS_POR_SERIE : n;
}
/** A Série de um número interno de Candidato. */
export function serieDoCandidato(numero: number): Serie {
  return numero > CANDIDATOS_POR_SERIE ? 'B' : 'A';
}
/** Como o Candidato aparece para o público: "3" numa Temporada de uma Série só; "A3" ou "B3" com duas. */
export function rotuloDoCandidato(numero: number, comSeries: boolean): string {
  if (!comSeries) return String(numero);
  const serie = serieDoCandidato(numero);
  return `${serie}${serie === 'B' ? numero - CANDIDATOS_POR_SERIE : numero}`;
}

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
  JAC: { nome: 'Jacaré Atlético Clube', sigla: 'JAC', bicho: 'jacare', primaria: '#2E8B57', secundaria: '#F2E6A6' },
  SUC: { nome: 'Sucuri Esporte Clube', sigla: 'SUC', bicho: 'sucuri', primaria: '#556B2F', secundaria: '#E9C46A' },
  LOB: { nome: 'Lobo-Guará Futebol Clube', sigla: 'LOB', bicho: 'lobo-guara', primaria: '#E07B24', secundaria: '#3B2A20' },
  CDM: { nome: 'Cachorro-do-Mato Sport Club', sigla: 'CÃO', bicho: 'cachorro-do-mato', primaria: '#8A8D91', secundaria: '#D9A441' },
  BOT: { nome: 'Boto Futebol Clube', sigla: 'BOT', bicho: 'boto', primaria: '#E58FA8', secundaria: '#1C2E5A' },
  PIR: { nome: 'Associação Pirarucu', sigla: 'PIR', bicho: 'pirarucu', primaria: '#B3202A', secundaria: '#2E4A3F' },
  COR: { nome: 'Coruja Esporte Clube', sigla: 'COR', bicho: 'coruja', primaria: '#8B6B4A', secundaria: '#F2C14E' },
  MOR: { nome: 'Morcego Futebol Clube', sigla: 'MOR', bicho: 'morcego', primaria: '#1E2235', secundaria: '#8FD3FF' },
};

/** Pares de rivais fixos (docs/times.md). */
export const CLASSICOS: ReadonlyArray<readonly [TimeId, TimeId]> = [
  ['CAP', 'ONC'],
  ['TAT', 'TAM'],
  ['PRE', 'SAG'],
  ['TUC', 'ARA'],
  ['JAC', 'SUC'],
  ['LOB', 'CDM'],
  ['BOT', 'PIR'],
  ['COR', 'MOR'],
];

export function ehClassico(a: TimeId, b: TimeId): boolean {
  return CLASSICOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Goleada: o vencedor fez 4 gols ou mais e abriu 3 ou mais de vantagem
 * (4×0, 4×1, 5×2 são goleada; 4×3 não). O narrador comemora no gol que a confirma e no fim.
 */
export function ehGoleada(golsVencedor: number, golsPerdedor: number): boolean {
  return golsVencedor >= 4 && golsVencedor - golsPerdedor >= 3;
}

const NOMES_CLASSICOS: Readonly<Record<string, string>> = {
  'CAP-ONC': 'Clássico da Margem',
  'TAM-TAT': 'Clássico do Cupinzeiro',
  'PRE-SAG': 'Clássico do Galho',
  'ARA-TUC': 'Clássico das Penas',
  'JAC-SUC': 'Clássico do Brejo',
  'CDM-LOB': 'Clássico da Matilha',
  'BOT-PIR': 'Clássico do Rio',
  'COR-MOR': 'Clássico da Madrugada',
};

/** Nome do Clássico entre dois Times, ou null se não forem rivais (docs/times.md). */
export function nomeDoClassico(a: TimeId, b: TimeId): string | null {
  return NOMES_CLASSICOS[[a, b].sort().join('-')] ?? null;
}

/** Como o Narrador fala de cada Time: nome curto, artigo e bordão (docs/times.md). */
export const FALA_DO_TIME: Readonly<Record<TimeId, { curto: string; artigo: 'o' | 'a'; bordao: string }>> = {
  CAP: { curto: 'Capivara', artigo: 'a', bordao: 'Calma que dá.' },
  ONC: { curto: 'Onça', artigo: 'a', bordao: 'Quem tem medo não entra no mato.' },
  TAT: { curto: 'Tatu', artigo: 'o', bordao: 'Aqui não passa nada.' },
  TAM: { curto: 'Tamanduá', artigo: 'o', bordao: 'Uma formiga de cada vez.' },
  PRE: { curto: 'Preguiça', artigo: 'a', bordao: 'Sem pressa pra ganhar.' },
  SAG: { curto: 'Sagui', artigo: 'o', bordao: 'Tamanho não joga.' },
  TUC: { curto: 'Tucano', artigo: 'o', bordao: 'Falo e faço.' },
  ARA: { curto: 'Arara', artigo: 'a', bordao: 'Ganhar é bom, ganhar bonito é melhor.' },
  JAC: { curto: 'Jacaré', artigo: 'o', bordao: 'Paciência e bote certo.' },
  SUC: { curto: 'Sucuri', artigo: 'a', bordao: 'Abraço que não solta.' },
  LOB: { curto: 'Lobo-guará', artigo: 'o', bordao: 'Perna comprida, cabeça erguida.' },
  CDM: { curto: 'Cachorro-do-mato', artigo: 'o', bordao: 'Late pouco, morde muito.' },
  BOT: { curto: 'Boto', artigo: 'o', bordao: 'Encanta e some.' },
  PIR: { curto: 'Pirarucu', artigo: 'o', bordao: 'Peso pesado do rio.' },
  COR: { curto: 'Coruja', artigo: 'a', bordao: 'A gente vê tudo.' },
  MOR: { curto: 'Morcego', artigo: 'o', bordao: 'A noite é nossa.' },
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
  /** Temporada 2 (ADR-0023): Especialização escolhida para o jogo. Só vale com as regras da T2. */
  especializacao?: Especializacao;
  /** Temporada 2 (ADR-0023): Habilidade de foco do Treino. */
  treino?: HabilidadeId;
  /** Temporada 2 (ADR-0023): Canto escolhido para pênaltis (batedor: onde chuta; goleiro: onde pula). */
  canto?: Canto;
  /** Resenha (ADR-0034): comentou no Reels do último jogo do Time; ganhos de Habilidade maiores nesta Partida. */
  resenha?: boolean;
}

/** Temporada 2 (ADR-0020): a atitude do Time na Partida, escolhida pelo Capitão. */
export const POSTURAS = ['OFENSIVA', 'EQUILIBRADA', 'DEFENSIVA'] as const;
export type Postura = (typeof POSTURAS)[number];

/** Temporada 2 (ADR-0023): Canto de pênalti. */
export const CANTOS = ['ESQUERDA', 'MEIO', 'DIREITA'] as const;
export type Canto = (typeof CANTOS)[number];

/** Temporada 2 (ADR-0023): 3 Especializações por Posição. */
export const ESPECIALIZACOES = {
  ATA: ['ARTILHEIRO', 'DRIBLADOR', 'OPORTUNISTA'],
  MEI: ['ARMADOR', 'VOLANTE', 'MEIA_ATACANTE'],
  ZAG: ['XERIFE', 'BLOQUEADOR', 'ANTECIPACAO'],
  GOL: ['PAREDAO', 'GATO', 'PEGADOR_DE_PENALTI'],
} as const satisfies Record<Posicao, readonly string[]>;
export type Especializacao = (typeof ESPECIALIZACOES)[Posicao][number];

/** Nome de cada Especialização como o público lê. */
export const NOME_DA_ESPECIALIZACAO: Readonly<Record<Especializacao, string>> = {
  ARTILHEIRO: 'Artilheiro',
  DRIBLADOR: 'Driblador',
  OPORTUNISTA: 'Oportunista',
  ARMADOR: 'Armador',
  VOLANTE: 'Volante',
  MEIA_ATACANTE: 'Meia-atacante',
  XERIFE: 'Xerife',
  BLOQUEADOR: 'Bloqueador',
  ANTECIPACAO: 'Antecipação',
  PAREDAO: 'Paredão',
  GATO: 'Gato',
  PEGADOR_DE_PENALTI: 'Pegador de pênalti',
};

/** O que cada Especialização faz, em uma linha (site e Ajuda). */
export const DESCRICAO_DA_ESPECIALIZACAO: Readonly<Record<Especializacao, string>> = {
  ARTILHEIRO: 'Chuta mais e finaliza melhor; dribla pior.',
  DRIBLADOR: 'Dribla mais e melhor; chuta marcado pior.',
  OPORTUNISTA: 'Aparece mais para finalizar, com menos precisão.',
  ARMADOR: 'Cria melhor as jogadas; rouba menos a bola.',
  VOLANTE: 'Rouba mais a bola; cria pior.',
  MEIA_ATACANTE: 'Finaliza mais vezes; cria pior.',
  XERIFE: 'Segura o drible; bloqueia pior o chute.',
  BLOQUEADOR: 'Trava o chute; segura pior o drible.',
  ANTECIPACAO: 'Corta melhor a criação; marca pior o finalizador.',
  PAREDAO: 'Melhor no chute apertado; pior no chute livre.',
  GATO: 'Melhor no chute livre; pior no chute apertado.',
  PEGADOR_DE_PENALTI: 'Melhor nos pênaltis; um pouco pior no resto do jogo.',
};

/** Temporada 2 (ADR-0019): o Grito de guerra de cada Time, na faixa da Arquibancada depois do gol. */
export const GRITO_DO_TIME: Readonly<Record<TimeId, string>> = {
  CAP: 'Devagar e sempre, Capivara!',
  ONC: 'É Onça, é garra, é raça!',
  TAT: 'Cava, Tatu, cava!',
  TAM: 'Tamanduá não larga!',
  PRE: 'Sem pressa, com Preguiça!',
  SAG: 'Pula, pula, Sagui!',
  TUC: 'Bico pra frente, Tucano!',
  ARA: 'Voa, Arara, voa!',
  JAC: 'Abre a boca, Jacaré!',
  SUC: 'Aperta, Sucuri!',
  LOB: 'Uuuh, Lobo-guará!',
  CDM: 'Late e morde, Cachorrão!',
  BOT: 'Encanta, Boto!',
  PIR: 'Ô Pirarucu, peso do rio!',
  COR: 'Olho aberto, Coruja!',
  MOR: 'A noite é do Morcego!',
};

/** Temporada 2: as regras que só valem a partir da Temporada 2 (ADRs 0020, 0021, 0023, 0024). */
export const PRIMEIRA_TEMPORADA_COM_REGRAS_T2 = 2;
export function temRegrasT2(numeroDaTemporada: number): boolean {
  return numeroDaTemporada >= PRIMEIRA_TEMPORADA_COM_REGRAS_T2;
}

export interface Escalacao {
  time: TimeId;
  jogadores: readonly JogadorEscalado[];
}
export * from './site.js';
export * from './rodada.js';
export * from './habilidades.js';
import type { HabilidadeId, Habilidades } from './habilidades.js';
export * from './aparencia.js';
export * from './apelido.js';
export * from './forca.js';
