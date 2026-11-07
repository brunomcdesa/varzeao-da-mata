/**
 * Disputa de pênaltis depois dos 90 minutos (só no Mata-mata). Como o resto da Timeline,
 * é função pura do tempo de jogo: cada cobrança ocupa um passo fixo, todas no gol de cima.
 *
 * Coreografia de uma cobrança (fração f do passo):
 *   0–0,30  o cobrador sai da roda no meio-campo e vai até a marca;
 *   0,30–0,44 ajeita a bola e espera o apito;
 *   0,44–0,55 corrida e chute;
 *   0,55–0,62 a bola voa; o goleiro mergulha (para o lado certo se pegar);
 *   0,62–1   comemoração ou lamento, e todo mundo volta para o lugar.
 */
import type { Escalacao } from '@liga/shared';
import type { Cobranca, Lado, ResultadoPartida, SlotRef } from '@liga/sim';
import type { AcaoJogador, Ponto } from './jogada.js';

/** Abertura da disputa (s de jogo): os times se arrumam e aparece o letreiro. */
export const INTRO_PENALTIS = 90;
/** Depois da última cobrança, a comemoração do vencedor. */
export const FIM_PENALTIS = 90;
/** Teto da disputa inteira (s de jogo): a 15×, dois minutos de Ao Vivo. */
export const DISPUTA_MAXIMA = 1800;

export const F_CHUTE_PENALTI = 0.55;
export const F_RESOLUCAO_PENALTI = 0.62;

const MARCA: Ponto = { x: 0.5, y: 0.125 };
const LINHA_DO_GOL: Ponto = { x: 0.5, y: 0.028 };

export interface Disputa {
  inicio: number;
  passo: number;
  cobrancas: Cobranca[];
  placar: Record<Lado, number>;
  vencedor: Lado;
  fim: number;
}

export type ResultadoCobranca = 'GOL' | 'DEFESA' | 'FORA';

export interface MarcaDePenalti {
  lado: Lado;
  resultado: ResultadoCobranca;
}

export interface EstadoPenaltis {
  /** Cobranças já resolvidas, na ordem. */
  marcas: MarcaDePenalti[];
  placar: Record<Lado, number>;
  /** Índice da cobrança em andamento, ou -1 (intro ou fim). */
  atual: number;
  /** Disputa decidida (depois da última cobrança). */
  vencedor: Lado | null;
  /** 0 → 1 dentro da fase atual (intro, cobrança ou fim). */
  progresso: number;
  fase: 'INTRO' | 'COBRANCA' | 'FIM';
}

export function montarDisputa(r: ResultadoPartida, inicio: number): Disputa | null {
  if (!r.penaltis || !r.vencedor) return null;
  const n = r.penaltis.cobrancas.length;
  const passo = Math.min(120, (DISPUTA_MAXIMA - INTRO_PENALTIS - FIM_PENALTIS) / Math.max(1, n));
  return {
    inicio,
    passo,
    cobrancas: r.penaltis.cobrancas,
    placar: r.penaltis.placar,
    vencedor: r.vencedor,
    fim: inicio + INTRO_PENALTIS + n * passo + FIM_PENALTIS,
  };
}

/** Pênalti perdido: defesa ou para fora, como a sim decidiu (Partidas antigas: fixo pelo seed). */
export function resultadoDaCobranca(d: Disputa, k: number, seed: number): ResultadoCobranca {
  const c = d.cobrancas[k]!;
  if (c.convertida) return 'GOL';
  if (c.defendida !== undefined) return c.defendida ? 'DEFESA' : 'FORA';
  return ((seed >>> 0) + k * 7) % 3 === 0 ? 'FORA' : 'DEFESA';
}

/** Canto da batida: -1 esquerda, 0 meio, 1 direita (fixo pelo seed). */
function canto(seed: number, k: number): -1 | 0 | 1 {
  const v = ((seed >>> 0) + k * 13 + 5) % 5;
  return v < 2 ? -1 : v < 4 ? 1 : 0;
}

