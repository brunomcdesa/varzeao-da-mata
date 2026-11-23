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
  // Agradecimento a quem jogou a T1, com a Recompensa (ADR-0047; o Rebalanceamento fica fora, ADR-0058): terça
  // 17/11, 20h de Brasília, depois do Resumo da Temporada (19h).
  { id: 'agradecimento-t1', ref: 2002, publicarEm: '2026-11-17T23:00:00Z' },
  // Abertura da Temporada 2: terça 17/11, 21h de Brasília, depois do Resumo da Temporada (19h)
  // e do Agradecimento (20h).
  { id: 'abertura-t2', ref: 2001, publicarEm: '2026-11-18T00:00:00Z' },
  // Rebalanceamento da T2 (ADR-0067): quarta 18/11, 10h de Brasília, antes das Novidades. O
  // Rebalanceamento roda na terça, quando a T2 nasce.
  { id: 'rebalanceamento-t2', ref: 2007, publicarEm: '2026-11-18T13:00:00Z' },
  // Novidades da T2 (ADR-0063): quarta 18/11, um Reels por tema, nos horários dos jogos da T1
  // (12h, 14h, 16h e 18h de Brasília).
  { id: 'novidades-campo', ref: 2003, publicarEm: '2026-11-18T15:00:00Z' },
  { id: 'novidades-capitao', ref: 2004, publicarEm: '2026-11-18T17:00:00Z' },
  { id: 'novidades-jogador', ref: 2005, publicarEm: '2026-11-18T19:00:00Z' },
  { id: 'novidades-site', ref: 2006, publicarEm: '2026-11-18T21:00:00Z' },
  // Perfil do Time (ADR-0100): segunda 23/11, 11h de Brasília, logo depois de aprovado (o dono pediu
  // para postar assim que subisse; a gravação foi disparada à mão).
  { id: 'perfil-do-time', ref: 2008, publicarEm: '2026-11-23T14:00:00Z' },
  // Abertura da Temporada 3, com a Copa (ADRs 0088 e 0092): sábado 28/11, 21h de Brasília, depois
  // do Resumo da Temporada 2 (19h). A T3 nasce na sexta à noite, quando sai o Craque da Temporada.
  { id: 'abertura-t3', ref: 2009, publicarEm: '2026-11-29T00:00:00Z' },
  // Novidades da T3 (ADR-0092): domingo 29/11, véspera da Copa, às 12h, 14h, 16h e 18h.
  { id: 'novidades-t3-campo', ref: 2010, publicarEm: '2026-11-29T15:00:00Z' },
  { id: 'novidades-t3-loja', ref: 2011, publicarEm: '2026-11-29T17:00:00Z' },
  { id: 'novidades-t3-palpite', ref: 2012, publicarEm: '2026-11-29T19:00:00Z' },
  { id: 'novidades-t3-capitao', ref: 2013, publicarEm: '2026-11-29T21:00:00Z' },
  // Segunda fase da Loja (ADR-0101): abre no dia da Rodada 4 da Liga da T3 (domingo 06/12), às 10h.
  { id: 'novidades-t3-loja2', ref: 2014, publicarEm: '2026-12-06T13:00:00Z' },
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
