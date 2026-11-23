import {
  CANTOS,
  FORMACAO_PADRAO,
  POSICOES,
  VAGAS_DA_FORMACAO,
  TAMANHO_ESCALACAO,
  ehClassico,
  ovrDasHabilidades,
  QUANTIDADE_DE_BATEDORES,
  type Canto,
  type Escalacao,
  type Formacao,
  type HabilidadeId,
  type Habilidades,
  type JogadorEscalado,
  type Posicao,
} from '@liga/shared';
import { duelo, probabilidadeDuelo } from './duelo.js';
import { ACOES, PROTECAO, evoluir, protegerPerdas, valorDaAcao, zeradas, type Acao } from './evolucao.js';
import { notaDaPartida } from './nota.js';
import { ESPECIALIZACAO, PARAMETROS, PARAMETROS_T2, PARAMETROS_T3, VERSAO_SIM, VERSAO_SIM_T1, VERSAO_SIM_T3 } from './parametros.js';
import { criarRng, type Rng } from './rng.js';
import type { Cobranca, Desempenho, EntradaPartida, Lado, Lance, LocalDaFalta, ResultadoPartida, SlotRef, Substituicao } from './tipos.js';

const LADOS: readonly Lado[] = ['mandante', 'visitante'];
const outro = (lado: Lado): Lado => (lado === 'mandante' ? 'visitante' : 'mandante');

/** Ordem dos cobradores de pênalti por Posição; repete enquanto durarem as alternadas. */
const ORDEM_COBRANCA: readonly Posicao[] = ['ATA', 'ATA', 'MEI', 'MEI', 'ZAG', 'ZAG', 'GOL'];
const COBRANCAS_REGULARES = 5;

interface Contadores {
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  bloqueios: number;
  dribles: number;
}

/** Confere se a Escalação tem 7 e as vagas da Formação (ADR-0044; 2-2-2 sem Formação). */
export function validarEscalacao(escalacao: Escalacao, formacao: Formacao = FORMACAO_PADRAO): void {
  if (escalacao.jogadores.length !== TAMANHO_ESCALACAO) {
    throw new Error(`Escalação de ${escalacao.time} tem ${escalacao.jogadores.length} Jogadores, esperado ${TAMANHO_ESCALACAO}`);
  }
  const vagas = VAGAS_DA_FORMACAO[formacao];
  for (const posicao of POSICOES) {
    const qtd = escalacao.jogadores.filter((j) => j.posicao === posicao).length;
    if (qtd !== vagas[posicao]) {
      throw new Error(`Escalação de ${escalacao.time} tem ${qtd} ${posicao}, esperado ${vagas[posicao]} no ${formacao}`);
    }
  }
}

/** Chance de a bola que venceu o goleiro sair: cai com a Finalização (ADR-0010). */
export function chanceDeFora(finalizacao: number): number {
  const t = Math.min(1, Math.max(0, (finalizacao - 50) / 40));
  return PARAMETROS.foraMaximo + (PARAMETROS.foraMinimo - PARAMETROS.foraMaximo) * t;
}

/** Chance de o finalizador tentar o drible (em vez do chute marcado): o lado mais forte, com sorte. */
export function chanceDeDriblar(drible: number, finalizacao: number): number {
  return 1 / (1 + Math.exp(-(drible - finalizacao) / PARAMETROS.escalaEscolha));
}

/** Simula uma Partida. Mesma entrada (incluindo seed) → mesmo resultado, sempre. */
/**
 * Ritmo da Partida (ADR-0016): lances de ataque numa curva em sino (soma de dois sorteios)
 * entre o mínimo e o máximo, com a média no meio. Tem sorteio próprio pelo seed, então os
 * primeiros lances de uma Partida saem iguais aos da versão anterior.
 */
export function ritmoDaPartida(seed: number): number {
  const r = criarRng(((seed >>> 0) ^ 0x2545f491) >>> 0);
  const { ritmoMinimo: min, ritmoMaximo: max } = PARAMETROS;
  return min + Math.round(((r.next() + r.next()) / 2) * (max - min));
}

