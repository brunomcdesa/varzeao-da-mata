/**
 * Os jobs do GitHub Actions (docs/arquitetura.md). Tudo é retomável: rodar de novo
 * continua de onde parou e nunca publica duas vezes.
 *
 *   coletar  (de hora em hora)  renova o token, sincroniza o que a borda publicou, lê os
 *                               comentários (ENTRO / voto por número), traz os votos do site e atualiza os dados do site.
 *   escalar  (35 min antes)     espera o Corte, escala, simula, guarda para o Ao Vivo e publica
 *                               as Escalações no site, sem vídeo (ADR-0038).
 *   partida  (35 min antes)     espera o Corte (escala se o escalar não fez), grava o Reels, sobe para o
 *                               R2, cria o container e agenda a publicação para o fim do Ao Vivo.
 *   resumo   (18h10)            fecha a Rodada, grava o Resumo e agenda para as 19h.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FALA_DO_TIME, IDENTIDADE, doTime, RODADA_DA_FINAL, type LigaPublica, duracaoAoVivoMs, etapaDa, nomeDaRodada, nomeDoClassico, type Posicao, type Serie, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { FUSO_BRASILIA, criarTemporada, somarDias } from './calendario.js';
import { processarComentario, type Comentario, type Resultado } from './coletar.js';
import { CORTE_MINUTOS } from './escalacao.js';
import { Instagram, ErroInstagram } from './instagram.js';
import { CHAVE_TOKEN, gravarNaAgenda, type Agenda, type Armazenamento, type ItemDaAgenda } from './nuvem.js';
import { avancarMataMata } from './mataMata.js';
import { destaquesDaTemporadaNoBanco } from './destaques.js';
import { seriesDaTemporada } from './series.js';
import { rodarPartida, type DadosDoVideo } from './partida.js';
import { craqueDaRodada, dadosDoResumo, fecharRodada, HORA_DO_RESUMO, type DadosDoResumo } from './resumo.js';
import { exportarSite } from './site.js';
import { jogadoresComVinculo } from './temporada2.js';
import { contextoDaVotacao, importarVotosDoSite, sincronizarVotacao } from './votoSite.js';
import { processarPedidosDoSite } from './pedidosSite.js';
import { tomarPendencias } from './pendencias.js';
import { aparenciasEscolhidas } from './perfil.js';

export interface ContextoDoJob {
  banco: Banco;
  armazenamento: Armazenamento;
  agenda: Agenda;
  /** null: sem Instagram configurado (só grava e sobe; não agenda). */
  ig: Instagram | null;
  gravarReels?: (dados: DadosDoVideo, saida: string) => Promise<void>;
  /** Narração do Ao Vivo do site (o jogo inteiro), em .m4a. */
  gravarAoVivo?: (dados: DadosDoVideo, saida: string) => Promise<void>;
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
  /** Votos do site trazidos do KV nesta coleta. */
  votosDoSite: number;
  /** Pedidos feitos pelo site (Transferência) aplicados nesta coleta. */
  pedidosDoSite: number;
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
    } else if (item.tipo === 'APRESENTACAO') {
      n += (await guardarPostDeInscricao(c.banco, item.mediaId)) ? 1 : 0;
    } else if (item.tipo === 'CRAQUE') {
      const r = await c.banco.query(`UPDATE temporada SET craque_status = 'PUBLICADO', craque_ig_media_id = $2 WHERE id = $1 AND craque_status <> 'PUBLICADO' RETURNING id`, [item.ref, item.mediaId]);
      n += r.rows.length;
    } else {
      const r = await c.banco.query(`UPDATE rodada SET resumo_status = 'PUBLICADO', resumo_ig_media_id = $2 WHERE id = $1 AND resumo_status <> 'PUBLICADO' RETURNING id`, [item.ref, item.mediaId]);
      n += r.rows.length;
    }
    if (agora - Date.parse(item.publicadoEm) > 2 * 86400_000) await c.agenda.apagar(chave);
  }
  return n;
}

/** Resposta a um comentário pelo Instagram; uma falha só vira log (a Inscrição já foi feita). */
function responderComentario(c: ContextoDoJob): (igCommentId: string, texto: string) => Promise<void> {
  return async (id, texto) => {
    if (!c.ig) return;
    try {
      await c.ig.responder(id, texto);
    } catch (e) {
      logDe(c)(`Não respondeu o comentário ${id}: ${(e as Error).message}`);
    }
  };
}

/**
 * Posts de inscrição (o Reels de apresentação): o coletar lê os comentários deles sempre,
 * não só nos primeiros dias, porque é neles que a maioria vai comentar ENTRO.
 */
export async function postsDeInscricao(banco: Banco): Promise<string[]> {
  const r = (await banco.query<{ valor: string[] }>(`SELECT valor FROM config WHERE chave = 'posts_de_inscricao'`)).rows[0];
  return r?.valor ?? [];
}

/** Guarda o post na lista de inscrição. Devolve false se já estava. */
export async function guardarPostDeInscricao(banco: Banco, mediaId: string): Promise<boolean> {
  const atuais = await postsDeInscricao(banco);
  if (atuais.includes(mediaId)) return false;
  await banco.query(
    `INSERT INTO config (chave, valor) VALUES ('posts_de_inscricao', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = now()`,
    [JSON.stringify([...atuais, mediaId])],
  );
  return true;
}

