import type { JogadorPublico } from '@liga/shared';

/**
 * Pontos do gráfico do OVR: a estreia, cada jogo e, para quem subiu pelo Piso da Temporada 1,
 * o degrau do Piso logo depois do último jogo da T1 (ADR-0078). Os ajustes à mão do dono
 * entram como degraus depois do jogo em que foram feitos (ADR-0079), sem marca própria.
 */
export type PontoDoOvr = { v: number; tipo: 'ESTREIA' | 'JOGO' | 'PISO' | 'DEGRAU'; jogo: number };
export function pontosDoOvr(j: Pick<JogadorPublico, 'ovrInicial' | 'historico' | 'pisoT1' | 'degraus'>): PontoDoOvr[] {
  const pontos: PontoDoOvr[] = [{ v: j.ovrInicial, tipo: 'ESTREIA', jogo: 0 }];
  const degraus = (jogo: number) => {
    for (const d of j.degraus ?? []) if (d.jogo === jogo) pontos.push({ v: d.ovr, tipo: 'DEGRAU', jogo });
  };
  degraus(0);
  const ultimoDaT1 = j.pisoT1 ? j.historico.reduce((u, h, i) => (h.temporada === 1 ? i : u), -1) : -1;
  j.historico.forEach((h, i) => {
    pontos.push({ v: h.ovr, tipo: 'JOGO', jogo: i + 1 });
    if (i === ultimoDaT1 && j.pisoT1) pontos.push({ v: j.pisoT1.depois, tipo: 'PISO', jogo: i + 1 });
    degraus(i + 1);
  });
  return pontos;
}

/**
 * Quanto o OVR mudou, para o card: desde a estreia ou, para quem teve ajuste à mão, desde o
 * último ajuste, com um texto que não revela o ajuste (ADR-0079).
 */
export function variacaoDoOvr(j: Pick<JogadorPublico, 'ovr' | 'ovrInicial' | 'base'>): { delta: number; desde: string } {
  return j.base ? { delta: j.ovr - j.base.ovr, desde: 'nos últimos jogos' } : { delta: j.ovr - j.ovrInicial, desde: 'desde a estreia' };
}
