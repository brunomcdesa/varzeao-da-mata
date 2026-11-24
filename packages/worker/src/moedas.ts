/**
 * Moedas (ADRs 0087, 0089 e 0090): Salário, prêmios, Palpite e Conquistas, todos no extrato
 * (`lancamento_moedas`). Cada pagamento tem referência única, então qualquer função aqui pode
 * rodar de novo sem pagar duas vezes. O que sai de uma Partida só aparece no fim do Ao Vivo.
 */
import {
  CONQUISTAS,
  MOEDAS,
  MOEDAS_DO_NIVEL,
  destaquesDaRodada,
  duracaoAoVivoMs,
  ehClassico,
  pontosDoPalpite,
  temMoedas,
  type CarreiraAteAqui,
  type Serie,
  type TimeId,
} from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { desempenhosDasPartidas } from './destaques.js';
import { craqueDaRodada } from './resumo.js';
import { lancar } from './carteira.js';
export { carteiraDoJogador, lancar, registrarPalpite, saldo } from './carteira.js';

const diaTexto = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

interface PartidaPaga {
  id: number;
  apito: Date | string;
  fase: 'LIGA' | 'MATA_MATA';
  temporada: number;
  dia: string | Date;
  resultado: ResultadoPartida | null;
}

/**
 * Depois da simulação: gols e assistências, os Palpites da Partida (com o teto do dia) e as
 * Conquistas. Tudo visível só no fim do Ao Vivo.
 */
export async function pagarPartida(b: Banco, partidaId: number): Promise<void> {
  const p = (
    await b.query<PartidaPaga>(
      `SELECT p.id, p.apito_inicial AS apito, r.fase, t.numero AS temporada, r.data AS dia, p.resultado
       FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id WHERE p.id = $1`,
      [partidaId],
    )
  ).rows[0];
  if (!p?.resultado || !temMoedas(p.temporada)) return;
  const visivelEm = new Date(new Date(p.apito).getTime() + duracaoAoVivoMs(p.fase));
  const ref = `p${p.id}`;
  // Técnico (ADR-0106): 3 por vitória do Time dele (na Copa também).
  if (p.resultado.vencedor) {
    const venceu = p.resultado.times[p.resultado.vencedor];
    const tec = (await b.query<{ id: string }>(`SELECT jogador_id::text AS id FROM tecnico WHERE time_id = $1 AND status = 'ATIVO'`, [venceu])).rows[0];
    if (tec) await lancar(b, { jogadorId: tec.id, tipo: 'VITORIA', referencia: ref, valor: MOEDAS.VITORIA_DO_TECNICO, descricao: 'Vitória do Time', visivelEm });
  }
  for (const d of p.resultado.desempenhos) {
    if (!d.jogadorId) continue;
    if (d.gols > 0) await lancar(b, { jogadorId: d.jogadorId, tipo: 'GOL', referencia: ref, valor: d.gols * MOEDAS.GOL, descricao: d.gols === 1 ? 'Gol' : `${d.gols} gols`, visivelEm });
    if (d.assistencias > 0)
      await lancar(b, { jogadorId: d.jogadorId, tipo: 'ASSISTENCIA', referencia: ref, valor: d.assistencias * MOEDAS.ASSISTENCIA, descricao: d.assistencias === 1 ? 'Assistência' : `${d.assistencias} assistências`, visivelEm });
  }
  await pagarPalpites(b, p, visivelEm);
  await atualizarConquistas(b);
}

