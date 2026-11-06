import {
  LIMITE_DELTA_OVR,
  LIMITE_DELTA_OVR_CLASSICO,
  MULTIPLICADOR_CLASSICO,
  OVR_MAX,
  OVR_MIN,
  type Posicao,
} from '@liga/shared';
import { PESOS_NOTA } from './parametros.js';

export interface Acoes {
  posicao: Posicao;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  resultado: 'vitoria' | 'empate' | 'derrota';
}

/** Pontos de Nota que as ações valem, antes de descontar a expectativa. */
export function contribuicao(a: Acoes): number {
  const sofridos =
    a.posicao === 'GOL'
      ? a.golsSofridos * PESOS_NOTA.golSofridoGoleiro
      : a.posicao === 'ZAG'
        ? a.golsSofridos * PESOS_NOTA.golSofridoZagueiro
        : 0;
  const resultado =
    a.resultado === 'vitoria' ? PESOS_NOTA.vitoria : a.resultado === 'derrota' ? PESOS_NOTA.derrota : 0;
  return (
    a.gols * PESOS_NOTA.gol +
    a.assistencias * PESOS_NOTA.assistencia +
    a.desarmes * PESOS_NOTA.desarme +
    a.defesas * PESOS_NOTA.defesa +
    sofridos +
    resultado
  );
}

/**
 * Contribuição que se espera de um Jogador com esse OVR na Posição. Reta ajustada
 * pelo script de calibração (contribuição média por OVR em Partidas aleatórias), para
 * que, em média, ninguém suba só por já ser forte (ADR-0004).
 */
export const EXPECTATIVA: Readonly<Record<Posicao, { intercepto: number; inclinacao: number }>> = {
  GOL: { intercepto: 0.219, inclinacao: 0.0125 },
  ZAG: { intercepto: 0.501, inclinacao: 0.0065 },
  MEI: { intercepto: 0.991, inclinacao: 0.0125 },
  ATA: { intercepto: 0.731, inclinacao: 0.0041 },
};

/** OVR de referência das retas de expectativa. */
export const OVR_REFERENCIA = 65;

export function expectativa(posicao: Posicao, ovr: number): number {
  const { intercepto, inclinacao } = EXPECTATIVA[posicao];
  return intercepto + inclinacao * (ovr - OVR_REFERENCIA);
}

const arredondar1 = (x: number): number => Math.round(x * 10) / 10;
const limitar = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

export function notaDaPartida(a: Acoes, ovr: number): number {
  return arredondar1(limitar(PESOS_NOTA.base + contribuicao(a) - expectativa(a.posicao, ovr), 0, 10));
}

/** Variação de OVR causada por uma Nota da Partida. */
export function deltaOvr(nota: number, classico: boolean): number {
  const multiplicador = classico ? MULTIPLICADOR_CLASSICO : 1;
  const limite = classico ? LIMITE_DELTA_OVR_CLASSICO : LIMITE_DELTA_OVR;
  const x = (nota - PESOS_NOTA.base) * multiplicador;
  // Arredondamento simétrico: Math.round puxa .5 negativo para cima e criaria inflação de OVR.
  const bruto = Math.sign(x) * Math.round(Math.abs(x));
  return limitar(bruto, -limite, limite);
}

export function aplicarDelta(ovr: number, delta: number): number {
  return limitar(ovr + delta, OVR_MIN, OVR_MAX);
}