/** Lê os comentários dos posts dos últimos dias e dos posts de inscrição (idempotente pelo id do comentário). */
export async function coletarComentarios(c: ContextoDoJob, o: { dias?: number } = {}): Promise<Comentario[]> {
  if (!c.ig) return [];
  const desde = new Date(agoraDe(c).getTime() - (o.dias ?? 3) * 86400_000);
  const midias = (await c.ig.midiasDesde(desde)).map((m) => m.id);
  for (const id of await postsDeInscricao(c.banco)) if (!midias.includes(id)) midias.push(id);
  const todos: Comentario[] = [];
  for (const id of midias) {
    try {
      todos.push(...(await c.ig.comentarios(id)));
    } catch (e) {
      // Post apagado ou sem acesso: segue com os outros.
      logDe(c)(`Não leu os comentários de ${id}: ${(e as Error).message}`);
    }
  }
  todos.sort((a, b) => a.comentadoEm.getTime() - b.comentadoEm.getTime() || a.igCommentId.localeCompare(b.igCommentId));
  return todos;
}

export async function publicarSite(c: ContextoDoJob, o: { recarregarVinculos?: boolean } = {}): Promise<number> {
  const { arquivos } = await exportarSite(c.banco, agoraDe(c), { vinculos: await jogadoresComVinculo(c.agenda, { recarregar: o.recarregarVinculos ?? true }) });
  for (const [caminho, conteudo] of arquivos) {
    await c.armazenamento.enviar('publico', `dados/${caminho}`, JSON.stringify(conteudo), { tipo: 'application/json', cache: 'public, max-age=60' });
  }
  return arquivos.size;
}

export async function jobColetar(c: ContextoDoJob): Promise<RelatorioColeta> {
  await renovarTokenSePreciso(c);
  // Só lista no KV o que a borda marcou; uma vez por hora, tudo (ADR-0035).
  const pendente = await tomarPendencias(c.banco, c.agenda, agoraDe(c));
  const publicados = pendente('publicados') ? await sincronizarPublicados(c) : 0;
  const comentarios = await coletarComentarios(c);
  const resultados: RelatorioColeta['resultados'] = {};
  const votacao = { ...(await contextoDaVotacao(c.banco)), responder: responderComentario(c) };
  for (const com of comentarios) {
    const r = await processarComentario(c.banco, com, votacao);
    resultados[r] = (resultados[r] ?? 0) + 1;
  }
  const { importados } = await sincronizarVotacao(c.banco, c.agenda, { importar: pendente('votos') });
  const pedidosDoSite = await processarPedidosDoSite(c.banco, c.agenda, agoraDe(c), pendente);
  const arquivosDoSite = await publicarSite(c, { recarregarVinculos: pendente('vinculos') });
  const rel = { comentarios: comentarios.length, resultados, votosDoSite: importados, pedidosDoSite, publicados, arquivosDoSite };
  logDe(c)(`coletar: ${JSON.stringify(rel)}`);
  return rel;
}

// ------------------------------------------------------------------ partida

const horaBrasilia = (d: Date) => (d.getUTCHours() + FUSO_BRASILIA + 24) % 24;

/** Uma linha que explica a Liga para quem cai num post sem conhecer. */
export const O_QUE_E = 'Varzeão da Mata é a liga de futebol dos seguidores: cada partida é simulada lance a lance, narrada e vira Reels aqui no perfil.';

