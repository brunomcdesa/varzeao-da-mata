import type { Canto, Escalacao, Formacao, HabilidadeId, Habilidades, JogadaDaFormacao, PerfilDoJuiz, Posicao, Postura, TimeId } from '@liga/shared';

export type Lado = 'mandante' | 'visitante';
export type Fase = 'LIGA' | 'MATA_MATA';

/** Aponta um lugar na Escalação de um lado (Jogadores da Base não têm id). */
export interface SlotRef {
  lado: Lado;
  indice: number;
}

export interface EntradaPartida {
  mandante: Escalacao;
  visitante: Escalacao;
  /** Sorteado pelo worker e salvo junto da Partida. */
  seed: number;
  fase: Fase;
  /** Legado (regra antiga). Ignorado: empate no Mata-mata vai para os pênaltis. */
  vantagemDoEmpate?: Lado;
  /**
   * Regras da Temporada 2 (VERSAO_SIM 10): Postura, faltas, cartões, Especialização, Canto e
   * Treino (ADRs 0020, 0021, 0023, 0024). Sem este campo, a Partida segue as regras da
   * Temporada 1 e sai igual à VERSAO_SIM 5.
   */
  t2?: {
    postura: Record<Lado, Postura>;
    /** Formação de cada Time (ADR-0044, VERSAO_SIM 11). Sem ela, os dois jogam no 2-2-2. */
    formacao?: Record<Lado, Formacao>;
  };
  /**
   * Regras da Temporada 3 (VERSAO_SIM_T3, ADRs 0091 e 0094): Trave, Rebote, Chute de longe,
   * Pressão final, Acréscimos, Perfil do Juiz, Gol de placa e Batedores. Só valem junto com `t2`;
   * sem este campo, a Partida sai igual à versão da T2.
   */
  t3?: {
    juiz: PerfilDoJuiz;
    /** Batedores escolhidos pelo Capitão (ids dos Jogadores, em ordem). Sem escolha, a ordem automática. */
    batedores?: Partial<Record<Lado, readonly string[]>>;
    /**
     * Capitão em campo (ADR-0107, VERSAO_SIM_T3 22): cobradores de escanteio (1 e o reserva) e a
     * Marcação individual (o lado que marca: um zagueiro ou meia seu num rival de linha). O
     * pênalti no jogo é do primeiro Batedor em campo.
     */
    escanteio?: Partial<Record<Lado, readonly string[]>>;
    marcacao?: Partial<Record<Lado, { marcador: string; alvo: string }>>;
  };
}

/** FALTA (só na T2): a jogada parou numa falta do defensor; a cobrança vem no lance seguinte. */
export type TipoLance = 'DESARME' | 'BLOQUEIO' | 'DEFESA' | 'FORA' | 'GOL' | 'FALTA';

/** Onde foi a falta (T2): dentro da área (pênalti), na entrada da área (chute direto) ou longe. */
export type LocalDaFalta = 'AREA' | 'ENTRADA' | 'LONGE';

/** Um lance de ataque, já resolvido. O renderer anima a partir daqui. */
export interface Lance {
  numero: number;
  minuto: number;
  ataque: Lado;
  tipo: TipoLance;
  /** Meia que conduziu a jogada. */
  criador: SlotRef;
  /** Quem finalizou (ausente quando a jogada parou num desarme). */
  finalizador?: SlotRef;
  /**
   * Quem parou a jogada: o zagueiro que desarmou (na criação ou no atacante), o zagueiro que
   * bloqueou ou o goleiro que defendeu/sofreu.
   */
  defensor: SlotRef;
  /** Zagueiro que marcou o finalizador no confronto atacante × zagueiro. */
  marcador?: SlotRef;
  /** O finalizador tentou driblar o marcador (em vez de chutar marcado). */
  drible?: boolean;
  /**
   * Bola parada (VERSAO_SIM 3). ESCANTEIO: lance extra depois de uma defesa ou bloqueio; o
   * criador cobra, o finalizador cabeceia e o defensor é o zagueiro que afasta (DESARME) ou o
   * goleiro. LATERAL: a jogada começa com a cobrança de um lateral (só muda o desenho).
   */
  bolaParada?: 'ESCANTEIO' | 'LATERAL' | 'PENALTI' | 'FALTA_DIRETA' | 'FALTA_CRUZADA' | 'FALTA_CURTA';
  /** No LATERAL: quem cobra (um companheiro do criador). */
  cobrador?: SlotRef;
  /**
   * Contra-ataque (VERSAO_SIM 4): o rival tinha acabado de perder a bola com gente adiantada.
   * `recomposto`: a defesa voltou a tempo (lance normal); senão, o 1º zagueiro ficou para trás
   * (criação garantida) e, se quase todos tinham subido (escanteio), também o marcador.
   */
  contraAtaque?: { recomposto: boolean; adiantados: number };
  /**
   * Marcação dupla (VERSAO_SIM 12/13, ADR-0045): o 1º zagueiro (`zagueiro`) voltou e dobrou a
   * marcação em `sobre`. Com `passe`, `sobre` achou o companheiro livre, que é o finalizador
   * (chute sem marcador); sem `passe`, `sobre` é o finalizador e o duelo foi contra os dois.
   */
  dobra?: { zagueiro: SlotRef; sobre: SlotRef; passe?: boolean };
  /** T2: no lance FALTA, quem fez a falta, onde e o cartão (se houve). */
  falta?: { autor: SlotRef; local: LocalDaFalta; cartao?: 'AMARELO' | 'VERMELHO'; segundoAmarelo?: boolean };
  /** T2: na FALTA_DIRETA, os defensores na barreira. */
  barreira?: SlotRef[];
  /** T2: no PENALTI, para onde o batedor chutou e para onde o goleiro pulou. */
  canto?: { cobrador: Canto; goleiro: Canto };
  /**
   * Jogada da Formação (ADR-0044). TABELA: o criador tabelou com o `apoio` antes de criar.
   * LIGACAO_DIRETA: o criador é um zagueiro que lançou direto para o ataque. COBERTURA: depois
   * do drible no marcador, o zagueiro da `cobertura` chegou para mais um desarme.
   */
  jogadaDaFormacao?: JogadaDaFormacao;
  /** Na TABELA: o meia que devolveu a bola ao criador. */
  apoio?: SlotRef;
  /** Na COBERTURA: o zagueiro que fez a sobra (é o `defensor` quando desarmou). */
  cobertura?: SlotRef;
  /** T3 (ADR-0094): o chute (FORA) bateu na trave. */
  trave?: true;
  /**
   * T3: Rebote. O goleiro soltou a bola do lance anterior; `criador` é quem chutou antes,
   * `finalizador` o atacante que foi na sobra e `marcador` o zagueiro que disputou com ele.
   */
  rebote?: true;
  /** T3: Chute de longe de verdade (meia ou zagueiro, sem Duelo com o marcador). */
  chuteDeLonge?: true;
  /** T3: Gol de placa (drible que ainda venceu a Cobertura, ou Chute de longe improvável). */
  golDePlaca?: true;
  /** T3: o Time de quem ataca estava na Pressão final (ou os dois, no empate do Mata-mata). */
  pressao?: true;
  /** T3: lance nos Acréscimos; o minuto fica 90 e este é o minuto a mais (90+2 → 2). */
  acrescimo?: number;
}