export function instanteDaCobranca(d: Disputa, k: number, f = F_RESOLUCAO_PENALTI): number {
  return d.inicio + INTRO_PENALTIS + (k + f) * d.passo;
}

export function estadoDaDisputa(d: Disputa, t: number, seed: number): EstadoPenaltis {
  const marcas: MarcaDePenalti[] = [];
  const placar: Record<Lado, number> = { mandante: 0, visitante: 0 };
  d.cobrancas.forEach((c, k) => {
    if (t >= instanteDaCobranca(d, k)) {
      const resultado = resultadoDaCobranca(d, k, seed);
      marcas.push({ lado: c.lado, resultado });
      if (resultado === 'GOL') placar[c.lado]++;
    }
  });
  const rel = t - d.inicio;
  if (rel < INTRO_PENALTIS) return { marcas, placar, atual: -1, vencedor: null, progresso: rel / INTRO_PENALTIS, fase: 'INTRO' };
  const k = Math.floor((rel - INTRO_PENALTIS) / d.passo);
  if (k < d.cobrancas.length) {
    return { marcas, placar, atual: k, vencedor: null, progresso: (rel - INTRO_PENALTIS - k * d.passo) / d.passo, fase: 'COBRANCA' };
  }
  const fimRel = rel - INTRO_PENALTIS - d.cobrancas.length * d.passo;
  return { marcas, placar, atual: -1, vencedor: d.vencedor, progresso: Math.min(1, fimRel / FIM_PENALTIS), fase: 'FIM' };
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpP = (a: Ponto, b: Ponto, f: number): Ponto => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
const suave = (f: number) => f * f * (3 - 2 * f);
const faixa = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));
const igual = (a: SlotRef, b: SlotRef) => a.lado === b.lado && a.indice === b.indice;

export interface QuadroDisputa {
  posicoes: { slot: SlotRef; pos: Ponto; acao: AcaoJogador; olhar: Ponto }[];
  bola: Ponto;
  bolaAltura: number;
}

/**
 * Onde cada um está: a roda dos dois Times no meio-campo (mandante à esquerda), o goleiro
 * da vez no gol de cima, o outro goleiro ao lado da roda e o cobrador na marca.
 */
