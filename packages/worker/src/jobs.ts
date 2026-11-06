/**
 * Os três jobs do GitHub Actions (docs/arquitetura.md). Tudo é retomável: rodar de novo
 * continua de onde parou e nunca publica duas vezes.
 *
 *   coletar  (de hora em hora)  renova o token, sincroniza o que a borda publicou, lê os
 *                               comentários (ENTRO / CRAQUE) e atualiza os dados do site.
 *   partida  (35 min antes)     espera o Corte, escala, simula, grava o Reels, sobe para o
 *                               R2, cria o container e agenda a publicação para o fim do Ao Vivo.
 *   resumo   (18h10)            fecha a Rodada, grava o Resumo e agenda para as 19h.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FALA_DO_TIME, IDENTIDADE, nomeDoClassico, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FUSO_BRASILIA } from './calendario.js';
import { processarComentario, type Comentario, type Resultado } from './coletar.js';
import { CORTE_MINUTOS } from './escalacao.js';
import { Instagram, ErroInstagram } from './instagram.js';
import { CHAVE_TOKEN, gravarNaAgenda, type Agenda, type Armazenamento, type ItemDaAgenda } from './nuvem.js';
import { rodarPartida, type DadosDoVideo } from './partida.js';
import { craqueDaRodada, dadosDoResumo, fecharRodada, HORA_DO_RESUMO, rodadaEmVotacao, type DadosDoResumo } from './resumo.js';
import { DURACAO_AO_VIVO_MS, exportarSite } from './site.js';

export interface ContextoDoJob {
  banco: Banco;
  armazenamento: Armazenamento;
  agenda: Agenda;
  /** null: sem Instagram configurado (só grava e sobe; não agenda). */
  ig: Instagram | null;
  gravarReels?: (dados: DadosDoVideo, saida: string) => Promise<void>;
  gravarResumo?: (dados: DadosDoResumo, saida: string) => Promise<void>;
  agora?: () => Date;
  dormir?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

const agoraDe = (c: ContextoDoJob) => (c.agora ? c.agora() : new Date());
const logDe = (c: ContextoDoJob) => c.log ?? ((m: string) => console.log(m));

// ------------------------------------------------------------------ token

/** Renova o token quando ele tem mais de 7 dias (vale 60). */
export const RENOVAR_TOKEN_A_CADA_MS = 7 * 86400_000;

interface TokenGuardado {
  token: string;
  renovadoEm: string;
  expiraEm: string;
}

/** Token mais novo: o do banco (renovado pelo job) ou, na primeira vez, o do ambiente. */
export async function tokenGuardado(banco: Banco): Promise<TokenGuardado | null> {
  const r = (await banco.query<{ valor: TokenGuardado }>(`SELECT valor FROM config WHERE chave = 'ig_token'`)).rows[0];
  return r?.valor ?? null;
}

export async function renovarTokenSePreciso(c: ContextoDoJob): Promise<void> {
  if (!c.ig) return;
  const guardado = await tokenGuardado(c.banco);
  const agora = agoraDe(c);
  if (guardado && agora.getTime() - Date.parse(guardado.renovadoEm) < RENOVAR_TOKEN_A_CADA_MS) return;
  try {
    const novo = await c.ig.renovarToken();
    const valor: TokenGuardado = { token: novo.token, renovadoEm: agora.toISOString(), expiraEm: novo.expiraEm.toISOString() };
    await c.banco.query(
      `INSERT INTO config (chave, valor) VALUES ('ig_token', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = now()`,
      [JSON.stringify(valor)],
    );
    await c.agenda.gravar(CHAVE_TOKEN, { token: novo.token });
    logDe(c)(`Token do Instagram renovado (vale até ${valor.expiraEm.slice(0, 10)}).`);
  } catch (e) {
    // Token novo demais (< 24 h) não renova; segue com o atual.
    logDe(c)(`Não renovou o token agora: ${(e as Error).message}`);
    if (!guardado) await c.agenda.gravar(CHAVE_TOKEN, { token: c.ig.token });
  }
}