export interface Cobranca {
  lado: Lado;
  cobrador: SlotRef;
  goleiro: SlotRef;
  convertida: boolean;
  /** Pênalti perdido: o goleiro pegou (true) ou foi pra fora (false). */
  defendida?: boolean;
  /** T2: para onde o batedor chutou e para onde o goleiro pulou. */
  canto?: { cobrador: Canto; goleiro: Canto };
}

export interface Desempenho {
  slot: SlotRef;
  jogadorId: string | null;
  posicao: Posicao;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  bloqueios: number;
  dribles: number;
  /** Nota da Partida, 0–10, relativa à expectativa do próprio OVR (só para o Craque). */
  nota: number;
  ovrAntes: number;
  deltaOvr: number;
  ovrDepois: number;
  habilidadesAntes: Habilidades;
  habilidadesDepois: Habilidades;
  /** Variação de cada Habilidade na Partida (uma casa decimal). */
  deltaHabilidades: Record<HabilidadeId, number>;
  /**
   * Substituição (ADR-0061): SAIU no intervalo (jogou o 1º tempo) ou ENTROU (jogou o 2º). O
   * `slot` é o lugar em campo, o mesmo de quem saiu e de quem entrou.
   */
  substituicao?: 'SAIU' | 'ENTROU';
  /** Reserva que entrou fora de posição: a Posição de inscrição dele (`posicao` é a vaga). */
  posicaoDeOrigem?: Posicao;
  /** T2: faltas cometidas e cartões (dois amarelos na Partida viram vermelho). */
  faltas?: number;
  amarelos?: number;
  expulso?: boolean;
}

export interface ResultadoPartida {
  versaoSim: number;
  seed: number;
  times: Record<Lado, TimeId>;
  classico: boolean;
  gols: Record<Lado, number>;
  /** Presente só quando houve disputa de pênaltis. */
  penaltis?: { placar: Record<Lado, number>; cobrancas: Cobranca[] };
  /** null = empate na Fase de Liga. */
  vencedor: Lado | null;
  lances: Lance[];
  desempenhos: Desempenho[];
  /** Quem decidiu a Partida (gol da vitória ou pênalti decisivo); base do Rei do Clássico. */
  decisivo: SlotRef | null;
  /** T2: a Postura de cada Time e quantos lances de ataque a Partida teve (o Ritmo). */
  postura?: Record<Lado, Postura>;
  ritmo?: number;
  /** T2 (ADR-0044): a Formação de cada Time. */
  formacao?: Record<Lado, Formacao>;
  /**
   * Substituições do intervalo (ADR-0061), em ordem. `lugar` é o slot em campo; a partir do lance
   * `antesDoLance` (índice em `lances`), quem ocupa o lugar é o reserva `banco` (índice no Banco).
   */
  substituicoes?: Substituicao[];
  /** Com Substituição (ADR-0061): o Jogador do `decisivo` (o lugar pode ter tido dois). */
  decisivoJogadorId?: string | null;
  /** T3 (ADR-0094): o Perfil do Juiz e os minutos de Acréscimos do 2º tempo. */
  juiz?: PerfilDoJuiz;
  acrescimos?: number;
}

export interface Substituicao {
  lado: Lado;
  lugar: number;
  /** Índice do reserva no Banco da Escalação. */
  banco: number;
  saiu: string | null;
  entrou: string | null;
  /** Nota parcial de quem saiu, no intervalo. */
  notaNoIntervalo: number;
  /** O primeiro lance (índice em `lances`) com o reserva em campo. */
  antesDoLance: number;
  minuto: number;
  /** O reserva entrou fora de posição (a vaga é de outra Posição). */
  foraDePosicao?: true;
}