export function simularPartida(entrada: EntradaPartida): ResultadoPartida {
  /** Formação de cada lado (ADR-0044): só na T2; sem escolha, 2-2-2. */
  const formacaoDe = (lado: Lado): Formacao => entrada.t2?.formacao?.[lado] ?? FORMACAO_PADRAO;
  validarEscalacao(entrada.mandante, formacaoDe('mandante'));
  validarEscalacao(entrada.visitante, formacaoDe('visitante'));

  const rng = criarRng(entrada.seed);
  const escalacoes: Record<Lado, Escalacao> = { mandante: entrada.mandante, visitante: entrada.visitante };
  const classico = ehClassico(entrada.mandante.time, entrada.visitante.time);

  // Substituição (ADR-0061): o Banco só vale com as regras da T2. Os lances continuam apontando
  // o lugar em campo (SlotRef); quem ocupa cada lugar pode mudar no intervalo. Os números de cada
  // Jogador (contadores, pontos, cartões) ficam com ele, pelo índice em `elenco` (titulares e
  // depois o Banco). Sem Banco, o ocupante de cada lugar é o próprio titular, e nada muda.
  const elenco: Record<Lado, readonly JogadorEscalado[]> = {
    mandante: [...entrada.mandante.jogadores, ...(entrada.t2 ? entrada.mandante.banco ?? [] : [])],
    visitante: [...entrada.visitante.jogadores, ...(entrada.t2 ? entrada.visitante.banco ?? [] : [])],
  };
  const titulares = (lado: Lado) => escalacoes[lado].jogadores.length;
  const ocupante: Record<Lado, number[]> = {
    mandante: entrada.mandante.jogadores.map((_, i) => i),
    visitante: entrada.visitante.jogadores.map((_, i) => i),
  };
  const quem = (s: SlotRef): number => ocupante[s.lado][s.indice]!;
  const jogadorEm = (s: SlotRef): JogadorEscalado => elenco[s.lado][quem(s)]!;
  /** Chave do Jogador (não do lugar): cartões e faltas ficam com quem fez. */
  const chaveJ = (s: SlotRef) => `${s.lado}:${quem(s)}`;
  const hab = (s: SlotRef, h: HabilidadeId): number => jogadorEm(s).habilidades[h];

  // Regras da Temporada 2 (VERSAO_SIM 10). Sem `entrada.t2`, nada daqui muda a Partida: os
  // sorteios da T2 são próprios e os ajustes valem zero, então a T1 sai igual à versão 5.
  const t2 = entrada.t2;
  const rngT2 = criarRng(((entrada.seed >>> 0) ^ 0x68e31da4) >>> 0);
  // Regras da Temporada 3 (ADR-0094): só junto com as da T2, com sorteio próprio. Sem
  // `entrada.t3`, nada daqui muda a Partida (sai igual à VERSAO_SIM da T2).
  const t3 = t2 ? entrada.t3 : undefined;
  const rngT3 = criarRng(((entrada.seed >>> 0) ^ 0x7feb352d) >>> 0);
  const juiz = t3?.juiz ?? 'NORMAL';
  const fatorFalta = t3 ? PARAMETROS_T3.juizFalta[juiz] : 1;
  const fatorCartao = t3 ? PARAMETROS_T3.juizCartao[juiz] : 1;
  /** Pressão final (T3): os Times que estão se lançando no lance da vez. */
  let pressionando: ReadonlySet<Lado> = new Set<Lado>();
  const chave = (s: SlotRef) => `${s.lado}:${s.indice}`;
  /** Expulsos (T2): o lugar fica vazio até o fim (a expulsão não é compensada). */
  const expulsos = new Set<string>();
  /** Expulsos, pelo Jogador (`chaveJ`). */
  const expulsosJ = new Set<string>();
  /** Índice do lance FALTA em que cada expulso saiu (para o lateral não usar quem já saiu). */
  const expulsoNoLance = new Map<string, number>();
  const faltasDe = new Map<string, number>();
  const amarelosDe = new Map<string, number>();
  /** Especialização de quem ocupa o lugar; fora de posição (reserva de outra Posição), nenhuma. */
  const especializacao = (s: SlotRef) => {
    if (!t2) return undefined;
    const j = jogadorEm(s);
    return j.posicao === escalacoes[s.lado].jogadores[s.indice]!.posicao ? j.especializacao : undefined;
  };
  /** Quanto a Especialização de `s` soma à chance de quem ataca no Duelo `campo` (0 na T1). */
  const mod = (s: SlotRef, campo: string): number => {
    const e = especializacao(s);
    return e ? ((ESPECIALIZACAO[e] as Record<string, number>)[campo] ?? 0) : 0;
  };
  const posturaDe = (lado: Lado) => t2?.postura[lado] ?? 'EQUILIBRADA';
  const limitarTatico = (x: number) => Math.min(PARAMETROS_T2.limiteTatico, Math.max(-PARAMETROS_T2.limiteTatico, x));
  /**
   * Quanto a Postura e a Formação dos dois Times somam à chance de quem ataca (0 na T1). Postura
   * e Formação somam, com limite no lado de quem ataca e no de quem defende (ADR-0044).
   */
  const ajustePostura = (ataque: Lado): number => {
    if (!t2) return 0;
    const defesa = outro(ataque);
    return (
      limitarTatico(PARAMETROS_T2.posturaAtaque[posturaDe(ataque)] + PARAMETROS_T2.formacaoAtaque[formacaoDe(ataque)]) +
      limitarTatico(PARAMETROS_T2.posturaDefesa[posturaDe(defesa)] + PARAMETROS_T2.formacaoDefesa[formacaoDe(defesa)]) +
      (pressionando.has(ataque) ? PARAMETROS_T3.pressaoAtaque : 0)
    );
  };
  /** Jogadas da Formação (ADR-0044) têm sorteio próprio: o 2-2-2 sai igual à VERSAO_SIM 10. */
  const rngF = criarRng(((entrada.seed >>> 0) ^ 0x1b873593) >>> 0);
  const jogaNa = (lado: Lado, f: Formacao) => t2 !== undefined && formacaoDe(lado) === f;

  /** Trava de goleada (ADR-0033): quem ataca com vantagem larga tira o pé (0 sem vantagem). */
  const ajusteVantagem = (ataque: Lado): number => {
    const vantagem = gols[ataque] - gols[outro(ataque)];
    return vantagem >= PARAMETROS.travaDesde ? -PARAMETROS.travaPasso * (vantagem - PARAMETROS.travaDesde + 1) : 0;
  };

  const slotsDa = (lado: Lado, posicao: Posicao): SlotRef[] =>
    escalacoes[lado].jogadores.flatMap((j, indice) => (j.posicao === posicao && !expulsos.has(`${lado}:${indice}`) ? [{ lado, indice }] : []));
  /** Os dois que defendem como zagueiros: os ZAG em campo, completados por meias se houve expulsão. */
  const zaga = (lado: Lado): SlotRef[] => {
    const z = slotsDa(lado, 'ZAG');
    return z.length >= 2 ? z : [...z, ...slotsDa(lado, 'MEI'), ...slotsDa(lado, 'ATA')].slice(0, 2);
  };
  /** Quem joga como meia: os MEI em campo; se todos foram expulsos, os atacantes recuam. */
  const meio = (lado: Lado): SlotRef[] => {
    const m = slotsDa(lado, 'MEI');
    return m.length ? m : slotsDa(lado, 'ATA');
  };
  /** Quem finaliza como atacante: os ATA em campo; se o único foi expulso, os meias sobem. */
  const frente = (lado: Lado): SlotRef[] => {
    const a = slotsDa(lado, 'ATA');
    return a.length ? a : meio(lado).length ? meio(lado) : zaga(lado);
  };

  const contadores: Record<Lado, Contadores[]> = {
    mandante: elenco.mandante.map(zerado),
    visitante: elenco.visitante.map(zerado),
  };
  const pontos: Record<Lado, Record<HabilidadeId, number>[]> = {
    mandante: elenco.mandante.map(zeradas),
    visitante: elenco.visitante.map(zeradas),
  };
  const conta = (s: SlotRef): Contadores => contadores[s.lado][quem(s)]!;
  /** Ações principais protegem (ADR-0104, da T2 em diante): proteção juntada pela Posição da vaga. */
  const protecao: Record<Lado, number[]> = {
    mandante: elenco.mandante.map(() => 0),
    visitante: elenco.visitante.map(() => 0),
  };
  const acao = (s: SlotRef, a: Acao): void => {
    pontos[s.lado][quem(s)]![ACOES[a].hab] += valorDaAcao(a, t2 !== undefined);
    if (t2) protecao[s.lado][quem(s)]! += PROTECAO[escalacoes[s.lado].jogadores[s.indice]!.posicao][a] ?? 0;
  };

  const gols: Record<Lado, number> = { mandante: 0, visitante: 0 };
  const lances: Lance[] = [];
  const golsEmOrdem: { lado: Lado; autor: SlotRef; jogador?: number }[] = [];
  // Bolas paradas têm sorteio próprio: os 20 lances de ataque saem iguais aos da versão 2.
  const rngBP = criarRng(((entrada.seed >>> 0) ^ 0x5bd1e995) >>> 0);
  // Contra-ataque (VERSAO_SIM 4): sorteio próprio também.
  const rngCA = criarRng(((entrada.seed >>> 0) ^ 0x27d4eb2f) >>> 0);
  // Marcação dupla (VERSAO_SIM 12/13): sorteio próprio também.
  const rngDobra = criarRng(((entrada.seed >>> 0) ^ 0x165667b1) >>> 0);
  /** Quem acabou de recuperar a bola e quantos do rival estavam adiantados. */
  let recuperou: { lado: Lado; adiantados: number } | null = null;
  const posicaoDe = (s: SlotRef) => escalacoes[s.lado].jogadores[s.indice]!.posicao;
  /** Atualiza quem recuperou a bola depois de cada lance (desarme ou defesa do goleiro). */
  const depoisDoLance = (l: Lance): void => {
    if (l.tipo !== 'DESARME' && l.tipo !== 'DEFESA') {
      recuperou = null;
      return;
    }
    const zagueiroSubiu = [l.criador, l.finalizador].some((s) => s && posicaoDe(s) === 'ZAG');
    // Pressão final (T3): quem se lançou deixa um a mais lá na frente.
    recuperou = { lado: outro(l.ataque), adiantados: (l.bolaParada === 'ESCANTEIO' ? 6 : zagueiroSubiu ? 4 : 3) + (pressionando.has(l.ataque) ? 1 : 0) };
  };

  /**
   * Escanteio (VERSAO_SIM 3): depois de uma defesa ou bloqueio, às vezes a bola sai pela linha
   * de fundo. Um meia cobra (Passe) contra um zagueiro (Defesa); passando, um atacante (ou um
   * zagueiro que subiu) cabeceia (Finalização) contra o goleiro (Goleiro).
   */
  const talvezEscanteio = (numero: number, minuto: number, ataque: Lado): void => {
    if (!rngBP.chance(PARAMETROS.chanceEscanteio)) return;
    const defesa = outro(ataque);
    const min = Math.min(90, minuto + 1);
    const cobrador = rngBP.pick(meio(ataque));
    const finalizador = rngBP.chance(PARAMETROS.chanceZagueiroCabeceia) ? rngBP.pick(zaga(ataque)) : rngBP.pick(frente(ataque));
    const zagueiro = rngBP.pick(zaga(defesa));
    const goleiro = rngBP.pick(slotsDa(defesa, 'GOL'));
    const base = { numero, minuto: min, ataque, criador: cobrador, finalizador, marcador: zagueiro, bolaParada: 'ESCANTEIO' as const };
    if (!duelo(rngBP, hab(cobrador, 'PAS'), hab(zagueiro, 'DEF'), PARAMETROS.baseCruzamento)) {
      // A zaga afasta: vale desarme para o zagueiro.
      conta(zagueiro).desarmes++;
      acao(zagueiro, 'desarme');
      acao(cobrador, 'desarmadoNaCriacao');
      lances.push({ ...base, tipo: 'DESARME', defensor: zagueiro });
      depoisDoLance(lances[lances.length - 1]!);
      return;
    }
    acao(zagueiro, 'superadoNaCriacao');
    if (!duelo(rngBP, hab(finalizador, 'FIN'), hab(goleiro, 'GOL'), PARAMETROS.baseCabeceio)) {
      conta(goleiro).defesas++;
      acao(goleiro, 'defesa');
      acao(finalizador, 'chuteDefendido');
      lances.push({ ...base, tipo: 'DEFESA', defensor: goleiro });
      depoisDoLance(lances[lances.length - 1]!);
      return;
    }
    if (rngBP.chance(chanceDeFora(hab(finalizador, 'FIN')))) {
      acao(finalizador, 'chuteFora');
      lances.push({ ...base, tipo: 'FORA', defensor: goleiro });
      depoisDoLance(lances[lances.length - 1]!);
      return;
    }
    gols[ataque]++;
    conta(finalizador).gols++;
    conta(cobrador).assistencias++;
    acao(finalizador, 'gol');
    acao(cobrador, 'assistencia');
    acao(goleiro, 'golSofridoGoleiro');
    for (const z of slotsDa(defesa, 'ZAG')) acao(z, 'golSofridoZagueiro');
    for (const s of [goleiro, ...slotsDa(defesa, 'ZAG')]) conta(s).golsSofridos++;
    golsEmOrdem.push({ lado: ataque, autor: finalizador, jogador: quem(finalizador) });
    lances.push({ ...base, tipo: 'GOL', defensor: goleiro });
      depoisDoLance(lances[lances.length - 1]!);
  };

  /** T2: o Canto que o Jogador escolheu pelo site, ou um sorteado. */
  const cantoDe = (s: SlotRef): Canto => jogadorEm(s).canto ?? rngT2.pick(CANTOS);
  /** T2: o melhor em campo numa Habilidade (cobrador de falta), sem o goleiro. */
  const melhorEm = (lado: Lado, h: HabilidadeId, exceto?: SlotRef): SlotRef =>
    (['ZAG', 'MEI', 'ATA'] as const)
      .flatMap((p) => slotsDa(lado, p))
      .filter((x) => x.indice !== exceto?.indice)
      .reduce((a, b) => (hab(b, h) > hab(a, h) ? b : a));
  const marcarGol = (ataque: Lado, autor: SlotRef, assistente: SlotRef | null, goleiro: SlotRef): void => {
    const defesa = outro(ataque);
    gols[ataque]++;
    conta(autor).gols++;
    acao(autor, 'gol');
    if (assistente) {
      conta(assistente).assistencias++;
      acao(assistente, 'assistencia');
    }
    acao(goleiro, 'golSofridoGoleiro');
    for (const z of slotsDa(defesa, 'ZAG')) acao(z, 'golSofridoZagueiro');
    for (const x of [goleiro, ...slotsDa(defesa, 'ZAG')]) conta(x).golsSofridos++;
    golsEmOrdem.push({ lado: ataque, autor, jogador: quem(autor) });
  };
  const empurrar = (l: Lance): void => {
    lances.push(l);
    depoisDoLance(l);
  };

  /**
   * T2 (ADRs 0021 e 0024): a jogada parou numa falta. Pode haver cartão (dois amarelos na
   * Partida viram vermelho; vermelho direto no pênalti do último homem) e vem a cobrança.
   */
  const cometerFalta = (
    numero: number,
    minuto: number,
    ataque: Lado,
    criador: SlotRef,
    autor: SlotRef,
    local: LocalDaFalta,
    finalizador: SlotRef | undefined,
    ca: { contraAtaque?: NonNullable<Lance['contraAtaque']> },
  ): void => {
    faltasDe.set(chaveJ(autor), (faltasDe.get(chaveJ(autor)) ?? 0) + 1);
    acao(autor, 'cometeuFalta');
    let cartao: 'AMARELO' | 'VERMELHO' | undefined;
    let segundoAmarelo = false;
    if (local === 'AREA' && rngT2.chance(PARAMETROS_T2.chanceVermelhoNoPenalti * fatorCartao)) cartao = 'VERMELHO';
    else if (rngT2.chance((local === 'AREA' ? PARAMETROS_T2.chanceAmareloNoPenalti : PARAMETROS_T2.chanceAmarelo) * fatorCartao)) {
      const n = (amarelosDe.get(chaveJ(autor)) ?? 0) + 1;
      amarelosDe.set(chaveJ(autor), n);
      cartao = n >= 2 ? 'VERMELHO' : 'AMARELO';
      segundoAmarelo = n >= 2;
    }
    empurrar({
      numero,
      minuto,
      ataque,
      tipo: 'FALTA',
      criador,
      ...(finalizador ? { finalizador } : {}),
      defensor: autor,
      falta: { autor, local, ...(cartao ? { cartao } : {}), ...(segundoAmarelo ? { segundoAmarelo } : {}) },
      ...ca,
    });
    // O expulso sai antes da cobrança (não entra na barreira).
    if (cartao === 'VERMELHO') {
      expulsos.add(chave(autor));
      expulsosJ.add(chaveJ(autor));
      expulsoNoLance.set(chave(autor), lances.length - 1);
    }
    const min = Math.min(90, minuto + 1);
    const defesa = outro(ataque);
    const goleiro = slotsDa(defesa, 'GOL')[0]!;

    if (local === 'AREA') {
      const cobrador = melhorEm(ataque, 'FIN');
      const canto = { cobrador: cantoDe(cobrador), goleiro: cantoDe(goleiro) };
      const base = { numero, minuto: min, ataque, criador: cobrador, finalizador: cobrador, defensor: goleiro, bolaParada: 'PENALTI' as const, canto };
      if (rngT2.chance(chanceDePenaltiComCanto(hab(cobrador, 'FIN'), hab(goleiro, 'GOL'), canto.cobrador, canto.goleiro, mod(goleiro, 'contraPenalti')))) {
        marcarGol(ataque, cobrador, null, goleiro);
        empurrar({ ...base, tipo: 'GOL' });
        return;
      }
      acao(cobrador, 'penaltiPerdido');
      if (rngT2.chance(canto.cobrador === canto.goleiro ? PARAMETROS_T2.defendidoNoCanto : PARAMETROS_T2.defendidoForaDoCanto)) {
        conta(goleiro).defesas++;
        acao(goleiro, 'penaltiPego');
        empurrar({ ...base, tipo: 'DEFESA' });
      } else empurrar({ ...base, tipo: 'FORA' });
      return;
    }

    if (local === 'ENTRADA') {
      // Chute direto: primeiro a barreira, depois o goleiro.
      const cobrador = melhorEm(ataque, 'FIN');
      const barreira = zaga(defesa);
      const defBarreira = barreira.reduce((soma, x) => soma + hab(x, 'DEF'), 0) / barreira.length;
      const base = { numero, minuto: min, ataque, criador: cobrador, finalizador: cobrador, bolaParada: 'FALTA_DIRETA' as const, barreira };
      if (!duelo(rngT2, hab(cobrador, 'FIN'), defBarreira, PARAMETROS_T2.baseBarreira)) {
        const quem = rngT2.pick(barreira);
        conta(quem).bloqueios++;
        acao(quem, 'bloqueio');
        acao(cobrador, 'chuteBloqueado');
        empurrar({ ...base, tipo: 'BLOQUEIO', defensor: quem });
        return;
      }
      if (!duelo(rngT2, hab(cobrador, 'FIN'), hab(goleiro, 'GOL'), PARAMETROS_T2.baseFaltaDireta + mod(goleiro, 'contraChuteApertado'))) {
        conta(goleiro).defesas++;
        acao(goleiro, 'defesa');
        acao(cobrador, 'chuteDefendido');
        empurrar({ ...base, tipo: 'DEFESA', defensor: goleiro });
        return;
      }
      if (rngT2.chance(chanceDeFora(hab(cobrador, 'FIN')))) {
        acao(cobrador, 'chuteFora');
        empurrar({ ...base, tipo: 'FORA', defensor: goleiro });
        return;
      }
      marcarGol(ataque, cobrador, null, goleiro);
      empurrar({ ...base, tipo: 'GOL', defensor: goleiro });
      return;
    }

    // Longe: jogada ensaiada, cruzamento para cabeçada ou toque curto para chute de longe.
    const cobrador = melhorEm(ataque, 'PAS');
    if (rngT2.chance(PARAMETROS_T2.chanceCruzada)) {
      const cabeceador = melhorEm(ataque, 'FIN', cobrador);
      const zagueiro = rngT2.pick(zaga(defesa));
      const base = { numero, minuto: min, ataque, criador: cobrador, finalizador: cabeceador, marcador: zagueiro, bolaParada: 'FALTA_CRUZADA' as const };
      if (!duelo(rngT2, hab(cobrador, 'PAS'), hab(zagueiro, 'DEF'), PARAMETROS_T2.baseCruzamentoFalta)) {
        conta(zagueiro).desarmes++;
        acao(zagueiro, 'desarme');
        acao(cobrador, 'desarmadoNaCriacao');
        empurrar({ ...base, tipo: 'DESARME', defensor: zagueiro });
        return;
      }
      acao(zagueiro, 'superadoNaCriacao');
      if (!duelo(rngT2, hab(cabeceador, 'FIN'), hab(goleiro, 'GOL'), PARAMETROS_T2.baseCabeceioFalta + mod(goleiro, 'contraChuteApertado'))) {
        conta(goleiro).defesas++;
        acao(goleiro, 'defesa');
        acao(cabeceador, 'chuteDefendido');
        empurrar({ ...base, tipo: 'DEFESA', defensor: goleiro });
        return;
      }
      if (rngT2.chance(chanceDeFora(hab(cabeceador, 'FIN')))) {
        acao(cabeceador, 'chuteFora');
        empurrar({ ...base, tipo: 'FORA', defensor: goleiro });
        return;
      }
      marcarGol(ataque, cabeceador, cobrador, goleiro);
      empurrar({ ...base, tipo: 'GOL', defensor: goleiro });
      return;
    }
    const chutador = melhorEm(ataque, 'FIN', cobrador);
    const base = { numero, minuto: min, ataque, criador: cobrador, finalizador: chutador, bolaParada: 'FALTA_CURTA' as const };
    if (!duelo(rngT2, hab(chutador, 'FIN'), hab(goleiro, 'GOL'), PARAMETROS_T2.baseChuteDeLonge + mod(goleiro, 'contraChuteApertado'))) {
      conta(goleiro).defesas++;
      acao(goleiro, 'defesa');
      acao(chutador, 'chuteDefendido');
      empurrar({ ...base, tipo: 'DEFESA', defensor: goleiro });
      return;
    }
    if (rngT2.chance(chanceDeFora(hab(chutador, 'FIN')))) {
      acao(chutador, 'chuteFora');
      empurrar({ ...base, tipo: 'FORA', defensor: goleiro });
      return;
    }
    marcarGol(ataque, chutador, cobrador, goleiro);
    empurrar({ ...base, tipo: 'GOL', defensor: goleiro });
  };

  /** T3: Trave em parte dos chutes para fora (sorteio próprio; não muda o placar). */
  const naTrave = (): Pick<Lance, 'trave'> => (t3 && rngT3.chance(PARAMETROS_T3.chanceTrave) ? { trave: true } : {});

  /**
   * T3: depois de uma defesa do goleiro em jogada, às vezes ele solta a bola (Rebote); senão, o
   * escanteio de sempre.
   */
  const depoisDaDefesa = (numero: number, minuto: number, ataque: Lado, goleiro: SlotRef): void => {
    if (t3 && rngT3.chance(PARAMETROS_T3.chanceRebote)) rebote(numero, minuto, ataque, lances[lances.length - 1]!.finalizador!, goleiro);
    else talvezEscanteio(numero, minuto, ataque);
  };

  /**
   * T3 (ADR-0094): Rebote. Um atacante (Finalização) disputa a sobra com um zagueiro (Defesa);
   * se ganha, chuta de novo contra o goleiro. Gol de rebote não tem assistência.
   */
  const rebote = (numero: number, minuto: number, ataque: Lado, chutou: SlotRef, goleiro: SlotRef): void => {
    const defesa = outro(ataque);
    const atacante = rngT3.pick(frente(ataque));
    const zagueiro = rngT3.pick(zaga(defesa));
    const base = { numero, minuto, ataque, criador: chutou, finalizador: atacante, marcador: zagueiro, rebote: true as const };
    if (!duelo(rngT3, hab(atacante, 'FIN'), hab(zagueiro, 'DEF'), PARAMETROS_T3.baseDisputaRebote)) {
      conta(zagueiro).desarmes++;
      acao(zagueiro, 'desarme');
      empurrar({ ...base, tipo: 'DESARME', defensor: zagueiro });
      return;
    }
    if (!duelo(rngT3, hab(atacante, 'FIN'), hab(goleiro, 'GOL'), PARAMETROS_T3.baseChuteRebote + mod(goleiro, 'contraChuteApertado'))) {
      conta(goleiro).defesas++;
      acao(goleiro, 'defesa');
      acao(atacante, 'chuteDefendido');
      empurrar({ ...base, tipo: 'DEFESA', defensor: goleiro });
      talvezEscanteio(numero, minuto, ataque);
      return;
    }
    if (rngT3.chance(chanceDeFora(hab(atacante, 'FIN')))) {
      acao(atacante, 'chuteFora');
      empurrar({ ...base, tipo: 'FORA', defensor: goleiro, ...naTrave() });
      return;
    }
    marcarGol(ataque, atacante, null, goleiro);
    empurrar({ ...base, tipo: 'GOL', defensor: goleiro });
  };

  /**
   * T3 (ADR-0094): Chute de longe. Quem criou arrisca de fora da área (ou toca para um zagueiro
   * que subiu), sem Duelo com o marcador: Finalização contra o goleiro. Entrou com pouca chance
   * de passar do goleiro, é Gol de placa.
   */
  const chutarDeLonge = (numero: number, minuto: number, ataque: Lado, criador: SlotRef, extra: Partial<Lance>): void => {
    const defesa = outro(ataque);
    const zagueiroChuta = rngT3.chance(PARAMETROS_T3.chanceZagueiroArrisca);
    const chutador = zagueiroChuta ? rngT3.pick(zaga(ataque)) : criador;
    const goleiro = slotsDa(defesa, 'GOL')[0]!;
    const base = { numero, minuto, ataque, criador, finalizador: chutador, defensor: goleiro, chuteDeLonge: true as const, ...extra };
    const p = probabilidadeDuelo(hab(chutador, 'FIN'), hab(goleiro, 'GOL'), PARAMETROS_T3.baseChuteDeLonge + mod(goleiro, 'contraChuteApertado'));
    if (!rngT3.chance(p)) {
      conta(goleiro).defesas++;
      acao(goleiro, 'defesa');
      acao(chutador, 'chuteDefendido');
      empurrar({ ...base, tipo: 'DEFESA' });
      depoisDaDefesa(numero, minuto, ataque, goleiro);
      return;
    }
    if (rngT3.chance(chanceDeFora(hab(chutador, 'FIN')) + PARAMETROS_T3.foraNoChuteDeLonge)) {
      acao(chutador, 'chuteFora');
      empurrar({ ...base, tipo: 'FORA', ...naTrave() });
      return;
    }
    marcarGol(ataque, chutador, zagueiroChuta ? criador : null, goleiro);
    empurrar({ ...base, tipo: 'GOL', ...(p <= PARAMETROS_T3.placaAte ? { golDePlaca: true as const } : {}) });
  };

  /** T3: quem está na Pressão final neste minuto (perde por 1 ou 2; no Mata-mata, também o empate). */
  const quemPressiona = (minuto: number): ReadonlySet<Lado> => {
    if (!t3 || minuto <= PARAMETROS_T3.pressaoDesde) return new Set();
    const s = new Set<Lado>();
    for (const lado of LADOS) {
      const deficit = gols[outro(lado)] - gols[lado];
      if ((deficit >= 1 && deficit <= PARAMETROS_T3.pressaoDeficitMaximo) || (deficit === 0 && entrada.fase === 'MATA_MATA')) s.add(lado);
    }
    return s;
  };

  /**
   * Substituição no intervalo (ADR-0061): em cada Time com Banco, sai quem está com Nota parcial
   * abaixo de `notaParaSair` (piores primeiro, até `trocasPorTime`), sem o lugar de um expulso.
   * Entra o primeiro reserva da mesma Posição. Sem ele: o goleiro só sai para outro goleiro (fica
   * em campo); um de linha pode ser trocado pelo primeiro reserva de linha de outra Posição, fora
   * de posição. Não usa sorteio: a Partida sem troca sai igual.
   */
  const substituicoes: Substituicao[] = [];
  /** Lances de ataque (dos 20 de referência) que cada Jogador jogou, para a Nota de quem trocou. */
  const lancesEmCampo = new Map<string, number>();
  const substituir = (minuto: number, lancesJogados: number): void => {
    for (const lado of LADOS) {
      const banco = elenco[lado].slice(titulares(lado));
      if (!banco.length) continue;
      const saldo = gols[lado] - gols[outro(lado)];
      const resultado = saldo > 0 ? 'vitoria' : saldo < 0 ? 'derrota' : 'empate';
      const candidatos = escalacoes[lado].jogadores
        .flatMap((vaga, lugar) => {
          if (expulsos.has(`${lado}:${lugar}`)) return [];
          const idx = ocupante[lado][lugar]!;
          const ovr = ovrDasHabilidades(vaga.posicao, elenco[lado][idx]!.habilidades);
          const nota = notaDaPartida({ posicao: vaga.posicao, ...contadores[lado][idx]!, resultado }, ovr, lancesJogados / PARAMETROS.lances);
          return nota < PARAMETROS_T2.notaParaSair ? [{ lugar, nota }] : [];
        })
        .sort((a, b) => a.nota - b.nota || a.lugar - b.lugar);
      const livres = banco.map((_, i) => i);
      let feitas = 0;
      for (const { lugar, nota } of candidatos) {
        if (feitas >= PARAMETROS_T2.trocasPorTime) break;
        const vaga = escalacoes[lado].jogadores[lugar]!.posicao;
        const mesma = livres.findIndex((i) => banco[i]!.posicao === vaga);
        // Goleiro só por goleiro; linha por linha (a mesma Posição primeiro).
        const k = mesma >= 0 ? mesma : vaga === 'GOL' ? -1 : livres.findIndex((i) => banco[i]!.posicao !== 'GOL');
        if (k < 0) continue;
        feitas++;
        const b = livres.splice(k, 1)[0]!;
        const saiu = elenco[lado][ocupante[lado][lugar]!]!;
        lancesEmCampo.set(`${lado}:${ocupante[lado][lugar]!}`, lancesJogados);
        ocupante[lado][lugar] = titulares(lado) + b;
        lancesEmCampo.set(`${lado}:${titulares(lado) + b}`, -lancesJogados);
        substituicoes.push({
          lado,
          lugar,
          banco: b,
          saiu: saiu.jogadorId,
          entrou: banco[b]!.jogadorId,
          notaNoIntervalo: nota,
          antesDoLance: lances.length,
          minuto,
          ...(banco[b]!.posicao !== vaga ? { foraDePosicao: true as const } : {}),
        });
      }
    }
  };
  let intervaloFeito = !(elenco.mandante.length > titulares('mandante') || elenco.visitante.length > titulares('visitante'));

  // Ritmo (VERSAO_SIM 5): quantos lances de ataque a Partida tem, com sorteio próprio.
  const totalDeLances = t2
    ? Math.min(
        PARAMETROS.ritmoMaximo,
        Math.max(PARAMETROS.ritmoMinimo, ritmoDaPartida(entrada.seed) + PARAMETROS_T2.posturaRitmo[posturaDe('mandante')] + PARAMETROS_T2.posturaRitmo[posturaDe('visitante')]),
      )
    : ritmoDaPartida(entrada.seed);
  // Acréscimos (T3, ADR-0094): de 1 a 4 minutos (sorteio próprio). Um dos lances do Ritmo a
  // cada 2 minutos passa para os Acréscimos: a Partida tem o mesmo número de lances de sempre.
  const acrescimos = t3 ? 1 + rngT3.int(PARAMETROS_T3.acrescimosMaximo) : 0;
  const lancesNosAcrescimos = Math.min(Math.round(acrescimos / 2), totalDeLances - 1);
  const lancesNoTempo = totalDeLances - lancesNosAcrescimos;

  const jogarLance = (numero: number, minuto: number): void => {
      // 1. Posse: o meia com a bola (Passe) contra o meia rival (Defesa). Depois de gol, quem
      // sofreu dá a saída (VERSAO_SIM 12/13, ADR-0045), mas ainda pode perder a bola no duelo.
      // O sorteio de antes continua sendo feito, para o resto da Partida não mudar.
      const sorteado: Lado = rng.chance(0.5) ? 'mandante' : 'visitante';
      const ultimo = lances[lances.length - 1];
      const comBola: Lado = ultimo?.tipo === 'GOL' ? outro(ultimo.ataque) : sorteado;
      const meiaComBola = rng.pick(meio(comBola));
      const meiaRival = rng.pick(meio(outro(comBola)));
      let criador: SlotRef;
      const basePosse = ultimo?.tipo === 'GOL' ? PARAMETROS.basePosseNaSaida : PARAMETROS.basePosse;
      const ajustePosse = t2 ? PARAMETROS_T2.formacaoPosse[formacaoDe(comBola)] - PARAMETROS_T2.formacaoPosse[formacaoDe(outro(comBola))] : 0;
      // Pressão final (T3): quem se lança fica mais com a bola (metade, na Postura Defensiva).
      const empurrao = (lado: Lado) => (pressionando.has(lado) && !pressionando.has(outro(lado)) ? PARAMETROS_T3.pressaoPosse * (posturaDe(lado) === 'DEFENSIVA' ? 0.5 : 1) : 0);
      const ajustePressao = empurrao(comBola) - empurrao(outro(comBola));
      if (duelo(rng, hab(meiaComBola, 'PAS'), hab(meiaRival, 'DEF'), basePosse + mod(meiaRival, 'defesaPosse') + ajustePosse + ajustePressao)) {
        criador = meiaComBola;
        acao(meiaComBola, 'ganhouPosse');
        acao(meiaRival, 'superadoNaPosse');
      } else {
        criador = meiaRival;
        acao(meiaRival, 'roubouPosse');
        acao(meiaComBola, 'perdeuPosse');
      }
      const ataque = criador.lado;
      const defesa = outro(ataque);
      // 3 zagueiros (ADR-0044): um fica na sobra (a Cobertura do 3-2-1); os outros dois jogam como antes.
      const zagaInteira = zaga(defesa);
      const sobra = zagaInteira.length > 2 ? rngF.pick(zagaInteira) : undefined;
      const [zagueiro1, zagueiro2] = embaralharDois(rng, sobra ? zagaInteira.filter((z) => z.indice !== sobra.indice) : zagaInteira);

      // Contra-ataque: quem acabou de recuperar a bola sai rápido; a defesa rival recompõe?
      let contraAtaque: Lance['contraAtaque'];
      const r0 = recuperou as { lado: Lado; adiantados: number } | null;
      if (r0 && r0.lado === ataque && rngCA.chance(PARAMETROS.chanceContraAtaque + PARAMETROS.chanceContraPorAdiantado * (r0.adiantados - 3) + (pressionando.has(defesa) ? PARAMETROS_T3.pressaoContra : 0))) {
        const recomposto = duelo(rngCA, hab(zagueiro1, 'DEF'), hab(criador, 'DRI'), PARAMETROS.baseRecomposicao - PARAMETROS.recomposicaoPorAdiantado * (r0.adiantados - 3));
        contraAtaque = { recomposto, adiantados: r0.adiantados };
      }
      const semZagueiro1 = contraAtaque !== undefined && !contraAtaque.recomposto;
      const semMarcador = semZagueiro1 && contraAtaque!.adiantados >= PARAMETROS.adiantadosSemMarcador;
      const ca = contraAtaque ? { contraAtaque } : {};
      const fechar = (l: Lance) => {
        lances.push(l);
        depoisDoLance(l);
      };

      // Jogada da Formação na criação (ADR-0044): Ligação direta (3-1-2, fora do contra-ataque) ou
      // Tabela (2-3-1). Os sorteios são do rngF; a criação continua com o mesmo sorteio de sempre.
      let jogada: Pick<Lance, 'jogadaDaFormacao' | 'apoio' | 'cobertura'> = {};
      let bonusCriacao = 0;
      let baseCriacao: number = PARAMETROS.baseCriacao;
      if (jogaNa(ataque, '3-1-2') && !contraAtaque && rngF.chance(PARAMETROS_T2.chanceLigacao)) {
        // O zagueiro lança: ele vira o criador (e leva a assistência), e o lançamento é mais difícil.
        criador = rngF.pick(zaga(ataque));
        baseCriacao = PARAMETROS_T2.baseLigacao;
        jogada = { jogadaDaFormacao: 'LIGACAO_DIRETA' };
      } else if (jogaNa(ataque, '2-3-1')) {
        const parceiros = meio(ataque).filter((m) => m.indice !== criador.indice);
        if (parceiros.length && rngF.chance(PARAMETROS_T2.chanceTabela)) {
          jogada = { jogadaDaFormacao: 'TABELA', apoio: rngF.pick(parceiros) };
          bonusCriacao = PARAMETROS_T2.bonusTabela;
        }
      }
      const ligacao = jogada.jogadaDaFormacao === 'LIGACAO_DIRETA';

      // 2. Criação: meia (Passe) contra o 1º zagueiro (Defesa). No contra-ataque sem
      //    recomposição o zagueiro ficou para trás (o sorteio acontece igual, para não mexer no resto).
      const criou = duelo(rng, hab(criador, 'PAS'), hab(zagueiro1, 'DEF'), baseCriacao + bonusCriacao + ajustePostura(ataque) + ajusteVantagem(ataque) + mod(criador, 'criacao') + mod(zagueiro1, 'contraCriacao'));
      if (!criou && !semZagueiro1) {
        // T2: às vezes o desarme é falta (ADR-0024). Lançamento interceptado não é falta.
        if (t2 && !ligacao && rngT2.chance(PARAMETROS_T2.chanceFaltaNaCriacao * fatorFalta)) {
          cometerFalta(numero, minuto, ataque, criador, zagueiro1, rngT2.chance(PARAMETROS_T2.criacaoNaEntrada) ? 'ENTRADA' : 'LONGE', undefined, ca);
          return;
        }
        conta(zagueiro1).desarmes++;
        acao(zagueiro1, 'desarme');
        acao(criador, 'desarmadoNaCriacao');
        fechar({ numero, minuto, ataque, tipo: 'DESARME', criador, defensor: zagueiro1, ...ca, ...jogada });
        return;
      }
      if (!semZagueiro1) acao(zagueiro1, 'superadoNaCriacao');

      // T3 (ADR-0094): Chute de longe. Quem criou arrisca de fora da área, mais com Finalização
      // alta e Postura Ofensiva. Não na Ligação direta nem no contra-ataque sem zagueiro.
      if (t3 && !ligacao && !semZagueiro1) {
        const { chanceChuteDeLonge, chuteDeLongePorPonto, chuteDeLongeMinimo, chuteDeLongeMaximo, chuteDeLongePostura } = PARAMETROS_T3;
        const chance = chanceChuteDeLonge + chuteDeLongePostura[posturaDe(ataque)] + (hab(criador, 'FIN') - 60) * chuteDeLongePorPonto;
        if (rngT3.chance(Math.min(chuteDeLongeMaximo, Math.max(chuteDeLongeMinimo, chance)))) {
          chutarDeLonge(numero, minuto, ataque, criador, { ...ca, ...jogada });
          return;
        }
      }

      // 3. Atacante × zagueiro: drible ou chute marcado.
      //    Na Ligação direta a bola vai direto para os atacantes (nenhum meia finaliza).
      const outrosMeias = ligacao ? [] : slotsDa(ataque, 'MEI').filter((s) => s.indice !== criador.indice);
      const chanceMeia =
        PARAMETROS.chanceMeiaFinaliza +
        (t2 ? Math.max(0, ...outrosMeias.map((m) => mod(m, 'chanceMeiaFinaliza'))) : 0) +
        (jogaNa(ataque, '2-3-1') ? PARAMETROS_T2.meiaFinalizaNoTresMeias : 0);
      let finalizador =
        outrosMeias.length > 0 && rng.chance(chanceMeia)
          ? rng.pick(outrosMeias)
          : t2
            ? escolherComPeso(rng, frente(ataque), (s) => mod(s, 'pesoFinalizador') || 1)
            : rng.pick(slotsDa(ataque, 'ATA'));
      const bonusMarcador = ligacao ? PARAMETROS_T2.bonusLigacao : 0;
      const marcador = zagueiro2;
      const goleiro = rng.pick(slotsDa(defesa, 'GOL'));
      const drible = rng.chance(limitar01(chanceDeDriblar(hab(finalizador, 'DRI'), hab(finalizador, 'FIN')) + mod(finalizador, 'escolhaDrible')));

      let baseChute: number;
      // Marcação dupla (VERSAO_SIM 12/13, ADR-0045): às vezes o 1º zagueiro volta e dobra a
      // marcação no finalizador. O duelo fica mais difícil (vale a melhor Defesa dos dois), mas
      // um companheiro fica livre: se o finalizador acha o passe, quem chuta é ele, sem marcador.
      // Sorteio próprio, para o resto da Partida não mudar quando não há dobra.
      const podeDobrar = !semZagueiro1 && !semMarcador && zagueiro1.indice !== zagueiro2.indice && !expulsos.has(chave(zagueiro1));
      const dobrou = podeDobrar && rngDobra.chance(PARAMETROS.chanceMarcacaoDupla);
      const naDobra = dobrou && hab(zagueiro1, 'DEF') > hab(zagueiro2, 'DEF') ? zagueiro1 : marcador;
      const ajusteDobra = dobrou ? -PARAMETROS.penalidadeMarcacaoDupla : 0;
      // Sem marcador (escanteio desfeito em contra-ataque): o duelo é sorteado, mas não vale.
      let venceuMarcador = drible
        ? duelo(rng, hab(finalizador, 'DRI'), hab(naDobra, 'DEF'), PARAMETROS.baseDrible + bonusMarcador + ajusteDobra + ajustePostura(ataque) + ajusteVantagem(ataque) + mod(finalizador, 'drible') + mod(naDobra, 'contraDrible'))
        : duelo(rng, hab(finalizador, 'FIN'), hab(naDobra, 'DEF'), PARAMETROS.baseChuteMarcado + bonusMarcador + ajusteDobra + ajustePostura(ataque) + ajusteVantagem(ataque) + mod(finalizador, 'chuteMarcado') + mod(naDobra, 'contraChuteMarcado'));
      let dobra: Lance['dobra'];
      let assistente = criador;
      if (dobrou) {
        const livres = [...slotsDa(ataque, 'ATA'), ...slotsDa(ataque, 'MEI')].filter((x) => x.indice !== finalizador.indice && x.indice !== criador.indice && !expulsos.has(chave(x)));
        const saiu = livres.length > 0 && duelo(rngDobra, hab(finalizador, 'PAS'), hab(naDobra, 'DEF'), PARAMETROS.baseSaidaDaDobra);
        dobra = { zagueiro: zagueiro1, sobre: finalizador };
        if (saiu) {
          // Tocou para quem ficou livre: o duelo com a zaga não acontece e o chute sai livre.
          const companheiro = rngDobra.pick(livres.filter((x) => posicaoDe(x) === 'ATA').length ? livres.filter((x) => posicaoDe(x) === 'ATA') : livres);
          dobra.passe = true;
          assistente = finalizador;
          finalizador = companheiro;
          venceuMarcador = true;
        }
      }
      /** Quem duelou com o finalizador: o marcador, ou o melhor da dobra. */
      const Z = naDobra;
      const comDobra = dobra ? { dobra } : {};
      let livre = true;
      if (semMarcador || dobra?.passe) {
        baseChute = PARAMETROS.baseChuteLivre;
      } else if (drible) {
        if (!venceuMarcador) {
          // T2: o desarme no drible pode ser falta, dentro da área (pênalti) ou na entrada dela.
          if (t2 && rngT2.chance(PARAMETROS_T2.chanceFaltaNoDrible * fatorFalta)) {
            cometerFalta(numero, minuto, ataque, criador, Z, rngT2.chance(PARAMETROS_T2.dribleNaArea) ? 'AREA' : 'ENTRADA', finalizador, ca);
            return;
          }
          conta(Z).desarmes++;
          acao(Z, 'desarme');
          acao(finalizador, 'desarmadoNoDrible');
          fechar({ numero, minuto, ataque, tipo: 'DESARME', criador, finalizador, defensor: Z, marcador: Z, drible: true, ...comDobra, ...ca, ...jogada });
          return;
        }
        conta(finalizador).dribles++;
        acao(finalizador, 'driblou');
        acao(Z, 'foiDriblado');
        baseChute = PARAMETROS.baseChuteLivre;
        // Cobertura (3-2-1, ADR-0044): o zagueiro da sobra chega para mais um Duelo com o driblador.
        if (sobra && jogaNa(defesa, '3-2-1') && rngF.chance(PARAMETROS_T2.chanceCobertura)) {
          // A Jogada do ataque (Tabela ou Ligação) continua no nome; `cobertura` marca a sobra.
          jogada = { jogadaDaFormacao: jogada.jogadaDaFormacao ?? 'COBERTURA', ...jogada, cobertura: sobra };
          const desarmou = !duelo(rngF, hab(finalizador, 'DRI'), hab(sobra, 'DEF'), PARAMETROS_T2.baseCobertura + mod(finalizador, 'drible') + mod(sobra, 'contraDrible'));
          if (desarmou) {
            conta(sobra).desarmes++;
            acao(sobra, 'desarme');
            acao(finalizador, 'desarmadoNoDrible');
            fechar({ numero, minuto, ataque, tipo: 'DESARME', criador, finalizador, defensor: sobra, marcador, drible: true, ...ca, ...jogada });
            return;
          }
          acao(sobra, 'foiDriblado');
        }
      } else {
        if (!venceuMarcador) {
          conta(Z).bloqueios++;
          acao(Z, 'bloqueio');
          acao(finalizador, 'chuteBloqueado');
          fechar({ numero, minuto, ataque, tipo: 'BLOQUEIO', criador, finalizador, defensor: Z, marcador: Z, drible: false, ...comDobra, ...ca, ...jogada });
          talvezEscanteio(numero, minuto, ataque);
          return;
        }
        acao(finalizador, 'venceuChuteMarcado');
        baseChute = PARAMETROS.baseChuteApertado;
        livre = false;
      }
      baseChute += mod(finalizador, 'finalizacao') + mod(goleiro, livre ? 'contraChuteLivre' : 'contraChuteApertado');

      // 4. Finalização (Finalização) contra o goleiro (Goleiro).
      const base = { numero, minuto, ataque, criador, finalizador, defensor: goleiro, ...(semMarcador || dobra?.passe ? {} : { marcador: naDobra, drible }), ...(dobra ? { dobra } : {}), ...ca, ...jogada };
      if (!duelo(rng, hab(finalizador, 'FIN'), hab(goleiro, 'GOL'), baseChute)) {
        conta(goleiro).defesas++;
        acao(goleiro, 'defesa');
        acao(finalizador, 'chuteDefendido');
        fechar({ ...base, tipo: 'DEFESA' });
        depoisDaDefesa(numero, minuto, ataque, goleiro);
        return;
      }
      if (rng.chance(chanceDeFora(hab(finalizador, 'FIN')) + mod(finalizador, 'fora'))) {
        acao(finalizador, 'chuteFora');
        fechar({ ...base, tipo: 'FORA', ...naTrave() });
        return;
      }

      gols[ataque]++;
      conta(finalizador).gols++;
      conta(assistente).assistencias++;
      acao(finalizador, 'gol');
      acao(assistente, 'assistencia');
      acao(goleiro, 'golSofridoGoleiro');
      for (const z of slotsDa(defesa, 'ZAG')) acao(z, 'golSofridoZagueiro');
      for (const s of [goleiro, ...slotsDa(defesa, 'ZAG')]) conta(s).golsSofridos++;
      golsEmOrdem.push({ lado: ataque, autor: finalizador, jogador: quem(finalizador) });
      // T3: Gol de placa. Driblou o marcador e ainda passou da Cobertura, ou passou driblando pela
      // marcação dupla (nem toda vira pintura: `placaNaDobra`).
      const placa =
        t3 !== undefined && drible && !semMarcador && !dobra?.passe && (jogada.cobertura !== undefined || (dobra !== undefined && rngT3.chance(PARAMETROS_T3.placaNaDobra)));
      fechar({ ...base, tipo: 'GOL', ...(placa ? { golDePlaca: true as const } : {}) });
  };

  for (let numero = 1; numero <= totalDeLances; numero++) {
    const noAcrescimo = numero > lancesNoTempo;
    let minuto = 90;
    if (!noAcrescimo) {
      // Cada lance cai em algum ponto da sua fatia dos 90 minutos, então o último pode sair até
      // o 90' (ADR-0045; antes os lances paravam entre o 76' e o 88'). Mesmo sorteio de antes.
      const posicaoNaFatia = (rng.int(3) + 0.5) / 3;
      minuto = Math.min(90, Math.floor(((numero - 1 + posicaoNaFatia) * 90) / lancesNoTempo) + 1);
    }
    // Intervalo (ADR-0061): antes do primeiro lance do 2º tempo.
    if (!intervaloFeito && minuto > 45) {
      intervaloFeito = true;
      substituir(45, numero - 1);
    }
    pressionando = quemPressiona(minuto);
    const antes = lances.length;
    jogarLance(numero, minuto);
    // Marca os lances que acabaram de sair: Pressão final e minuto dos Acréscimos (90+n).
    const acrescimo = noAcrescimo ? Math.min(acrescimos, Math.ceil(((numero - lancesNoTempo) * acrescimos) / lancesNosAcrescimos)) : 0;
    for (const l of lances.slice(antes)) {
      if (pressionando.has(l.ataque)) l.pressao = true;
      if (acrescimo) l.acrescimo = acrescimo;
    }
  }

  // Numeração final (com os escanteios no meio) e laterais: alguns lances começam com a
  // cobrança de um lateral (nunca o primeiro, nem depois de gol ou logo depois de escanteio).
  lances.forEach((l, i) => {
    l.numero = i + 1;
    const antes = lances[i - 1];
    if (!antes || antes.tipo === 'GOL' || antes.tipo === 'FALTA' || l.bolaParada || l.contraAtaque || l.rebote || lances[i + 1]?.bolaParada === 'ESCANTEIO' || antes.bolaParada === 'ESCANTEIO') return;
    if (!rngBP.chance(PARAMETROS.chanceLateral)) return;
    const jaSaiu = (indice: number) => (expulsoNoLance.get(`${l.criador.lado}:${indice}`) ?? Infinity) < i;
    const companheiros = escalacoes[l.criador.lado].jogadores.flatMap((j, indice) => ((j.posicao === 'MEI' || j.posicao === 'ZAG') && indice !== l.criador.indice && !jaSaiu(indice) ? [{ lado: l.criador.lado, indice }] : []));
    if (!companheiros.length) return;
    l.bolaParada = 'LATERAL';
    l.cobrador = rngBP.pick(companheiros);
  });

  for (const lado of LADOS) {
    for (const g of slotsDa(lado, 'GOL')) if (conta(g).golsSofridos === 0) acao(g, 'semSofrerGol');
  }

  /**
   * Batedores (T3, ADR-0091): os escolhidos pelo Capitão que estão em campo no fim, em ordem.
   * Quem foi expulso é pulado; depois deles, a ordem automática.
   */
  const batedoresEscolhidos = (lado: Lado): SlotRef[] => {
    const ids = t3?.batedores?.[lado] ?? [];
    const emCampo = escalacoes[lado].jogadores.map((_, indice): SlotRef => ({ lado, indice })).filter((x) => !expulsos.has(chave(x)));
    const usados = new Set<number>();
    return ids.slice(0, QUANTIDADE_DE_BATEDORES).flatMap((id) => {
      const x = emCampo.find((y) => jogadorEm(y).jogadorId === id && !usados.has(y.indice));
      if (!x) return [];
      usados.add(x.indice);
      return [x];
    });
  };

  // Desempate: no Mata-mata, empate vai para os pênaltis.
  let vencedor: Lado | null = gols.mandante > gols.visitante ? 'mandante' : gols.visitante > gols.mandante ? 'visitante' : null;
  let penaltis: ResultadoPartida['penaltis'];
  let decisivoPenalti: SlotRef | null = null;

  if (vencedor === null && entrada.fase === 'MATA_MATA') {
    const disputa = t2 ? disputarPenaltisT2(rng, rngT2, slotsDa, hab, cantoDe, mod, batedoresEscolhidos) : disputarPenaltis(rng, slotsDa, hab);
    penaltis = { placar: disputa.placar, cobrancas: disputa.cobrancas };
    vencedor = disputa.vencedor;
    decisivoPenalti = disputa.decisivo;
    for (const c of disputa.cobrancas) {
      if (c.convertida) acao(c.cobrador, 'penaltiConvertido');
      else {
        acao(c.cobrador, 'penaltiPerdido');
        if (c.defendida) acao(c.goleiro, 'penaltiPego');
      }
    }
  }

  const resultadoDe = (lado: Lado): 'vitoria' | 'empate' | 'derrota' =>
    vencedor === null || penaltis ? 'empate' : vencedor === lado ? 'vitoria' : 'derrota';

  /** O lugar em campo de cada Jogador que jogou (o reserva fica com o lugar de quem saiu). */
  const lugarDe = (lado: Lado, idx: number): number | null => {
    if (idx < titulares(lado)) return idx;
    const troca = substituicoes.find((x) => x.lado === lado && titulares(lado) + x.banco === idx);
    return troca ? troca.lugar : null;
  };
  const desempenhos: Desempenho[] = LADOS.flatMap((lado) =>
    elenco[lado].flatMap((jogador, indice): Desempenho[] => {
      const lugar = lugarDe(lado, indice);
      // Reserva que não entrou não tem desempenho.
      if (lugar === null) return [];
      const c = contadores[lado][indice]!;
      const antes: Habilidades = { ...jogador.habilidades };
      const daBase = jogador.jogadorId === null;
      const treino = t2 && jogador.treino ? { hab: jogador.treino, multiplicador: PARAMETROS_T2.multiplicadorTreino } : undefined;
      // Ganho maior da T2 (ADR-0056), Resenha (ADR-0034) e Bônus da Temporada 1 (ADR-0047) somam.
      const ganhos = (t2 ? PARAMETROS_T2.multiplicadorGanho : 1) + (jogador.resenha ? PARAMETROS.multiplicadorResenha - 1 : 0) + (t2 && jogador.bonusT1 ? PARAMETROS_T2.multiplicadorBonusT1 - 1 : 0);
      const { depois, delta } = daBase ? { depois: antes, delta: zeradas() } : evoluir(antes, t2 ? protegerPerdas(pontos[lado][indice]!, protecao[lado][indice]!, escalacoes[lado].jogadores[lugar]!.posicao) : pontos[lado][indice]!, classico, treino, ganhos, t2 ? PARAMETROS_T2.referenciaGanho : undefined);
      // A vaga do lugar: o reserva fora de posição joga com o OVR da vaga (como na Formação).
      const posicao = escalacoes[lado].jogadores[lugar]!.posicao;
      const ovrAntes = ovrDasHabilidades(posicao, antes);
      const ovrDepois = ovrDasHabilidades(posicao, depois);
      // Quem trocou no intervalo tem a Nota pela parte do jogo em que esteve em campo.
      const naTroca = lancesEmCampo.get(`${lado}:${indice}`);
      const jogados = naTroca === undefined ? totalDeLances : naTroca >= 0 ? naTroca : totalDeLances + naTroca;
      const substituicao = naTroca === undefined ? undefined : naTroca >= 0 ? ('SAIU' as const) : ('ENTROU' as const);
      return [
        {
          slot: { lado, indice: lugar },
          jogadorId: jogador.jogadorId,
          posicao,
          ...(posicao !== jogador.posicao && indice >= titulares(lado) ? { posicaoDeOrigem: jogador.posicao } : {}),
          ...(substituicao ? { substituicao } : {}),
          ...c,
          nota: notaDaPartida({ posicao, ...c, resultado: resultadoDe(lado) }, ovrAntes, jogados / PARAMETROS.lances),
          ovrAntes,
          deltaOvr: ovrDepois - ovrAntes,
          ovrDepois,
          habilidadesAntes: antes,
          habilidadesDepois: depois,
          deltaHabilidades: delta,
          ...(t2
            ? {
                faltas: faltasDe.get(`${lado}:${indice}`) ?? 0,
                amarelos: amarelosDe.get(`${lado}:${indice}`) ?? 0,
                expulso: expulsosJ.has(`${lado}:${indice}`),
              }
            : {}),
        },
      ];
    }),
  );

  /** Quem decidiu (gol da vitória ou pênalti decisivo), pelo Jogador que estava no lugar. */
  const jogadorDecisivo = (): string | null => {
    if (decisivoPenalti) return jogadorEm(decisivoPenalti).jogadorId;
    if (vencedor === null || gols.mandante === gols.visitante) return null;
    const g = golsEmOrdem.filter((x) => x.lado === vencedor)[gols[outro(vencedor)]];
    return g ? elenco[g.lado][g.jogador ?? g.autor.indice]!.jogadorId : null;
  };

  return {
    versaoSim: t3 ? VERSAO_SIM_T3 : t2 ? VERSAO_SIM : VERSAO_SIM_T1,
    seed: entrada.seed,
    times: { mandante: entrada.mandante.time, visitante: entrada.visitante.time },
    classico,
    gols,
    ...(penaltis ? { penaltis } : {}),
    vencedor,
    lances,
    desempenhos,
    decisivo: decisivoPenalti ?? golDaVitoria(golsEmOrdem, vencedor, gols),
    // Com Substituição, o lugar não basta para saber quem decidiu: vai o Jogador (ADR-0061).
    ...(substituicoes.length ? { decisivoJogadorId: jogadorDecisivo() } : {}),
    ...(t2 ? { postura: { mandante: posturaDe('mandante'), visitante: posturaDe('visitante') }, ritmo: totalDeLances } : {}),
    ...(t2?.formacao ? { formacao: { mandante: formacaoDe('mandante'), visitante: formacaoDe('visitante') } } : {}),
    ...(substituicoes.length ? { substituicoes } : {}),
    ...(t3 ? { juiz, acrescimos } : {}),
  };
}

