/**
 * Juiz em campo (Temporada 2, ADR-0040): só visual. Não muda nada da simulação; acompanha o
 * lance na diagonal, corre até a falta, apita e mostra o cartão, e volta ao meio depois do gol.
 */
import { IDENTIDADE, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';
import type { Ponto } from './jogada.js';
import { segundoUniforme } from './clima.js';
import { aparencia, type Visual } from './sprites.js';

export type AcaoDoJuiz = 'PARADO' | 'CORRENDO' | 'APITO' | 'CARTAO';

export interface JuizNoQuadro {
  pos: Ponto;
  vel: Ponto;
  olhar: Ponto;
  acao: AcaoDoJuiz;
  /** Semente da Partida: sorteia a pele e o cabelo do juiz (o mesmo a Partida toda). */
  seed: number;
  /** Só com acao CARTAO: o cartão que ele levanta. */
  cartao?: 'AMARELO' | 'VERMELHO';
}

/** Onde o juiz fica no Apito Inicial: ao lado do círculo central. */
export const JUIZ_NO_APITO_INICIAL: Ponto = { x: 0.6, y: 0.5 };

/** Distância da bola na diagonal (fração do campo). */
const DIAGONAL = { x: 0.17, y: 0.07 };
/** O juiz corre um pouco menos que os Jogadores. */
export const RITMO_DO_JUIZ = 0.85;

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Situação do momento, decidida pela Timeline. */
export type MomentoDoJuiz =
  | { tipo: 'JOGO'; bola: Ponto }
  | { tipo: 'FALTA'; autor: Ponto }
  | { tipo: 'GOL' };

/**
 * Para onde o juiz quer ir. No jogo, na diagonal da bola, do lado de dentro do campo (para não
 * ficar em cima da jogada nem colado na lateral). Na falta, ao lado de quem fez. Depois do gol,
 * de volta ao meio.
 */
export function alvoDoJuiz(m: MomentoDoJuiz): { pos: Ponto; naJogada: boolean } {
  if (m.tipo === 'GOL') return { pos: JUIZ_NO_APITO_INICIAL, naJogada: false };
  if (m.tipo === 'FALTA') {
    const lado = m.autor.x < 0.5 ? 1 : -1;
    return { pos: { x: limitar(m.autor.x + lado * 0.1, 0.06, 0.94), y: limitar(m.autor.y + 0.045, 0.05, 0.95) }, naJogada: true };
  }
  const lado = m.bola.x < 0.5 ? 1 : -1;
  return {
    pos: { x: limitar(m.bola.x + lado * DIAGONAL.x, 0.1, 0.9), y: limitar(m.bola.y + DIAGONAL.y, 0.08, 0.92) },
    naJogada: false,
  };
}

/** Uniformes possíveis, na ordem de preferência: o preto clássico primeiro. */
export const UNIFORMES_DO_JUIZ = {
  PRETO: { camisa: '#1B1B1B', detalhe: '#4A4A4A', calcao: '#1B1B1B', meiao: '#1B1B1B' },
  AMARELO: { camisa: '#DDEB2F', detalhe: '#1B1B1B', calcao: '#1B1B1B', meiao: '#1B1B1B' },
  VERMELHO: { camisa: '#E0352B', detalhe: '#1B1B1B', calcao: '#1B1B1B', meiao: '#1B1B1B' },
} as const;
export type UniformeDoJuiz = keyof typeof UNIFORMES_DO_JUIZ;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const distancia = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
/** Abaixo disso, a camisa do juiz se confunde com a de um Time. */
const DISTANCIA_MINIMA = 90;

/**
 * Camisa do juiz que não se confunde com nenhuma das camisas em campo (a dos dois Times, a do
 * goleiro, que usa a secundária, e o segundo uniforme, se houver). Se todas se parecem com
 * alguma, vale a mais diferente.
 */
export function uniformeDoJuiz(times: Record<Lado, TimeId>, segundo: Lado | null): UniformeDoJuiz {
  const camisas: string[] = [];
  for (const lado of ['mandante', 'visitante'] as const) {
    const id = IDENTIDADE[times[lado]];
    camisas.push(id.secundaria);
    if (segundo === lado) camisas.push(segundoUniforme(times[lado], times[lado === 'mandante' ? 'visitante' : 'mandante']).camisa);
    else camisas.push(id.primaria);
  }
  const opcoes = Object.keys(UNIFORMES_DO_JUIZ) as UniformeDoJuiz[];
  const folga = (u: UniformeDoJuiz) => Math.min(...camisas.map((c) => distancia(UNIFORMES_DO_JUIZ[u].camisa, c)));
  return opcoes.find((u) => folga(u) >= DISTANCIA_MINIMA) ?? opcoes.reduce((a, b) => (folga(b) > folga(a) ? b : a));
}

/** Visual do boneco do juiz: o uniforme e pele/cabelo sorteados pela semente (o juiz da Partida). */
export function visualDoJuiz(times: Record<Lado, TimeId>, segundo: Lado | null, seed: number): Visual {
  return { ...UNIFORMES_DO_JUIZ[uniformeDoJuiz(times, segundo)], ...aparencia(`juiz:${seed}`) };
}

/**
 * Em que momento do letreiro de falta o juiz apita e mostra o cartão. Apito no começo; o cartão
 * sobe quando ele chega perto de quem fez (ou, se demorar, a partir de CARTAO_DE) e desce antes
 * de o expulso sair (a saída é em 0,7 do letreiro).
 */
export const GESTOS = { apitoAte: 0.3, cartaoDe: 0.06, cartaoForcadoDe: 0.2, cartaoAte: 0.68, perto: 0.14 } as const;

export function acaoNaFalta(progresso: number, cartao: 'AMARELO' | 'VERMELHO' | undefined, distanciaDoAutor: number): AcaoDoJuiz | null {
  if (cartao) {
    const chegou = distanciaDoAutor <= GESTOS.perto || progresso >= GESTOS.cartaoForcadoDe;
    if (progresso >= GESTOS.cartaoDe && progresso < GESTOS.cartaoAte && chegou) return 'CARTAO';
  }
  if (progresso < GESTOS.apitoAte) return 'APITO';
  return null;
}
