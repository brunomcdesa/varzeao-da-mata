/**
 * Botões de calibração do motor. Mudar qualquer valor muda resultados de seeds
 * antigas, então exige subir VERSAO_SIM (ADR-0002).
 */
export const VERSAO_SIM = 5;

export const PARAMETROS = {
  /** Lances de ataque de referência: a média das retas de EXPECTATIVA da Nota (ADR-0004). */
  lances: 20,
  /**
   * Ritmo (VERSAO_SIM 5, ADR-0016): os lances de ataque variam por Partida, numa curva em sino
   * entre `ritmoMinimo` e `ritmoMaximo`. Jogo travado tem poucos, jogo aberto tem muitos; cada
   * Duelo continua decidido pelas Habilidades.
   */
  ritmoMinimo: 6,
  ritmoMaximo: 34,
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
  baseChuteLivre: 0.62,
  baseChuteApertado: 0.5,
  /** Chance de a bola que passou do goleiro ir pra fora: 35% com Finalização 50, 22% com 90. */
  foraMaximo: 0.38,
  foraMinimo: 0.25,
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
  baseCabeceio: 0.48,
  /** Chance de um lance começar com lateral (só o desenho). */
  chanceLateral: 0.35,
  /**
   * Contra-ataque: quando um time perde a bola (desarme ou defesa do goleiro) e o próximo ataque
   * é do rival, chance de ser contra-ataque com 3 adiantados; cada adiantado a mais soma.
   */
  chanceContraAtaque: 0.35,
  chanceContraPorAdiantado: 0.1,
  /** Recomposição: 1º zagueiro (Defesa) contra o criador (Drible); cada adiantado a mais pesa. */
  baseRecomposicao: 0.62,
  recomposicaoPorAdiantado: 0.1,
  /** Com tantos adiantados (escanteio), sem recompor o marcador também fica para trás. */
  adiantadosSemMarcador: 5,
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
