/**
 * Escalação de uma Partida (job `partida`, passo 1): 7 lugares por Time (na T2, nas vagas da
 * Formação, com quem sobrou de outra Posição jogando fora de posição, ADR-0044), com
 * rodízio do Elenco, Craque da Rodada anterior garantido, prioridade para quem confirmou
 * Presença (T2) e, no Clássico da T2, para quem tem Resenha, e Jogadores da Base completando as vagas. Só conta quem se
 * inscreveu até o Corte (30 min antes do Apito Inicial).
 */
import {
  ehClassico,
  habilidadesDoPerfil,
  ovrDasHabilidades,
  posicoesDaFormacao,
  temRegrasT2,
  VAGAS_DA_FORMACAO,
  FORMACAO_PADRAO,
  type Canto,
  type Escalacao,
  type Especializacao,
  type Formacao,
  type HabilidadeId,
  type Habilidades,
  type Posicao,
  type TimeId,
} from '@liga/shared';
import type { Banco } from './banco.js';
import { FORMACAO, OVR_BASE, habilidadesDe } from './regras.js';
import { capitaoEmCampo, confirmados, formacoesDaPartida, suspensos } from './temporada2.js';

export const CORTE_MINUTOS = 30;

/**
 * Limite de Partidas Fora (ADR-0043): quem ficou esse número de Partidas seguidas do próprio
 * Time fora da Escalação, contando só as Partidas depois da Inscrição, passa na frente no
 * rodízio, no mesmo nível da Presença.
 */
export const LIMITE_FORA = 2;

export interface EscalacaoMontada {
  escalacao: Escalacao;
  /** Formação (ADR-0044): quem teria entrado no 2-2-2 e ficou fora pela Formação escolhida. */
  cortados?: string[];
  /** @ de cada lugar; null = Jogador da Base. */
  nomes: (string | null)[];
  /** Apelido de cada lugar na hora da Escalação (ADR-0014); null = sem apelido. */
  apelidos: (string | null)[];
}

interface Disponivel {
  id: string;
  username: string;
  apelido?: string | null;
  posicao: Posicao;
  ovr: number;
  habilidades: Habilidades;
  jogos: number;
  ultimo: Date | null;
  inscritoEm: Date;
  /** Partidas seguidas do Time fora da Escalação, desde a última jogada (ou desde a Inscrição). */
  fora?: number;
  /** T2: escolhas do site na hora da Escalação. */
  especializacao?: Especializacao | null;
  treino?: HabilidadeId | null;
  canto?: Canto | null;
}

