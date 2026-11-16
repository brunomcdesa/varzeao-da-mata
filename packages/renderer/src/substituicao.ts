/**
 * Substituição no intervalo (ADR-0061), do lado do desenho. Os lances apontam o lugar em campo;
 * quem ocupa o lugar muda no intervalo. Os nomes (`nomes`, `apelidos`) vêm com os titulares e,
 * depois deles, o Banco: o "ocupante" é o índice nessa lista.
 */
import type { Escalacao } from '@liga/shared';
import type { Desempenho, Lado, ResultadoPartida } from '@liga/sim';

/** Quanto dura a troca na tela (s de jogo): ~3 s no Ao Vivo. */
export const DURACAO_TROCA = 60;

export interface Troca {
  lado: Lado;
  lugar: number;
  /** Índice do reserva na lista titulares + Banco. */
  ocupante: number;
  /** Índice de quem saiu (o titular do lugar). */
  saiu: number;
  /** Primeiro lance (índice em `lances`) com o reserva em campo. */
  antesDoLance: number;
  /** Instante de jogo em que a troca começa na tela (a placa sobe). */
  t: number;
  foraDePosicao: boolean;
}

/** As trocas da Partida, com o instante na tela: terminam quando começa a jogada do primeiro lance do 2º tempo. */
export function trocasDaPartida(
  r: Pick<ResultadoPartida, 'substituicoes'>,
  escalacoes: Record<Lado, Escalacao>,
  janelas: readonly { inicio: number; fim: number }[],
): Troca[] {
  return (r.substituicoes ?? []).map((x) => {
    const proxima = janelas[x.antesDoLance];
    const anterior = janelas[x.antesDoLance - 1];
    // No intervalo: a partir dos 45', ou logo depois do último lance do 1º tempo, se ele passou.
    const fim = proxima?.inicio ?? 45 * 60;
    const t = Math.max(anterior?.fim ?? 0, Math.min(45 * 60, fim - DURACAO_TROCA));
    return {
      lado: x.lado,
      lugar: x.lugar,
      ocupante: escalacoes[x.lado].jogadores.length + x.banco,
      saiu: x.lugar,
      antesDoLance: x.antesDoLance,
      t,
      foraDePosicao: !!x.foraDePosicao,
    };
  });
}

/** Quem ocupava o lugar no lance `indiceLance` (índice em titulares + Banco). */
export function ocupanteNoLance(r: Pick<ResultadoPartida, 'substituicoes'>, titulares: number, lado: Lado, lugar: number, indiceLance: number): number {
  const x = r.substituicoes?.find((s) => s.lado === lado && s.lugar === lugar && indiceLance >= s.antesDoLance);
  return x ? titulares + x.banco : lugar;
}

/** O índice (titulares + Banco) de um desempenho: o reserva que ENTROU não é o titular do lugar. */
export function ocupanteDoDesempenho(r: Pick<ResultadoPartida, 'substituicoes'>, titulares: number, d: Pick<Desempenho, 'slot' | 'substituicao'>): number {
  if (d.substituicao !== 'ENTROU') return d.slot.indice;
  const x = r.substituicoes?.find((s) => s.lado === d.slot.lado && s.lugar === d.slot.indice);
  return x ? titulares + x.banco : d.slot.indice;
}
