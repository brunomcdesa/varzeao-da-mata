import type { Escalacao, Posicao, TimeId } from '@liga/shared';

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
  /** Só no Mata-mata: quem avança com empate (1º e 2º da Fase de Liga na semifinal). */
  vantagemDoEmpate?: Lado;
}

export type TipoLance = 'DESARME' | 'DEFESA' | 'FORA' | 'GOL';

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
  /** Zagueiro que desarmou ou goleiro que defendeu/sofreu. */
  defensor: SlotRef;
}

export interface Cobranca {
  lado: Lado;
  cobrador: SlotRef;
  goleiro: SlotRef;
  convertida: boolean;
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
  /** Nota da Partida, 0–10, relativa à expectativa do próprio OVR. */
  nota: number;
  ovrAntes: number;
  deltaOvr: number;
  ovrDepois: number;
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
}
