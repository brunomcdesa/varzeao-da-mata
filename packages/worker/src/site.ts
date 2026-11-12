/**
 * Dados públicos do site (job `coletar`, passo 5): liga.json, jogadores.json e um
 * partidas/<id>.json por Partida já escalada.
 *
 * Regra de ouro: nada revela o resultado antes do Apito Inicial. A Partida é simulada no
 * Corte (30 min antes), então placar, lances, Notas, Candidatos e até o OVR que mudou só
 * aparecem depois do Apito (o lance a lance) ou do fim do Ao Vivo (placar, tabela, Card).
 * Escalações aparecem assim que existem (a partir do Corte).
 */
import { IDENTIDADE, TIMES, duracaoAoVivoMs, mataMataDaPartida, rotuloDoCandidato, type Serie, ehClassico, etapaDa, type EscalacaoPublica, type Estatisticas, type JogadorPublico, type JogadorResumido, type TemporadaNaHistoria, type LigaPublica, type PartidaNoCalendario, type PartidaPublica, type Posicao, type RodadaPublica, type SituacaoPartida, type TimeId, type Habilidades, type Aparencia, type Especializacao, type HabilidadeId, temRegrasT2, destaquesDaRodada, destaquesDaTemporada, type Destaque } from '@liga/shared';
import { fundadorDe } from './rebalanceamento.js';
import { comSeloT1 } from './recompensaT1.js';
import { TEMPORADA_DOS_DESTAQUES, desempenhosDasPartidas } from './destaques.js';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { seriesDaTemporada, type SeriesDaTemporada } from './series.js';
import { classificar } from './tabela.js';
import { habilidadesDe } from './regras.js';
import { capitaoDaPartida, proximaPartidaDoTime, tamanhoDosElencos } from './temporada2.js';

/** Duração do Ao Vivo de uma Partida (5 min; 7 no Mata-mata, por causa dos pênaltis). */
export const DURACAO_AO_VIVO_MS = duracaoAoVivoMs('LIGA');

interface LinhaPartida {
  id: number;
  rodada_id: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  data: string | Date;
  apito_inicial: string | Date;
  mandante_id: TimeId;
  visitante_id: TimeId;
  status: string;
  resultado: ResultadoPartida | null;
  video_url: string | null;
  narracao_url: string | null;
  vantagem_do_empate: 'mandante' | 'visitante' | null;
  serie: Serie;
}

interface LinhaEscalacao {
  partida_id: number;
  time_id: TimeId;
  lugar: number;
  jogador_id: string | null;
  posicao: Posicao;
  ovr_antes: number;
  habilidades_antes: Habilidades | string | null;
  username: string | null;
  /** Apelido na hora da Escalação (ADR-0014). */
  apelido: string | null;
  /** Capitão em campo (T2, ADR-0020). */
  capitao: boolean;
}

export interface ExportacaoDoSite {
  /** Caminho relativo → conteúdo JSON. */
  arquivos: Map<string, unknown>;
}

interface LinhaTemporada {
  id: number;
  numero: number;
  status: string;
  inicio: string | Date;
  campeao_id: TimeId | null;
  craque_jogador_id: string | null;
  craque_b_jogador_id: string | null;
  craque_revelado_em: string | Date | null;
}

const diaTexto = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

function estatisticasVazias(): Estatisticas {
  return { jogos: 0, gols: 0, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, dribles: 0, bloqueios: 0, notaMedia: null, melhorNota: null, vitorias: 0, empates: 0, derrotas: 0 };
}

