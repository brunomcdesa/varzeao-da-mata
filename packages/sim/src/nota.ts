import type { Posicao } from '@liga/shared';
import { PESOS_NOTA } from './parametros.js';

export interface Acoes {
  posicao: Posicao;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  golsSofridos: number;
  bloqueios?: number;
  dribles?: number;
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
    (a.bloqueios ?? 0) * PESOS_NOTA.bloqueio +
    (a.dribles ?? 0) * PESOS_NOTA.drible +
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
  GOL: { intercepto: -0.441, inclinacao: 0.0085 },
  ZAG: { intercepto: 0.8, inclinacao: 0.011 },
  MEI: { intercepto: 1.025, inclinacao: 0.0164 },
  ATA: { intercepto: 0.865, inclinacao: 0.0105 },
};

/** OVR de referência das retas de expectativa. */
export const OVR_REFERENCIA = 65;

export function expectativa(posicao: Posicao, ovr: number): number {
  const { intercepto, inclinacao } = EXPECTATIVA[posicao];
  return intercepto + inclinacao * (ovr - OVR_REFERENCIA);
}

const arredondar1 = (x: number): number => Math.round(x * 10) / 10;
const limitar = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

/**
 * Nota da Partida. `ritmo`: lances de ataque da Partida dividido pela referência (ADR-0016).
 * A expectativa acompanha o Ritmo, para jogo travado não baixar a Nota de todo mundo.
 */
export function notaDaPartida(a: Acoes, ovr: number, ritmo = 1): number {
  return arredondar1(limitar(PESOS_NOTA.base + contribuicao(a) - expectativa(a.posicao, ovr) * ritmo, 0, 10));
}

