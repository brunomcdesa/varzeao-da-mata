/**
 * Dados públicos do site (job `coletar`, passo 5): liga.json, jogadores.json e um
 * partidas/<id>.json por Partida já escalada.
 *
 * Regra de ouro: nada revela o resultado antes do Apito Inicial. A Partida é simulada no
 * Corte (30 min antes), então placar, lances, Notas, Candidatos e até o OVR que mudou só
 * aparecem depois do Apito (o lance a lance) ou do fim do Ao Vivo (placar, tabela, Card).
 * Escalações aparecem assim que existem (a partir do Corte).
 */
import { IDENTIDADE, TIMES, ehClassico, etapaDa, type EscalacaoPublica, type Estatisticas, type JogadorPublico, type JogadorResumido, type TemporadaNaHistoria, type LigaPublica, type PartidaNoCalendario, type PartidaPublica, type Posicao, type RodadaPublica, type SituacaoPartida, type TimeId } from '@liga/shared';
import type { ResultadoPartida } from '@liga/sim';
import type { Banco } from './banco.js';
import { classificar } from './tabela.js';

/** Duração do Ao Vivo: 90 minutos de jogo a 15× (ADR-0005). */
export const DURACAO_AO_VIVO_MS = 6 * 60_000;

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
  vantagem_do_empate: 'mandante' | 'visitante' | null;
}

interface LinhaEscalacao {
  partida_id: number;
  time_id: TimeId;
  lugar: number;
  jogador_id: string | null;
  posicao: Posicao;
  ovr_antes: number;
  username: string | null;
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
  craque_revelado_em: string | Date | null;
}

const diaTexto = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

function estatisticasVazias(): Estatisticas {
  return { jogos: 0, gols: 0, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, notaMedia: null, melhorNota: null, vitorias: 0, empates: 0, derrotas: 0 };
}