/** Palpite (ADR-0089): 2 no resultado, 5 no placar exato, até 10 Moedas por dia; o resto vai só para o ranking. */
async function pagarPalpites(b: Banco, p: PartidaPaga, visivelEm: Date): Promise<void> {
  const placar = { mandante: p.resultado!.gols.mandante, visitante: p.resultado!.gols.visitante };
  const dia = diaTexto(p.dia);
  const palpites = (await b.query<{ jogador_id: string; mandante: number; visitante: number }>(`SELECT jogador_id::text AS jogador_id, mandante, visitante FROM palpite WHERE partida_id = $1 AND pontos IS NULL`, [p.id])).rows;
  for (const x of palpites) {
    const pontos = pontosDoPalpite(x, placar);
    await b.query(`UPDATE palpite SET pontos = $3 WHERE jogador_id = $1 AND partida_id = $2`, [x.jogador_id, p.id, pontos]);
    if (!pontos) continue;
    const ja = Number((await b.query<{ s: string | null }>(`SELECT sum(valor) AS s FROM lancamento_moedas WHERE jogador_id = $1 AND tipo = 'PALPITE' AND dia = $2`, [x.jogador_id, dia])).rows[0]?.s ?? 0);
    const valor = Math.min(pontos, Math.max(0, MOEDAS.TETO_DO_PALPITE_POR_DIA - ja));
    if (valor > 0) await lancar(b, { jogadorId: x.jogador_id, tipo: 'PALPITE', referencia: `p${p.id}`, valor, descricao: pontos === MOEDAS.PALPITE_EXATO ? 'Palpite no placar exato' : 'Palpite no resultado', dia, visivelEm });
  }
}

/**
 * Fim do dia (job resumo): Salário de todo o Elenco, Seleção da Rodada e o Craque da Rodada
 * anterior (a votação dele fechou no Corte do primeiro jogo deste dia).
 */
export async function pagarRodada(b: Banco, rodadaId: number): Promise<void> {
  const r = (
    await b.query<{ temporada_id: number; temporada: number; dia: string | Date; ultimo: Date | string | null; fase: 'LIGA' | 'MATA_MATA' }>(
      `SELECT r.temporada_id, t.numero AS temporada, r.data AS dia, r.fase, (SELECT max(p.apito_inicial) FROM partida p WHERE p.rodada_id = r.id) AS ultimo
       FROM rodada r JOIN temporada t ON t.id = r.temporada_id WHERE r.id = $1`,
      [rodadaId],
    )
  ).rows[0];
  if (!r?.ultimo || !temMoedas(r.temporada)) return;
  const visivelEm = new Date(new Date(r.ultimo).getTime() + duracaoAoVivoMs(r.fase));
  const ref = `r${rodadaId}`;
  // Salário (ADR-0087): todo o Elenco dos Times da Temporada, jogando ou não, igual na A e na B.
  const elenco = (
    await b.query<{ id: string }>(
      `SELECT j.id::text AS id FROM jogador j JOIN serie_do_time s ON s.time_id = j.time_id AND s.temporada_id = $1 WHERE NOT j.banido AND j.inscrito_em <= $2`,
      [r.temporada_id, new Date(r.ultimo).toISOString()],
    )
  ).rows;
  for (const j of elenco) await lancar(b, { jogadorId: j.id, tipo: 'SALARIO', referencia: ref, valor: MOEDAS.SALARIO, descricao: 'Salário do dia', visivelEm });
  // Técnico (ADR-0106): o mesmo Salário, pelos Times da Temporada.
  const tecnicos = (
    await b.query<{ id: string }>(`SELECT t.jogador_id::text AS id FROM tecnico t JOIN serie_do_time s ON s.time_id = t.time_id AND s.temporada_id = $1 WHERE t.status = 'ATIVO'`, [r.temporada_id])
  ).rows;
  for (const t of tecnicos) await lancar(b, { jogadorId: t.id, tipo: 'SALARIO', referencia: ref, valor: MOEDAS.SALARIO, descricao: 'Salário de Técnico', visivelEm });
  // Seleção da Rodada: a mesma conta do Resumo (por Série).
  const partidas = (await b.query<{ resultado: ResultadoPartida; serie: Serie }>(`SELECT resultado, serie FROM partida WHERE rodada_id = $1 AND resultado IS NOT NULL`, [rodadaId])).rows;
  for (const d of destaquesDaRodada(desempenhosDasPartidas(partidas, true))) {
    await lancar(b, { jogadorId: d.jogadorId, tipo: 'SELECAO_RODADA', referencia: ref, valor: MOEDAS.SELECAO_RODADA, descricao: 'Seleção da Rodada', visivelEm });
  }
  // Craque da Rodada anterior (pela data), de cada Série.
  const anterior = (
    await b.query<{ id: number }>(`SELECT id FROM rodada WHERE temporada_id = $1 AND data < $2 ORDER BY data DESC LIMIT 1`, [r.temporada_id, diaTexto(r.dia)])
  ).rows[0];
  if (anterior) {
    for (const serie of ['A', 'B'] as const) {
      const c = await craqueDaRodada(b, anterior.id, serie);
      if (c) await lancar(b, { jogadorId: c.id, tipo: 'CRAQUE_RODADA', referencia: `r${anterior.id}`, valor: MOEDAS.CRAQUE_RODADA, descricao: 'Craque da Rodada', visivelEm });
    }
  }
}

