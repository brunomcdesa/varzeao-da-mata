/**
 * Botões de calibração do motor. Mudar qualquer valor muda resultados de seeds
 * antigas, então exige subir VERSAO_SIM (ADR-0002).
 */
/** Temporada 2. A Temporada 1 usa VERSAO_SIM_T1 (abaixo). */
export const VERSAO_SIM = 12;

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
  /** Peso da Habilidade contra a sorte em cada Duelo (0 = moeda). ADR-0035: 0,35 (era 0,20). */
  forcaHabilidade: 0.35,
  /**
   * Trava de goleada (ADR-0035): o Time que ataca com `travaDesde` gols de vantagem ou mais tira
   * o pé. Cada gol de vantagem a partir daí tira `travaPasso` da base da criação, do drible e do
   * chute marcado. Bola parada não muda.
   */
  travaDesde: 2,
  travaPasso: 0.06,
  /** Resenha (ADR-0034): ganhos de Habilidade de quem comentou no Reels do último jogo do Time. */
  multiplicadorResenha: 1.5,
  /** Chance de um meia (em vez de atacante) finalizar a jogada. */
  chanceMeiaFinaliza: 0.3,
  /** Base da posse: o meia com a bola (Passe) contra o meia rival (Defesa). */
  basePosse: 0.5,
  /** Duelo de Posse na saída de bola depois do gol: quem sofreu tem a bola e a vantagem (ADR-0043). */
  basePosseNaSaida: 0.8,
  /** Marcação dupla (ADR-0043): chance de o 1º zagueiro dobrar no finalizador. */
  chanceMarcacaoDupla: 0.25,
  /** Quanto a dobra tira da chance do finalizador no duelo com a zaga. */
  penalidadeMarcacaoDupla: 0.15,
  /** Duelo do passe (Passe × Defesa) para achar o companheiro livre na dobra. */
  baseSaidaDaDobra: 0.35,
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
  /** Chance de a bola que passou do goleiro ir pra fora: 38% com Finalização 50, 25% com 90. */
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

/**
 * Regras da Temporada 2 (VERSAO_SIM 12; eram a 10 antes do ADR-0043 e a 8 antes do ADR-0035).
 * Só valem com `entrada.t2`; sem elas, a Partida sai com as regras da Temporada 1
 * (VERSAO_SIM_T1, a 11; era a 9). A 11/12 trouxe a saída de bola de quem sofreu o gol.
 */
export const VERSAO_SIM_T1 = 11;

export const PARAMETROS_T2 = {
  /**
   * Postura (ADR-0020): o que soma à chance de quem ataca, pela Postura de quem ataca e de quem
   * defende. Ofensiva ataca melhor e defende pior; Defensiva, o contrário. Não dá vantagem de
   * graça: muda o tamanho do placar e a chance de surpresa.
   */
  posturaAtaque: { OFENSIVA: 0.03, EQUILIBRADA: 0, DEFENSIVA: -0.03 },
  posturaDefesa: { OFENSIVA: 0.04, EQUILIBRADA: 0, DEFENSIVA: -0.03 },
  /** Postura puxa o Ritmo: lances a mais (ou a menos) por Time. */
  posturaRitmo: { OFENSIVA: 1, EQUILIBRADA: 0, DEFENSIVA: -1 },
  /** Faltas (ADR-0024): chance de um desarme ser falta, na criação e no drible. */
  chanceFaltaNaCriacao: 0.17,
  chanceFaltaNoDrible: 0.24,
  /** Onde: falta na criação é na entrada da área com esta chance (senão, longe). */
  criacaoNaEntrada: 0.4,
  /** Falta no drible: dentro da área (pênalti) com esta chance (senão, na entrada). */
  dribleNaArea: 0.4,
  /** Cartões (ADR-0021): amarelo numa falta comum e no pênalti; vermelho no pênalti do último homem. */
  chanceAmarelo: 0.25,
  chanceAmareloNoPenalti: 0.35,
  chanceVermelhoNoPenalti: 0.12,
  /** Chute direto: Finalização do cobrador contra a Defesa da barreira, depois contra o goleiro. */
  baseBarreira: 0.55,
  baseFaltaDireta: 0.25,
  /** Jogada ensaiada: cruzamento para cabeçada (como o escanteio) ou toque curto para chute de longe. */
  chanceCruzada: 0.55,
  baseCruzamentoFalta: 0.45,
  baseCabeceioFalta: 0.42,
  baseChuteDeLonge: 0.2,
  /** Canto (ADR-0023): o pênalti fica mais difícil se o goleiro acerta o canto, mais fácil se erra. */
  cantoAcertado: 0.62,
  cantoErrado: 1.19,
  /** Pênalti perdido: chance de ter sido defesa quando o goleiro acertou ou errou o canto. */
  defendidoNoCanto: 0.85,
  defendidoForaDoCanto: 0.25,
  /** Treino (ADR-0023): ganhos na Habilidade de foco. */
  multiplicadorTreino: 1.5,
} as const;

/**
 * Especialização (ADR-0023): quanto cada uma soma à chance de quem ataca em cada Duelo.
 * Positivo ajuda o ataque; para quem defende, o sinal já está do ponto de vista do ataque.
 */
export const ESPECIALIZACAO = {
  // ATA
  ARTILHEIRO: { escolhaDrible: -0.15, drible: -0.04, chuteMarcado: 0.04, finalizacao: 0.03 },
  DRIBLADOR: { escolhaDrible: 0.15, drible: 0.05, chuteMarcado: -0.04 },
  OPORTUNISTA: { pesoFinalizador: 1.8, finalizacao: -0.02, fora: 0.04 },
  // MEI (com a bola: posse e criação; sem a bola: defesa da posse)
  ARMADOR: { criacao: 0.05, defesaPosse: 0.04 },
  VOLANTE: { criacao: -0.04, defesaPosse: -0.05 },
  MEIA_ATACANTE: { criacao: -0.02, chanceMeiaFinaliza: 0.2 },
  // ZAG (do ponto de vista do ataque)
  XERIFE: { contraDrible: -0.05, contraChuteMarcado: 0.04 },
  BLOQUEADOR: { contraDrible: 0.04, contraChuteMarcado: -0.05 },
  ANTECIPACAO: { contraCriacao: -0.05, contraDrible: 0.03, contraChuteMarcado: 0.03 },
  // GOL (do ponto de vista do ataque)
  PAREDAO: { contraChuteApertado: -0.05, contraChuteLivre: 0.04 },
  GATO: { contraChuteApertado: 0.04, contraChuteLivre: -0.05 },
  PEGADOR_DE_PENALTI: { contraPenalti: -0.08, contraChuteApertado: 0.02, contraChuteLivre: 0.02 },
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
