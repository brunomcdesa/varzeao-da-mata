/**
 * Botões de calibração do motor. Mudar qualquer valor muda resultados de seeds
 * antigas, então exige subir VERSAO_SIM (ADR-0002).
 */
export const VERSAO_SIM = 1;

export const PARAMETROS = {
  /** Lances de ataque disputados na Partida inteira. */
  lances: 20,
  /** Quantos pontos de OVR de diferença equivalem a "1 unidade" na curva logística do Duelo. */
  escalaDuelo: 12,
  /** Peso do OVR contra a sorte no Duelo (0 = moeda, 1 = só OVR). */
  pesoOvr: 0.2,
  /** Chance de um meia (em vez de atacante) finalizar a jogada. */
  chanceMeiaFinaliza: 0.3,
  /** Chance de a finalização que vence o goleiro ir no alvo e virar gol. */
  conversao: 0.7,
  /** Chance de converter um pênalti quando cobrador e goleiro têm o mesmo OVR. */
  penaltiBase: 0.75,
  /** Quanto a vantagem de OVR no Duelo cobrador × goleiro desloca a chance de gol no pênalti. */
  pesoOvrPenalti: 0.5,
} as const;

/** Pesos que convertem ações em pontos de Nota da Partida. */
export const PESOS_NOTA = {
  base: 6,
  gol: 1.2,
  assistencia: 0.8,
  desarme: 0.35,
  defesa: 0.45,
  golSofridoGoleiro: -0.5,
  golSofridoZagueiro: -0.2,
  vitoria: 0.5,
  derrota: -0.5,
} as const;
