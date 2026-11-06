import type { Escalacao, JogadorEscalado, Posicao, TimeId } from '@liga/shared';

const FORMACAO_ORDEM: readonly Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];

/** Escalação com todos os Jogadores no mesmo OVR (ou OVRs explícitos na ordem GOL, ZAG, ZAG, MEI, MEI, ATA, ATA). */
export function escalacao(time: TimeId, ovr: number | readonly number[], prefixo: string = time): Escalacao {
  const jogadores: JogadorEscalado[] = FORMACAO_ORDEM.map((posicao, i) => ({
    jogadorId: `${prefixo}-${i}`,
    posicao,
    ovr: typeof ovr === 'number' ? ovr : ovr[i]!,
  }));
  return { time, jogadores };
}
