import type { JogadorPublico } from '@liga/shared';

/**
 * Pontos do gráfico do OVR: a estreia, cada jogo e, para quem subiu pelo Piso da Temporada 1,
 * o degrau do Piso logo depois do último jogo da T1 (ADR-0078).
 */
export type PontoDoOvr = { v: number; tipo: 'ESTREIA' | 'JOGO' | 'PISO'; jogo: number };
export function pontosDoOvr(j: Pick<JogadorPublico, 'ovrInicial' | 'historico' | 'pisoT1'>): PontoDoOvr[] {
  const pontos: PontoDoOvr[] = [{ v: j.ovrInicial, tipo: 'ESTREIA', jogo: 0 }];
  const ultimoDaT1 = j.pisoT1 ? j.historico.reduce((u, h, i) => (h.temporada === 1 ? i : u), -1) : -1;
  j.historico.forEach((h, i) => {
    pontos.push({ v: h.ovr, tipo: 'JOGO', jogo: i + 1 });
    if (i === ultimoDaT1 && j.pisoT1) pontos.push({ v: j.pisoT1.depois, tipo: 'PISO', jogo: i + 1 });
  });
  return pontos;
}
