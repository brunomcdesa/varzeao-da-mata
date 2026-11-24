/**
 * Moedas (ADRs 0087, 0089 e 0090): Salário, prêmios, Palpite e Conquistas. Só compram visual na
 * Loja; começam a contar na Pré-temporada da T3, com a Copa.
 */
import { PRIMEIRA_TEMPORADA_COM_REGRAS_T3 } from './temporada3.js';
import type { ItensEquipados } from './itens.js';

export const PRIMEIRA_TEMPORADA_COM_MOEDAS = PRIMEIRA_TEMPORADA_COM_REGRAS_T3;
export function temMoedas(numeroDaTemporada: number): boolean {
  return numeroDaTemporada >= PRIMEIRA_TEMPORADA_COM_MOEDAS;
}

/** Os valores aprovados (ADR-0087). Revistos só entre Temporadas. */
export const MOEDAS = {
  SALARIO: 10,
  GOL: 3,
  ASSISTENCIA: 2,
  SELECAO_RODADA: 5,
  CRAQUE_RODADA: 10,
  TITULO_A: 50,
  TITULO_B: 30,
  TITULO_COPA: 40,
  /** Técnico (ADR-0111): por vitória do Time dele. */
  VITORIA_DO_TECNICO: 3,
  BONUS_POR_TEMPORADA: 20,
  PALPITE_RESULTADO: 2,
  PALPITE_EXATO: 5,
  TETO_DO_PALPITE_POR_DIA: 10,
} as const;

/** Cada tipo de lançamento do extrato. */
export const TIPOS_DE_LANCAMENTO = [
  'SALARIO',
  'GOL',
  'ASSISTENCIA',
  'SELECAO_RODADA',
  'CRAQUE_RODADA',
  'TITULO',
  'TITULO_COPA',
  'BONUS_LARGADA',
  'PALPITE',
  'CONQUISTA',
  'COMPRA',
  'VITORIA',
] as const;
export type TipoDeLancamento = (typeof TIPOS_DE_LANCAMENTO)[number];

export const NOME_DO_LANCAMENTO: Record<TipoDeLancamento, string> = {
  SALARIO: 'Salário',
  GOL: 'Gol',
  ASSISTENCIA: 'Assistência',
  SELECAO_RODADA: 'Seleção da Rodada',
  CRAQUE_RODADA: 'Craque da Rodada',
  TITULO: 'Título',
  TITULO_COPA: 'Título da Copa',
  BONUS_LARGADA: 'Bônus de largada',
  PALPITE: 'Palpite',
  CONQUISTA: 'Conquista',
  COMPRA: 'Compra na Loja',
  VITORIA: 'Vitória do Time',
};

// ---------------------------------------------------------------- Palpite (ADR-0089)

/** Quanto um Palpite vale (antes do teto do dia): 5 no placar exato, 2 no resultado, 0 no erro. */
export function pontosDoPalpite(palpite: { mandante: number; visitante: number }, placar: { mandante: number; visitante: number }): number {
  if (palpite.mandante === placar.mandante && palpite.visitante === placar.visitante) return MOEDAS.PALPITE_EXATO;
  const sinal = (a: number, b: number) => Math.sign(a - b);
  return sinal(palpite.mandante, palpite.visitante) === sinal(placar.mandante, placar.visitante) ? MOEDAS.PALPITE_RESULTADO : 0;
}

/** O Palpite vai pelo mesmo caminho das escolhas do site: "partida:mandante-visitante" (ex.: "1234:2-1"). */
export function lerPalpite(valor: string): { partidaId: number; mandante: number; visitante: number } | null {
  const m = /^(\d{1,9}):(\d{1,2})-(\d{1,2})$/.exec(valor.trim());
  if (!m) return null;
  return { partidaId: Number(m[1]), mandante: Number(m[2]), visitante: Number(m[3]) };
}

// ---------------------------------------------------------------- Conquistas (ADR-0090)

export type NivelDaConquista = 'FACIL' | 'MEDIA' | 'DIFICIL';
export const MOEDAS_DO_NIVEL: Record<NivelDaConquista, number> = { FACIL: 5, MEDIA: 10, DIFICIL: 20 };

/** O que a Carreira acumulou até uma Partida (inclusive), para conferir as Conquistas. */
export interface CarreiraAteAqui {
  jogos: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  classicosVencidos: number;
  titulos: number;
  /** Nesta Partida: gols, se foi Gol de placa e se o goleiro não sofreu gol. */
  golsNaPartida: number;
  golDePlacaNaPartida: boolean;
  goleiroSemSofrer: boolean;
}