/** Títulos das Séries (ADR-0087): quem jogou pelo campeão na Temporada; A 50, B 30. */
export async function pagarTitulos(b: Banco, temporadaId: number): Promise<void> {
  const t = (await b.query<{ numero: number; a: TimeId | null; b: TimeId | null }>(`SELECT numero, campeao_id AS a, campeao_b_id AS b FROM temporada WHERE id = $1`, [temporadaId])).rows[0];
  if (!t || !temMoedas(t.numero)) return;
  const fim = (await b.query<{ fim: Date | string }>(`SELECT max(p.apito_inicial) AS fim FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1`, [temporadaId])).rows[0]!.fim;
  const visivelEm = new Date(new Date(fim).getTime() + duracaoAoVivoMs('MATA_MATA'));
  for (const [time, valor, serie] of [[t.a, MOEDAS.TITULO_A, 'A'], [t.b, MOEDAS.TITULO_B, 'B']] as const) {
    if (!time) continue;
    for (const j of [...(await quemJogouPor(b, temporadaId, time, false)), ...(await tecnicoDoTitulo(b, time))]) {
      await lancar(b, { jogadorId: j, tipo: 'TITULO', referencia: `t${temporadaId}`, valor, descricao: `Título da Série ${serie}`, visivelEm });
    }
  }
  await atualizarConquistas(b);
}

/** O Técnico ativo do Time campeão também ganha o Título (ADR-0106). */
async function tecnicoDoTitulo(b: Banco, time: TimeId): Promise<string[]> {
  return (await b.query<{ id: string }>(`SELECT jogador_id::text AS id FROM tecnico WHERE time_id = $1 AND status = 'ATIVO'`, [time])).rows.map((r) => r.id);
}

/** Título da Copa (ADR-0088): 40 para cada Jogador do campeão que entrou em campo na Copa. */
export async function pagarTituloDaCopa(b: Banco, temporadaId: number): Promise<void> {
  const t = (await b.query<{ numero: number; copa: TimeId | null }>(`SELECT numero, campeao_copa_id AS copa FROM temporada WHERE id = $1`, [temporadaId])).rows[0];
  if (!t?.copa || !temMoedas(t.numero)) return;
  const fim = (
    await b.query<{ fim: Date | string }>(`SELECT max(p.apito_inicial) AS fim FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa IS NOT NULL`, [temporadaId])
  ).rows[0]!.fim;
  const visivelEm = new Date(new Date(fim).getTime() + duracaoAoVivoMs('MATA_MATA'));
  for (const j of [...(await quemJogouPor(b, temporadaId, t.copa, true)), ...(await tecnicoDoTitulo(b, t.copa))]) {
    await lancar(b, { jogadorId: j, tipo: 'TITULO_COPA', referencia: `c${temporadaId}`, valor: MOEDAS.TITULO_COPA, descricao: 'Título da Copa', visivelEm });
  }
  await atualizarConquistas(b);
}

/** Quem entrou em campo pelo Time na Temporada (na Copa, só nos jogos dela). */
async function quemJogouPor(b: Banco, temporadaId: number, time: TimeId, soCopa: boolean): Promise<string[]> {
  return (
    await b.query<{ id: string }>(
      `SELECT DISTINCT e.jogador_id::text AS id FROM escalacao e JOIN partida p ON p.id = e.partida_id JOIN rodada r ON r.id = p.rodada_id
       WHERE r.temporada_id = $1 AND e.time_id = $2 AND e.jogador_id IS NOT NULL AND e.nota IS NOT NULL ${soCopa ? 'AND p.copa_etapa IS NOT NULL' : ''}`,
      [temporadaId, time],
    )
  ).rows.map((r) => r.id);
}