export function legendaDaPartida(d: DadosDoVideo, rodada: number): string {
  const { mandante, visitante } = d.resultado.times;
  const g = d.resultado.gols;
  const classico = nomeDoClassico(mandante, visitante);
  const nome = (t: TimeId) => FALA_DO_TIME[t].curto;
  const autores = d.resultado.lances
    .filter((l) => l.tipo === 'GOL' && l.finalizador)
    .map((l) => {
      const arroba = d.nomes[l.finalizador!.lado][l.finalizador!.indice];
      const apelido = d.apelidos?.[l.finalizador!.lado]?.[l.finalizador!.indice];
      // Legenda: o apelido com o @ (marca a pessoa no post).
      return arroba && apelido ? `${apelido} (${arroba})` : arroba;
    })
    .filter((n): n is string => !!n);
  const linhas = [
    `⚽ ${nome(mandante)} ${g.mandante} × ${g.visitante} ${nome(visitante)}${d.resultado.penaltis ? ` (pênaltis ${d.resultado.penaltis.placar.mandante}–${d.resultado.penaltis.placar.visitante})` : ''}`,
    `${classico ? `${classico} · ` : ''}${d.subtitulo}`,
    autores.length ? `Gols: ${[...new Set(autores)].join(', ')}` : '',
    '',
    O_QUE_E,
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
  fase: 'LIGA' | 'MATA_MATA';
  serie: Serie;
}

/** Partidas que o job `partida` deve tocar agora: apito nas próximas `janelaMin`, ainda não agendadas. */
export async function partidasPendentes(banco: Banco, agora: Date, janelaMin = 60): Promise<LinhaJob[]> {
  return (
    await banco.query<LinhaJob>(
      `SELECT p.id, p.rodada_id, r.numero AS rodada, r.fase, p.apito_inicial, p.status, p.video_url, p.ig_container_id, p.serie
       FROM partida p JOIN rodada r ON r.id = p.rodada_id
       WHERE p.status NOT IN ('AGENDADA', 'PUBLICADA') AND p.apito_inicial <= $1
       ORDER BY p.apito_inicial, p.serie`,
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
  const { arquivos } = await exportarSite(c.banco, new Date(apito.getTime() + duracaoAoVivoMs('MATA_MATA') + 60_000));
  const completa = arquivos.get(`partidas/${partidaId}.json`);
  if (completa) await c.armazenamento.enviar('privado', `partidas/${partidaId}.json`, JSON.stringify(completa), { tipo: 'application/json' });
}

/**
 * Capa do Reels do Resumo (e do fim da Temporada): o quadro da abertura com o título
 * ("Resumo da Rodada 3"). O quadro 0 é só o campo, e a abertura acaba aos 3 s.
 */
export const CAPA_DO_RESUMO_MS = 2000;

/** Cria (ou reaproveita) o container e grava na agenda. Devolve o item agendado. */
async function agendar(c: ContextoDoJob, o: { tipo: ItemDaAgenda['tipo']; ref: number; videoUrl: string; capaUrl?: string; capaEmMs?: number; legenda: string; containerAtual: string | null; publicarEm: Date; salvarContainer: (id: string) => Promise<void> }): Promise<ItemDaAgenda | null> {
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
    container = await c.ig.criarReels({ videoUrl: o.videoUrl, legenda: o.legenda, ...(o.capaUrl ? { capaUrl: o.capaUrl } : {}), ...(o.capaEmMs !== undefined ? { capaEmMs: o.capaEmMs } : {}) });
    await o.salvarContainer(container);
  }
  await c.ig.esperarContainer(container);
  const item: ItemDaAgenda = { tipo: o.tipo, ref: o.ref, containerId: container, publicarEm: o.publicarEm.toISOString() };
  await gravarNaAgenda(c.agenda, item);
  return item;
}

/** O Craque da Rodada anterior da mesma Série, que tem a vaga garantida na Escalação (ADR-0017). */
async function craqueDaVez(banco: Banco, p: LinhaJob): Promise<{ id: string } | null> {
  const anterior = (await banco.query<{ id: number }>(`SELECT s.id FROM rodada s JOIN rodada r ON r.temporada_id = s.temporada_id AND s.numero = r.numero - 1 WHERE r.id = $1`, [p.rodada_id])).rows[0];
  return anterior ? craqueDaRodada(banco, anterior.id, p.serie) : null;
}

/**
 * A etapa do Corte (ADR-0038): espera o Corte, lê os comentários, os votos e os pedidos do site
 * feitos até ele, escala, simula e guarda todas as Partidas pendentes do horário de `p` e publica
 * o site, para as Escalações aparecerem já no Corte. Não grava vídeo. Devolve false se o Corte
 * ainda não chegou e `esperarCorte` é false. Pode rodar em dois jobs ao mesmo tempo (escalar e
 * partida): a Escalação e a simulação travam a Partida no banco e a segunda vê o que a primeira fez.
 */
async function etapaDoCorte(c: ContextoDoJob, pendentes: LinhaJob[], p: LinhaJob, o: { esperarCorte?: boolean }): Promise<boolean> {
  const log = logDe(c);
  const dormir = c.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const apito = new Date(p.apito_inicial);
  const corte = new Date(apito.getTime() - CORTE_MINUTOS * 60_000);
  const falta = corte.getTime() - agoraDe(c).getTime();
  if (falta > 0) {
    if (o.esperarCorte === false) {
      log(`Partida ${p.id}: ainda não chegou o Corte (${corte.toISOString()}).`);
      return false;
    }
    log(`Partida ${p.id}: esperando o Corte (${Math.ceil(falta / 60_000)} min).`);
    await dormir(falta + 5_000);
  }
  const coments = await coletarComentarios(c, { dias: 1 });
  const votacao = { ...(await contextoDaVotacao(c.banco)), responder: responderComentario(c) };
  for (const com of coments) await processarComentario(c.banco, com, votacao);
  // Últimos votos do site antes de a votação fechar (ela fecha quando este jogo é escalado).
  if (votacao.rodadaEmVotacao !== null) await importarVotosDoSite(c.banco, c.agenda, votacao.rodadaEmVotacao);
  // Transferências pedidas pelo site até o Corte entram nesta Escalação.
  await processarPedidosDoSite(c.banco, c.agenda, agoraDe(c));
  // Com duas Séries há duas Partidas no mesmo horário: as duas ficam prontas antes de qualquer
  // Reels ser gravado, para estarem no Ao Vivo no Apito Inicial (ADR-0017).
  for (const q of pendentes) {
    if (q.status !== 'PENDENTE' || new Date(q.apito_inicial).getTime() !== apito.getTime()) continue;
    await rodarPartida(c.banco, q.id, { craque: (await craqueDaVez(c.banco, q))?.id ?? null, vinculos: await jogadoresComVinculo(c.agenda) });
    await guardarPartidaPrivada(c, q.id, apito);
    q.status = 'SIMULADA';
    log(`Partida ${q.id}: escalada e simulada.`);
  }
  await publicarSite(c); // as Escalações aparecem no site já no Corte
  return true;
}

/**
 * Job leve do Corte (ADR-0038): só a etapa do Corte, sem Chromium nem ffmpeg. As Escalações e o
 * Ao Vivo saem no horário mesmo se a instalação ou a gravação do vídeo falharem; o job partida
 * grava os Reels depois e, se este job não tiver rodado, faz a etapa do Corte ele mesmo.
 */
export async function jobEscalar(c: ContextoDoJob, o: { janelaMin?: number; esperarCorte?: boolean } = {}): Promise<number[]> {
  const pendentes = await partidasPendentes(c.banco, agoraDe(c), o.janelaMin ?? 60);
  const p = pendentes.find((q) => q.status === 'PENDENTE');
  if (!p) {
    logDe(c)('escalar: nada a fazer agora.');
    return [];
  }
  if (!(await etapaDoCorte(c, pendentes, p, o))) return [];
  const apito = new Date(p.apito_inicial).getTime();
  return pendentes.filter((q) => q.status === 'SIMULADA' && new Date(q.apito_inicial).getTime() === apito).map((q) => q.id);
}

export async function jobPartida(c: ContextoDoJob, o: { janelaMin?: number; esperarCorte?: boolean } = {}): Promise<number[]> {
  const log = logDe(c);
  const feitas: number[] = [];
  const pendentes = await partidasPendentes(c.banco, agoraDe(c), o.janelaMin ?? 60);
  if (!pendentes.length) log('partida: nada a fazer agora.');
  for (const p of pendentes) {
    const apito = new Date(p.apito_inicial);
    // Só escala depois do Corte, com os comentários feitos até ele (se o job escalar ainda não fez).
    if (p.status === 'PENDENTE' && !(await etapaDoCorte(c, pendentes, p, o))) continue;
    // O job escalar pode ter simulado depois da leitura acima: o status certo vem do banco.
    const agoraNoBanco = (await c.banco.query<{ status: LinhaJob['status'] }>(`SELECT status FROM partida WHERE id = $1`, [p.id])).rows[0]?.status;
    if (agoraNoBanco) p.status = agoraNoBanco;

    const craque = await craqueDaVez(c.banco, p);

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
        vinculos: await jogadoresComVinculo(c.agenda),
        ...(c.gravarReels && !videoUrl ? { gravar: { gravador: c.gravarReels, saida } } : {}),
      });
      await guardarPartidaPrivada(c, p.id, apito);
      let capaUrl: string | undefined;
      if (!videoUrl && r.video) {
        const local = r.video.replace('file://', '');
        const nome = `videos/${randomUUID()}`;
        await c.armazenamento.enviar('publico', `${nome}.mp4`, new Uint8Array(await readFile(local)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
        videoUrl = c.armazenamento.urlPublica(`${nome}.mp4`);
        await c.banco.query(`UPDATE partida SET video_url = $2 WHERE id = $1`, [p.id, videoUrl]);
        // Capa do Reels ("Time A x Time B" com os escudos), gravada junto com o vídeo.
        const capa = local.replace(/\.mp4$/, '-capa.jpg');
        if (await existe(capa)) {
          await c.armazenamento.enviar('publico', `${nome}-capa.jpg`, new Uint8Array(await readFile(capa)), { tipo: 'image/jpeg', cache: 'public, max-age=31536000, immutable' });
          capaUrl = c.armazenamento.urlPublica(`${nome}-capa.jpg`);
        }
      }
      // Narração do Ao Vivo: falha aqui não atrapalha o Reels (o Ao Vivo segue mudo).
      if (c.gravarAoVivo) {
        const ja = (await c.banco.query<{ narracao_url: string | null }>(`SELECT narracao_url FROM partida WHERE id = $1`, [p.id])).rows[0]?.narracao_url;
        if (!ja) {
          try {
            const arquivo = join(pasta, 'aovivo.m4a');
            await c.gravarAoVivo(r.dados, arquivo);
            const chave = `narracao/${randomUUID()}.m4a`;
            await c.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(arquivo)), { tipo: 'audio/mp4', cache: 'public, max-age=31536000, immutable' });
            await c.banco.query(`UPDATE partida SET narracao_url = $2 WHERE id = $1`, [p.id, c.armazenamento.urlPublica(chave)]);
            // A cópia que a borda entrega no Ao Vivo foi guardada antes da narração: guarda de novo, agora com ela.
            await guardarPartidaPrivada(c, p.id, apito);
          } catch (e) {
            log(`Partida ${p.id}: sem narração do Ao Vivo (${(e as Error).message}).`);
          }
        }
      }
      if (!videoUrl) {
        log(`Partida ${p.id}: simulada, sem vídeo (gravador não configurado).`);
        feitas.push(p.id);
        continue;
      }
      // Publica quando o Ao Vivo acaba, para o Reels não estragar o jogo no site.
      const publicarEm = new Date(Math.max(apito.getTime() + duracaoAoVivoMs(p.fase), agoraDe(c).getTime()));
      const item = await agendar(c, {
        tipo: 'PARTIDA',
        ref: p.id,
        videoUrl,
        ...(capaUrl ? { capaUrl } : {}),
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
  const etapa = etapaDa(d.fase, d.rodada);
  const comSeries = !!d.tabelaB;
  const placar = (p: DadosDoResumo['placares'][number]) =>
    `${p.hora}h  ${FALA_DO_TIME[p.mandante].curto} ${p.golsMandante} × ${p.golsVisitante} ${FALA_DO_TIME[p.visitante].curto}${p.penaltis ? ` (pênaltis ${p.penaltis.mandante}–${p.penaltis.visitante})` : ''}`;
  const vencedor = (p: DadosDoResumo['placares'][number]) =>
    p.penaltis ? (p.penaltis.mandante > p.penaltis.visitante ? p.mandante : p.visitante) : p.golsMandante > p.golsVisitante ? p.mandante : p.visitante;
  const daSerie = <T extends { serie?: Serie }>(xs: T[], serie: Serie) => xs.filter((x) => (x.serie ?? 'A') === serie);
  const series: Serie[] = comSeries ? ['A', 'B'] : ['A'];
  // Na Final, o campeão de cada Série (com duas Séries, a Final da B também está nos placares).
  const campeoes = etapa === 'FINAL' ? series.flatMap((serie) => daSerie(d.placares, serie).slice(0, 1).map((p) => ({ serie, time: vencedor(p) }))) : [];
  const placares = comSeries ? series.flatMap((serie) => [`Série ${serie}`, ...daSerie(d.placares, serie).map(placar)]) : d.placares.map(placar);
  // Sem @: a lista não marca ninguém (ADR-0011).
  const candidato = (c: DadosDoResumo['candidatos'][number], i: number) => `${c.rotulo ?? c.numero ?? i + 1} · ${c.username} (${FALA_DO_TIME[c.time].curto})`;
  const candidatos = comSeries
    ? series.flatMap((serie) => {
        const lista = daSerie(d.candidatos, serie);
        return lista.length ? [`Série ${serie}`, ...lista.map(candidato)] : [];
      })
    : d.candidatos.map(candidato);
  const linhas = [
    `📋 ${etapa === 'LIGA' ? `Resumo da Rodada ${d.rodada}` : etapa === 'SEMIFINAL' ? 'Resumo das Semifinais' : 'Resumo da Final'} da Temporada ${d.temporada}`,
    ...placares,
    '',
    // Anúncio do Craque da Rodada anterior: aqui o @ marca o eleito (é parabéns, não voto).
    ...[d.craqueDaRodada ? ['A', d.craqueDaRodada] : null, d.craqueDaRodadaB ? ['B', d.craqueDaRodadaB] : null].flatMap((x) => {
      if (!x) return [];
      const [serie, c] = x as [Serie, NonNullable<DadosDoResumo['craqueDaRodada']>];
      return [
        `⭐ Craque ${c.fase === 'LIGA' ? `da Rodada ${c.rodada}` : 'das Semifinais'}${comSeries ? ` da Série ${serie}` : ''}: ${c.apelido ? `${c.apelido} (@${c.username})` : `@${c.username}`}, ${FALA_DO_TIME[c.time].curto}${c.votos ? `, com ${c.votos} ${c.votos === 1 ? 'voto' : 'votos'}` : ''}. Parabéns!`,
      ];
    }),
    ...(d.craqueDaRodada || d.craqueDaRodadaB ? [''] : []),
    ...(campeoes.length
      ? [
          ...campeoes.map((c) => `${IDENTIDADE[c.time].nome} é campeão ${comSeries ? `da Série ${c.serie} ` : ''}da Temporada ${d.temporada}!`),
          'Obrigado a todo mundo que jogou. A próxima Temporada vem aí.',
        ]
      : [
          comSeries
            ? `Quem é o Craque ${etapa === 'FINAL' ? 'da Temporada' : 'da Rodada'} em cada Série? Comente a letra e o número (A3, B3), ou vote no site (link na bio):`
            : `Quem é o Craque ${etapa === 'FINAL' ? 'da Temporada' : 'da Rodada'}? Comente só o número do seu escolhido, ou vote no site (link na bio):`,
          ...candidatos,
          comSeries ? 'Um voto por perfil em cada Série (vale o último) e um por aparelho no site.' : 'Um voto por perfil (vale o último) e um por aparelho no site.',
        ]),
    '',
    O_QUE_E,
    d.totalNovos ? `${d.totalNovos} ${d.totalNovos === 1 ? 'novo contratado' : 'novos contratados'} hoje. Quer jogar? Comente ENTRO + Time + posição.` : 'Quer jogar? Comente ENTRO + Time + posição.',
    '',
    etapa === 'LIGA' ? `#varzeaodamata #rodada${d.rodada}` : `#varzeaodamata #matamata`,
  ];
  return linhas.join('\n');
}

/**
 * No dia seguinte à Final, às 18h, fecha a votação do Craque da Temporada, grava o anúncio e
 * agenda para as 19h. Devolve o id da Temporada (ou null se não era a hora).
 */
export async function jobCraqueDaTemporada(c: ContextoDoJob): Promise<number | null> {
  const log = logDe(c);
  const agora = agoraDe(c);
  const t = (
    await c.banco.query<{ id: number; numero: number; final_id: number; data: string | Date; craque_jogador_id: string | null }>(
      `SELECT t.id, t.numero, r.id AS final_id, r.data, t.craque_jogador_id::text AS craque_jogador_id
       FROM temporada t JOIN rodada r ON r.temporada_id = t.id AND r.numero = ${RODADA_DA_FINAL}
       WHERE t.status = 'ENCERRADA' AND t.craque_status = 'PENDENTE'
       ORDER BY t.numero LIMIT 1`,
    )
  ).rows[0];
  if (!t) return null;
  const dia = typeof t.data === 'string' ? t.data.slice(0, 10) : t.data.toISOString().slice(0, 10);
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const fechaEm = Date.UTC(a, m - 1, d + 1, 18 - FUSO_BRASILIA);
  if (agora.getTime() < fechaEm) return null;

  // A próxima Temporada já nasce aqui: Rodada 1 dois dias depois deste anúncio.
  const proxima = await garantirProximaTemporada(c.banco, t.numero, somarDias(dia, 3));
  await importarVotosDoSite(c.banco, c.agenda, t.final_id);
  // Com duas Séries, a B também elege o seu Craque da Temporada (ADR-0017).
  const craqueB = (await seriesDaTemporada(c.banco, t.id)).B.length ? await eleitoDaSerieB(c.banco, t.id, t.final_id) : null;
  let craqueId = t.craque_jogador_id;
  if (!craqueId) {
    const eleito = await craqueDaRodada(c.banco, t.final_id);
    if (!eleito) {
      // Sem Candidatos (ninguém com jogos suficientes): encerra sem Craque.
      await c.banco.query(`UPDATE temporada SET craque_status = 'PUBLICADO' WHERE id = $1`, [t.id]);
      await publicarSite(c);
      return t.id;
    }
    craqueId = eleito.id;
    await c.banco.query(`UPDATE temporada SET craque_jogador_id = $2 WHERE id = $1`, [t.id, craqueId]);
  }
  const { s, gols } = await numerosDoCraque(c.banco, t.id, t.final_id, craqueId);
  const b = craqueB ? await numerosDoCraque(c.banco, t.id, t.final_id, craqueB.id) : null;
  const publicarEm = new Date(Math.max(Date.UTC(a, m - 1, d + 1, HORA_DO_RESUMO - FUSO_BRASILIA), agora.getTime()));
  // Campeão, vice, artilheiro e melhor goleiro: os mesmos números da página de História.
  // Seleção da Temporada (ADR-0041): com ela, o melhor goleiro vira a Muralha.
  const destaques = await destaquesDaTemporadaNoBanco(c.banco, t.id, t.numero, (await seriesDaTemporada(c.banco, t.id)).B.length > 0);
  const historia = ((await exportarSite(c.banco, agora)).arquivos.get('liga.json') as LigaPublica).temporadas.find((x) => x.numero === t.numero);
  const dados: DadosDoResumo = {
    temporada: t.numero,
    rodada: RODADA_DA_FINAL,
    fase: 'MATA_MATA',
    placares: [],
    tabela: [],
    novosContratados: [],
    totalNovos: 0,
    candidatos: [],
    ...(historia?.campeao ? { campeao: historia.campeao } : {}),
    ...(historia?.serieB?.campeao ? { campeaoB: historia.serieB.campeao } : {}),
    ...(b ? { craqueDaTemporadaB: { username: b.s.username, apelido: b.s.apelido ?? null, time: b.s.time_id, posicao: b.s.posicao, notaMedia: Number(b.s.media), gols: b.gols, jogos: Number(b.s.jogos), votos: Number(b.s.votos) } } : {}),
    fimDaTemporada: {
      ...(historia?.artilheiro ? { artilheiro: { username: historia.artilheiro.username, apelido: historia.artilheiro.apelido ?? null, time: historia.artilheiro.time, posicao: historia.artilheiro.posicao, gols: historia.artilheiro.gols } } : {}),
      ...(historia?.goleiro && !destaques.length ? { goleiro: { username: historia.goleiro.username, time: historia.goleiro.time, notaMedia: historia.goleiro.notaMedia } } : {}),
      proxima,
    },
    ...(destaques.length ? { destaques } : {}),
    craqueDaTemporada: { username: s.username, apelido: s.apelido ?? null, time: s.time_id, posicao: s.posicao, notaMedia: Number(s.media), gols, jogos: Number(s.jogos), votos: Number(s.votos) },
  };
  let item: ItemDaAgenda | null = null;
  if (c.gravarResumo) {
    const pasta = await mkdtemp(join(tmpdir(), 'varzea-craque-'));
    try {
      const saida = join(pasta, 'craque.mp4');
      await c.gravarResumo({ ...dados, aparencias: await aparenciasEscolhidas(c.banco) }, saida);
      const chave = `videos/${randomUUID()}.mp4`;
      await c.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(saida)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
      item = await agendar(c, {
        tipo: 'CRAQUE',
        ref: t.id,
        videoUrl: c.armazenamento.urlPublica(chave),
        capaEmMs: CAPA_DO_RESUMO_MS,
        legenda: legendaDoFimDaTemporada(t.numero, historia, { username: s.username, time: s.time_id, jogos: Number(s.jogos), gols, media: Number(s.media), votos: Number(s.votos) }, proxima, craqueB),
        containerAtual: null,
        publicarEm,
        salvarContainer: async () => {},
      });
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }
  await c.banco.query(`UPDATE temporada SET craque_status = $2, craque_revelado_em = $3 WHERE id = $1`, [t.id, item ? 'AGENDADO' : 'PUBLICADO', publicarEm.toISOString()]);
  log(`Craque da Temporada ${t.numero}: @${s.username}${item ? `, anúncio agendado para ${item.publicarEm}` : ''}.`);
  await publicarSite(c);
  return t.id;
}

/** Os números do Craque da Temporada para o anúncio: nota média, jogos, votos e gols. */
async function numerosDoCraque(banco: Banco, temporadaId: number, finalId: number, jogadorId: string) {
  const s = (
    await banco.query<{ username: string; apelido: string | null; time_id: TimeId; posicao: Posicao; media: string; jogos: string; votos: string }>(
      `SELECT j.username, j.apelido, j.time_id, j.posicao, c.nota AS media,
              (SELECT count(*) FROM escalacao e JOIN partida p ON p.id = e.partida_id JOIN rodada r ON r.id = p.rodada_id
                WHERE r.temporada_id = $3 AND e.jogador_id = j.id AND e.nota IS NOT NULL) AS jogos,
              (SELECT count(*) FROM voto_total v WHERE v.rodada_id = c.rodada_id AND v.jogador_id = j.id) AS votos
       FROM candidato c JOIN jogador j ON j.id = c.jogador_id WHERE c.rodada_id = $1 AND j.id = $2`,
      [finalId, jogadorId, temporadaId],
    )
  ).rows[0]!;
  const gols = (
    await banco.query<{ desempenho: { gols: number } }>(
      `SELECT d AS desempenho FROM partida p JOIN rodada r ON r.id = p.rodada_id CROSS JOIN LATERAL jsonb_array_elements(p.resultado->'desempenhos') d
       WHERE r.temporada_id = $1 AND d->>'jogadorId' = $2`,
      [temporadaId, jogadorId],
    )
  ).rows.reduce((soma, x) => soma + (x.desempenho.gols ?? 0), 0);
  return { s, gols };
}

/** Elege (uma vez só) o Craque da Temporada da Série B: o Candidato da B mais votado na Final. */
async function eleitoDaSerieB(banco: Banco, temporadaId: number, finalId: number): Promise<{ id: string; username: string; time: TimeId } | null> {
  let id = (await banco.query<{ id: string | null }>(`SELECT craque_b_jogador_id::text AS id FROM temporada WHERE id = $1`, [temporadaId])).rows[0]?.id ?? null;
  if (!id) {
    id = (await craqueDaRodada(banco, finalId, 'B'))?.id ?? null;
    if (!id) return null;
    await banco.query(`UPDATE temporada SET craque_b_jogador_id = $2 WHERE id = $1`, [temporadaId, id]);
  }
  return (await banco.query<{ id: string; username: string; time: TimeId }>(`SELECT id::text AS id, username, time_id AS time FROM jogador WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Cria a Temporada seguinte (se ainda não existe) e devolve número e dia da Rodada 1. */
export async function garantirProximaTemporada(banco: Banco, atual: number, inicio: string): Promise<{ numero: number; inicio: string }> {
  const existente = (await banco.query<{ inicio: string | Date }>(`SELECT inicio FROM temporada WHERE numero = $1`, [atual + 1])).rows[0];
  if (existente) return { numero: atual + 1, inicio: (existente.inicio instanceof Date ? existente.inicio.toISOString() : String(existente.inicio)).slice(0, 10) };
  await criarTemporada(banco, { numero: atual + 1, primeiraRodada: inicio, seed: Math.floor(Math.random() * 2 ** 31) });
  return { numero: atual + 1, inicio };
}

/** Legenda do Resumo da Temporada (o post do dia seguinte à Final). Marca só o Craque eleito. */
export function legendaDoFimDaTemporada(
  numero: number,
  h: LigaPublica['temporadas'][number] | undefined,
  craque: { username: string; time: TimeId; jogos: number; gols: number; media: number; votos: number },
  proxima: { numero: number; inicio: string },
  craqueB: { username: string; time: TimeId } | null = null,
): string {
  const nome = (t: TimeId) => FALA_DO_TIME[t].curto;
  const [, mes, dia] = proxima.inicio.split('-');
  const linhas = [
    `🏆 Resumo da Temporada ${numero} do Varzeão da Mata`,
    '',
    h?.campeao ? `Campeão: ${IDENTIDADE[h.campeao].nome}${h.vice ? ` (vice: ${nome(h.vice)})` : ''}` : '',
    `Craque da Temporada${craqueB ? ' (Série A)' : ''}: @${craque.username} (${nome(craque.time)}), ${craque.jogos} jogos, ${craque.gols} ${craque.gols === 1 ? 'gol' : 'gols'}, nota média ${craque.media.toFixed(1).replace('.', ',')} e ${craque.votos} votos da torcida`,
    craqueB ? `Craque da Temporada (Série B): @${craqueB.username} (${nome(craqueB.time)})` : '',
    h?.artilheiro ? `Artilheiro: ${h.artilheiro.username} (${nome(h.artilheiro.time)}), ${h.artilheiro.gols} ${h.artilheiro.gols === 1 ? 'gol' : 'gols'}` : '',
    h?.goleiro ? `Melhor goleiro: ${h.goleiro.username} (${nome(h.goleiro.time)}), nota média ${h.goleiro.notaMedia.toFixed(1).replace('.', ',')}` : '',
    '',
    `🏁 A Temporada ${proxima.numero} começa em ${dia}/${mes}. Quer jogar? Comente ENTRO + Time + posição.`,
    O_QUE_E,
    '',
    '#varzeaodamata #craquedatemporada',
  ];
  return linhas.filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n');
}

export async function jobResumo(c: ContextoDoJob): Promise<number | null> {
  const log = logDe(c);
  const agora = agoraDe(c);
  if (await jobCraqueDaTemporada(c)) return null;
  // A Rodada mais recente com todas as Partidas simuladas e o Resumo ainda não agendado.
  const r = (
    await c.banco.query<{ id: number; temporada_id: number; numero: number; data: string | Date; resumo_status: string }>(
      `SELECT r.id, r.temporada_id, r.numero, r.data, r.resumo_status FROM rodada r
       WHERE r.resumo_status IN ('PENDENTE', 'RENDERIZADO')
         AND EXISTS (SELECT 1 FROM partida p WHERE p.rodada_id = r.id)
         AND NOT EXISTS (SELECT 1 FROM partida p WHERE p.rodada_id = r.id AND p.status IN ('PENDENTE', 'ESCALADA'))
       ORDER BY r.data DESC, r.numero DESC LIMIT 1`,
    )
  ).rows[0];
  if (!r) {
    log('resumo: nenhuma Rodada pronta para o Resumo.');
    return null;
  }
  await fecharRodada(c.banco, r.id);
  // Depois da 7ª Rodada cria as Semifinais; depois delas, a Final; depois dela, encerra.
  const passo = await avancarMataMata(c.banco, r.temporada_id);
  if (passo !== 'NADA') log(`Mata-mata: ${passo}.`);
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
    await c.gravarResumo({ ...dados, aparencias: await aparenciasEscolhidas(c.banco) }, saida);
    const chave = `videos/${randomUUID()}.mp4`;
    await c.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(saida)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
    await c.banco.query(`UPDATE rodada SET resumo_status = 'RENDERIZADO' WHERE id = $1`, [r.id]);
    const item = await agendar(c, {
      tipo: 'RESUMO',
      ref: r.id,
      videoUrl: c.armazenamento.urlPublica(chave),
      capaEmMs: CAPA_DO_RESUMO_MS,
      legenda: legendaDoResumo(dados),
      containerAtual: null,
      publicarEm,
      salvarContainer: async () => {},
    });
    if (item) await c.banco.query(`UPDATE rodada SET resumo_status = 'AGENDADO' WHERE id = $1`, [r.id]);
    log(`Resumo ${nomeDaRodada(dados.fase, r.numero)}${item ? ` agendado para ${item.publicarEm}` : ' gravado'}.`);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
  await publicarSite(c);
  return r.id;
}

export { ErroInstagram };

// ------------------------------------------------------------------ boas-vindas

/**
 * Resposta de boas-vindas para quem se inscreveu antes de a Liga responder as Inscrições.
 * Roda uma vez à mão; pula quem já tem resposta da Liga (pela API e pela lista guardada).
 */
export async function jobBoasVindas(c: ContextoDoJob, o: { enviar: boolean }): Promise<{ respondidos: number; pulados: number }> {
  if (!c.ig) throw new Error('Instagram não configurado.');
  const conta = (await c.ig.eu()).username.toLowerCase();
  const guardado = (await c.banco.query<{ valor: string[] }>(`SELECT valor FROM config WHERE chave = 'boas_vindas'`)).rows[0]?.valor ?? [];
  const feitos = new Set(guardado);
  const alvos = (
    await c.banco.query<{ ig_comment_id: string; username: string; time_id: TimeId; posicao: Posicao; ovr: number }>(
      `SELECT DISTINCT ON (j.id) c.ig_comment_id, j.username, j.time_id, j.posicao, j.ovr
         FROM jogador j JOIN comando c ON c.ig_user_id = j.ig_user_id AND c.resultado IN ('INSCRITO', 'REALOCADO')
        WHERE NOT j.banido ORDER BY j.id, c.comentado_em DESC`,
    )
  ).rows;
  const nome: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };
  let respondidos = 0;
  let pulados = 0;
  let sumidos = 0;
  for (const a of alvos) {
    if (feitos.has(a.ig_comment_id)) {
      pulados++;
      continue;
    }
    const quem = await c.ig.quemRespondeu(a.ig_comment_id).catch(() => null);
    if (quem === null) {
      logDe(c)(`@${a.username}: comentário não existe mais, pulado.`);
      sumidos++;
      continue;
    }
    if (quem.includes(conta)) {
      pulados++;
      continue;
    }
    const texto = `@${a.username} você entrou no Varzeão da Mata! Agora é ${nome[a.posicao]} ${doTime(a.time_id)}, OVR ${a.ovr}. Seu boneco já está no site (link na bio). ⚽`;
    if (!o.enviar) {
      logDe(c)(`(teste) ${texto}`);
      continue;
    }
    try {
      await c.ig.responder(a.ig_comment_id, texto);
      feitos.add(a.ig_comment_id);
      respondidos++;
      await c.banco.query(
        `INSERT INTO config (chave, valor) VALUES ('boas_vindas', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = now()`,
        [JSON.stringify([...feitos])],
      );
      await new Promise((r) => setTimeout(r, 3000)); // devagar, para o Instagram não achar que é spam
    } catch (e) {
      logDe(c)(`Não respondeu @${a.username}: ${(e as Error).message}`);
    }
  }
  logDe(c)(`boas-vindas: ${respondidos} respondido(s), ${pulados} já tinham resposta, ${sumidos} comentário(s) apagado(s), ${alvos.length} inscrito(s).`);
  return { respondidos, pulados };
}
