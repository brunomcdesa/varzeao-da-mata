import { habilidadesDoPerfil, posicoesDaFormacao, type Escalacao, type Formacao, type Habilidades, type JogadorEscalado, type Posicao, type TimeId } from '@liga/shared';

export const FORMACAO_ORDEM: readonly Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];

/** Jogador com Habilidades do perfil da Posição para esse OVR. */
export function jogador(jogadorId: string | null, posicao: Posicao, ovr: number, ruido?: Partial<Habilidades>): JogadorEscalado {
  return { jogadorId, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr, ruido) };
}

/** Escalação com todos os Jogadores no mesmo OVR (ou OVRs explícitos na ordem GOL, ZAG, ZAG, MEI, MEI, ATA, ATA). */
export function escalacao(time: TimeId, ovr: number | readonly number[], prefixo: string = time): Escalacao {
  return {
    time,
    jogadores: FORMACAO_ORDEM.map((posicao, i) => jogador(`${prefixo}-${i}`, posicao, typeof ovr === 'number' ? ovr : ovr[i]!)),
  };
}

/** Escalação de uma Formação (ADR-0044), todos no mesmo OVR. */
export function escalacaoNa(formacao: Formacao, time: TimeId, ovr: number, prefixo: string = time): Escalacao {
  return { time, jogadores: posicoesDaFormacao(formacao).map((posicao, i) => jogador(`${prefixo}-${i}`, posicao, ovr)) };
}