export async function exportarSite(banco: Banco, agora = new Date(), o: { vinculos?: ReadonlySet<string> } = {}): Promise<ExportacaoDoSite> {
  const arquivos = new Map<string, unknown>();
  const temporadas = (
    await banco.query<LinhaTemporada>(
      `SELECT id, numero, status, inicio, campeao_id, craque_jogador_id::text AS craque_jogador_id, craque_b_jogador_id::text AS craque_b_jogador_id, craque_revelado_em FROM temporada ORDER BY numero`,
    )
  ).rows;
  // As Séries de cada Temporada (ADR-0017); Temporada sem Série B mostra tudo como antes.
  const seriesDe = new Map<number, SeriesDaTemporada>();
  for (const t of temporadas) seriesDe.set(t.id, await seriesDaTemporada(banco, t.id));
  const comSeries = (temporadaId: number) => (seriesDe.get(temporadaId)?.B.length ?? 0) > 0;
  // A Temporada "atual" é a última que já começou: entre o fim de uma e o início da próxima, o
  // site segue mostrando a que acabou (campeão, Craque) e anuncia a próxima à parte.
  const hojeBrasilia = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const inicioDe = (t: LinhaTemporada) => (t.inicio instanceof Date ? t.inicio.toISOString() : String(t.inicio)).slice(0, 10);
  const temporada = [...temporadas].reverse().find((t) => inicioDe(t) <= hojeBrasilia) ?? temporadas.at(-1);
  const seguinte = temporadas.at(-1) !== temporada ? temporadas.at(-1) : undefined;
  const numeroDa = new Map(temporadas.map((t) => [t.id, t.numero]));
  const times = TIMES.map((id) => ({ id, nome: IDENTIDADE[id].nome, sigla: IDENTIDADE[id].sigla, primaria: IDENTIDADE[id].primaria, secundaria: IDENTIDADE[id].secundaria }));

  // Todas as Partidas de todas as Temporadas: a carreira dos Jogadores atravessa Temporadas.
  const todas = (
    await banco.query<LinhaPartida & { temporada_id: number; resumo_status: string }>(
      `SELECT p.id, p.rodada_id, r.temporada_id, r.numero AS rodada, r.fase, r.data, r.resumo_status, p.apito_inicial, p.mandante_id, p.visitante_id, p.status, p.resultado, p.video_url, p.narracao_url, p.vantagem_do_empate, p.serie
       FROM partida p JOIN rodada r ON r.id = p.rodada_id ORDER BY p.apito_inicial, p.serie`,
    )
  ).rows;
  const partidas = temporada ? todas.filter((p) => p.temporada_id === temporada.id) : [];
  const apito = (p: LinhaPartida) => new Date(p.apito_inicial);
  const revelada = (p: LinhaPartida) => p.resultado !== null && apito(p).getTime() <= agora.getTime();
  // Encerrada: o Ao Vivo já acabou. Placar no calendário, tabela e estatísticas só contam
  // Partidas encerradas, para não estragar o Ao Vivo de quem está assistindo.
  const encerrada = (p: LinhaPartida) => revelada(p) && apito(p).getTime() + duracaoAoVivoMs(p.fase) <= agora.getTime();
  const situacao = (p: LinhaPartida): SituacaoPartida =>
    !revelada(p) ? 'AGENDADA' : agora.getTime() < apito(p).getTime() + duracaoAoVivoMs(p.fase) ? 'AO_VIVO' : 'ENCERRADA';

  const escalacoes = (
    await banco.query<LinhaEscalacao>(
      `SELECT e.partida_id, e.time_id, e.lugar, e.jogador_id::text AS jogador_id, e.posicao, e.ovr_antes, e.habilidades_antes, j.username, e.apelido, e.capitao
       FROM escalacao e LEFT JOIN jogador j ON j.id = e.jogador_id ORDER BY e.partida_id, e.lugar`,
    )
  ).rows;
  const escalacoesDe = new Map<number, LinhaEscalacao[]>();
  for (const e of escalacoes) escalacoesDe.set(e.partida_id, [...(escalacoesDe.get(e.partida_id) ?? []), e]);
  const apitoDaPartida = new Map<number, Date>();
  const encerradaPorId = new Map<number, boolean>();
  for (const p of todas) {
    apitoDaPartida.set(p.id, apito(p));
    encerradaPorId.set(p.id, encerrada(p));
  }
  const placarDe = (r: ResultadoPartida) => ({ mandante: r.gols.mandante, visitante: r.gols.visitante, ...(r.penaltis ? { penaltis: r.penaltis.placar } : {}) });

  // ---- calendário da Temporada atual
  const calendario: PartidaNoCalendario[] = partidas.map((p) => {
    const r = encerrada(p) ? p.resultado! : null;
    return {
      id: p.id,
      rodada: p.rodada,
      fase: p.fase,
      apito: apito(p).toISOString(),
      mandante: p.mandante_id,
      visitante: p.visitante_id,
      situacao: situacao(p),
      classico: ehClassico(p.mandante_id, p.visitante_id),
      escalada: escalacoesDe.has(p.id),
      ...(p.vantagem_do_empate ? { vantagemDoEmpate: true } : {}),
      ...(r && p.fase === 'MATA_MATA' && r.vencedor ? { classificado: r.times[r.vencedor] } : {}),
      ...(r ? { placar: placarDe(r) } : {}),
      ...(temporada && comSeries(temporada.id) ? { serie: p.serie } : {}),
    };
  });
  const tabelaDa = (ps: LinhaPartida[], temporadaId: number, serie: Serie = 'A') =>
    classificar(
      ps.filter((p) => p.fase === 'LIGA' && p.serie === serie && encerrada(p)).map((p) => ({ mandante: p.mandante_id, visitante: p.visitante_id, gm: p.resultado!.gols.mandante, gv: p.resultado!.gols.visitante })),
      seriesDe.get(temporadaId)?.[serie],
    );

  // ---- rodadas de todas as Temporadas (para os troféus); o site mostra só as da atual.
  // Candidatos só quando todas as Partidas do dia acabaram; Craque da Rodada quando a
  // primeira Partida do dia seguinte começa. Na Final, a votação é a Craque da Temporada.
  const rodadasPorTemporada = new Map<number, RodadaPublica[]>();
  const bases = [...new Map(todas.map((p) => [p.rodada_id, p])).values()];
  for (const base of bases) {
    const doDia = todas.filter((p) => p.rodada_id === base.rodada_id);
    const daTemporada = todas.filter((p) => p.temporada_id === base.temporada_id);
    const ehAFinal = etapaDa(base.fase, base.rodada) === 'FINAL';
    const proximaRodada = daTemporada.find((p) => p.rodada === base.rodada + 1);
    const votacaoFechada = !ehAFinal && (proximaRodada ? apito(proximaRodada).getTime() <= agora.getTime() : false);
    const candidatos = doDia.every(encerrada)
      ? (
          await banco.query<{ jogador_id: string; username: string; apelido: string | null; time_id: TimeId; posicao: Posicao; nota: string; numero: number | null; votos: string; serie: Serie }>(
            `SELECT c.jogador_id::text AS jogador_id, j.username, j.apelido, j.time_id, j.posicao, c.nota, c.numero, c.serie, count(v.eleitor) AS votos
             FROM candidato c JOIN jogador j ON j.id = c.jogador_id
             LEFT JOIN voto_total v ON v.rodada_id = c.rodada_id AND v.jogador_id = c.jogador_id
             WHERE c.rodada_id = $1 GROUP BY c.jogador_id, j.username, j.apelido, j.time_id, j.posicao, c.nota, c.numero, c.serie, j.id
             ORDER BY c.numero NULLS LAST, c.nota DESC, j.id`,
            [base.rodada_id],
          )
        ).rows
      : [];
    // O Craque de cada Série: o Candidato dela mais votado (empate: maior Nota).
    const vencedorDa = (serie: Serie) => {
      const daSerie = candidatos.filter((c) => c.serie === serie);
      return votacaoFechada && daSerie.length ? [...daSerie].sort((a, b) => Number(b.votos) - Number(a.votos) || Number(b.nota) - Number(a.nota))[0]! : null;
    };
    const vencedor = vencedorDa('A');
    const vencedorB = vencedorDa('B');
    const series = comSeries(base.temporada_id);
    const lista = rodadasPorTemporada.get(base.temporada_id) ?? [];
    lista.push({
      id: base.rodada_id,
      numero: base.rodada,
      fase: base.fase,
      data: diaTexto(base.data),
      resumoPublicado: base.resumo_status === 'PUBLICADO',
      votacao: ehAFinal ? 'TEMPORADA' : 'RODADA',
      candidatos: candidatos.map((c, i) => ({
        numero: c.numero ?? i + 1,
        ...(series ? { rotulo: rotuloDoCandidato(c.numero ?? i + 1, true), serie: c.serie } : {}),
        jogadorId: c.jogador_id, username: c.username, apelido: c.apelido ?? null, time: c.time_id, posicao: c.posicao, nota: Number(c.nota) })),
      craque: vencedor ? { jogadorId: vencedor.jogador_id, username: vencedor.username, apelido: vencedor.apelido ?? null, time: vencedor.time_id } : null,
      ...(series ? { craqueB: vencedorB ? { jogadorId: vencedorB.jogador_id, username: vencedorB.username, apelido: vencedorB.apelido ?? null, time: vencedorB.time_id } : null } : {}),
    });
    rodadasPorTemporada.set(base.temporada_id, lista);
  }

  // ---- jogadores
  const jogadores = (
    await banco.query<{ id: string; username: string; time_id: TimeId; posicao: Posicao; ovr: number; habilidades: Habilidades | string | null; inscrito_em: string | Date; visual: Aparencia | string | null; numero: number | null; apelido: string | null; apelido_em: string | Date | null; especializacao: Especializacao | null; treino: HabilidadeId | null }>(
      `SELECT id::text AS id, username, time_id, posicao, ovr, habilidades, inscrito_em, visual, numero, apelido, apelido_em, especializacao, treino FROM jogador WHERE NOT banido ORDER BY id`,
    )
  ).rows;
  const transferiram = new Set(
    (
      await banco.query<{ jogador_id: string }>(
        `SELECT t.jogador_id::text AS jogador_id FROM transferencia t JOIN temporada tp ON tp.id = t.temporada_id WHERE tp.status IN ('PRE_TEMPORADA', 'EM_ANDAMENTO')`,
      )
    ).rows.map((r) => r.jogador_id),
  );
  const comRegrasT2 = temporada !== undefined && temRegrasT2(temporada.numero);
  // Fundadores (ADR-0036): só existem a partir da T2, e só aparecem no site da T2.
  const fundadores = comRegrasT2 ? await fundadorDe(banco) : new Map<string, { time: TimeId; temporada: number }>();
  // Selo da Temporada 1 (ADR-0047): também só no site da T2.
  const seloT1 = comRegrasT2 ? await comSeloT1(banco) : new Set<string>();
  const porJogador = new Map<string, JogadorPublico>();
  const resumido = (id: string): JogadorResumido | null => {
    const j = porJogador.get(id);
    return j ? { jogadorId: j.id, username: j.username, apelido: j.apelido ?? null, time: j.time, posicao: j.posicao } : null;
  };
  for (const j of jogadores) {
    const minhas = escalacoes.filter((e) => e.jogador_id === j.id && apitoDaPartida.has(e.partida_id)).sort((a, b) => apitoDaPartida.get(a.partida_id)!.getTime() - apitoDaPartida.get(b.partida_id)!.getTime());
    const oculta = minhas.find((e) => !encerradaPorId.get(e.partida_id));
    porJogador.set(j.id, {
      id: j.id,
      username: j.username,
      apelido: j.apelido ?? null,
      apelidoTrocadoEm: j.apelido_em ? new Date(j.apelido_em).toISOString() : null,
      time: j.time_id,
      posicao: j.posicao,
      // OVR antes da primeira Partida ainda não encerrada; senão o atual.
      ovr: oculta ? oculta.ovr_antes : j.ovr,
      ovrInicial: minhas[0]?.ovr_antes ?? j.ovr,
      habilidades: oculta ? habilidadesDe(j.posicao, oculta.ovr_antes, oculta.habilidades_antes) : habilidadesDe(j.posicao, j.ovr, j.habilidades),
      habilidadesIniciais: minhas[0] ? habilidadesDe(j.posicao, minhas[0].ovr_antes, minhas[0].habilidades_antes) : habilidadesDe(j.posicao, j.ovr, j.habilidades),
      inscritoEm: new Date(j.inscrito_em).toISOString(),
      transferenciaUsada: transferiram.has(j.id),
      visual: j.visual ? (typeof j.visual === 'string' ? (JSON.parse(j.visual) as Aparencia) : j.visual) : null,
      numero: j.numero ?? null,
      // Temporada 2 (ADR-0023): só aparece quando a Temporada atual tem as regras novas.
      ...(comRegrasT2 ? { especializacao: j.especializacao ?? null, treino: j.treino ?? null } : {}),
      ...(fundadores.has(j.id) ? { fundador: fundadores.get(j.id)! } : {}),
      ...(seloT1.has(j.id) ? { seloT1: true as const } : {}),
      ...estatisticasVazias(),
      vezesCandidato: 0,
      craqueDaRodada: 0,
      craqueDaTemporada: 0,
      titulos: 0,
      reiDoClassico: 0,
      temporadas: 0,
      nestaTemporada: estatisticasVazias(),
      trofeus: [],
      historico: [],
    });
  }
  const somar = (e: Estatisticas, d: ResultadoPartida['desempenhos'][number], r: ResultadoPartida) => {
    e.jogos++;
    e.gols += d.gols;
    e.assistencias += d.assistencias;
    e.desarmes += d.desarmes;
    e.defesas += d.defesas;
    e.golsSofridos += d.golsSofridos;
    e.dribles += d.dribles ?? 0;
    e.bloqueios += d.bloqueios ?? 0;
    if (r.gols.mandante === r.gols.visitante) e.empates++; // decidido nos pênaltis: conta como empate
    else if (r.vencedor === d.slot.lado) e.vitorias++;
    else e.derrotas++;
  };
  const notasDaTemporada = new Map<string, number[]>();
  const jogouPor = new Set<string>(); // `${temporadaId}:${time}:${jogadorId}`
  const temporadasDe = new Map<string, Set<number>>();
  for (const p of todas.filter(encerrada)) {
    const r = p.resultado!;
    const numero = numeroDa.get(p.temporada_id)!;
    for (const d of r.desempenhos) {
      if (d.jogadorId === null) continue;
      const j = porJogador.get(d.jogadorId);
      if (!j) continue;
      somar(j, d, r);
      if (p.temporada_id === temporada?.id) {
        somar(j.nestaTemporada, d, r);
        notasDaTemporada.set(j.id, [...(notasDaTemporada.get(j.id) ?? []), d.nota]);
      }
      jogouPor.add(`${p.temporada_id}:${r.times[d.slot.lado]}:${j.id}`);
      temporadasDe.set(j.id, (temporadasDe.get(j.id) ?? new Set()).add(p.temporada_id));
      const outro = d.slot.lado === 'mandante' ? 'visitante' : 'mandante';
      j.historico.push({
        partidaId: p.id, temporada: numero, rodada: p.rodada, fase: p.fase, nota: d.nota, ovr: d.ovrDepois, habilidades: d.habilidadesDepois ?? habilidadesDe(d.posicao, d.ovrDepois, null), gols: d.gols,
        rival: r.times[outro], emCasa: d.slot.lado === 'mandante', pro: r.gols[d.slot.lado], contra: r.gols[outro],
        time: r.times[d.slot.lado], assistencias: d.assistencias,
        ...(comSeries(p.temporada_id) ? { serie: p.serie } : {}),
        // Cartões só existem nas Partidas da T2 (ADR-0021).
        ...(d.amarelos ? { amarelos: d.amarelos } : {}),
        ...(d.expulso ? { expulso: true } : {}),
      });
    }
    if (r.classico && r.decisivo) {
      const id = r.desempenhos.find((d) => d.slot.lado === r.decisivo!.lado && d.slot.indice === r.decisivo!.indice)?.jogadorId;
      const j = id ? porJogador.get(id) : undefined;
      if (j) {
        j.reiDoClassico++;
        j.trofeus.push({ tipo: 'REI_DO_CLASSICO', temporada: numero, rodada: p.rodada, fase: p.fase, time: r.times[r.decisivo.lado], partidaId: p.id });
      }
    }
  }
  // T2: o Capitão atual de cada Time (o do próximo jogo aberto; sem jogo aberto, o da última
  // Escalação), com a faixa "C" no site para todo mundo (ADR-0020).
  if (comRegrasT2 && temporada) {
    for (const time of TIMES) {
      const proxima = await proximaPartidaDoTime(banco, time, agora);
      let id = proxima ? await capitaoDaPartida(banco, proxima.id, time, o.vinculos ?? new Set()) : null;
      if (!proxima) {
        const ultima = [...escalacoes].reverse().find((e) => e.time_id === time && e.capitao && partidas.some((p) => p.id === e.partida_id));
        id = ultima?.jogador_id ?? null;
      }
      const j = id ? porJogador.get(id) : undefined;
      if (j && j.time === time) j.capitao = true;
    }
  }
  const media = (ns: number[]) => (ns.length ? Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 100) / 100 : null);
  for (const j of porJogador.values()) {
    j.notaMedia = media(j.historico.map((h) => h.nota));
    j.melhorNota = j.historico.length ? Math.max(...j.historico.map((h) => h.nota)) : null;
    const notas = notasDaTemporada.get(j.id) ?? [];
    j.nestaTemporada.notaMedia = media(notas);
    j.nestaTemporada.melhorNota = notas.length ? Math.max(...notas) : null;
    j.temporadas = temporadasDe.get(j.id)?.size ?? 0;
  }
  for (const [temporadaId, rodadas] of rodadasPorTemporada) {
    const numero = numeroDa.get(temporadaId)!;
    for (const r of rodadas) {
      for (const c of r.candidatos) {
        const j = porJogador.get(c.jogadorId);
        if (j && r.votacao === 'RODADA') j.vezesCandidato++;
      }
      for (const [craque, serie] of [[r.craque, 'A'], [r.craqueB ?? null, 'B']] as const) {
        const j = craque ? porJogador.get(craque.jogadorId) : undefined;
        if (j && craque) {
          j.craqueDaRodada++;
          j.trofeus.push({ tipo: 'CRAQUE_RODADA', temporada: numero, rodada: r.numero, fase: r.fase, time: craque.time, ...(serie === 'B' ? { serie } : {}) });
        }
      }
    }
  }

  // Seleção da Rodada e da Temporada (ADR-0041), da T2 em diante: da Rodada depois que o Resumo dela foi ao
  // ar; da Temporada depois do anúncio do Craque da Temporada (o mesmo Reels).
  for (const t of temporadas) {
    if (t.numero < TEMPORADA_DOS_DESTAQUES) continue;
    const series = comSeries(t.id);
    const ps = todas.filter((p) => p.temporada_id === t.id && p.resultado && encerrada(p));
    const dar = (tipo: 'SELECAO_RODADA' | 'SELECAO_TEMPORADA', destaques: Destaque[], desempenhos: ReturnType<typeof desempenhosDasPartidas>, rodada?: Pick<LinhaPartida, 'rodada' | 'fase'>) => {
      for (const d of destaques) {
        const j = porJogador.get(d.jogadorId);
        const time = [...desempenhos].reverse().find((x) => x.jogadorId === d.jogadorId && x.posicao === d.posicao)?.time;
        if (!j || !time) continue;
        j.trofeus.push({ tipo, temporada: t.numero, posicao: d.posicao, time, ...(rodada ? { rodada: rodada.rodada, fase: rodada.fase } : {}), ...(d.serie === 'B' ? { serie: d.serie } : {}) });
      }
    };
    for (const rodadaId of new Set(ps.map((p) => p.rodada_id))) {
      const doDia = ps.filter((p) => p.rodada_id === rodadaId);
      if (doDia[0]!.resumo_status !== 'PUBLICADO') continue;
      const ds = desempenhosDasPartidas(doDia.map((p) => ({ resultado: p.resultado!, serie: p.serie })), series);
      dar('SELECAO_RODADA', destaquesDaRodada(ds), ds, doDia[0]!);
    }
    if (t.craque_revelado_em) {
      const ds = desempenhosDasPartidas(ps.map((p) => ({ resultado: p.resultado!, serie: p.serie })), series);
      dar('SELECAO_TEMPORADA', destaquesDaTemporada(ds), ds);
    }
  }

  // ---- história das Temporadas: campeão (Final encerrada), vice, Craque (depois do anúncio), artilheiro
  const historia: TemporadaNaHistoria[] = [];
  for (const t of temporadas) {
    const ps = todas.filter((p) => p.temporada_id === t.id);
    // A Final de cada Série (com duas Séries, as duas são às 18h do mesmo dia).
    const desfecho = (serie: Serie) => {
      const final = ps.find((p) => etapaDa(p.fase, p.rodada) === 'FINAL' && p.serie === serie);
      const rf = final && encerrada(final) ? final.resultado : null;
      const campeao = rf?.vencedor ? rf.times[rf.vencedor] : null;
      const vice = rf?.vencedor ? rf.times[rf.vencedor === 'mandante' ? 'visitante' : 'mandante'] : null;
      if (campeao) {
        for (const j of porJogador.values()) {
          if (jogouPor.has(`${t.id}:${campeao}:${j.id}`)) {
            j.titulos++;
            j.trofeus.push({ tipo: 'CAMPEAO', temporada: t.numero, time: campeao, ...(final ? { partidaId: final.id } : {}), ...(serie === 'B' ? { serie } : {}) });
          }
        }
      }
      return { final, rf, campeao, vice };
    };
    const craqueDa = (serie: Serie, id: string | null) => {
      const revelado = id && t.craque_revelado_em && new Date(t.craque_revelado_em).getTime() <= agora.getTime() ? id : null;
      const craque = revelado ? resumido(revelado) : null;
      if (craque) {
        const j = porJogador.get(craque.jogadorId)!;
        j.craqueDaTemporada++;
        j.trofeus.push({ tipo: 'CRAQUE_TEMPORADA', temporada: t.numero, time: craque.time, ...(serie === 'B' ? { serie } : {}) });
      }
      return craque;
    };
    const { final, rf, campeao, vice } = desfecho('A');
    const craque = craqueDa('A', t.craque_jogador_id);
    const b = comSeries(t.id) ? desfecho('B') : null;
    const craqueB = b ? craqueDa('B', t.craque_b_jogador_id) : null;
    // Artilheiro: mais gols na Temporada (desempate: menos jogos, depois quem se inscreveu antes).
    const gols = new Map<string, { gols: number; jogos: number }>();
    for (const p of ps.filter(encerrada)) {
      for (const d of p.resultado!.desempenhos) {
        if (!d.jogadorId) continue;
        const g = gols.get(d.jogadorId) ?? { gols: 0, jogos: 0 };
        g.gols += d.gols;
        g.jogos++;
        gols.set(d.jogadorId, g);
      }
    }
    const [topo] = [...gols.entries()].filter(([, g]) => g.gols > 0).sort((a, b) => b[1].gols - a[1].gols || a[1].jogos - b[1].jogos || Number(a[0]) - Number(b[0]));
    const artilheiro = topo && resumido(topo[0]) ? { ...resumido(topo[0])!, gols: topo[1].gols } : null;
    // Melhor goleiro: maior nota média com pelo menos 3 jogos no gol.
    const goleiros = new Map<string, { notas: number[]; defesas: number; sofridos: number }>();
    for (const p of ps.filter(encerrada)) {
      for (const d of p.resultado!.desempenhos) {
        if (!d.jogadorId || d.posicao !== 'GOL') continue;
        const g = goleiros.get(d.jogadorId) ?? { notas: [], defesas: 0, sofridos: 0 };
        g.notas.push(d.nota);
        g.defesas += d.defesas;
        g.sofridos += d.golsSofridos;
        goleiros.set(d.jogadorId, g);
      }
    }
    const mediaDe = (ns: number[]) => ns.reduce((s, n) => s + n, 0) / ns.length;
    const [melhorGoleiro] = [...goleiros.entries()]
      .filter(([, g]) => g.notas.length >= 3)
      .sort((a, b) => mediaDe(b[1].notas) - mediaDe(a[1].notas) || a[1].sofridos / a[1].notas.length - b[1].sofridos / b[1].notas.length || Number(a[0]) - Number(b[0]));
    const goleiro =
      melhorGoleiro && resumido(melhorGoleiro[0])
        ? { ...resumido(melhorGoleiro[0])!, notaMedia: Math.round(mediaDe(melhorGoleiro[1].notas) * 100) / 100, jogos: melhorGoleiro[1].notas.length, defesas: melhorGoleiro[1].defesas, golsSofridos: melhorGoleiro[1].sofridos }
        : null;
    historia.push({
      numero: t.numero,
      status: t.status,
      inicio: diaTexto(t.inicio),
      campeao,
      vice,
      final: final && rf ? { partidaId: final.id, mandante: final.mandante_id, visitante: final.visitante_id, placar: placarDe(rf) } : null,
      craque,
      artilheiro,
      goleiro,
      tabela: tabelaDa(ps, t.id, 'A'),
      ...(b
        ? {
            serieB: {
              campeao: b.campeao,
              vice: b.vice,
              final: b.final && b.rf ? { partidaId: b.final.id, mandante: b.final.mandante_id, visitante: b.final.visitante_id, placar: placarDe(b.rf) } : null,
              craque: craqueB,
              tabela: tabelaDa(ps, t.id, 'B'),
            },
          }
        : {}),
    });
  }
  for (const j of porJogador.values()) j.trofeus.sort((a, b) => b.temporada - a.temporada || (b.rodada ?? 99) - (a.rodada ?? 99));

  const atual = historia.find((h) => h.numero === temporada?.numero);
  const liga: LigaPublica = {
    atualizadoEm: agora.toISOString(),
    temporada: temporada ? { numero: temporada.numero, status: temporada.status } : null,
    times,
    tabela: atual?.tabela ?? [],
    ...(atual?.serieB && temporada ? { tabelaB: atual.serieB.tabela, series: { A: [...seriesDe.get(temporada.id)!.A], B: [...seriesDe.get(temporada.id)!.B] } } : {}),
    calendario,
    rodadas: temporada ? (rodadasPorTemporada.get(temporada.id) ?? []) : [],
    campeao: atual?.campeao ?? null,
    craqueDaTemporada: atual?.craque ?? null,
    ...(atual?.serieB ? { campeaoB: atual.serieB.campeao, craqueDaTemporadaB: atual.serieB.craque } : {}),
    temporadas: [...historia].reverse(),
    proximaTemporada: seguinte ? { numero: seguinte.numero, inicio: inicioDe(seguinte) } : null,
  };
  arquivos.set('liga.json', liga);
  arquivos.set('jogadores.json', [...porJogador.values()]);

  const elencos = await tamanhoDosElencos(banco);
  // ---- uma página por Partida escalada (de todas as Temporadas: o histórico aponta para elas)
  for (const p of todas) {
    const linhas = escalacoesDe.get(p.id);
    const de = (time: TimeId): EscalacaoPublica => ({
      time,
      jogadores: (linhas ?? [])
        .filter((e) => e.time_id === time)
        .map((e) => ({ lugar: e.lugar, posicao: e.posicao, jogadorId: e.jogador_id, username: e.username, apelido: e.apelido ?? null, ovr: e.ovr_antes, habilidades: habilidadesDe(e.posicao, e.ovr_antes, e.habilidades_antes), ...(e.capitao ? { capitao: true as const } : {}) })),
    });
    if (!linhas && !revelada(p)) continue;
    const publica: PartidaPublica = {
      id: p.id,
      rodada: p.rodada,
      fase: p.fase,
      apito: apito(p).toISOString(),
      mandante: p.mandante_id,
      visitante: p.visitante_id,
      classico: ehClassico(p.mandante_id, p.visitante_id),
      situacao: situacao(p),
      escalacoes: linhas ? { mandante: de(p.mandante_id), visitante: de(p.visitante_id) } : null,
      resultado: revelada(p) ? p.resultado : null,
      video: encerrada(p) && p.video_url?.startsWith('http') ? p.video_url : null,
      narracao: revelada(p) && p.narracao_url?.startsWith('http') ? p.narracao_url : null,
      ...(() => {
        const mm = mataMataDaPartida({ fase: p.fase, rodada: p.rodada, temporada: temporadas.find((t) => t.id === p.temporada_id)?.numero ?? 0, serie: p.serie, comSeries: comSeries(p.temporada_id) });
        return mm ? { mataMata: mm } : {};
      })(),
      // Arquibancada (T2): só nas Partidas simuladas com as regras da Temporada 2.
      ...(revelada(p) && (p.resultado as { postura?: unknown } | null)?.postura != null
        ? { torcida: { mandante: elencos.get(p.mandante_id) ?? 0, visitante: elencos.get(p.visitante_id) ?? 0 } }
        : {}),
    };
    arquivos.set(`partidas/${p.id}.json`, publica);
  }
  return { arquivos };
}

/** Grava a exportação numa pasta (o job publica a mesma estrutura no R2). */
export async function escreverSite(exportacao: ExportacaoDoSite, pasta: string): Promise<string[]> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const escritos: string[] = [];
  for (const [caminho, conteudo] of exportacao.arquivos) {
    const destino = join(pasta, caminho);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, JSON.stringify(conteudo));
    escritos.push(caminho);
  }
  return escritos;
}