export function quadroDaDisputa(d: Disputa, t: number, seed: number, escalacoes: Record<Lado, Escalacao>): QuadroDisputa {
  const e = estadoDaDisputa(d, t, seed);
  const cob = e.atual >= 0 ? d.cobrancas[e.atual]! : null;
  const f = e.progresso;
  const goleiroDaVez: SlotRef | null = cob ? cob.goleiro : null;

  const roda = (slot: SlotRef): Ponto => {
    // Linha de cada Time de frente para o gol, no círculo central.
    const lista = escalacoes[slot.lado].jogadores.map((_, i) => i);
    const ordem = lista.indexOf(slot.indice);
    const x0 = slot.lado === 'mandante' ? 0.14 : 0.56;
    return { x: x0 + ordem * 0.05, y: 0.5 + (ordem % 2) * 0.015 };
  };

  const alvoX = cob ? 0.5 + canto(seed, e.atual) * 0.075 : 0.5;
  const res = cob ? resultadoDaCobranca(d, e.atual, seed) : 'GOL';
  // O goleiro acerta o canto só quando defende; quando é gol, cai para o lado errado (ou fica).
  const caiX = res === 'DEFESA' ? alvoX : 0.5 + (canto(seed, e.atual) === 0 ? (e.atual % 2 ? 0.07 : -0.07) : -canto(seed, e.atual) * 0.07);

  const posicoes: QuadroDisputa['posicoes'] = [];
  for (const lado of ['mandante', 'visitante'] as const) {
    escalacoes[lado].jogadores.forEach((j, indice) => {
      const slot = { lado, indice };
      let pos = roda(slot);
      let acao: AcaoJogador = 'PARADO';
      let olhar: Ponto = MARCA;
      if (j.posicao === 'GOL' && !(goleiroDaVez && igual(slot, goleiroDaVez))) {
        // Goleiro de fora: espera ao lado da roda do seu Time.
        pos = { x: lado === 'mandante' ? 0.08 : 0.92, y: 0.56 };
      }
      if (goleiroDaVez && igual(slot, goleiroDaVez)) {
        const mergulho = faixa(f, 0.52, F_RESOLUCAO_PENALTI);
        pos = { x: lerp(LINHA_DO_GOL.x, caiX, mergulho), y: LINHA_DO_GOL.y + (res === 'DEFESA' ? mergulho * 0.01 : 0) };
        acao = f >= 0.52 && f < 0.85 ? 'MERGULHO' : 'PARADO';
        olhar = MARCA;
      } else if (e.fase === 'INTRO' && j.posicao === 'GOL') {
        // Na intro, o goleiro do primeiro a defender já vai para o gol.
        const primeiro = d.cobrancas[0]!.goleiro;
        if (igual(slot, primeiro)) pos = lerpP(pos, LINHA_DO_GOL, faixa(f, 0.2, 0.9));
      }
      if (cob && igual(slot, cob.cobrador)) {
        const casa = roda(slot);
        const espera: Ponto = { x: 0.5, y: 0.17 };
        if (f < 0.3) {
          pos = lerpP(casa, espera, faixa(f, 0, 0.3));
          acao = 'CORRENDO';
        } else if (f < 0.44) pos = espera;
        else if (f < F_CHUTE_PENALTI) {
          pos = lerpP(espera, { x: 0.5, y: MARCA.y + 0.012 }, faixa(f, 0.44, F_CHUTE_PENALTI));
          acao = f > 0.5 ? 'CHUTE' : 'CORRENDO';
        } else if (f < 0.85) {
          pos = { x: 0.5, y: MARCA.y + 0.012 };
          acao = res === 'GOL' && f > F_RESOLUCAO_PENALTI ? 'COMEMORANDO' : 'PARADO';
        } else {
          pos = lerpP({ x: 0.5, y: MARCA.y + 0.012 }, casa, faixa(f, 0.85, 1));
          acao = 'CORRENDO';
        }
        olhar = { x: alvoX, y: 0 };
      }
      if (e.fase === 'FIM' && lado === d.vencedor) acao = 'COMEMORANDO';
      posicoes.push({ slot, pos, acao, olhar });
    });
  }

  // A bola: na marca, voa no chute, depois para no fundo da rede, nas mãos do goleiro ou longe.
  let bola: Ponto = MARCA;
  let bolaAltura = 0;
  if (cob && f >= F_CHUTE_PENALTI) {
    const s = faixa(f, F_CHUTE_PENALTI, F_RESOLUCAO_PENALTI);
    const destino: Ponto =
      res === 'GOL' ? { x: alvoX, y: 0.004 } : res === 'DEFESA' ? { x: caiX, y: LINHA_DO_GOL.y + 0.012 } : { x: alvoX + (alvoX >= 0.5 ? 0.11 : -0.11), y: 0.0 };
    bola = lerpP(MARCA, destino, s);
    bolaAltura = (res === 'FORA' ? 0.5 : 0.15) * 4 * s * (1 - s);
    if (f > F_RESOLUCAO_PENALTI && res === 'DEFESA') bola = lerpP(destino, { x: caiX + (caiX >= 0.5 ? 0.06 : -0.06), y: 0.09 }, faixa(f, F_RESOLUCAO_PENALTI, 0.75));
    if (f > 0.85) bola = lerpP(bola, MARCA, faixa(f, 0.88, 1));
  } else if (e.fase === 'INTRO') {
    bola = lerpP({ x: 0.5, y: 0.5 }, MARCA, faixa(f, 0.3, 0.9));
  }
  return { posicoes, bola, bolaAltura };
}
