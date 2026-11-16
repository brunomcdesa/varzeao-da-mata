/** Vocabulário de domínio compartilhado entre sim, worker, renderer e site. Ver GLOSSARY.md. */

export const POSICOES = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
export type Posicao = (typeof POSICOES)[number];

/**
 * Os 24 Times da Liga: os 8 fundadores (Temporada 1), os 8 que chegaram na T2 direto na Série A
 * (ADR-0017 e ADR-0058) e os 8 que estrearam a Série B na T2 (ADR-0058).
 */
export const TIMES = [
  'CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA',
  'JAC', 'SUC', 'LOB', 'LEA', 'BOT', 'TAR', 'COR', 'BES',
  'QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG',
] as const;
export type TimeId = (typeof TIMES)[number];

/** Os Times da Temporada 1, que formam a Série A na primeira Temporada com Séries. */
export const TIMES_FUNDADORES: readonly TimeId[] = ['CAP', 'ONC', 'TAT', 'TAM', 'PRE', 'SAG', 'TUC', 'ARA'];
/** Os Times que chegaram na T2 direto na Série A, ao lado dos fundadores (ADR-0058). */
export const TIMES_NOVOS: readonly TimeId[] = ['JAC', 'SUC', 'LOB', 'LEA', 'BOT', 'TAR', 'COR', 'BES'];
/**
 * Times criados para uma Série B futura (ADR-0058). Guardados (ADR-0062): a T2 tem só a Série A,
 * e a B da T3 é formada pelos 8 Times que caem no fim da T2.
 */
export const TIMES_DA_SERIE_B: readonly TimeId[] = ['QUA', 'GAM', 'JAB', 'TEI', 'ARI', 'ANT', 'SER', 'BUG'];

/** As duas Séries da Liga (GLOSSARY: Série). */
export const SERIES = ['A', 'B'] as const;
export type Serie = (typeof SERIES)[number];
/** Times em cada Série a partir da T3 (ADR-0062 e ADR-0064): 8 na A e 8 na B, em turno único. */
export const TIMES_POR_SERIE: Readonly<Record<Serie, number>> = { A: 8, B: 8 };
/** Quantos Times descem da A e sobem da B a cada Temporada (ADR-0017), da T3 em diante. */
export const TIMES_QUE_TROCAM_DE_SERIE = 2;
/**
 * Grupos da Série A de 16 (T2, ADR-0064): dois Grupos de 8, cada um em turno único, com os
 * Clássicos juntos e cada Time fundador no mesmo Grupo do seu Time Primo.
 */
export const GRUPOS = ['CHAO', 'COPA'] as const;
export type Grupo = (typeof GRUPOS)[number];
export const NOME_DO_GRUPO: Readonly<Record<Grupo, string>> = { CHAO: 'Grupo do Chão', COPA: 'Grupo da Copa' };
/** Nome curto, para placas e tabelas ("Chão", "Copa"). */
export const NOME_CURTO_DO_GRUPO: Readonly<Record<Grupo, string>> = { CHAO: 'Chão', COPA: 'Copa' };
export const GRUPOS_DA_A_DE_16: Readonly<Record<Grupo, readonly TimeId[]>> = {
  CHAO: ['CAP', 'ONC', 'TAT', 'TAM', 'JAC', 'SUC', 'LOB', 'LEA'],
  COPA: ['PRE', 'SAG', 'TUC', 'ARA', 'COR', 'BES', 'BOT', 'TAR'],
};
/** Quantos de cada Grupo vão para as Semifinais (1º de um contra o 2º do outro). */
export const CLASSIFICAM_POR_GRUPO = 2;
/** Quantos de cada Grupo caem no fim da T2: os 4 últimos, 8 ao todo, formam a Série B da T3. */
export const CAEM_POR_GRUPO = 4;

/** O Grupo de um Time (null se a Temporada não tem Grupos ou o Time não está em nenhum). */
export function grupoDoTime(grupos: Readonly<Record<Grupo, readonly TimeId[]>> | null | undefined, time: TimeId): Grupo | null {
  return grupos ? (GRUPOS.find((g) => grupos[g].includes(time)) ?? null) : null;
}

/**
 * Quantos Times de uma tabela da Série A caem no fim da Temporada: 2 com Série B (ADR-0017), 4
 * por Grupo na T2 (ADR-0064), nenhum com uma Série só de 8 (T1).
 */
