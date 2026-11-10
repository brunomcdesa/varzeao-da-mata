import type { Canto, Escalacao, HabilidadeId, Habilidades, Posicao, Postura, TimeId } from '@liga/shared';

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
  t2?: { postura: Record<Lado, Postura> };
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
  /** T2: no lance FALTA, quem fez a falta, onde e o cartão (se houve). */
  falta?: { autor: SlotRef; local: LocalDaFalta; cartao?: 'AMARELO' | 'VERMELHO'; segundoAmarelo?: boolean };
  /** T2: na FALTA_DIRETA, os defensores na barreira. */
  barreira?: SlotRef[];
  /** T2: no PENALTI, para onde o batedor chutou e para onde o goleiro pulou. */
  canto?: { cobrador: Canto; goleiro: Canto };
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
}
