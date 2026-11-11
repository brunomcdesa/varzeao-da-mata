/**
 * Formato dos dados públicos do site (gerados pelo worker, lidos pelo site).
 * Regra: nada que revele o resultado de uma Partida antes do seu Apito Inicial.
 */
import type { Aparencia } from './aparencia.js';
import type { Especializacao, Posicao, Serie, TimeId } from './index.js';
import type { HabilidadeId, Habilidades } from './habilidades.js';

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

/** AGENDADA: antes do Apito. AO_VIVO: até ~5 min depois. ENCERRADA: daí em diante. */
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
  /** A Série da Partida (ADR-0017). Sem o campo, é a A. */
  serie?: Serie;
}

export interface RodadaPublica {
  /** Id da Rodada no banco: é o que o voto pelo site manda para a borda. */
  id: number;
  numero: number;
  fase: 'LIGA' | 'MATA_MATA';
  data: string;
  /** O Resumo da Rodada já saiu no Instagram: a partir daí o site mostra a próxima Rodada. */
  resumoPublicado?: boolean;
  /**
   * `numero`: o número interno, que o site manda para a borda ao votar. `rotulo`: o que se
   * comenta ("3", ou "A3" e "B3" com duas Séries). `serie`: a Série do Candidato (ADR-0017).
   */
  candidatos: { numero: number; rotulo?: string; serie?: Serie; jogadorId: string; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number }[];
  /** RODADA: Craque da Rodada. TEMPORADA: na Final, os Candidatos são a Craque da Temporada (nota = média). */
  votacao: 'RODADA' | 'TEMPORADA';
  /** Definido quando a votação fecha. Com duas Séries, é o da A. */
  craque: { jogadorId: string; username: string; apelido?: string | null; time: TimeId } | null;
  /** Craque da Série B, quando a Rodada tem Série B. */
  craqueB?: { jogadorId: string; username: string; apelido?: string | null; time: TimeId } | null;
}

export interface LigaPublica {
  atualizadoEm: string;
  temporada: { numero: number; status: string } | null;
  times: TimePublico[];
  /** Tabela da Série A (ou da Liga inteira, antes das Séries). */
  tabela: LinhaTabelaPublica[];
  /** Tabela da Série B, quando a Temporada tem Séries (ADR-0017). */
  tabelaB?: LinhaTabelaPublica[];
  /** Os Times de cada Série na Temporada atual, quando ela tem Séries. */
  series?: Record<Serie, TimeId[]> | null;
  calendario: PartidaNoCalendario[];
  rodadas: RodadaPublica[];
  /** Só depois que o Ao Vivo da Final termina. Com duas Séries, é o campeão da A. */
  campeao: TimeId | null;
  campeaoB?: TimeId | null;
  /** Craque da Temporada atual, depois do anúncio (dia seguinte à Final, 19h). */
  craqueDaTemporada: JogadorResumido | null;
  craqueDaTemporadaB?: JogadorResumido | null;
  /** Todas as Temporadas, da mais recente para a mais antiga. */
  temporadas: TemporadaNaHistoria[];
  /** Temporada já criada que ainda não começou (o site a anuncia). */
  proximaTemporada?: { numero: number; inicio: string } | null;
}

export interface JogadorResumido {
  jogadorId: string;
  username: string;
  apelido?: string | null;
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
  /** Tabela da Fase de Liga (parcial enquanto a Temporada corre). Com duas Séries, a da A. */
  tabela: LinhaTabelaPublica[];
  /** Série B (ADR-0017): campeão, vice, Final, Craque e tabela. */
  serieB?: {
    campeao: TimeId | null;
    vice: TimeId | null;
    final: { partidaId: number; mandante: TimeId; visitante: TimeId; placar: { mandante: number; visitante: number; penaltis?: { mandante: number; visitante: number } } } | null;
    craque: JogadorResumido | null;
    tabela: LinhaTabelaPublica[];
  };
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
  /** Título e Craques da Série B (ADR-0017). Sem o campo, é da A. */
  serie?: Serie;
}

export interface JogadorPublico {
  id: string;
  username: string;
  /** Nome escolhido pelo dono (ADR-0014); sem ele, aparece o @. */
  apelido?: string | null;
  /** Quando o apelido foi trocado pela última vez (uma troca por Rodada, ADR-0014). */
  apelidoTrocadoEm?: string | null;
  time: TimeId;
  posicao: Posicao;
  /** OVR visível: não muda antes do Apito da Partida que o alterou. */
  ovr: number;
  ovrInicial: number;
  /** Habilidades visíveis (mesma regra do OVR): uma casa decimal; o site mostra inteiros. */
  habilidades: Habilidades;
  habilidadesIniciais: Habilidades;
  inscritoEm: string;
  /** Já usou a Transferência da Temporada atual (ADR-0012). */
  transferenciaUsada: boolean;
  /** Visual do boneco escolhido pelo dono (ADR-0013); null = o sorteado pelo @. */
  visual: Aparencia | null;
  /** Número da camisa escolhido pelo dono. */
  numero: number | null;
  /** Fundador de um Time da Série B (ADR-0036): só existe a partir da Temporada 2. */
  fundador?: { time: TimeId; temporada: number };
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
  historico: {
    partidaId: number; temporada: number; rodada: number; fase: 'LIGA' | 'MATA_MATA'; nota: number; ovr: number; habilidades: Habilidades; gols: number; rival: TimeId; emCasa: boolean; pro: number; contra: number;
    /** Time pelo qual jogou e assistências (Página de Carreira, ADR-0025). */
    time?: TimeId;
    assistencias?: number;
    serie?: Serie;
    /** Temporada 2 (ADR-0021): cartões. Ausentes nas Partidas da T1. */
    amarelos?: number;
    expulso?: boolean;
  }[];
  /** Temporada 2 (ADR-0020): é o Capitão atual do Time. Ausente na T1 e para os outros. */
  capitao?: true;
  /** Temporada 2 (ADR-0023): Especialização e Treino escolhidos. Ausentes na T1. */
  especializacao?: Especializacao | null;
  treino?: HabilidadeId | null;
}

export interface EscalacaoPublica {
  time: TimeId;
  /** `capitao`: faixa de Capitão nesta Partida (só na T2, ADR-0020). */
  jogadores: { lugar: number; posicao: Posicao; jogadorId: string | null; username: string | null; apelido?: string | null; ovr: number; habilidades: Habilidades; capitao?: true }[];
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
  /** Áudio da narração do Ao Vivo (o jogo inteiro, no tempo do Ao Vivo), depois do Apito. */
  narracao: string | null;
  /** Temporada 2: tamanho de cada Elenco, para a Arquibancada. Ausente nas Partidas da T1. */
  torcida?: Record<'mandante' | 'visitante', number>;
}