const limitar01 = (p: number) => Math.min(0.97, Math.max(0.03, p));

/** Escolhe um slot com peso (T2: o Oportunista aparece mais para finalizar). Um sorteio só. */
function escolherComPeso(rng: Rng, slots: SlotRef[], peso: (s: SlotRef) => number): SlotRef {
  const pesos = slots.map(peso);
  let x = rng.next() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < slots.length; i++) {
    x -= pesos[i]!;
    if (x < 0) return slots[i]!;
  }
  return slots[slots.length - 1]!;
}

/** T2 (ADR-0023): chance de converter o pênalti com os Cantos de batedor e goleiro. */
export function chanceDePenaltiComCanto(finalizacao: number, goleiro: number, cantoCobrador: Canto, cantoGoleiro: Canto, ajuste = 0): number {
  const p = chanceDePenalti(finalizacao, goleiro) + ajuste;
  return limitar01(p * (cantoCobrador === cantoGoleiro ? PARAMETROS_T2.cantoAcertado : PARAMETROS_T2.cantoErrado));
}

function zerado(): Contadores {
  return { gols: 0, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, bloqueios: 0, dribles: 0 };
}

function embaralharDois(rng: Rng, slots: SlotRef[]): [SlotRef, SlotRef] {
  const [a, b] = slots as [SlotRef, SlotRef];
  return rng.chance(0.5) ? [a, b] : [b, a];
}

