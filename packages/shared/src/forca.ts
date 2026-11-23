/**
 * Força do Time (ADR-0028): o OVR médio da escalação provável, e por setor, como no EA FC
 * (Ataque = atacantes, Meio = meias, Defesa = zagueiros e goleiro).
 */
import { OVR_JOGADOR_DA_BASE, posicoesDaFormacao } from './index.js';
import type { Formacao, Posicao } from './index.js';
import { ovrDasHabilidades, type Habilidades } from './habilidades.js';
import { etapaDa } from './rodada.js';

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
export function forcaProvavel(elenco: { posicao: Posicao; ovr: number; jogos: number; inscritoEm: string }[], inscritosAte: string | null = null): ForcaDoTime {
  return forcaDaEscalacao(escalacaoProvavel(elenco, inscritosAte).map((l) => ({ posicao: l.posicao, ovr: l.ovr })));
}

/**
 * Os 7 lugares da escalação provável (GOL, ZAG, ZAG, MEI, MEI, ATA, ATA); null = Base.
 * `inscritosAte` (Mata-mata, ADR-0057): quem se inscreveu depois disso não entra.
 * `formacao` (ADR-0044): as vagas vêm dela e a vaga sem inscrito da Posição vai para quem
 * sobrou de outra (fora de posição, com o OVR pelos pesos da vaga), como na Escalação.
 */
export function escalacaoProvavel<J extends { posicao: Posicao; ovr: number; jogos: number; inscritoEm: string; habilidades?: Habilidades }>(
  elenco: J[],
  inscritosAte: string | null = null,
  formacao: Formacao | null = null,
): { posicao: Posicao; jogador: J | null; ovr: number | null; posicaoDeOrigem?: Posicao }[] {
  const filas = new Map<Posicao, J[]>();
  for (const posicao of Object.keys(VAGAS) as Posicao[]) {
    filas.set(posicao, elenco.filter((j) => j.posicao === posicao && !foraDoMataMata(j, inscritosAte)).sort((a, b) => a.jogos - b.jogos || a.inscritoEm.localeCompare(b.inscritoEm)));
  }
  // Sem Formação: o 2-2-2 da T1, e vaga sem inscrito é da Base.
  const vagas: Posicao[] = formacao ? posicoesDaFormacao(formacao) : (Object.keys(VAGAS) as Posicao[]).flatMap((p) => Array<Posicao>(VAGAS[p]).fill(p));
  const lugares: { posicao: Posicao; jogador: J | null; ovr: number | null; posicaoDeOrigem?: Posicao }[] = vagas.map((posicao) => {
    const j = filas.get(posicao)!.shift() ?? null;
    return { posicao, jogador: j, ovr: j?.ovr ?? null };
  });
  // Com Formação (ADR-0044): vaga sem inscrito da Posição vai para quem sobrou de outra, fora de posição.
  if (formacao) {
    for (const l of lugares) {
      if (l.jogador) continue;
      for (const origem of QUEM_COBRE[l.posicao]) {
        const j = filas.get(origem)!.shift();
        if (!j) continue;
        l.jogador = j;
        l.posicaoDeOrigem = origem;
        l.ovr = j.habilidades ? ovrDasHabilidades(l.posicao, j.habilidades) : j.ovr;
        break;
      }
    }
  }
  return lugares;
}

/**
 * Formação (ADR-0044): de onde vem quem cobre uma vaga sem inscrito da Posição. Primeiro a
 * Posição vizinha, depois a outra. Goleiro só joga no gol, e ninguém de linha vai para o gol.
 */
export const QUEM_COBRE: Readonly<Record<Posicao, readonly Posicao[]>> = {
  GOL: [],
  ZAG: ['MEI', 'ATA'],
  MEI: ['ZAG', 'ATA'],
  ATA: ['MEI', 'ZAG'],
};

/** Minutos antes do Apito Inicial em que a Escalação sai (o Corte). */
export const CORTE_MINUTOS = 30;

type JogoDoCalendario = { fase: 'LIGA' | 'MATA_MATA'; rodada: number; apito: string; mandante: string; visitante: string; situacao: string; classificado?: string };

/**
 * Mata-mata (ADR-0057) na escalação provável: se o próximo jogo do Time é do Mata-mata, só entra
 * quem se inscreveu até o Corte do último jogo dele na Fase de Liga. Devolve esse instante (ISO),
 * ou null quando vale o Elenco todo (próximo jogo na Fase de Liga, ou nenhum jogo pela frente).
 * Entre a Semifinal e a criação da Final, quem venceu a Semifinal já conta como no Mata-mata.
 */
export function inscritosAteNoProximoJogo(calendario: readonly JogoDoCalendario[], time: string): string | null {
  const doTime = calendario.filter((p) => p.mandante === time || p.visitante === time).sort((a, b) => a.apito.localeCompare(b.apito));
  const proximo = doTime.find((p) => p.situacao !== 'ENCERRADA');
  const ultimo = doTime.filter((p) => p.situacao === 'ENCERRADA').at(-1);
  // A Copa (ADR-0088) vem antes da Fase de Liga: nela joga o Elenco todo.
  const noMataMata = proximo ? proximo.fase === 'MATA_MATA' && etapaDa(proximo.fase, proximo.rodada) !== 'COPA' : !!ultimo && ultimo.classificado === time && etapaDa(ultimo.fase, ultimo.rodada) === 'SEMIFINAL';
  if (!noMataMata) return null;
  const ultimoDaLiga = doTime.filter((p) => p.fase === 'LIGA').at(-1);
  return ultimoDaLiga ? new Date(Date.parse(ultimoDaLiga.apito) - CORTE_MINUTOS * 60_000).toISOString() : null;
}

/** Fica fora do Mata-mata: entrou no Elenco depois do limite (estreia na próxima Temporada). */
export function foraDoMataMata(j: { inscritoEm: string }, inscritosAte: string | null): boolean {
  return inscritosAte !== null && Date.parse(j.inscritoEm) > Date.parse(inscritosAte);
}
