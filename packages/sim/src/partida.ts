import { FORMACAO, POSICOES, TAMANHO_ESCALACAO, ehClassico, type Escalacao, type Posicao } from '@liga/shared';
import { duelo, probabilidadeDuelo } from './duelo.js';
import { aplicarDelta, deltaOvr, notaDaPartida } from './nota.js';
import { PARAMETROS, VERSAO_SIM } from './parametros.js';
import { criarRng, type Rng } from './rng.js';
import type {
  Cobranca,
  Desempenho,
  EntradaPartida,
  Lado,
  Lance,
  ResultadoPartida,
  SlotRef,
} from './tipos.js';

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

/** Simula uma Partida. Mesma entrada (incluindo seed) → mesmo resultado, sempre. */
export function simularPartida(entrada: EntradaPartida): ResultadoPartida {
  validarEscalacao(entrada.mandante);
  validarEscalacao(entrada.visitante);
  if (entrada.fase === 'LIGA' && entrada.vantagemDoEmpate) {
    throw new Error('Vantagem do Empate só existe no Mata-mata');
  }

  const rng = criarRng(entrada.seed);
  const escalacoes: Record<Lado, Escalacao> = { mandante: entrada.mandante, visitante: entrada.visitante };
  const classico = ehClassico(entrada.mandante.time, entrada.visitante.time);

  const ovrDe = (s: SlotRef): number => escalacoes[s.lado].jogadores[s.indice]!.ovr;
  const slotsDa = (lado: Lado, posicao: Posicao): SlotRef[] =>
    escalacoes[lado].jogadores.flatMap((j, indice) => (j.posicao === posicao ? [{ lado, indice }] : []));

  const contadores: Record<Lado, Contadores[]> = {
    mandante: entrada.mandante.jogadores.map(zerado),
    visitante: entrada.visitante.jogadores.map(zerado),
  };
  const conta = (s: SlotRef): Contadores => contadores[s.lado][s.indice]!;

  const gols: Record<Lado, number> = { mandante: 0, visitante: 0 };
  const lances: Lance[] = [];
  const golsEmOrdem: { lado: Lado; autor: SlotRef }[] = [];

  for (let numero = 1; numero <= PARAMETROS.lances; numero++) {
    const minuto = Math.min(90, Math.floor(((numero - 1) * 90) / PARAMETROS.lances) + 1 + rng.int(3));

    // 1. Posse: meia contra meia.
    const meiaMandante = rng.pick(slotsDa('mandante', 'MEI'));
    const meiaVisitante = rng.pick(slotsDa('visitante', 'MEI'));
    const mandanteGanha = duelo(rng, ovrDe(meiaMandante), ovrDe(meiaVisitante));
    const ataque: Lado = mandanteGanha ? 'mandante' : 'visitante';
    const defesa = outro(ataque);
    const criador = mandanteGanha ? meiaMandante : meiaVisitante;

    // 2. Criação: meia contra zagueiro.
    const zagueiro = rng.pick(slotsDa(defesa, 'ZAG'));
    if (!duelo(rng, ovrDe(criador), ovrDe(zagueiro))) {
      conta(zagueiro).desarmes++;
      lances.push({ numero, minuto, ataque, tipo: 'DESARME', criador, defensor: zagueiro });
      continue;
    }

    // 3. Finalização: atacante (ou o outro meia) contra o goleiro.
    const outrosMeias = slotsDa(ataque, 'MEI').filter((s) => s.indice !== criador.indice);
    const finalizador =
      outrosMeias.length > 0 && rng.chance(PARAMETROS.chanceMeiaFinaliza)
        ? rng.pick(outrosMeias)
        : rng.pick(slotsDa(ataque, 'ATA'));
    const goleiro = rng.pick(slotsDa(defesa, 'GOL'));

    if (!duelo(rng, ovrDe(finalizador), ovrDe(goleiro))) {
      conta(goleiro).defesas++;
      lances.push({ numero, minuto, ataque, tipo: 'DEFESA', criador, finalizador, defensor: goleiro });
      continue;
    }
    if (!rng.chance(PARAMETROS.conversao)) {
      lances.push({ numero, minuto, ataque, tipo: 'FORA', criador, finalizador, defensor: goleiro });
      continue;
    }

    gols[ataque]++;
    conta(finalizador).gols++;
    conta(criador).assistencias++;
    for (const s of [goleiro, ...slotsDa(defesa, 'ZAG')]) conta(s).golsSofridos++;
    golsEmOrdem.push({ lado: ataque, autor: finalizador });
    lances.push({ numero, minuto, ataque, tipo: 'GOL', criador, finalizador, defensor: goleiro });
  }

  // Desempate.
  let vencedor: Lado | null =
    gols.mandante > gols.visitante ? 'mandante' : gols.visitante > gols.mandante ? 'visitante' : null;
  let penaltis: ResultadoPartida['penaltis'];
  let decisivoPenalti: SlotRef | null = null;

  if (vencedor === null && entrada.fase === 'MATA_MATA') {
    if (entrada.vantagemDoEmpate) {
      vencedor = entrada.vantagemDoEmpate;
    } else {
      const disputa = disputarPenaltis(rng, slotsDa, ovrDe);
      penaltis = { placar: disputa.placar, cobrancas: disputa.cobrancas };
      vencedor = disputa.vencedor;
      decisivoPenalti = disputa.decisivo;
    }
  }

  const resultadoDe = (lado: Lado): 'vitoria' | 'empate' | 'derrota' =>
    vencedor === null || penaltis ? 'empate' : vencedor === lado ? 'vitoria' : 'derrota';

  const desempenhos: Desempenho[] = LADOS.flatMap((lado) =>
    escalacoes[lado].jogadores.map((jogador, indice): Desempenho => {
      const c = contadores[lado][indice]!;
      const nota = notaDaPartida({ posicao: jogador.posicao, ...c, resultado: resultadoDe(lado) }, jogador.ovr);
      const delta = jogador.jogadorId === null ? 0 : deltaOvr(nota, classico);
      return {
        slot: { lado, indice },
        jogadorId: jogador.jogadorId,
        posicao: jogador.posicao,
        ...c,
        nota,
        ovrAntes: jogador.ovr,
        deltaOvr: delta,
        ovrDepois: aplicarDelta(jogador.ovr, delta),
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
  return { gols: 0, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0 };
}

/** O gol do vencedor que o deixou à frente para sempre (ex.: 3×1 → o 2º gol do vencedor). */
function golDaVitoria(
  golsEmOrdem: readonly { lado: Lado; autor: SlotRef }[],
  vencedor: Lado | null,
  gols: Record<Lado, number>,
): SlotRef | null {
  if (vencedor === null || gols.mandante === gols.visitante) return null;
  const golsDoPerdedor = gols[outro(vencedor)];
  const doVencedor = golsEmOrdem.filter((g) => g.lado === vencedor);
  return doVencedor[golsDoPerdedor]?.autor ?? null;
}

function disputarPenaltis(
  rng: Rng,
  slotsDa: (lado: Lado, posicao: Posicao) => SlotRef[],
  ovrDe: (s: SlotRef) => number,
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
    const p =
      PARAMETROS.penaltiBase + (probabilidadeDuelo(ovrDe(cobrador), ovrDe(goleiro)) - 0.5) * PARAMETROS.pesoOvrPenalti;
    const convertida = rng.chance(p);
    if (convertida) placar[lado]++;
    cobrancas.push({ lado, cobrador, goleiro, convertida });
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