/** O gol do vencedor que o deixou à frente para sempre (ex.: 3×1 → o 2º gol do vencedor). */
function golDaVitoria(golsEmOrdem: readonly { lado: Lado; autor: SlotRef }[], vencedor: Lado | null, gols: Record<Lado, number>): SlotRef | null {
  if (vencedor === null || gols.mandante === gols.visitante) return null;
  const golsDoPerdedor = gols[outro(vencedor)];
  const doVencedor = golsEmOrdem.filter((g) => g.lado === vencedor);
  return doVencedor[golsDoPerdedor]?.autor ?? null;
}

/** Chance de converter um pênalti: Finalização do cobrador × Goleiro do goleiro. */
export function chanceDePenalti(finalizacao: number, goleiro: number): number {
  return PARAMETROS.penaltiBase + (probabilidadeDuelo(finalizacao, goleiro) - 0.5) * PARAMETROS.pesoPenalti;
}

function disputarPenaltis(
  rng: Rng,
  slotsDa: (lado: Lado, posicao: Posicao) => SlotRef[],
  hab: (s: SlotRef, h: HabilidadeId) => number,
): { placar: Record<Lado, number>; cobrancas: Cobranca[]; vencedor: Lado; decisivo: SlotRef } {
  const ordem: Record<Lado, SlotRef[]> = {
    mandante: ordemDeCobranca('mandante', slotsDa),
    visitante: ordemDeCobranca('visitante', slotsDa),
  };
  const placar: Record<Lado, number> = { mandante: 0, visitante: 0 };
  const cobrancas: Cobranca[] = [];

  const cobrar = (lado: Lado, rodada: number): void => {
    const cobrador = ordem[lado][rodada % ordem[lado].length]!;
    const goleiro = slotsDa(outro(lado), 'GOL')[0]!;
    const convertida = rng.chance(chanceDePenalti(hab(cobrador, 'FIN'), hab(goleiro, 'GOL')));
    if (convertida) {
      placar[lado]++;
      cobrancas.push({ lado, cobrador, goleiro, convertida });
    } else {
      cobrancas.push({ lado, cobrador, goleiro, convertida, defendida: rng.chance(PARAMETROS.penaltiDefendido) });
    }
  };

  for (let rodada = 0; rodada < COBRANCAS_REGULARES; rodada++) {
    for (const lado of LADOS) {
      cobrar(lado, rodada);
      const restantes = (l: Lado) => COBRANCAS_REGULARES - cobrancas.filter((c) => c.lado === l).length;
      if (placar.mandante + restantes('mandante') < placar.visitante) return fim('visitante');
      if (placar.visitante + restantes('visitante') < placar.mandante) return fim('mandante');
    }
  }
  for (let rodada = COBRANCAS_REGULARES; ; rodada++) {
    cobrar('mandante', rodada);
    cobrar('visitante', rodada);
    if (placar.mandante !== placar.visitante) return fim(placar.mandante > placar.visitante ? 'mandante' : 'visitante');
  }

  function fim(vencedor: Lado) {
    const ultimaConvertidaDoVencedor = [...cobrancas].reverse().find((c) => c.lado === vencedor && c.convertida);
    const decisivo = ultimaConvertidaDoVencedor?.cobrador ?? slotsDa(vencedor, 'GOL')[0]!;
    return { placar, cobrancas, vencedor, decisivo };
  }
}

