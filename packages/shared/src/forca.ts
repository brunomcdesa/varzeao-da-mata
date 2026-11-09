/**
 * Força do Time (ADR-0028): o OVR médio da escalação provável, e por setor, como no EA FC
 * (Ataque = atacantes, Meio = meias, Defesa = zagueiros e goleiro).
 */
import { OVR_JOGADOR_DA_BASE } from './index.js';
import type { Posicao } from './index.js';

export interface ForcaDoTime {
  ovr: number;
  ataque: number;
  meio: number;
  defesa: number;
}

const VAGAS: Record<Posicao, number> = { GOL: 1, ZAG: 2, MEI: 2, ATA: 2 };

/** Força de uma escalação já montada (7 lugares; null = Jogador da Base). */
export function forcaDaEscalacao(lugares: { posicao: Posicao; ovr: number | null }[]): ForcaDoTime {
  const media = (ps: Posicao[]) => {
    const xs = lugares.filter((l) => ps.includes(l.posicao)).map((l) => l.ovr ?? OVR_JOGADOR_DA_BASE);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : OVR_JOGADOR_DA_BASE;
  };
  return { ovr: media(['GOL', 'ZAG', 'MEI', 'ATA']), ataque: media(['ATA']), meio: media(['MEI']), defesa: media(['GOL', 'ZAG']) };
}

/**
 * Escalação provável do próximo jogo, pela regra do rodízio: em cada posição entra quem jogou
 * menos na Temporada (empate: quem se inscreveu antes); vaga sem inscrito é da Base.
 */
export function forcaProvavel(elenco: { posicao: Posicao; ovr: number; jogos: number; inscritoEm: string }[]): ForcaDoTime {
  const lugares: { posicao: Posicao; ovr: number | null }[] = [];
  for (const posicao of Object.keys(VAGAS) as Posicao[]) {
    const fila = elenco.filter((j) => j.posicao === posicao).sort((a, b) => a.jogos - b.jogos || a.inscritoEm.localeCompare(b.inscritoEm));
    for (let i = 0; i < VAGAS[posicao]; i++) lugares.push({ posicao, ovr: fila[i]?.ovr ?? null });
  }
  return forcaDaEscalacao(lugares);
}