/** T2 (ADRs 0021, 0023 e 0044): quem está suspenso, quem confirmou Presença e a Formação. */
export interface RegrasDaEscalacao {
  suspensos: ReadonlySet<string>;
  confirmados: ReadonlySet<string>;
  /** Sem Formação, 2-2-2. */
  formacao?: Formacao;
  /** Quem a Formação cortou no jogo anterior do Time: prioridade no rodízio (ADR-0044). */
  cortados?: ReadonlySet<string>;
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

/**
 * Ordem do rodízio, por Posição: Craque da Rodada anterior primeiro; depois quem tem
 * prioridade (Limite de Partidas Fora, ADR-0043; na T2 também Presença, ADR-0023, ou Resenha no
 * Clássico, ADR-0039), no mesmo nível; depois
 * quem jogou menos na Temporada; empate, quem jogou há mais tempo (ou nunca); depois quem
 * se inscreveu antes.
 */
export function ordemDoRodizio(a: Disponivel, b: Disponivel, craque: string | null, prioridade?: ReadonlySet<string>): number {
  if (craque) {
    if (a.id === craque && b.id !== craque) return -1;
    if (b.id === craque && a.id !== craque) return 1;
  }
  if (prioridade) {
    const pa = prioridade.has(a.id);
    const pb = prioridade.has(b.id);
    if (pa !== pb) return pa ? -1 : 1;
  }
  if (a.jogos !== b.jogos) return a.jogos - b.jogos;
  const ua = a.ultimo?.getTime() ?? -Infinity;
  const ub = b.ultimo?.getTime() ?? -Infinity;
  if (ua !== ub) return ua - ub;
  if (a.inscritoEm.getTime() !== b.inscritoEm.getTime()) return a.inscritoEm.getTime() - b.inscritoEm.getTime();
  return Number(a.id) - Number(b.id);
}

export async function montarEscalacao(
  banco: Banco,
  o: { time: TimeId; temporadaId: number; corte: Date; craque?: string | null; t2?: RegrasDaEscalacao; resenha?: ReadonlySet<string>; classico?: boolean },
): Promise<EscalacaoMontada> {
  const disponiveis = (
    await banco.query<{ id: string; username: string; apelido: string | null; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; jogos: string; ultimo: string | Date | null; inscrito_em: string | Date; fora: string; especializacao: Especializacao | null; treino: HabilidadeId | null; canto: Canto | null }>(
      `WITH base AS (
         SELECT j.id, j.username, j.apelido, j.posicao, j.ovr, j.habilidades, j.inscrito_em, j.especializacao, j.treino, j.canto,
                count(p.id) AS jogos, max(p.apito_inicial) AS ultimo
         FROM jogador j
         LEFT JOIN escalacao e ON e.jogador_id = j.id
         LEFT JOIN partida p ON p.id = e.partida_id
           AND p.rodada_id IN (SELECT id FROM rodada WHERE temporada_id = $2)
         WHERE j.time_id = $1 AND NOT j.banido AND j.inscrito_em <= $3
         GROUP BY j.id)
       SELECT b.id::text AS id, b.username, b.apelido, b.posicao, b.ovr, b.habilidades, b.inscrito_em, b.especializacao, b.treino, b.canto,
              b.jogos, b.ultimo,
              (SELECT count(*) FROM partida q JOIN rodada r ON r.id = q.rodada_id
               WHERE r.temporada_id = $2 AND (q.mandante_id = $1 OR q.visitante_id = $1)
                 AND q.status <> 'PENDENTE' AND q.apito_inicial < $3
                 AND q.apito_inicial - interval '${CORTE_MINUTOS} minutes' >= b.inscrito_em
                 AND (b.ultimo IS NULL OR q.apito_inicial > b.ultimo)) AS fora
       FROM base b`,
      [o.time, o.temporadaId, o.corte.toISOString()],
    )
  ).rows.map(
    (r): Disponivel => ({
      id: r.id,
      username: r.username,
      apelido: r.apelido,
      posicao: r.posicao,
      ovr: r.ovr,
      habilidades: habilidadesDe(r.posicao, r.ovr, r.habilidades),
      jogos: Number(r.jogos),
      ultimo: r.ultimo ? new Date(r.ultimo) : null,
      inscritoEm: new Date(r.inscrito_em),
      fora: Number(r.fora),
      ...(o.t2 ? { especializacao: r.especializacao, treino: r.treino, canto: r.canto } : {}),
    }),
  ).filter((d) => !o.t2?.suspensos.has(d.id));

  // Prioridade no rodízio, mesmo nível: Limite de Partidas Fora (ADR-0043); na T2, Presença sempre e Resenha só no Clássico (ADR-0039).
  const prioridade = new Set([
    ...disponiveis.filter((d) => (d.fora ?? 0) >= LIMITE_FORA).map((d) => d.id),
    ...(o.classico ? (o.resenha ?? []) : []),
    ...(o.t2?.confirmados ?? []),
    ...(o.t2?.cortados ?? []),
  ]);
  const porPosicao = new Map<Posicao, Disponivel[]>();
  for (const d of disponiveis) porPosicao.set(d.posicao, [...(porPosicao.get(d.posicao) ?? []), d]);
  for (const lista of porPosicao.values()) lista.sort((a, b) => ordemDoRodizio(a, b, o.craque ?? null, prioridade));
  const resenha = o.resenha ?? new Set<string>();

  // T2 (ADR-0044): as vagas vêm da Formação; na T1, a FORMACAO fixa (2-2-2), como sempre.
  const formacao = o.t2 ? (o.t2.formacao ?? FORMACAO_PADRAO) : null;
  const vagas: readonly Posicao[] = formacao ? posicoesDaFormacao(formacao) : FORMACAO;
  // Quem o 2-2-2 teria posto em campo, para saber quem a Formação cortou.
  const noPadrao = new Set(
    (['GOL', 'ZAG', 'MEI', 'ATA'] as const).flatMap((p) => (porPosicao.get(p) ?? []).slice(0, VAGAS_DA_FORMACAO[FORMACAO_PADRAO][p]).map((d) => d.id)),
  );

  const escolhidos: (Disponivel | null)[] = vagas.map((posicao) => porPosicao.get(posicao)?.shift() ?? null);
  // Vaga sem inscrito da Posição: na T2, quem sobrou de outra Posição joga fora de posição.
  const foraDePosicao = new Set<number>();
  if (formacao) {
    vagas.forEach((posicao, lugar) => {
      if (escolhidos[lugar]) return;
      for (const origem of QUEM_COBRE[posicao]) {
        const d = porPosicao.get(origem)?.shift();
        if (d) {
          escolhidos[lugar] = d;
          foraDePosicao.add(lugar);
          return;
        }
      }
    });
  }

  const jogadores: Escalacao['jogadores'][number][] = [];
  const nomes: (string | null)[] = [];
  const apelidos: (string | null)[] = [];
  vagas.forEach((posicao, lugar) => {
    const proximo = escolhidos[lugar];
    const fora = foraDePosicao.has(lugar);
    jogadores.push(
      proximo
        ? {
            jogadorId: proximo.id,
            posicao,
            // Fora de posição, o OVR sai pelos pesos da vaga (ADR-0044).
            ovr: fora ? ovrDasHabilidades(posicao, proximo.habilidades) : proximo.ovr,
            habilidades: proximo.habilidades,
            ...(fora ? { posicaoDeOrigem: proximo.posicao } : {}),
            ...(proximo.especializacao && !fora ? { especializacao: proximo.especializacao } : {}),
            ...(proximo.treino ? { treino: proximo.treino } : {}),
            ...(proximo.canto ? { canto: proximo.canto } : {}),
            ...(resenha.has(proximo.id) ? { resenha: true } : {}),
          }
        : { jogadorId: null, posicao, ovr: OVR_BASE, habilidades: habilidadesDoPerfil(posicao, OVR_BASE) },
    );
    nomes.push(proximo ? `@${proximo.username}` : null);
    apelidos.push(proximo?.apelido ?? null);
  });
  const emCampo = new Set(escolhidos.flatMap((d) => (d ? [d.id] : [])));
  const cortados = formacao ? [...noPadrao].filter((id) => !emCampo.has(id)) : [];
  return { escalacao: { time: o.time, jogadores }, nomes, apelidos, ...(formacao ? { cortados } : {}) };
}

/**
 * Formação (ADR-0044): quem a Formação cortou no último jogo escalado do Time antes desta
 * Partida. Ganha prioridade no rodízio (uma vez: no jogo seguinte já não conta).
 */
export async function cortadosNoJogoAnterior(b: Banco, time: TimeId, partidaId: number, apito: Date): Promise<Set<string>> {
  const anterior = (
    await b.query<{ id: number }>(
      `SELECT id FROM partida WHERE (mandante_id = $1 OR visitante_id = $1) AND id <> $2 AND status <> 'PENDENTE' AND apito_inicial < $3
       ORDER BY apito_inicial DESC LIMIT 1`,
      [time, partidaId, apito.toISOString()],
    )
  ).rows[0];
  if (!anterior) return new Set();
  const linhas = (
    await b.query<{ id: string }>(
      `SELECT c.jogador_id::text AS id FROM corte_da_formacao c JOIN jogador j ON j.id = c.jogador_id WHERE c.partida_id = $1 AND j.time_id = $2`,
      [anterior.id, time],
    )
  ).rows;
  return new Set(linhas.map((l) => l.id));
}

/**
 * Resenha (ADRs 0034 e 0039): os Jogadores do Time que comentaram, até o Corte, no Reels do
 * último jogo do Time que foi ao ar antes desta Partida. Qualquer comentário vale, e um basta.
 * Dá evolução mais rápida para quem é escalado e, no Clássico da T2, prioridade no rodízio.
 */
export async function comResenha(b: Banco, time: TimeId, apito: Date, corte: Date): Promise<Set<string>> {
  const linhas = (
    await b.query<{ id: string }>(
      `SELECT j.id::text AS id FROM jogador j
       WHERE j.time_id = $1 AND EXISTS (
         SELECT 1 FROM comando c
         WHERE c.ig_user_id = j.ig_user_id AND c.comentado_em <= $3
           AND c.ig_media_id = (
             SELECT p.ig_media_id FROM partida p
             WHERE (p.mandante_id = $1 OR p.visitante_id = $1) AND p.ig_media_id IS NOT NULL AND p.apito_inicial < $2
             ORDER BY p.apito_inicial DESC LIMIT 1))`,
      [time, apito.toISOString(), corte.toISOString()],
    )
  ).rows;
  return new Set(linhas.map((l) => l.id));
}

export interface PartidaEscalada {
  partidaId: number;
  escalacoes: { mandante: Escalacao; visitante: Escalacao };
  nomes: { mandante: (string | null)[]; visitante: (string | null)[] };
  apelidos: { mandante: (string | null)[]; visitante: (string | null)[] };
}

/**
 * Escala as duas equipes de uma Partida e grava em `escalacao` (status → ESCALADA).
 * Se a Partida já foi escalada, devolve a Escalação gravada: reexecutar retoma de onde parou.
 */
export async function escalarPartida(banco: Banco, partidaId: number, o: { craque?: string | null; vinculos?: ReadonlySet<string> } = {}): Promise<PartidaEscalada> {
  return banco.transacao(async (b) => {
    const p = (
      await b.query<{ mandante_id: TimeId; visitante_id: TimeId; apito_inicial: string | Date; status: string; temporada_id: number; numero: number }>(
        `SELECT p.mandante_id, p.visitante_id, p.apito_inicial, p.status, r.temporada_id, t.numero
         FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id WHERE p.id = $1 FOR UPDATE OF p`,
        [partidaId],
      )
    ).rows[0];
    if (!p) throw new Error(`Partida ${partidaId} não existe`);

    if (p.status !== 'PENDENTE') return lerEscalacao(b, partidaId, p.mandante_id, p.visitante_id);

    const corte = new Date(new Date(p.apito_inicial).getTime() - CORTE_MINUTOS * 60_000);
    // T2: Suspensão e Presença entram na Escalação (ADRs 0021 e 0023).
    // Formação (ADR-0044): escolhida até o Corte; quem ela cortou no jogo anterior tem prioridade.
    const formacoes = temRegrasT2(p.numero) ? await formacoesDaPartida(b, partidaId, p.mandante_id, p.visitante_id) : null;
    const regras = async (time: TimeId, formacao: Formacao | undefined): Promise<RegrasDaEscalacao | undefined> =>
      temRegrasT2(p.numero)
        ? {
            suspensos: await suspensos(b, time, partidaId),
            confirmados: await confirmados(b, partidaId),
            ...(formacao ? { formacao } : {}),
            cortados: await cortadosNoJogoAnterior(b, time, partidaId, new Date(p.apito_inicial)),
          }
        : undefined;
    const regrasM = await regras(p.mandante_id, formacoes?.mandante);
    const regrasV = await regras(p.visitante_id, formacoes?.visitante);
    // Resenha (ADRs 0034 e 0039): a evolução vale nas duas Temporadas; a prioridade no rodízio, só no Clássico da T2.
    const classico = temRegrasT2(p.numero) && ehClassico(p.mandante_id, p.visitante_id);
    const apito = new Date(p.apito_inicial);
    const resenhaM = await comResenha(b, p.mandante_id, apito, corte);
    const resenhaV = await comResenha(b, p.visitante_id, apito, corte);
    const mandante = await montarEscalacao(b, { time: p.mandante_id, temporadaId: p.temporada_id, corte, craque: o.craque ?? null, resenha: resenhaM, classico, ...(regrasM ? { t2: regrasM } : {}) });
    const visitante = await montarEscalacao(b, { time: p.visitante_id, temporadaId: p.temporada_id, corte, craque: o.craque ?? null, resenha: resenhaV, classico, ...(regrasV ? { t2: regrasV } : {}) });
    for (const m of [mandante, visitante]) {
      for (const [lugar, j] of m.escalacao.jogadores.entries()) {
        await b.query(
          `INSERT INTO escalacao (partida_id, time_id, lugar, jogador_id, posicao, ovr_antes, habilidades_antes, apelido, especializacao, treino, canto, resenha, posicao_de_origem) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [partidaId, m.escalacao.time, lugar, j.jogadorId, j.posicao, j.ovr, JSON.stringify(j.habilidades), m.apelidos[lugar] ?? null, j.especializacao ?? null, j.treino ?? null, j.canto ?? null, j.resenha ?? false, j.posicaoDeOrigem ?? null],
        );
      }
      for (const id of m.cortados ?? []) {
        await b.query(`INSERT INTO corte_da_formacao (partida_id, jogador_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [partidaId, id]);
      }
    }
    // T2: a faixa de Capitão fica com quem está em campo (ADR-0020).
    if (temRegrasT2(p.numero)) {
      for (const m of [mandante, visitante]) {
        const time = m.escalacao.time;
        const emCampo = new Set(m.escalacao.jogadores.map((j) => j.jogadorId).filter((id): id is string => id !== null));
        const c = await capitaoEmCampo(b, partidaId, time, emCampo, o.vinculos ?? new Set());
        if (c) await b.query(`UPDATE escalacao SET capitao = true WHERE partida_id = $1 AND time_id = $2 AND jogador_id = $3`, [partidaId, time, c]);
      }
    }
    await b.query(`UPDATE partida SET status = 'ESCALADA' WHERE id = $1`, [partidaId]);
    return {
      partidaId,
      escalacoes: { mandante: mandante.escalacao, visitante: visitante.escalacao },
      nomes: { mandante: mandante.nomes, visitante: visitante.nomes },
      apelidos: { mandante: mandante.apelidos, visitante: visitante.apelidos },
    };
  });
}

async function lerEscalacao(b: Banco, partidaId: number, mandante: TimeId, visitante: TimeId): Promise<PartidaEscalada> {
  const linhas = (
    await b.query<{ time_id: TimeId; jogador_id: string | null; posicao: Posicao; ovr_antes: number; habilidades_antes: Habilidades | string | null; username: string | null; apelido: string | null; especializacao: Especializacao | null; treino: HabilidadeId | null; canto: Canto | null; resenha: boolean; posicao_de_origem: Posicao | null }>(
      `SELECT e.time_id, e.jogador_id::text AS jogador_id, e.posicao, e.ovr_antes, e.habilidades_antes, j.username, e.apelido, e.especializacao, e.treino, e.canto, e.resenha, e.posicao_de_origem
       FROM escalacao e LEFT JOIN jogador j ON j.id = e.jogador_id
       WHERE e.partida_id = $1 ORDER BY e.lugar`,
      [partidaId],
    )
  ).rows;
  const de = (time: TimeId) => {
    const minhas = linhas.filter((l) => l.time_id === time);
    return {
      escalacao: {
        time,
        jogadores: minhas.map((l) => ({
          jogadorId: l.jogador_id,
          posicao: l.posicao,
          ovr: l.ovr_antes,
          habilidades: habilidadesDe(l.posicao, l.ovr_antes, l.habilidades_antes),
          ...(l.especializacao ? { especializacao: l.especializacao } : {}),
          ...(l.treino ? { treino: l.treino } : {}),
          ...(l.canto ? { canto: l.canto } : {}),
          ...(l.resenha ? { resenha: true } : {}),
          ...(l.posicao_de_origem ? { posicaoDeOrigem: l.posicao_de_origem } : {}),
        })),
      } as Escalacao,
      nomes: minhas.map((l) => (l.username ? `@${l.username}` : null)),
      apelidos: minhas.map((l) => l.apelido ?? null),
    };
  };
  const m = de(mandante);
  const v = de(visitante);
  return { partidaId, escalacoes: { mandante: m.escalacao, visitante: v.escalacao }, nomes: { mandante: m.nomes, visitante: v.nomes }, apelidos: { mandante: m.apelidos, visitante: v.apelidos } };
}