// ------------------------------------------------------------------ coletar

export interface RelatorioColeta {
  comentarios: number;
  resultados: Partial<Record<Resultado, number>>;
  publicados: number;
  arquivosDoSite: number;
}

/** Atualiza no banco o que o worker da borda já publicou e limpa a agenda antiga. */
export async function sincronizarPublicados(c: ContextoDoJob): Promise<number> {
  let n = 0;
  const agora = agoraDe(c).getTime();
  for (const chave of await c.agenda.listar('agenda/')) {
    const item = await c.agenda.ler<ItemDaAgenda>(chave);
    if (!item?.publicadoEm || !item.mediaId) continue;
    if (item.tipo === 'PARTIDA') {
      const r = await c.banco.query(`UPDATE partida SET status = 'PUBLICADA', ig_media_id = $2 WHERE id = $1 AND status <> 'PUBLICADA' RETURNING id`, [item.ref, item.mediaId]);
      n += r.rows.length;
    } else {
      const r = await c.banco.query(`UPDATE rodada SET resumo_status = 'PUBLICADO', resumo_ig_media_id = $2 WHERE id = $1 AND resumo_status <> 'PUBLICADO' RETURNING id`, [item.ref, item.mediaId]);
      n += r.rows.length;
    }
    if (agora - Date.parse(item.publicadoEm) > 2 * 86400_000) await c.agenda.apagar(chave);
  }
  return n;
}

/** Lê os comentários dos posts dos últimos dias e processa (idempotente pelo id do comentário). */
export async function coletarComentarios(c: ContextoDoJob, o: { dias?: number } = {}): Promise<Comentario[]> {
  if (!c.ig) return [];
  const desde = new Date(agoraDe(c).getTime() - (o.dias ?? 3) * 86400_000);
  const midias = await c.ig.midiasDesde(desde);
  const todos: Comentario[] = [];
  for (const m of midias) todos.push(...(await c.ig.comentarios(m.id)));
  todos.sort((a, b) => a.comentadoEm.getTime() - b.comentadoEm.getTime() || a.igCommentId.localeCompare(b.igCommentId));
  return todos;
}

export async function publicarSite(c: ContextoDoJob): Promise<number> {
  const { arquivos } = await exportarSite(c.banco, agoraDe(c));
  for (const [caminho, conteudo] of arquivos) {
    await c.armazenamento.enviar('publico', `dados/${caminho}`, JSON.stringify(conteudo), { tipo: 'application/json', cache: 'public, max-age=60' });
  }
  return arquivos.size;
}

export async function jobColetar(c: ContextoDoJob): Promise<RelatorioColeta> {
  await renovarTokenSePreciso(c);
  const publicados = await sincronizarPublicados(c);
  const comentarios = await coletarComentarios(c);
  const resultados: RelatorioColeta['resultados'] = {};
  const votacao = await rodadaEmVotacao(c.banco);
  for (const com of comentarios) {
    const r = await processarComentario(c.banco, com, { rodadaEmVotacao: votacao });
    resultados[r] = (resultados[r] ?? 0) + 1;
  }
  const arquivosDoSite = await publicarSite(c);
  const rel = { comentarios: comentarios.length, resultados, publicados, arquivosDoSite };
  logDe(c)(`coletar: ${JSON.stringify(rel)}`);
  return rel;
}

// ------------------------------------------------------------------ partida

const horaBrasilia = (d: Date) => (d.getUTCHours() + FUSO_BRASILIA + 24) % 24;

