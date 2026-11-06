/**
 * Dados públicos do site (job `coletar`, passo 5): liga.json, jogadores.json e um
 * partidas/<id>.json por Partida já escalada.
 *
 * Regra de ouro: nada revela o resultado antes do Apito Inicial. A Partida é simulada no
 * Corte (30 min antes), então placar, lances, Notas, Candidatos e até o OVR que mudou só
 * aparecem depois do Apito (o lance a lance) ou do fim do Ao Vivo (placar, tabela, Card).
 * Escalações aparecem assim que existem (a partir do Corte).
 */
import { IDENTIDADE, TIMES, ehClassico, type EscalacaoPublica, type JogadorPublico, type LigaPublica, type PartidaNoCalendario, type PartidaPublica, type Posicao, type RodadaPublica, type SituacaoPartida, type TimeId } from '@liga/shared';
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

export async function exportarSite(banco: Banco, agora = new Date()): Promise<ExportacaoDoSite> {
  const arquivos = new Map<string, unknown>();
  const temporada = (await banco.query<{ id: number; numero: number; status: string }>(`SELECT id, numero, status FROM temporada ORDER BY numero DESC LIMIT 1`)).rows[0];
  const times = TIMES.map((id) => ({ id, nome: IDENTIDADE[id].nome, sigla: IDENTIDADE[id].sigla, primaria: IDENTIDADE[id].primaria, secundaria: IDENTIDADE[id].secundaria }));

  const partidas = temporada
    ? (
        await banco.query<LinhaPartida>(
          `SELECT p.id, p.rodada_id, r.numero AS rodada, r.fase, r.data, p.apito_inicial, p.mandante_id, p.visitante_id, p.status, p.resultado, p.video_url
           FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial`,
          [temporada.id],
        )
      ).rows
    : [];
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
  const reveladaPorId = new Map<number, boolean>();
  for (const p of partidas) {
    apitoDaPartida.set(p.id, apito(p));
    reveladaPorId.set(p.id, encerrada(p));
  }

  // ---- calendário e tabela
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
      ...(r
        ? { placar: { mandante: r.gols.mandante, visitante: r.gols.visitante, ...(r.penaltis ? { penaltis: r.penaltis.placar } : {}) } }
        : {}),
    };
  });
  const tabela = classificar(
    partidas.filter((p) => p.fase === 'LIGA' && encerrada(p)).map((p) => ({ mandante: p.mandante_id, visitante: p.visitante_id, gm: p.resultado!.gols.mandante, gv: p.resultado!.gols.visitante })),
  );

  // ---- rodadas: Candidatos só quando todas as Partidas do dia já foram reveladas;
  // Craque quando a primeira Partida do dia seguinte começa (é revelado no Reels dela).
  const rodadasIds = [...new Map(partidas.map((p) => [p.rodada_id, p])).values()];
  const rodadas: RodadaPublica[] = [];
  for (const base of rodadasIds) {
    const doDia = partidas.filter((p) => p.rodada_id === base.rodada_id);
    const todasReveladas = doDia.every(encerrada);
    const proximaRodada = partidas.find((p) => p.rodada === base.rodada + 1);
    const votacaoFechada = proximaRodada ? apito(proximaRodada).getTime() <= agora.getTime() : false;
    const candidatos = todasReveladas
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
    rodadas.push({
      numero: base.rodada,
      fase: base.fase,
      data: typeof base.data === 'string' ? base.data.slice(0, 10) : base.data.toISOString().slice(0, 10),
      candidatos: candidatos.map((c) => ({ jogadorId: c.jogador_id, username: c.username, time: c.time_id, posicao: c.posicao, nota: Number(c.nota) })),
      craque: vencedor ? { jogadorId: vencedor.jogador_id, username: vencedor.username, time: vencedor.time_id } : null,
    });
  }

  const liga: LigaPublica = {
    atualizadoEm: agora.toISOString(),
    temporada: temporada ? { numero: temporada.numero, status: temporada.status } : null,
    times,
    tabela,
    calendario,
    rodadas,
  };
  arquivos.set('liga.json', liga);

  // ---- jogadores: Card e estatísticas só com Partidas reveladas
  const jogadores = (
    await banco.query<{ id: string; username: string; time_id: TimeId; posicao: Posicao; ovr: number; inscrito_em: string | Date }>(
      `SELECT id::text AS id, username, time_id, posicao, ovr, inscrito_em FROM jogador WHERE NOT banido ORDER BY id`,
    )
  ).rows;
  const porJogador = new Map<string, JogadorPublico>();
  for (const j of jogadores) {
    const minhas = escalacoes.filter((e) => e.jogador_id === j.id).sort((a, b) => apitoDaPartida.get(a.partida_id)!.getTime() - apitoDaPartida.get(b.partida_id)!.getTime());
    const oculta = minhas.find((e) => !reveladaPorId.get(e.partida_id));
    porJogador.set(j.id, {
      id: j.id,
      username: j.username,
      time: j.time_id,
      posicao: j.posicao,
      // OVR antes da primeira Partida ainda não revelada; senão o atual.
      ovr: oculta ? oculta.ovr_antes : j.ovr,
      ovrInicial: minhas[0]?.ovr_antes ?? j.ovr,
      inscritoEm: new Date(j.inscrito_em).toISOString(),
      jogos: 0, gols: 0, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0,
      notaMedia: null, melhorNota: null, vitorias: 0, empates: 0, derrotas: 0,
      vezesCandidato: 0, craqueDaRodada: 0, reiDoClassico: 0,
      historico: [],
    });
  }
  for (const p of partidas.filter(encerrada)) {
    const r = p.resultado!;
    for (const d of r.desempenhos) {
      if (d.jogadorId === null) continue;
      const j = porJogador.get(d.jogadorId);
      if (!j) continue;
      j.jogos++;
      j.gols += d.gols;
      j.assistencias += d.assistencias;
      j.desarmes += d.desarmes;
      j.defesas += d.defesas;
      j.golsSofridos += d.golsSofridos;
      if (r.vencedor === null) j.empates++;
      else if (r.vencedor === d.slot.lado) j.vitorias++;
      else j.derrotas++;
      j.historico.push({ partidaId: p.id, rodada: p.rodada, nota: d.nota, ovr: d.ovrDepois, gols: d.gols });
    }
    if (r.classico && r.decisivo) {
      const id = r.desempenhos.find((d) => d.slot.lado === r.decisivo!.lado && d.slot.indice === r.decisivo!.indice)?.jogadorId;
      if (id) porJogador.get(id)!.reiDoClassico++;
    }
  }
  for (const j of porJogador.values()) {
    if (j.historico.length) {
      j.notaMedia = Math.round((j.historico.reduce((s, h) => s + h.nota, 0) / j.historico.length) * 100) / 100;
      j.melhorNota = Math.max(...j.historico.map((h) => h.nota));
    }
  }
  for (const r of rodadas) {
    for (const c of r.candidatos) porJogador.get(c.jogadorId) && porJogador.get(c.jogadorId)!.vezesCandidato++;
    if (r.craque && porJogador.get(r.craque.jogadorId)) porJogador.get(r.craque.jogadorId)!.craqueDaRodada++;
  }
  arquivos.set('jogadores.json', [...porJogador.values()]);

  // ---- uma página por Partida escalada
  for (const p of partidas) {
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