export function timesQueCaem(o: { temSerieB: boolean; porGrupo: boolean }): number {
  if (o.temSerieB) return TIMES_QUE_TROCAM_DE_SERIE;
  return o.porGrupo ? CAEM_POR_GRUPO : 0;
}

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
  // Leão, Tartaruga e Besouro: nomes sugeridos por um seguidor (ADR-0065).
  LEA: { nome: 'Leão Futebol Clube', sigla: 'LEA', bicho: 'leao', primaria: '#C98A1A', secundaria: '#4A2A12' },
  BOT: { nome: 'Boto Futebol Clube', sigla: 'BOT', bicho: 'boto', primaria: '#E58FA8', secundaria: '#1C2E5A' },
  TAR: { nome: 'Tartarugas Futebol Clube', sigla: 'TAR', bicho: 'tartaruga', primaria: '#2F7D6D', secundaria: '#E3C567' },
  COR: { nome: 'Coruja Esporte Clube', sigla: 'COR', bicho: 'coruja', primaria: '#8B6B4A', secundaria: '#F2C14E' },
  BES: { nome: 'Besouros Esporte Clube', sigla: 'BES', bicho: 'besouro', primaria: '#2B1D3A', secundaria: '#4FD1C5' },
  QUA: { nome: 'Quati Futebol Clube', sigla: 'QUA', bicho: 'quati', primaria: '#7B1E3A', secundaria: '#F0D9A8' },
  GAM: { nome: 'Gambá Esporte Clube', sigla: 'GAM', bicho: 'gamba', primaria: '#3A3A3A', secundaria: '#FFFFFF' },
  JAB: { nome: 'Jabuti Atlético Clube', sigla: 'JAB', bicho: 'jabuti', primaria: '#C9A227', secundaria: '#4B3621' },
  TEI: { nome: 'Teiú Futebol Clube', sigla: 'TEI', bicho: 'teiu', primaria: '#138A7E', secundaria: '#151515' },
  ARI: { nome: 'Ariranha Sport Club', sigla: 'ARI', bicho: 'ariranha', primaria: '#5A3825', secundaria: '#4FB3BF' },
  ANT: { nome: 'Associação Anta', sigla: 'ANT', bicho: 'anta', primaria: '#0F4C5C', secundaria: '#F4A259' },
  SER: { nome: 'Seriema Esporte Clube', sigla: 'SER', bicho: 'seriema', primaria: '#D9C9A3', secundaria: '#C1272D' },
  BUG: { nome: 'Bugio Futebol Clube', sigla: 'BUG', bicho: 'bugio', primaria: '#B9471E', secundaria: '#1B1B1B' },
};

/** Pares de rivais fixos (docs/times.md). */
export const CLASSICOS: ReadonlyArray<readonly [TimeId, TimeId]> = [
  ['CAP', 'ONC'],
  ['TAT', 'TAM'],
  ['PRE', 'SAG'],
  ['TUC', 'ARA'],
  ['JAC', 'SUC'],
  ['LOB', 'LEA'],
  ['BOT', 'TAR'],
  ['COR', 'BES'],
  ['QUA', 'GAM'],
  ['JAB', 'TEI'],
  ['ARI', 'ANT'],
  ['SER', 'BUG'],
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
  'LEA-LOB': 'Clássico da Juba',
  'BOT-TAR': 'Clássico do Rio',
  'BES-COR': 'Clássico da Madrugada',
  'GAM-QUA': 'Clássico do Quintal',
  'JAB-TEI': 'Clássico do Sol',
  'ANT-ARI': 'Clássico da Lagoa',
  'BUG-SER': 'Clássico do Grito',
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
  LEA: { curto: 'Leão', artigo: 'o', bordao: 'Quem manda na mata é a gente.' },
  BOT: { curto: 'Boto', artigo: 'o', bordao: 'Encanta e some.' },
  TAR: { curto: 'Tartaruga', artigo: 'a', bordao: 'Casco firme, chegada certa.' },
  COR: { curto: 'Coruja', artigo: 'a', bordao: 'A gente vê tudo.' },
  BES: { curto: 'Besouro', artigo: 'o', bordao: 'Pequeno, blindado e chato de parar.' },
  QUA: { curto: 'Quati', artigo: 'o', bordao: 'Fuça tudo até achar o gol.' },
  GAM: { curto: 'Gambá', artigo: 'o', bordao: 'Ninguém chega perto.' },
  JAB: { curto: 'Jabuti', artigo: 'o', bordao: 'Devagar e sempre.' },
  TEI: { curto: 'Teiú', artigo: 'o', bordao: 'Esquenta no sol e dá o bote.' },
  ARI: { curto: 'Ariranha', artigo: 'a', bordao: 'Em bando ninguém segura.' },
  ANT: { curto: 'Anta', artigo: 'a', bordao: 'Passa por cima.' },
  SER: { curto: 'Seriema', artigo: 'a', bordao: 'Grita antes do gol.' },
  BUG: { curto: 'Bugio', artigo: 'o', bordao: 'O grito se ouve de longe.' },
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
  /**
   * Bônus da Temporada 1 (ADR-0047): tem o Selo da Temporada 1 e a Partida é de uma das primeiras
   * Rodadas da T2; ganhos de Habilidade maiores, somados aos da Resenha.
   */
  bonusT1?: boolean;
  /**
   * Formação (ADR-0044): a Posição de inscrição de quem joga fora de posição. `posicao` é a vaga
   * que ele ocupa, e o `ovr` já vem pelos pesos dessa vaga.
   */
  posicaoDeOrigem?: Posicao;
}