function ordemDeCobranca(lado: Lado, slotsDa: (lado: Lado, posicao: Posicao) => SlotRef[]): SlotRef[] {
  const usados = new Set<number>();
  return ORDEM_COBRANCA.map((posicao) => {
    const slot = slotsDa(lado, posicao).find((s) => !usados.has(s.indice))!;
    usados.add(slot.indice);
    return slot;
  });
}


/**
 * Disputa de pênaltis da Temporada 2 (ADR-0023): a mesma de antes, com o Canto de batedor e
 * goleiro, e sem os expulsos (a ordem pula quem saiu).
 */
function disputarPenaltisT2(
  rng: Rng,
  rngT2: Rng,
  slotsDa: (lado: Lado, posicao: Posicao) => SlotRef[],
  hab: (s: SlotRef, h: HabilidadeId) => number,
  cantoDe: (s: SlotRef) => Canto,
  mod: (s: SlotRef, campo: string) => number,
  escolhidos: (lado: Lado) => SlotRef[] = () => [],
): { placar: Record<Lado, number>; cobrancas: Cobranca[]; vencedor: Lado; decisivo: SlotRef } {
  /** Os Batedores escolhidos primeiro (T3), depois a ordem automática sem repetir ninguém. */
  const ordemDe = (lado: Lado): SlotRef[] => {
    const primeiros = escolhidos(lado);
    const usados = new Set<number>(primeiros.map((x) => x.indice));
    return [...primeiros, ...ORDEM_COBRANCA.flatMap((posicao) => {
      const slot = slotsDa(lado, posicao).find((x) => !usados.has(x.indice));
      if (!slot) return [];
      usados.add(slot.indice);
      return [slot];
    })];
  };
  const ordem: Record<Lado, SlotRef[]> = { mandante: ordemDe('mandante'), visitante: ordemDe('visitante') };
  const placar: Record<Lado, number> = { mandante: 0, visitante: 0 };
  const cobrancas: Cobranca[] = [];

  const cobrar = (lado: Lado, rodada: number): void => {
    const cobrador = ordem[lado][rodada % ordem[lado].length]!;
    const goleiro = slotsDa(outro(lado), 'GOL')[0]!;
    const canto = { cobrador: cantoDe(cobrador), goleiro: cantoDe(goleiro) };
    const convertida = rng.chance(chanceDePenaltiComCanto(hab(cobrador, 'FIN'), hab(goleiro, 'GOL'), canto.cobrador, canto.goleiro, mod(goleiro, 'contraPenalti')));
    if (convertida) {
      placar[lado]++;
      cobrancas.push({ lado, cobrador, goleiro, convertida, canto });
    } else {
      const defendida = rngT2.chance(canto.cobrador === canto.goleiro ? PARAMETROS_T2.defendidoNoCanto : PARAMETROS_T2.defendidoForaDoCanto);
      cobrancas.push({ lado, cobrador, goleiro, convertida, defendida, canto });
    }
  };

  for (let rodada = 0; rodada < COBRANCAS_REGULARES; rodada++) {
    for (const lado of LADOS) {
      cobrar(lado, rodada);
      const restantes = (l: Lado) => COBRANCAS_REGULARES - cobrancas.filter((c) => c.lado === l).length;
      if (placar.mandante + restantes('mandante') < placar.visitante) return fim('visitante');
      if (placar.visitante + restantes('visitante') < placar.mandante) return fim('mandante');
    }
  }
  for (let rodada = COBRANCAS_REGULARES; ; rodada++) {
    cobrar('mandante', rodada);
    cobrar('visitante', rodada);
    if (placar.mandante !== placar.visitante) return fim(placar.mandante > placar.visitante ? 'mandante' : 'visitante');
  }

  function fim(vencedor: Lado) {
    const ultimaConvertidaDoVencedor = [...cobrancas].reverse().find((c) => c.lado === vencedor && c.convertida);
    const decisivo = ultimaConvertidaDoVencedor?.cobrador ?? slotsDa(vencedor, 'GOL')[0]!;
    return { placar, cobrancas, vencedor, decisivo };
  }
}
