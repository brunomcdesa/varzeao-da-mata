/**
 * Reels Programados (ADR-0051): Reels de anúncio com dia e hora marcados, que saem sozinhos.
 * A borda dispara o workflow `programados` 90 e 60 minutos antes de cada um; o job grava o vídeo,
 * cria o container e põe na agenda, e a borda publica na hora.
 */
export interface ReelsProgramado {
  /** Identificador estável (também o nome do vídeo e da marca de "já agendado"). */
  id: string;
  /** Número na agenda da borda (tipo APRESENTACAO): único entre os Programados. */
  ref: number;
  /** Quando publicar, em UTC. */
  publicarEm: string;
}

export const REELS_PROGRAMADOS: readonly ReelsProgramado[] = [
  // Abertura da Temporada 2: terça 17/11, 12h de Brasília.
  { id: 'abertura-t2', ref: 2001, publicarEm: '2026-11-17T15:00:00Z' },
  // Agradecimento a quem jogou a T1, com a Recompensa e o Rebalanceamento (ADR-0047): terça
  // 17/11, 20h de Brasília, depois do Resumo da Temporada (19h).
  { id: 'agradecimento-t1', ref: 2002, publicarEm: '2026-11-17T23:00:00Z' },
];

/** O job grava a partir de 2 h antes e ainda tenta até 1 h depois do horário. */
export const GRAVAR_DESDE_MIN = 120;
export const TENTAR_ATE_MIN = 60;
/** Minutos antes do horário em que a borda dispara o workflow (o segundo é a reserva). */
export const DISPAROS_ANTES_MIN = [90, 60] as const;

/** Programados que o job deve gravar e agendar agora. */
export function programadosDaVez(agora: Date, lista: readonly ReelsProgramado[] = REELS_PROGRAMADOS): ReelsProgramado[] {
  const t = agora.getTime();
  return lista.filter((p) => {
    const em = Date.parse(p.publicarEm);
    return t >= em - GRAVAR_DESDE_MIN * 60_000 && t < em + TENTAR_ATE_MIN * 60_000;
  });
}

/** Se a borda dispara o workflow `programados` neste minuto. */
export function dispararProgramadosAgora(agora: Date, lista: readonly ReelsProgramado[] = REELS_PROGRAMADOS): boolean {
  const minuto = Math.floor(agora.getTime() / 60_000);
  return lista.some((p) => DISPAROS_ANTES_MIN.some((antes) => Math.floor(Date.parse(p.publicarEm) / 60_000) - antes === minuto));
}