/** Temporada 2 (ADR-0020): a atitude do Time na Partida, escolhida pelo Capitão. */
export const POSTURAS = ['OFENSIVA', 'EQUILIBRADA', 'DEFENSIVA'] as const;
export type Postura = (typeof POSTURAS)[number];

/**
 * Temporada 2 (ADR-0044): o desenho do Time em campo, escolhido pelo Capitão junto da Postura.
 * Os números contam os Jogadores de linha: zagueiros, meias e atacantes (o goleiro é sempre um).
 */
export const FORMACOES = ['2-2-2', '2-3-1', '3-2-1', '3-1-2'] as const;
export type Formacao = (typeof FORMACOES)[number];
/** Formação de quem não escolheu (e de toda a Temporada 1). */
export const FORMACAO_PADRAO: Formacao = '2-2-2';

/** Quantas vagas cada Posição tem em cada Formação. */
export const VAGAS_DA_FORMACAO: Readonly<Record<Formacao, Readonly<Record<Posicao, number>>>> = {
  '2-2-2': { GOL: 1, ZAG: 2, MEI: 2, ATA: 2 },
  '2-3-1': { GOL: 1, ZAG: 2, MEI: 3, ATA: 1 },
  '3-2-1': { GOL: 1, ZAG: 3, MEI: 2, ATA: 1 },
  '3-1-2': { GOL: 1, ZAG: 3, MEI: 1, ATA: 2 },
};

/** As Posições de uma Formação, na ordem da Escalação (GOL, ZAG…, MEI…, ATA…). */
export function posicoesDaFormacao(f: Formacao): Posicao[] {
  const v = VAGAS_DA_FORMACAO[f];
  return (['GOL', 'ZAG', 'MEI', 'ATA'] as const).flatMap((p) => Array<Posicao>(v[p]).fill(p));
}

export function ehFormacao(x: unknown): x is Formacao {
  return typeof x === 'string' && (FORMACOES as readonly string[]).includes(x);
}

/** A Jogada da Formação (ADR-0044): o lance próprio de cada desenho, narrado pelo nome. */
export const JOGADA_DA_FORMACAO: Readonly<Record<Formacao, JogadaDaFormacao | null>> = {
  '2-2-2': null,
  '2-3-1': 'TABELA',
  '3-2-1': 'COBERTURA',
  '3-1-2': 'LIGACAO_DIRETA',
};
export type JogadaDaFormacao = 'COBERTURA' | 'TABELA' | 'LIGACAO_DIRETA';

