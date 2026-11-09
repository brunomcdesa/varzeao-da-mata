/**
 * Botões de calibração do motor. Mudar qualquer valor muda resultados de seeds
 * antigas, então exige subir VERSAO_SIM (ADR-0002).
 */
export const VERSAO_SIM = 3;

export const PARAMETROS = {
  /** Lances de ataque disputados na Partida inteira. */
  lances: 20,
  /** Quantos pontos de Habilidade de diferença equivalem a "1 unidade" na curva logística. */
  escalaDuelo: 12,
  /** Peso da Habilidade contra a sorte em cada Duelo (0 = moeda). */
  forcaHabilidade: 0.15,
  /** Chance de um meia (em vez de atacante) finalizar a jogada. */
  chanceMeiaFinaliza: 0.3,
  /** Base da posse: o meia com a bola (Passe) contra o meia rival (Defesa). */
  basePosse: 0.5,
  /** Base da criação: meia (Passe) contra o 1º zagueiro (Defesa). */
  baseCriacao: 0.52,
  /** Base do drible: finalizador (Drible) contra o marcador (Defesa). */
  baseDrible: 0.6,
  /** Base do chute marcado: finalizador (Finalização) contra o marcador (Defesa) que tenta bloquear. */
  baseChuteMarcado: 0.72,
  /** Quanto a diferença Drible − Finalização puxa a escolha entre driblar e chutar marcado. */
  escalaEscolha: 20,
  /** Base do chute contra o goleiro depois de driblar (livre) e depois de chutar marcado. */
  baseChuteLivre: 0.78,
  baseChuteApertado: 0.66,
  /** Chance de a bola que passou do goleiro ir pra fora: 35% com Finalização 50, 22% com 90. */
  foraMaximo: 0.35,
  foraMinimo: 0.22,
  /** Chance de converter um pênalti quando cobrador (Finalização) e goleiro (Goleiro) se igualam. */
  penaltiBase: 0.75,
  /** Quanto a vantagem no Duelo cobrador × goleiro desloca a chance de gol no pênalti. */
  pesoPenalti: 0.5,
  /** Pênalti perdido: chance de ter sido defesa (o resto vai pra fora). */
  penaltiDefendido: 0.65,
  /** Chance de uma defesa ou bloqueio virar escanteio (lance extra). */
  chanceEscanteio: 0.45,
  /** Escanteio: chance de quem cabeceia ser um zagueiro que subiu (senão, um atacante). */
  chanceZagueiroCabeceia: 0.25,
  /** Escanteio: cruzamento do cobrador (Passe) contra o zagueiro (Defesa) que tenta afastar. */
  baseCruzamento: 0.55,
  /** Escanteio: cabeceio (Finalização) contra o goleiro (Goleiro). */
  baseCabeceio: 0.6,
  /** Chance de um lance começar com lateral (só o desenho). */
  chanceLateral: 0.35,
} as const;

/** Pesos que convertem ações em pontos de Nota da Partida. */
export const PESOS_NOTA = {
  base: 6,
  gol: 1.2,
  assistencia: 0.8,
  desarme: 0.35,
  defesa: 0.45,
  bloqueio: 0.4,
  drible: 0.3,
  golSofridoGoleiro: -0.5,
  golSofridoZagueiro: -0.2,
  vitoria: 0.5,
  derrota: -0.5,
} as const;