export interface Conquista {
  codigo: string;
  nome: string;
  descricao: string;
  nivel: NivelDaConquista;
  /** Já foi conquistada com a Carreira até aqui? (uma vez só; quem conferir guarda a primeira). */
  feita: (c: CarreiraAteAqui) => boolean;
}

/** A lista fechada da T3 (ADR-0090); toda Conquista nova ganha teste. */
export const CONQUISTAS: readonly Conquista[] = [
  { codigo: 'PRIMEIRA_PARTIDA', nome: 'Estreia', descricao: 'Entrou em campo pela primeira vez.', nivel: 'FACIL', feita: (c) => c.jogos >= 1 },
  { codigo: 'PRIMEIRO_GOL', nome: 'Primeiro gol', descricao: 'Marcou o primeiro gol na Liga.', nivel: 'FACIL', feita: (c) => c.gols >= 1 },
  { codigo: 'PRIMEIRA_ASSISTENCIA', nome: 'Primeira assistência', descricao: 'Deu o primeiro passe para gol.', nivel: 'FACIL', feita: (c) => c.assistencias >= 1 },
  { codigo: 'PRIMEIRA_VITORIA', nome: 'Primeira vitória', descricao: 'Venceu a primeira Partida.', nivel: 'FACIL', feita: (c) => c.vitorias >= 1 },
  { codigo: 'HAT_TRICK', nome: 'Hat-trick', descricao: 'Três gols numa Partida só.', nivel: 'MEDIA', feita: (c) => c.golsNaPartida >= 3 },
  { codigo: 'CINCO_GOLS', nome: 'Cinco gols', descricao: 'Cinco gols na Carreira.', nivel: 'MEDIA', feita: (c) => c.gols >= 5 },
  { codigo: 'CLASSICO_VENCIDO', nome: 'Dono do Clássico', descricao: 'Venceu o primeiro Clássico.', nivel: 'MEDIA', feita: (c) => c.classicosVencidos >= 1 },
  { codigo: 'GOL_DE_PLACA', nome: 'Gol de placa', descricao: 'Marcou um Gol de placa.', nivel: 'MEDIA', feita: (c) => c.golDePlacaNaPartida },
  { codigo: 'MURALHA', nome: 'Muralha', descricao: 'Goleiro que não sofreu gol numa Partida.', nivel: 'MEDIA', feita: (c) => c.goleiroSemSofrer },
  { codigo: 'DEZ_JOGOS', nome: 'Dez jogos', descricao: 'Dez Partidas na Carreira.', nivel: 'MEDIA', feita: (c) => c.jogos >= 10 },
  { codigo: 'PRIMEIRO_TITULO', nome: 'Campeão', descricao: 'Ganhou o primeiro Título (Série ou Copa).', nivel: 'MEDIA', feita: (c) => c.titulos >= 1 },
  { codigo: 'VINTE_GOLS', nome: 'Artilheiro de raiz', descricao: 'Vinte gols na Carreira.', nivel: 'DIFICIL', feita: (c) => c.gols >= 20 },
  { codigo: 'CINQUENTA_JOGOS', nome: 'Veterano', descricao: 'Cinquenta Partidas na Carreira.', nivel: 'DIFICIL', feita: (c) => c.jogos >= 50 },
  { codigo: 'TRES_TITULOS', nome: 'Colecionador de taças', descricao: 'Três Títulos (Série ou Copa).', nivel: 'DIFICIL', feita: (c) => c.titulos >= 3 },
];
export const CONQUISTA_POR_CODIGO: ReadonlyMap<string, Conquista> = new Map(CONQUISTAS.map((c) => [c.codigo, c]));

/** A Carteira que o dono vê pelo Vínculo (saldo e extrato são privados; ADR-0087). */
/** A Loja do dono (ADR-0101): Itens dele, os equipados agora, se é goleiro e a fase aberta. */
export interface LojaDoJogador {
  donos: string[];
  equipados: ItensEquipados;
  goleiro: boolean;
  fase: 1 | 2;
}

export interface Carteira {
  saldo: number;
  loja?: LojaDoJogador;
  extrato: { tipo: TipoDeLancamento; valor: number; descricao: string; em: string }[];
  conquistas: { codigo: string; temporada: number; pagou: boolean }[];
  palpites: { partidaId: number; mandante: number; visitante: number; pontos: number | null }[];
}