/** Nome e descrição de cada Formação para o site (painel do Capitão e Ajuda). */
export const DESCRICAO_DA_FORMACAO: Readonly<Record<Formacao, { nome: string; jogada: string | null; linha: string }>> = {
  '2-2-2': { nome: '2-2-2', jogada: null, linha: 'Equilibrada: dois em cada linha.' },
  '2-3-1': { nome: '2-3-1', jogada: 'Tabela', linha: 'Meio forte: os meias tabelam e chutam mais de fora; a defesa fica mais exposta.' },
  '3-2-1': { nome: '3-2-1', jogada: 'Cobertura', linha: 'Defesa forte: o 3º zagueiro faz a Cobertura; o ataque perde força.' },
  '3-1-2': { nome: '3-1-2', jogada: 'Ligação direta', linha: 'Contra-ataque: o zagueiro lança direto para a dupla de ataque; o meio perde a posse mais.' },
};

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
  LEA: 'Ruge, Leão!',
  BOT: 'Encanta, Boto!',
  TAR: 'Rema, Tartaruga!',
  COR: 'Olho aberto, Coruja!',
  BES: 'Zum, zum, Besouro!',
  QUA: 'Fuça, Quati, fuça!',
  GAM: 'Sai da frente, é o Gambá!',
  JAB: 'Casco duro, Jabuti!',
  TEI: 'Dá o bote, Teiú!',
  ARI: 'Mergulha, Ariranha!',
  ANT: 'Atropela, Anta!',
  SER: 'Grita, Seriema!',
  BUG: 'Ruge, Bugio!',
};

/** Temporada 2: as regras que só valem a partir da Temporada 2 (ADRs 0020, 0021, 0023, 0024). */
export const PRIMEIRA_TEMPORADA_COM_REGRAS_T2 = 2;
export function temRegrasT2(numeroDaTemporada: number): boolean {
  return numeroDaTemporada >= PRIMEIRA_TEMPORADA_COM_REGRAS_T2;
}

/**
 * Recompensa da Temporada 1 (ADR-0047): quem se inscreveu na T1 ganha o Selo da Temporada 1, o
 * Piso da Temporada 1 (OVR mínimo, aplicado uma vez na Pré-temporada da T2) e ganhos maiores nas
 * primeiras Rodadas da T2.
 */
export const PISO_DA_TEMPORADA_1 = 65;

/** OVR sorteado na Inscrição durante a Temporada 1 (inclusive nas duas pontas). */
export const OVR_INICIAL = { min: 60, max: 70 } as const;
/**
 * OVR de quem se inscreve depois da Temporada 1 (ADR-0056): no máximo o Piso da Temporada 1,
 * para quem chega não começar à frente de quem jogou a T1.
 */
export const OVR_INICIAL_DEPOIS_DA_T1 = { min: 60, max: PISO_DA_TEMPORADA_1 } as const;

/**
 * Faixa do OVR inicial pelo que o site sabe da Liga (ADR-0056): depois que a T1 termina, ou
 * quando já existe a próxima Temporada, vale OVR_INICIAL_DEPOIS_DA_T1. O worker decide igual.
 */
export function faixaDoOvrInicialDaLiga(l: {
  temporada: { numero: number; status: string } | null;
  proximaTemporada?: { numero: number } | null;
}): { readonly min: number; readonly max: number } {
  const depois = !!l.proximaTemporada || (!!l.temporada && (l.temporada.numero >= 2 || l.temporada.status === 'ENCERRADA'));
  return depois ? OVR_INICIAL_DEPOIS_DA_T1 : OVR_INICIAL;
}
/** Rodadas da Fase de Liga da T2 em que vale o Bônus da Temporada 1 (da 1ª até esta). */
export const RODADAS_DO_BONUS_T1 = 3;
export function temBonusT1(numeroDaTemporada: number, numeroDaRodada: number, fase: 'LIGA' | 'MATA_MATA'): boolean {
  return numeroDaTemporada === PRIMEIRA_TEMPORADA_COM_REGRAS_T2 && fase === 'LIGA' && numeroDaRodada <= RODADAS_DO_BONUS_T1;
}

export interface Escalacao {
  time: TimeId;
  jogadores: readonly JogadorEscalado[];
  /**
   * Banco (T2, ADR-0061): até 2 reservas de linha, os próximos da fila do rodízio. No intervalo,
   * podem entrar no lugar de quem foi mal. Nas Partidas sem Banco, nada muda.
   */
  banco?: readonly JogadorEscalado[];
}
export * from './site.js';
export * from './rodada.js';
export * from './habilidades.js';
export * from './reacoes.js';
import type { HabilidadeId, Habilidades } from './habilidades.js';
export * from './aparencia.js';
export * from './apelido.js';
export * from './forca.js';
export * from './pendencias.js';
export * from './avisos.js';
export * from './destaques.js';
export * from './briga.js';
export * from './programados.js';
export * from './estrelas.js';
