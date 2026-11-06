/**
 * Formato dos dados públicos do site (gerados pelo worker, lidos pelo site).
 * Regra: nada que revele o resultado de uma Partida antes do seu Apito Inicial.
 */
import type { Posicao, TimeId } from './index.js';

export interface TimePublico {
  id: TimeId;
  nome: string;
  sigla: string;
  primaria: string;
  secundaria: string;
}

export interface LinhaTabelaPublica {
  time: TimeId;
  jogos: number;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
}

/** AGENDADA: antes do Apito. AO_VIVO: até ~6 min depois. ENCERRADA: daí em diante. */
export type SituacaoPartida = 'AGENDADA' | 'AO_VIVO' | 'ENCERRADA';

export interface PartidaNoCalendario {
  id: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  apito: string;
  mandante: TimeId;
  visitante: TimeId;
  situacao: SituacaoPartida;
  classico: boolean;
  /** Só depois do Apito Inicial. */
  placar?: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } };
  /** Já existe Escalação (a partir do Corte). */
  escalada: boolean;
}

export interface RodadaPublica {
  numero: number;
  fase: 'LIGA' | 'MATA_MATA';
  data: string;
  candidatos: { jogadorId: string; username: string; time: TimeId; posicao: Posicao; nota: number }[];
  /** Definido quando a votação fecha. */
  craque: { jogadorId: string; username: string; time: TimeId } | null;
}

export interface LigaPublica {
  atualizadoEm: string;
  temporada: { numero: number; status: string } | null;
  times: TimePublico[];
  tabela: LinhaTabelaPublica[];
  calendario: PartidaNoCalendario[];
  rodadas: RodadaPublica[];
}

export interface JogadorPublico {
  id: string;
  username: string;
  time: TimeId;
  posicao: Posicao;
  /** OVR visível: não muda antes do Apito da Partida que o alterou. */
  ovr: number;
  ovrInicial: number;
  inscritoEm: string;
  jogos: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  notaMedia: number | null;
  melhorNota: number | null;
  vitorias: number;
  empates: number;
  derrotas: number;
  vezesCandidato: number;
  craqueDaRodada: number;
  reiDoClassico: number;
  /** OVR depois de cada Partida já revelada, em ordem. */
  historico: { partidaId: number; rodada: number; nota: number; ovr: number; gols: number }[];
}

export interface EscalacaoPublica {
  time: TimeId;
  jogadores: { lugar: number; posicao: Posicao; jogadorId: string | null; username: string | null; ovr: number }[];
}

export interface PartidaPublica {
  id: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  apito: string;
  mandante: TimeId;
  visitante: TimeId;
  classico: boolean;
  situacao: SituacaoPartida;
  escalacoes: { mandante: EscalacaoPublica; visitante: EscalacaoPublica } | null;
  /** ResultadoPartida completo (lances, desempenhos), só depois do Apito Inicial. */
  resultado: unknown | null;
  video: string | null;
}