/** Bônus de largada (ADR-0087): 20 Moedas por Temporada jogada antes das Moedas (T1 e/ou T2). */
export async function pagarBonusDeLargada(b: Banco, agora: Date): Promise<number> {
  const linhas = (
    await b.query<{ id: string; numero: number }>(
      `SELECT DISTINCT e.jogador_id::text AS id, t.numero FROM escalacao e JOIN partida p ON p.id = e.partida_id JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id
       JOIN jogador_todos j ON j.id = e.jogador_id WHERE e.jogador_id IS NOT NULL AND e.nota IS NOT NULL AND NOT j.banido`,
    )
  ).rows.filter((l) => !temMoedas(l.numero));
  let pagos = 0;
  for (const l of linhas) {
    if (await lancar(b, { jogadorId: l.id, tipo: 'BONUS_LARGADA', referencia: `T${l.numero}`, valor: MOEDAS.BONUS_POR_TEMPORADA, descricao: `Bônus por jogar a Temporada ${l.numero}`, visivelEm: agora })) pagos++;
  }
  return pagos;
}

// ---------------------------------------------------------------- Conquistas (ADR-0090)

interface LinhaDaConquista {
  id: number;
  apito: Date | string;
  fase: 'LIGA' | 'MATA_MATA';
  temporada_id: number;
  temporada: number;
  copa_etapa: string | null;
  etapa_final: boolean;
  serie: Serie;
  resultado: ResultadoPartida;
}

/**
 * Passa por todas as Partidas em ordem e grava a primeira vez que cada Jogador cumpriu cada
 * Conquista. Até a T2 vira só selo; da T3 em diante paga pelo nível. Idempotente.
 */