export async function exportarSite(banco: Banco, agora = new Date()): Promise<ExportacaoDoSite> {
  const arquivos = new Map<string, unknown>();
  const temporadas = (
    await banco.query<LinhaTemporada>(
      `SELECT id, numero, status, inicio, campeao_id, craque_jogador_id::text AS craque_jogador_id, craque_revelado_em FROM temporada ORDER BY numero`,
    )
  ).rows;
  const temporada = temporadas.at(-1);
  const numeroDa = new Map(temporadas.map((t) => [t.id, t.numero]));
  const times = TIMES.map((id) => ({ id, nome: IDENTIDADE[id].nome, sigla: IDENTIDADE[id].sigla, primaria: IDENTIDADE[id].primaria, secundaria: IDENTIDADE[id].secundaria }));

  // Todas as Partidas de todas as Temporadas: a carreira dos Jogadores atravessa Temporadas.
  const todas = (
    await banco.query<LinhaPartida & { temporada_id: number }>(
      `SELECT p.id, p.rodada_id, r.temporada_id, r.numero AS rodada, r.fase, r.data, p.apito_inicial, p.mandante_id, p.visitante_id, p.status, p.resultado, p.video_url, p.vantagem_do_empate
       FROM partida p JOIN rodada r ON r.id = p.rodada_id ORDER BY p.apito_inicial`,
    )
  ).rows;
  const partidas = temporada ? todas.filter((p) => p.temporada_id === temporada.id) : [];
  const apito = (p: LinhaPartida) => new Date(p.apito_inicial);
  const revelada = (p: LinhaPartida) => p.resultado !== null && apito(p).getTime() <= agora.getTime();
  // Encerrada: o Ao Vivo já acabou. Placar no calendário, tabela e estatísticas só contam
  // Partidas encerradas, para não estragar o Ao Vivo de quem está assistindo.
  const encerrada = (p: LinhaPartida) => revelada(p) && apito(p).getTime() + DURACAO_AO_VIVO_MS <= agora.getTime();
  const situacao = (p: LinhaPartida): SituacaoPartida =>
    !revelada(p) ? 'AGENDADA' : agora.getTime() < apito(p).getTime() + DURACAO_AO_VIVO_MS ? 'AO_VIVO' : 'ENCERRADA';

  const escalacoes = (
    await banco.query<LinhaEscalacao>(
      `SELECT e.partida_id, e.time_id, e.lugar, e.jogador_id::text AS jogador_id, e.posicao, e.ovr_antes, j.username
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
    };
  });
  const tabelaDa = (ps: LinhaPartida[]) =>
    classificar(ps.filter((p) => p.fase === 'LIGA' && encerrada(p)).map((p) => ({ mandante: p.mandante_id, visitante: p.visitante_id, gm: p.resultado!.gols.mandante, gv: p.resultado!.gols.visitante })));

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
          await banco.query<{ jogador_id: string; username: string; time_id: TimeId; posicao: Posicao; nota: string; votos: string }>(
            `SELECT c.jogador_id::text AS jogador_id, j.username, j.time_id, j.posicao, c.nota, count(v.ig_user_id) AS votos
             FROM candidato c JOIN jogador j ON j.id = c.jogador_id
             LEFT JOIN voto v ON v.rodada_id = c.rodada_id AND v.jogador_id = c.jogador_id
             WHERE c.rodada_id = $1 GROUP BY c.jogador_id, j.username, j.time_id, j.posicao, c.nota, j.id
             ORDER BY c.nota DESC, j.id`,
            [base.rodada_id],
          )
        ).rows
      : [];
    const vencedor = votacaoFechada && candidatos.length ? [...candidatos].sort((a, b) => Number(b.votos) - Number(a.votos) || Number(b.nota) - Number(a.nota))[0]! : null;
    const lista = rodadasPorTemporada.get(base.temporada_id) ?? [];
    lista.push({
      numero: base.rodada,
      fase: base.fase,
      data: diaTexto(base.data),
      votacao: ehAFinal ? 'TEMPORADA' : 'RODADA',
      candidatos: candidatos.map((c) => ({ jogadorId: c.jogador_id, username: c.username, time: c.time_id, posicao: c.posicao, nota: Number(c.nota) })),
      craque: vencedor ? { jogadorId: vencedor.jogador_id, username: vencedor.username, time: vencedor.time_id } : null,
    });
    rodadasPorTemporada.set(base.temporada_id, lista);
  }

  // ---- jogadores
  const jogadores = (
    await banco.query<{ id: string; username: string; time_id: TimeId; posicao: Posicao; ovr: number; inscrito_em: string | Date }>(
      `SELECT id::text AS id, username, time_id, posicao, ovr, inscrito_em FROM jogador WHERE NOT banido ORDER BY id`,
    )
  ).rows;
  const porJogador = new Map<string, JogadorPublico>();
  const resumido = (id: string): JogadorResumido | null => {
    const j = porJogador.get(id);
    return j ? { jogadorId: j.id, username: j.username, time: j.time, posicao: j.posicao } : null;
  };
  for (const j of jogadores) {
    const minhas = escalacoes.filter((e) => e.jogador_id === j.id && apitoDaPartida.has(e.partida_id)).sort((a, b) => apitoDaPartida.get(a.partida_id)!.getTime() - apitoDaPartida.get(b.partida_id)!.getTime());
    const oculta = minhas.find((e) => !encerradaPorId.get(e.partida_id));
    porJogador.set(j.id, {
      id: j.id,
      username: j.username,
      time: j.time_id,
      posicao: j.posicao,
      // OVR antes da primeira Partida ainda não encerrada; senão o atual.
      ovr: oculta ? oculta.ovr_antes : j.ovr,
      ovrInicial: minhas[0]?.ovr_antes ?? j.ovr,
      inscritoEm: new Date(j.inscrito_em).toISOString(),
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
    if (r.gols.mandante === r.gols.visitante) e.empates++; // decidido nos pênaltis ou na Vantagem do Empate: empate
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
        partidaId: p.id, temporada: numero, rodada: p.rodada, fase: p.fase, nota: d.nota, ovr: d.ovrDepois, gols: d.gols,
        rival: r.times[outro], emCasa: d.slot.lado === 'mandante', pro: r.gols[d.slot.lado], contra: r.gols[outro],
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
      const j = r.craque ? porJogador.get(r.craque.jogadorId) : undefined;
      if (j) {
        j.craqueDaRodada++;
        j.trofeus.push({ tipo: 'CRAQUE_RODADA', temporada: numero, rodada: r.numero, fase: r.fase, time: r.craque!.time });
      }
    }
  }

  // ---- história das Temporadas: campeão (Final encerrada), vice, Craque (depois do anúncio), artilheiro
  const historia: TemporadaNaHistoria[] = [];
  for (const t of temporadas) {
    const ps = todas.filter((p) => p.temporada_id === t.id);
    const final = ps.find((p) => etapaDa(p.fase, p.rodada) === 'FINAL');
    const rf = final && encerrada(final) ? final.resultado : null;
    const campeao = rf?.vencedor ? rf.times[rf.vencedor] : null;
    const vice = rf?.vencedor ? rf.times[rf.vencedor === 'mandante' ? 'visitante' : 'mandante'] : null;
    if (campeao) {
      for (const j of porJogador.values()) {
        if (jogouPor.has(`${t.id}:${campeao}:${j.id}`)) {
          j.titulos++;
          j.trofeus.push({ tipo: 'CAMPEAO', temporada: t.numero, time: campeao, ...(final ? { partidaId: final.id } : {}) });
        }
      }
    }
    const craqueRevelado = t.craque_jogador_id && t.craque_revelado_em && new Date(t.craque_revelado_em).getTime() <= agora.getTime() ? t.craque_jogador_id : null;
    const craque = craqueRevelado ? resumido(craqueRevelado) : null;
    if (craque) {
      const j = porJogador.get(craque.jogadorId)!;
      j.craqueDaTemporada++;
      j.trofeus.push({ tipo: 'CRAQUE_TEMPORADA', temporada: t.numero, time: craque.time });
    }
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
    historia.push({
      numero: t.numero,
      status: t.status,
      inicio: diaTexto(t.inicio),
      campeao,
      vice,
      final: final && rf ? { partidaId: final.id, mandante: final.mandante_id, visitante: final.visitante_id, placar: placarDe(rf) } : null,
      craque,
      artilheiro,
      tabela: tabelaDa(ps),
    });
  }
  for (const j of porJogador.values()) j.trofeus.sort((a, b) => b.temporada - a.temporada || (b.rodada ?? 99) - (a.rodada ?? 99));

  const atual = historia.at(-1);
  const liga: LigaPublica = {
    atualizadoEm: agora.toISOString(),
    temporada: temporada ? { numero: temporada.numero, status: temporada.status } : null,
    times,
    tabela: atual?.tabela ?? [],
    calendario,
    rodadas: temporada ? (rodadasPorTemporada.get(temporada.id) ?? []) : [],
    campeao: atual?.campeao ?? null,
    craqueDaTemporada: atual?.craque ?? null,
    temporadas: [...historia].reverse(),
  };
  arquivos.set('liga.json', liga);
  arquivos.set('jogadores.json', [...porJogador.values()]);

  // ---- uma página por Partida escalada (de todas as Temporadas: o histórico aponta para elas)
  for (const p of todas) {
    const linhas = escalacoesDe.get(p.id);
    const de = (time: TimeId): EscalacaoPublica => ({
      time,
      jogadores: (linhas ?? [])
        .filter((e) => e.time_id === time)
        .map((e) => ({ lugar: e.lugar, posicao: e.posicao, jogadorId: e.jogador_id, username: e.username, ovr: e.ovr_antes })),
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
