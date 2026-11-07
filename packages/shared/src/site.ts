/**
 * Formato dos dados públicos do site (gerados pelo worker, lidos pelo site).
 * Regra: nada que revele o resultado de uma Partida antes do seu Apito Inicial.
 */
import type { Posicao, TimeId } from './index.js';
import type { Habilidades } from './habilidades.js';

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
  /** Legado (regra antiga da Vantagem do Empate); hoje o Mata-mata vai para os pênaltis. */
  vantagemDoEmpate?: boolean;
  /** Mata-mata encerrado: quem avançou (ou foi campeão). */
  classificado?: TimeId;
}

export interface RodadaPublica {
  numero: number;
  fase: 'LIGA' | 'MATA_MATA';
  data: string;
  candidatos: { jogadorId: string; username: string; time: TimeId; posicao: Posicao; nota: number }[];
  /** RODADA: Craque da Rodada. TEMPORADA: na Final, os Candidatos são a Craque da Temporada (nota = média). */
  votacao: 'RODADA' | 'TEMPORADA';
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
  /** Só depois que o Ao Vivo da Final termina. */
  campeao: TimeId | null;
  /** Craque da Temporada atual, depois do anúncio (dia seguinte à Final, 19h). */
  craqueDaTemporada: JogadorResumido | null;
  /** Todas as Temporadas, da mais recente para a mais antiga. */
  temporadas: TemporadaNaHistoria[];
}

export interface JogadorResumido {
  jogadorId: string;
  username: string;
  time: TimeId;
  posicao: Posicao;
}

export interface TemporadaNaHistoria {
  numero: number;
  status: string;
  inicio: string;
  /** Só com a Final encerrada. */
  campeao: TimeId | null;
  vice: TimeId | null;
  final: { partidaId: number; mandante: TimeId; visitante: TimeId; placar: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } } } | null;
  craque: JogadorResumido | null;
  artilheiro: (JogadorResumido & { gols: number }) | null;
  /** Maior nota média entre os goleiros com pelo menos 3 jogos (desempate: menos gols sofridos por jogo). */
  goleiro: (JogadorResumido & { notaMedia: number; jogos: number; defesas: number; golsSofridos: number }) | null;
  /** Tabela da Fase de Liga (parcial enquanto a Temporada corre). */
  tabela: LinhaTabelaPublica[];
}

export interface Estatisticas {
  jogos: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  dribles: number;
  bloqueios: number;
  notaMedia: number | null;
  melhorNota: number | null;
  vitorias: number;
  empates: number;
  derrotas: number;
}

export type TipoTrofeu = 'CAMPEAO' | 'CRAQUE_TEMPORADA' | 'CRAQUE_RODADA' | 'REI_DO_CLASSICO';

export interface Trofeu {
  tipo: TipoTrofeu;
  temporada: number;
  /** Craque da Rodada: a Rodada (8 = Semifinais). Rei do Clássico: a Rodada do jogo. */
  rodada?: number;
  fase?: 'LIGA' | 'MATA_MATA';
  time: TimeId;
  partidaId?: number;
}

export interface JogadorPublico {
  id: string;
  username: string;
  time: TimeId;
  posicao: Posicao;
  /** OVR visível: não muda antes do Apito da Partida que o alterou. */
  ovr: number;
  ovrInicial: number;
  /** Habilidades visíveis (mesma regra do OVR): uma casa decimal; o site mostra inteiros. */
  habilidades: Habilidades;
  habilidadesIniciais: Habilidades;
  inscritoEm: string;
  /** Números da carreira (todas as Temporadas); `nestaTemporada` só a atual. */
  jogos: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  dribles: number;
  bloqueios: number;
  notaMedia: number | null;
  melhorNota: number | null;
  vitorias: number;
  empates: number;
  derrotas: number;
  vezesCandidato: number;
  craqueDaRodada: number;
  craqueDaTemporada: number;
  titulos: number;
  reiDoClassico: number;
  temporadas: number;
  nestaTemporada: Estatisticas;
  trofeus: Trofeu[];
  /** OVR depois de cada Partida já revelada, em ordem (todas as Temporadas). */
  historico: { partidaId: number; temporada: number; rodada: number; fase: 'LIGA' | 'MATA_MATA'; nota: number; ovr: number; habilidades: Habilidades; gols: number; rival: TimeId; emCasa: boolean; pro: number; contra: number }[];
}

export interface EscalacaoPublica {
  time: TimeId;
  jogadores: { lugar: number; posicao: Posicao; jogadorId: string | null; username: string | null; ovr: number; habilidades: Habilidades }[];
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