export async function atualizarConquistas(b: Banco): Promise<number> {
  const ja = new Set(
    (await b.query<{ jogador_id: string; codigo: string }>(`SELECT jogador_id::text AS jogador_id, codigo FROM conquista`)).rows.map((r) => `${r.jogador_id}:${r.codigo}`),
  );
  const partidas = (
    await b.query<LinhaDaConquista>(
      `SELECT p.id, p.apito_inicial AS apito, r.fase, r.temporada_id, t.numero AS temporada, p.copa_etapa, p.serie,
              (r.fase = 'MATA_MATA' AND p.copa_etapa IS NULL AND r.numero = (SELECT max(x.numero) FROM rodada x WHERE x.temporada_id = r.temporada_id AND x.numero < 100)) AS etapa_final,
              jsonb_build_object('times', p.resultado->'times', 'gols', p.resultado->'gols', 'vencedor', p.resultado->'vencedor', 'desempenhos', p.resultado->'desempenhos',
                'lances', coalesce((SELECT jsonb_agg(l) FROM jsonb_array_elements(p.resultado->'lances') l WHERE l ? 'golDePlaca'), '[]'::jsonb)) AS resultado
       FROM partida p JOIN rodada r ON r.id = p.rodada_id JOIN temporada t ON t.id = r.temporada_id
       WHERE p.resultado IS NOT NULL ORDER BY p.apito_inicial, p.id`,
    )
  ).rows;
  const temporadas = (await b.query<{ id: number; a: TimeId | null; b: TimeId | null; copa: TimeId | null }>(`SELECT id, campeao_id AS a, campeao_b_id AS b, campeao_copa_id AS copa FROM temporada`)).rows;
  const campeaoDa = new Map(temporadas.map((t) => [t.id, t]));
  // Quem jogou por qual Time em cada Temporada (para os Títulos), e na Copa.
  const jogouPor = new Set<string>();
  const jogouNaCopa = new Set<string>();
  for (const p of partidas) {
    for (const d of p.resultado.desempenhos) {
      if (!d.jogadorId) continue;
      jogouPor.add(`${p.temporada_id}:${p.resultado.times[d.slot.lado]}:${d.jogadorId}`);
      if (p.copa_etapa) jogouNaCopa.add(`${p.temporada_id}:${p.resultado.times[d.slot.lado]}:${d.jogadorId}`);
    }
  }
  const todos = new Set(partidas.flatMap((p) => p.resultado.desempenhos.flatMap((d) => (d.jogadorId ? [d.jogadorId] : []))));
  const acumulado = new Map<string, Omit<CarreiraAteAqui, 'golsNaPartida' | 'golDePlacaNaPartida' | 'goleiroSemSofrer'>>();
  const de = (id: string) => {
    let a = acumulado.get(id);
    if (!a) acumulado.set(id, (a = { jogos: 0, gols: 0, assistencias: 0, vitorias: 0, classicosVencidos: 0, titulos: 0 }));
    return a;
  };
  let novas = 0;
  for (const p of partidas) {
    const r = p.resultado;
    const vencedor = r.vencedor ?? (r.gols.mandante > r.gols.visitante ? 'mandante' : r.gols.visitante > r.gols.mandante ? 'visitante' : null);
    const classico = ehClassico(r.times.mandante, r.times.visitante);
    const placas = new Set(r.lances.map((l) => (l.finalizador ? `${l.finalizador.lado}:${l.finalizador.indice}` : '')));
    const nestaPartida = new Map<string, Pick<CarreiraAteAqui, 'golsNaPartida' | 'golDePlacaNaPartida' | 'goleiroSemSofrer'>>();
    for (const d of r.desempenhos) {
      if (!d.jogadorId) continue;
      const a = de(d.jogadorId);
      a.jogos++;
      a.gols += d.gols;
      a.assistencias += d.assistencias;
      const venceu = vencedor === d.slot.lado;
      if (venceu) a.vitorias++;
      if (venceu && classico) a.classicosVencidos++;
      nestaPartida.set(d.jogadorId, {
        golsNaPartida: d.gols,
        golDePlacaNaPartida: placas.has(`${d.slot.lado}:${d.slot.indice}`),
        goleiroSemSofrer: d.posicao === 'GOL' && d.golsSofridos === 0,
      });
    }
    // Títulos: na Final de uma Série (quem jogou pelo campeão na Temporada) e na Final da Copa.
    const c = campeaoDa.get(p.temporada_id);
    const campeaoDaPartida = vencedor ? r.times[vencedor] : null;
    if (c && campeaoDaPartida && (p.copa_etapa === 'FINAL' ? c.copa === campeaoDaPartida : p.etapa_final && (c.a === campeaoDaPartida || c.b === campeaoDaPartida))) {
      for (const id of todos) {
        const chave = `${p.temporada_id}:${campeaoDaPartida}:${id}`;
        if (p.copa_etapa ? jogouNaCopa.has(chave) : jogouPor.has(chave)) {
          de(id).titulos++;
          if (!nestaPartida.has(id)) nestaPartida.set(id, { golsNaPartida: 0, golDePlacaNaPartida: false, goleiroSemSofrer: false });
        }
      }
    }
    const visivelEm = new Date(new Date(p.apito).getTime() + duracaoAoVivoMs(p.fase));
    for (const [id, aqui] of nestaPartida) {
      const carreira: CarreiraAteAqui = { ...de(id), ...aqui };
      for (const q of CONQUISTAS) {
        if (ja.has(`${id}:${q.codigo}`) || !q.feita(carreira)) continue;
        ja.add(`${id}:${q.codigo}`);
        const paga = temMoedas(p.temporada);
        await b.query(`INSERT INTO conquista (jogador_id, codigo, partida_id, temporada, pagou, em) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [
          id,
          q.codigo,
          p.id,
          p.temporada,
          paga,
          visivelEm.toISOString(),
        ]);
        if (paga) await lancar(b, { jogadorId: id, tipo: 'CONQUISTA', referencia: q.codigo, valor: MOEDAS_DO_NIVEL[q.nivel], descricao: `Conquista: ${q.nome}`, visivelEm });
        novas++;
      }
    }
  }
  return novas;
}

