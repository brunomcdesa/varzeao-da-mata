import {
  FORMACAO,
  POSICOES,
  TAMANHO_ESCALACAO,
  ehClassico,
  ovrDasHabilidades,
  type Escalacao,
  type HabilidadeId,
  type Habilidades,
  type Posicao,
} from '@liga/shared';
import { duelo, probabilidadeDuelo } from './duelo.js';
import { ACOES, evoluir, zeradas, type Acao } from './evolucao.js';
import { notaDaPartida } from './nota.js';
import { PARAMETROS, VERSAO_SIM } from './parametros.js';
import { criarRng, type Rng } from './rng.js';
import type { Cobranca, Desempenho, EntradaPartida, Lado, Lance, ResultadoPartida, SlotRef } from './tipos.js';

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

export function validarEscalacao(escalacao: Escalacao): void {
  if (escalacao.jogadores.length !== TAMANHO_ESCALACAO) {
    throw new Error(`Escalação de ${escalacao.time} tem ${escalacao.jogadores.length} Jogadores, esperado ${TAMANHO_ESCALACAO}`);
  }
  for (const posicao of POSICOES) {
    const qtd = escalacao.jogadores.filter((j) => j.posicao === posicao).length;
    if (qtd !== FORMACAO[posicao]) {
      throw new Error(`Escalação de ${escalacao.time} tem ${qtd} ${posicao}, esperado ${FORMACAO[posicao]}`);
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
  validarEscalacao(entrada.mandante);
  validarEscalacao(entrada.visitante);

  const rng = criarRng(entrada.seed);
  const escalacoes: Record<Lado, Escalacao> = { mandante: entrada.mandante, visitante: entrada.visitante };
  const classico = ehClassico(entrada.mandante.time, entrada.visitante.time);

  const hab = (s: SlotRef, h: HabilidadeId): number => escalacoes[s.lado].jogadores[s.indice]!.habilidades[h];
  const slotsDa = (lado: Lado, posicao: Posicao): SlotRef[] =>
    escalacoes[lado].jogadores.flatMap((j, indice) => (j.posicao === posicao ? [{ lado, indice }] : []));

  const contadores: Record<Lado, Contadores[]> = {
    mandante: entrada.mandante.jogadores.map(zerado),
    visitante: entrada.visitante.jogadores.map(zerado),
  };
  const pontos: Record<Lado, Record<HabilidadeId, number>[]> = {
    mandante: entrada.mandante.jogadores.map(zeradas),
    visitante: entrada.visitante.jogadores.map(zeradas),
  };
  const conta = (s: SlotRef): Contadores => contadores[s.lado][s.indice]!;
  const acao = (s: SlotRef, a: Acao): void => {
    pontos[s.lado][s.indice]![ACOES[a].hab] += ACOES[a].valor;
  };

  const gols: Record<Lado, number> = { mandante: 0, visitante: 0 };
  const lances: Lance[] = [];
  const golsEmOrdem: { lado: Lado; autor: SlotRef }[] = [];
  // Bolas paradas têm sorteio próprio: os 20 lances de ataque saem iguais aos da versão 2.
  const rngBP = criarRng(((entrada.seed >>> 0) ^ 0x5bd1e995) >>> 0);
  // Contra-ataque (VERSAO_SIM 4): sorteio próprio também.
  const rngCA = criarRng(((entrada.seed >>> 0) ^ 0x27d4eb2f) >>> 0);
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
    recuperou = { lado: outro(l.ataque), adiantados: l.bolaParada === 'ESCANTEIO' ? 6 : zagueiroSubiu ? 4 : 3 };
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
    const cobrador = rngBP.pick(slotsDa(ataque, 'MEI'));
    const finalizador = rngBP.chance(PARAMETROS.chanceZagueiroCabeceia) ? rngBP.pick(slotsDa(ataque, 'ZAG')) : rngBP.pick(slotsDa(ataque, 'ATA'));
    const zagueiro = rngBP.pick(slotsDa(defesa, 'ZAG'));
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
    golsEmOrdem.push({ lado: ataque, autor: finalizador });
    lances.push({ ...base, tipo: 'GOL', defensor: goleiro });
      depoisDoLance(lances[lances.length - 1]!);
  };

  // Ritmo (VERSAO_SIM 5): quantos lances de ataque a Partida tem, com sorteio próprio.
  const totalDeLances = ritmoDaPartida(entrada.seed);
  for (let numero = 1; numero <= totalDeLances; numero++) {
    const minuto = Math.min(90, Math.floor(((numero - 1) * 90) / totalDeLances) + 1 + rng.int(3));

    // 1. Posse: o meia com a bola (Passe) contra o meia rival (Defesa).
    const comBola: Lado = rng.chance(0.5) ? 'mandante' : 'visitante';
    const meiaComBola = rng.pick(slotsDa(comBola, 'MEI'));
    const meiaRival = rng.pick(slotsDa(outro(comBola), 'MEI'));
    let criador: SlotRef;
    if (duelo(rng, hab(meiaComBola, 'PAS'), hab(meiaRival, 'DEF'), PARAMETROS.basePosse)) {
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
    const [zagueiro1, zagueiro2] = embaralharDois(rng, slotsDa(defesa, 'ZAG'));

    // Contra-ataque: quem acabou de recuperar a bola sai rápido; a defesa rival recompõe?
    let contraAtaque: Lance['contraAtaque'];
    const r0 = recuperou as { lado: Lado; adiantados: number } | null;
    if (r0 && r0.lado === ataque && rngCA.chance(PARAMETROS.chanceContraAtaque + PARAMETROS.chanceContraPorAdiantado * (r0.adiantados - 3))) {
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

    // 2. Criação: meia (Passe) contra o 1º zagueiro (Defesa). No contra-ataque sem
    //    recomposição o zagueiro ficou para trás (o sorteio acontece igual, para não mexer no resto).
    const criou = duelo(rng, hab(criador, 'PAS'), hab(zagueiro1, 'DEF'), PARAMETROS.baseCriacao);
    if (!criou && !semZagueiro1) {
      conta(zagueiro1).desarmes++;
      acao(zagueiro1, 'desarme');
      acao(criador, 'desarmadoNaCriacao');
      fechar({ numero, minuto, ataque, tipo: 'DESARME', criador, defensor: zagueiro1, ...ca });
      continue;
    }
    if (!semZagueiro1) acao(zagueiro1, 'superadoNaCriacao');

    // 3. Atacante × zagueiro: drible ou chute marcado.
    const outrosMeias = slotsDa(ataque, 'MEI').filter((s) => s.indice !== criador.indice);
    const finalizador =
      outrosMeias.length > 0 && rng.chance(PARAMETROS.chanceMeiaFinaliza) ? rng.pick(outrosMeias) : rng.pick(slotsDa(ataque, 'ATA'));
    const marcador = zagueiro2;
    const goleiro = rng.pick(slotsDa(defesa, 'GOL'));
    const drible = rng.chance(chanceDeDriblar(hab(finalizador, 'DRI'), hab(finalizador, 'FIN')));

    let baseChute: number;
    // Sem marcador (escanteio desfeito em contra-ataque): o duelo é sorteado, mas não vale.
    const venceuMarcador = drible
      ? duelo(rng, hab(finalizador, 'DRI'), hab(marcador, 'DEF'), PARAMETROS.baseDrible)
      : duelo(rng, hab(finalizador, 'FIN'), hab(marcador, 'DEF'), PARAMETROS.baseChuteMarcado);
    if (semMarcador) {
      baseChute = PARAMETROS.baseChuteLivre;
    } else if (drible) {
      if (!venceuMarcador) {
        conta(marcador).desarmes++;
        acao(marcador, 'desarme');
        acao(finalizador, 'desarmadoNoDrible');
        fechar({ numero, minuto, ataque, tipo: 'DESARME', criador, finalizador, defensor: marcador, marcador, drible: true, ...ca });
        continue;
      }
      conta(finalizador).dribles++;
      acao(finalizador, 'driblou');
      acao(marcador, 'foiDriblado');
      baseChute = PARAMETROS.baseChuteLivre;
    } else {
      if (!venceuMarcador) {
        conta(marcador).bloqueios++;
        acao(marcador, 'bloqueio');
        acao(finalizador, 'chuteBloqueado');
        fechar({ numero, minuto, ataque, tipo: 'BLOQUEIO', criador, finalizador, defensor: marcador, marcador, drible: false, ...ca });
        talvezEscanteio(numero, minuto, ataque);
        continue;
      }
      acao(finalizador, 'venceuChuteMarcado');
      baseChute = PARAMETROS.baseChuteApertado;
    }

    // 4. Finalização (Finalização) contra o goleiro (Goleiro).
    const base = { numero, minuto, ataque, criador, finalizador, defensor: goleiro, ...(semMarcador ? {} : { marcador, drible }), ...ca };
    if (!duelo(rng, hab(finalizador, 'FIN'), hab(goleiro, 'GOL'), baseChute)) {
      conta(goleiro).defesas++;
      acao(goleiro, 'defesa');
      acao(finalizador, 'chuteDefendido');
      fechar({ ...base, tipo: 'DEFESA' });
      talvezEscanteio(numero, minuto, ataque);
      continue;
    }
    if (rng.chance(chanceDeFora(hab(finalizador, 'FIN')))) {
      acao(finalizador, 'chuteFora');
      fechar({ ...base, tipo: 'FORA' });
      continue;
    }

    gols[ataque]++;
    conta(finalizador).gols++;
    conta(criador).assistencias++;
    acao(finalizador, 'gol');
    acao(criador, 'assistencia');
    acao(goleiro, 'golSofridoGoleiro');
    for (const z of slotsDa(defesa, 'ZAG')) acao(z, 'golSofridoZagueiro');
    for (const s of [goleiro, ...slotsDa(defesa, 'ZAG')]) conta(s).golsSofridos++;
    golsEmOrdem.push({ lado: ataque, autor: finalizador });
    fechar({ ...base, tipo: 'GOL' });
  }

  // Numeração final (com os escanteios no meio) e laterais: alguns lances começam com a
  // cobrança de um lateral (nunca o primeiro, nem depois de gol ou logo depois de escanteio).
  lances.forEach((l, i) => {
    l.numero = i + 1;
    const antes = lances[i - 1];
    if (!antes || antes.tipo === 'GOL' || l.bolaParada || l.contraAtaque || lances[i + 1]?.bolaParada === 'ESCANTEIO' || antes.bolaParada === 'ESCANTEIO') return;
    if (!rngBP.chance(PARAMETROS.chanceLateral)) return;
    const companheiros = escalacoes[l.criador.lado].jogadores.flatMap((j, indice) => ((j.posicao === 'MEI' || j.posicao === 'ZAG') && indice !== l.criador.indice ? [{ lado: l.criador.lado, indice }] : []));
    if (!companheiros.length) return;
    l.bolaParada = 'LATERAL';
    l.cobrador = rngBP.pick(companheiros);
  });

  for (const lado of LADOS) {
    for (const g of slotsDa(lado, 'GOL')) if (conta(g).golsSofridos === 0) acao(g, 'semSofrerGol');
  }

  // Desempate: no Mata-mata, empate vai para os pênaltis.
  let vencedor: Lado | null = gols.mandante > gols.visitante ? 'mandante' : gols.visitante > gols.mandante ? 'visitante' : null;
  let penaltis: ResultadoPartida['penaltis'];
  let decisivoPenalti: SlotRef | null = null;

  if (vencedor === null && entrada.fase === 'MATA_MATA') {
    const disputa = disputarPenaltis(rng, slotsDa, hab);
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

  const desempenhos: Desempenho[] = LADOS.flatMap((lado) =>
    escalacoes[lado].jogadores.map((jogador, indice): Desempenho => {
      const c = contadores[lado][indice]!;
      const antes: Habilidades = { ...jogador.habilidades };
      const daBase = jogador.jogadorId === null;
      const { depois, delta } = daBase ? { depois: antes, delta: zeradas() } : evoluir(antes, pontos[lado][indice]!, classico);
      const ovrAntes = ovrDasHabilidades(jogador.posicao, antes);
      const ovrDepois = ovrDasHabilidades(jogador.posicao, depois);
      return {
        slot: { lado, indice },
        jogadorId: jogador.jogadorId,
        posicao: jogador.posicao,
        ...c,
        nota: notaDaPartida({ posicao: jogador.posicao, ...c, resultado: resultadoDe(lado) }, ovrAntes, totalDeLances / PARAMETROS.lances),
        ovrAntes,
        deltaOvr: ovrDepois - ovrAntes,
        ovrDepois,
        habilidadesAntes: antes,
        habilidadesDepois: depois,
        deltaHabilidades: delta,
      };
    }),
  );

  return {
    versaoSim: VERSAO_SIM,
    seed: entrada.seed,
    times: { mandante: entrada.mandante.time, visitante: entrada.visitante.time },
    classico,
    gols,
    ...(penaltis ? { penaltis } : {}),
    vencedor,
    lances,
    desempenhos,
    decisivo: decisivoPenalti ?? golDaVitoria(golsEmOrdem, vencedor, gols),
  };
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