export function legendaDaPartida(d: DadosDoVideo, rodada: number): string {
  const { mandante, visitante } = d.resultado.times;
  const g = d.resultado.gols;
  const classico = nomeDoClassico(mandante, visitante);
  const nome = (t: TimeId) => FALA_DO_TIME[t].curto;
  const autores = d.resultado.lances
    .filter((l) => l.tipo === 'GOL' && l.finalizador)
    .map((l) => d.nomes[l.finalizador!.lado][l.finalizador!.indice])
    .filter((n): n is string => !!n);
  const linhas = [
    `${nome(mandante)} ${g.mandante} × ${g.visitante} ${nome(visitante)}${d.resultado.penaltis ? ` (pênaltis ${d.resultado.penaltis.placar.mandante}–${d.resultado.penaltis.placar.visitante})` : ''}`,
    `${classico ? `${classico} · ` : ''}${d.subtitulo}`,
    autores.length ? `Gols: ${[...new Set(autores)].join(', ')}` : '',
    '',
    'Quer jogar? Comente ENTRO + seu Time + sua posição. Exemplo: ENTRO ONÇA ATACANTE',
    'Replay e escalações no site (link na bio).',
    '',
    `#varzeaodamata #rodada${rodada} #${IDENTIDADE[mandante].bicho} #${IDENTIDADE[visitante].bicho}`,
  ];
  return linhas.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

interface LinhaJob {
  id: number;
  rodada_id: number;
  rodada: number;
  apito_inicial: string | Date;
  status: string;
  video_url: string | null;
  ig_container_id: string | null;
}

/** Partidas que o job `partida` deve tocar agora: apito nas próximas `janelaMin`, ainda não agendadas. */
export async function partidasPendentes(banco: Banco, agora: Date, janelaMin = 60): Promise<LinhaJob[]> {
  return (
    await banco.query<LinhaJob>(
      `SELECT p.id, p.rodada_id, r.numero AS rodada, p.apito_inicial, p.status, p.video_url, p.ig_container_id
       FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE p.status NOT IN ('AGENDADA', 'PUBLICADA') AND p.apito_inicial <= $1
       ORDER BY p.apito_inicial`,
      [new Date(agora.getTime() + janelaMin * 60_000).toISOString()],
    )
  ).rows;
}

async function existe(caminho: string): Promise<boolean> {
  return stat(caminho).then(
    () => true,
    () => false,
  );
}

/** Sobe a Partida completa (com lances) para o bucket privado: a borda só entrega depois do Apito. */
async function guardarPartidaPrivada(c: ContextoDoJob, partidaId: number, apito: Date): Promise<void> {
  const { arquivos } = await exportarSite(c.banco, new Date(apito.getTime() + DURACAO_AO_VIVO_MS + 60_000));
  const completa = arquivos.get(`partidas/${partidaId}.json`);
  if (completa) await c.armazenamento.enviar('privado', `partidas/${partidaId}.json`, JSON.stringify(completa), { tipo: 'application/json' });
}

/** Cria (ou reaproveita) o container e grava na agenda. Devolve o item agendado. */
async function agendar(c: ContextoDoJob, o: { tipo: ItemDaAgenda['tipo']; ref: number; videoUrl: string; legenda: string; containerAtual: string | null; publicarEm: Date; salvarContainer: (id: string) => Promise<void> }): Promise<ItemDaAgenda | null> {
  if (!c.ig) {
    logDe(c)(`${o.tipo} ${o.ref}: sem Instagram configurado, não agendou.`);
    return null;
  }
  let container = o.containerAtual;
  if (container) {
    const { status } = await c.ig.statusDoContainer(container).catch(() => ({ status: 'ERROR' as const }));
    if (status === 'ERROR' || status === 'EXPIRED') container = null;
  }
  if (!container) {
    container = await c.ig.criarReels({ videoUrl: o.videoUrl, legenda: o.legenda });
    await o.salvarContainer(container);
  }
  await c.ig.esperarContainer(container);
  const item: ItemDaAgenda = { tipo: o.tipo, ref: o.ref, containerId: container, publicarEm: o.publicarEm.toISOString() };
  await gravarNaAgenda(c.agenda, item);
  return item;
}

export async function jobPartida(c: ContextoDoJob, o: { janelaMin?: number; esperarCorte?: boolean } = {}): Promise<number[]> {
  const log = logDe(c);
  const dormir = c.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const feitas: number[] = [];
  const pendentes = await partidasPendentes(c.banco, agoraDe(c), o.janelaMin ?? 60);
  if (!pendentes.length) log('partida: nada a fazer agora.');
  for (const p of pendentes) {
    const apito = new Date(p.apito_inicial);
    const corte = new Date(apito.getTime() - CORTE_MINUTOS * 60_000);
    // Só escala depois do Corte, com os comentários feitos até ele.
    if (p.status === 'PENDENTE') {
      const falta = corte.getTime() - agoraDe(c).getTime();
      if (falta > 0) {
        if (o.esperarCorte === false) {
          log(`Partida ${p.id}: ainda não chegou o Corte (${corte.toISOString()}).`);
          continue;
        }
        log(`Partida ${p.id}: esperando o Corte (${Math.ceil(falta / 60_000)} min).`);
        await dormir(falta + 5_000);
      }
      const coments = await coletarComentarios(c, { dias: 1 });
      const votacao = await rodadaEmVotacao(c.banco);
      for (const com of coments) await processarComentario(c.banco, com, { rodadaEmVotacao: votacao });
    }

    const anterior = (await c.banco.query<{ id: number }>(`SELECT s.id FROM rodada s JOIN rodada r ON r.temporada_id = s.temporada_id AND s.numero = r.numero - 1 WHERE r.id = $1`, [p.rodada_id])).rows[0];
    const craque = anterior ? await craqueDaRodada(c.banco, anterior.id) : null;

    // Vídeo: grava se ainda não tem um link público (num runner novo, o arquivo local some).
    let videoUrl = p.video_url?.startsWith('http') ? p.video_url : null;
    const pasta = await mkdtemp(join(tmpdir(), 'varzea-job-'));
    try {
      const saida = join(pasta, 'reels.mp4');
      if (!videoUrl && p.status === 'RENDERIZADA' && !(p.video_url && (await existe(p.video_url.replace('file://', ''))))) {
        await c.banco.query(`UPDATE partida SET status = 'SIMULADA' WHERE id = $1`, [p.id]);
      }
      const r = await rodarPartida(c.banco, p.id, {
        craque: craque?.id ?? null,
        ...(c.gravarReels && !videoUrl ? { gravar: { gravador: c.gravarReels, saida } } : {}),
      });
      await guardarPartidaPrivada(c, p.id, apito);
      if (!videoUrl && r.video) {
        const local = r.video.replace('file://', '');
        const chave = `videos/${randomUUID()}.mp4`;
        await c.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(local)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
        videoUrl = c.armazenamento.urlPublica(chave);
        await c.banco.query(`UPDATE partida SET video_url = $2 WHERE id = $1`, [p.id, videoUrl]);
      }
      if (!videoUrl) {
        log(`Partida ${p.id}: simulada, sem vídeo (gravador não configurado).`);
        feitas.push(p.id);
        continue;
      }
      // Publica quando o Ao Vivo acaba, para o Reels não estragar o jogo no site.
      const publicarEm = new Date(Math.max(apito.getTime() + DURACAO_AO_VIVO_MS, agoraDe(c).getTime()));
      const item = await agendar(c, {
        tipo: 'PARTIDA',
        ref: p.id,
        videoUrl,
        legenda: legendaDaPartida(r.dados, p.rodada),
        containerAtual: p.ig_container_id,
        publicarEm,
        salvarContainer: (id) => c.banco.query(`UPDATE partida SET ig_container_id = $2 WHERE id = $1`, [p.id, id]).then(() => {}),
      });
      if (item) await c.banco.query(`UPDATE partida SET status = 'AGENDADA' WHERE id = $1`, [p.id]);
      const g = r.resultado.gols;
      log(`Partida ${p.id} (${horaBrasilia(apito)}h): ${g.mandante}×${g.visitante}${item ? `, Reels agendado para ${item.publicarEm}` : ''}.`);
      feitas.push(p.id);
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }
  if (pendentes.length) await publicarSite(c); // as Escalações aparecem no site
  return feitas;
}

// ------------------------------------------------------------------ resumo

export function legendaDoResumo(d: DadosDoResumo): string {
  const linhas = [
    `Resumo da Rodada ${d.rodada}`,
    ...d.placares.map((p) => `${p.hora}h  ${FALA_DO_TIME[p.mandante].curto} ${p.golsMandante} × ${p.golsVisitante} ${FALA_DO_TIME[p.visitante].curto}`),
    '',
    'Quem é o Craque da Rodada? Comente CRAQUE e o @ do seu escolhido:',
    ...d.candidatos.map((c) => `CRAQUE @${c.username}`),
    'Vale o último voto de cada perfil, até o primeiro jogo de amanhã.',
    '',
    d.totalNovos ? `${d.totalNovos} ${d.totalNovos === 1 ? 'novo contratado' : 'novos contratados'} hoje. Quer jogar? Comente ENTRO + Time + posição.` : 'Quer jogar? Comente ENTRO + Time + posição.',
    '',
    `#varzeaodamata #rodada${d.rodada}`,
  ];
  return linhas.join('\n');
}

export async function jobResumo(c: ContextoDoJob): Promise<number | null> {
  const log = logDe(c);
  const agora = agoraDe(c);
  // A Rodada mais recente com todas as Partidas simuladas e o Resumo ainda não agendado.
  const r = (
    await c.banco.query<{ id: number; numero: number; data: string | Date; resumo_status: string }>(
      `SELECT r.id, r.numero, r.data, r.resumo_status FROM rodada r
       WHERE r.resumo_status IN ('PENDENTE', 'RENDERIZADO')
         AND EXISTS (SELECT 1 FROM partida p WHERE p.rodada_id = r.id)
         AND NOT EXISTS (SELECT 1 FROM partida p WHERE p.rodada_id = r.id AND p.status IN ('PENDENTE', 'ESCALADA'))
       ORDER BY r.numero DESC LIMIT 1`,
    )
  ).rows[0];
  if (!r) {
    log('resumo: nenhuma Rodada pronta para o Resumo.');
    return null;
  }
  await fecharRodada(c.banco, r.id);
  const dados = await dadosDoResumo(c.banco, r.id);
  const dia = typeof r.data === 'string' ? r.data.slice(0, 10) : r.data.toISOString().slice(0, 10);
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const publicarEm = new Date(Math.max(Date.UTC(a, m - 1, d, HORA_DO_RESUMO - FUSO_BRASILIA), agora.getTime()));

  if (!c.gravarResumo) {
    log(`Rodada ${r.numero}: Candidatos definidos; sem gravador, não gravou o Resumo.`);
    return r.id;
  }
  const pasta = await mkdtemp(join(tmpdir(), 'varzea-resumo-'));
  try {
    const saida = join(pasta, 'resumo.mp4');
    await c.gravarResumo(dados, saida);
    const chave = `videos/${randomUUID()}.mp4`;
    await c.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(saida)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
    await c.banco.query(`UPDATE rodada SET resumo_status = 'RENDERIZADO' WHERE id = $1`, [r.id]);
    const item = await agendar(c, {
      tipo: 'RESUMO',
      ref: r.id,
      videoUrl: c.armazenamento.urlPublica(chave),
      legenda: legendaDoResumo(dados),
      containerAtual: null,
      publicarEm,
      salvarContainer: async () => {},
    });
    if (item) await c.banco.query(`UPDATE rodada SET resumo_status = 'AGENDADO' WHERE id = $1`, [r.id]);
    log(`Resumo da Rodada ${r.numero}${item ? ` agendado para ${item.publicarEm}` : ' gravado'}.`);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
  await publicarSite(c);
  return r.id;
}

export { ErroInstagram };
