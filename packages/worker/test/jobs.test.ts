import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_PENDENCIAS, TIMES_FUNDADORES as TIMES, TIMES_NOVOS } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import type { Comentario } from '../src/coletar.js';
import type { Instagram } from '../src/instagram.js';
import { CAPA_DO_RESUMO_MS, jobColetar, jobEscalar, jobPartida, jobResumo, sincronizarPublicados, type ContextoDoJob } from '../src/jobs.js';
import { AgendaNaMemoria, CHAVE_TOKEN, PastaLocal, type ItemDaAgenda } from '../src/nuvem.js';
import { bancoDeTeste } from './banco-de-teste.js';

/** Instagram de mentira: posts com comentários, containers que ficam prontos na hora. */
class InstagramFalso {
  comentariosPorMidia = new Map<string, Comentario[]>();
  containers: { id: string; videoUrl: string; legenda: string; capaEmMs?: number; capaUrl?: string }[] = [];
  token = 'T0';
  renovacoes = 0;
  /** Posts antigos: existem, mas já não aparecem em midiasDesde. */
  antigos = new Set<string>();
  async midiasDesde() {
    return [...this.comentariosPorMidia.keys()].filter((id) => !this.antigos.has(id)).map((id) => ({ id, timestamp: new Date().toISOString() }));
  }
  async comentarios(id: string) {
    return this.comentariosPorMidia.get(id) ?? [];
  }
  async criarReels(o: { videoUrl: string; legenda: string; capaEmMs?: number; capaUrl?: string }) {
    const id = `C${this.containers.length + 1}`;
    this.containers.push({ id, ...o });
    return id;
  }
  async statusDoContainer() {
    return { status: 'FINISHED' as const };
  }
  async esperarContainer() {}
  async renovarToken() {
    this.renovacoes++;
    this.token = `T${this.renovacoes}`;
    return { token: this.token, expiraEm: new Date(Date.now() + 60 * 86400_000) };
  }
}

let banco: Banco;
let pasta: string;
let ig: InstagramFalso;
let agenda: AgendaNaMemoria;
let agora: Date;
let ctx: ContextoDoJob;
const gravados: string[] = [];

beforeEach(async () => {
  banco = await bancoDeTeste();
  await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 9 });
  pasta = await mkdtemp(join(tmpdir(), 'jobs-'));
  ig = new InstagramFalso();
  agenda = new AgendaNaMemoria();
  agora = new Date('2026-11-07T12:00:00Z'); // 9h em Brasília
  let n = 0;
  ig.comentariosPorMidia.set(
    'post1',
    TIMES.flatMap((t) =>
      ['ATA', 'GOL'].map((pos) => ({
        igCommentId: `c${++n}`,
        igMediaId: 'post1',
        igUserId: `u${n}`,
        username: `${t}_${pos}`.toLowerCase(),
        texto: `ENTRO ${t} ${pos}`,
        comentadoEm: new Date('2026-11-07T11:00:00Z'),
      })),
    ),
  );
  ctx = {
    banco,
    armazenamento: new PastaLocal(pasta),
    agenda,
    ig: ig as unknown as Instagram,
    agora: () => agora,
    dormir: async (ms) => void (agora = new Date(agora.getTime() + ms)),
    log: () => {},
    gravarReels: async (_d, saida) => {
      gravados.push(saida);
      await writeFile(saida, 'mp4 de mentira');
    },
    gravarResumo: async (_d, saida) => writeFile(saida, 'resumo de mentira'),
  };
});
afterEach(async () => {
  await banco.fechar();
});

const status = async (id: number) => (await banco.query<{ status: string }>(`SELECT status FROM partida WHERE id = $1`, [id])).rows[0]!.status;

describe('jobs', () => {
  it('coletar: renova o token, inscreve pelos comentários e publica o site', async () => {
    const rel = await jobColetar(ctx);
    expect(rel.resultados.INSCRITO).toBe(16);
    expect(ig.renovacoes).toBe(1);
    expect(await agenda.ler(CHAVE_TOKEN)).toEqual({ token: 'T1' });
    expect(await readdir(join(pasta, 'publico/dados'))).toEqual(expect.arrayContaining(['liga.json', 'jogadores.json']));
    // Rodar de novo: nada se repete e o token, novo, não renova.
    const de_novo = await jobColetar(ctx);
    expect(de_novo.resultados.REPETIDO).toBe(16);
    expect(ig.renovacoes).toBe(1);
  });

  it('coletar: lê sempre o post de apresentação, mesmo depois dos primeiros dias', async () => {
    ig.comentariosPorMidia.set('apresentacao', [
      { igCommentId: 'a1', igMediaId: 'apresentacao', igUserId: 'fa', username: 'fã.antigo', texto: 'ENTRO TATU MEIA', comentadoEm: new Date('2026-11-07T11:30:00Z') },
    ]);
    ig.antigos.add('apresentacao');
    expect((await jobColetar(ctx)).resultados.INSCRITO).toBe(16); // o post antigo ficou de fora
    // A borda publicou o Reels de apresentação: o coletar registra o post e passa a lê-lo.
    await agenda.gravar('agenda/2026-11-07T22:00:00.000Z/apresentacao-1', {
      tipo: 'APRESENTACAO', ref: 1, containerId: 'C9', publicarEm: '2026-11-07T22:00:00.000Z', publicadoEm: '2026-11-07T22:00:05.000Z', mediaId: 'apresentacao',
    } satisfies ItemDaAgenda);
    await agenda.gravar(CHAVE_PENDENCIAS, { publicados: '2026-11-07T22:00:05.000Z' }); // a borda marca (ADR-0035)
    const rel = await jobColetar(ctx);
    expect(rel.publicados).toBe(1);
    expect(rel.resultados.INSCRITO).toBe(1);
  });

  it('partida: espera o Corte, grava, sobe, agenda para o fim do Ao Vivo e não repete', async () => {
    await jobColetar(ctx);
    agora = new Date('2026-11-07T14:25:00Z'); // 11h25: 35 min antes do jogo das 12h
    const [id] = await jobPartida(ctx);
    expect(id).toBeDefined();
    expect(agora.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-07T14:30:00Z')); // esperou o Corte
    expect(await status(id!)).toBe('AGENDADA');
    const [chave] = await agenda.listar('agenda/');
    const item = (await agenda.ler<ItemDaAgenda>(chave!))!;
    expect(item).toMatchObject({ tipo: 'PARTIDA', ref: id, containerId: 'C1', publicarEm: '2026-11-07T15:05:00.000Z' });
    expect(ig.containers[0]!.legenda).toMatch(/Rodada 1, jogo das 12h/);
    const url = ig.containers[0]!.videoUrl;
    expect(url).toMatch(/^file:\/\/.*\/publico\/videos\/[0-9a-f-]{36}\.mp4$/);
    expect(await readFile(url.replace('file://', ''), 'utf8')).toBe('mp4 de mentira');
    // A Partida completa fica no bucket privado; no público, a Escalação sem resultado.
    const privada = JSON.parse(await readFile(join(pasta, 'privado/partidas', `${id}.json`), 'utf8'));
    expect(privada.resultado.lances.length).toBeGreaterThan(0);
    const publica = JSON.parse(await readFile(join(pasta, 'publico/dados/partidas', `${id}.json`), 'utf8'));
    expect(publica.escalacoes).not.toBeNull();
    expect(publica.resultado).toBeNull();

    expect(await jobPartida(ctx)).toEqual([]);
    expect(ig.containers).toHaveLength(1);

    // A borda publica; o coletar seguinte marca no banco.
    await agenda.gravar(chave!, { ...item, publicadoEm: '2026-11-07T15:06:30Z', mediaId: 'M1' });
    expect(await sincronizarPublicados(ctx)).toBe(1);
    expect(await status(id!)).toBe('PUBLICADA');
  });

  it('escalar: no Corte escala, simula, guarda e publica o site sem gravar; o partida depois só grava (ADR-0038)', async () => {
    await jobColetar(ctx);
    const gravadosAntes = gravados.length;
    agora = new Date('2026-11-07T14:25:00Z');
    const [id] = await jobEscalar(ctx);
    expect(id).toBeDefined();
    expect(agora.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-07T14:30:00Z')); // esperou o Corte
    expect(await status(id!)).toBe('SIMULADA');
    expect(gravados).toHaveLength(gravadosAntes);
    expect(ig.containers).toHaveLength(0);
    // Ao Vivo pronto (bucket privado) e Escalação no site, sem o resultado.
    expect(JSON.parse(await readFile(join(pasta, 'privado/partidas', `${id}.json`), 'utf8')).resultado.lances.length).toBeGreaterThan(0);
    const publica = JSON.parse(await readFile(join(pasta, 'publico/dados/partidas', `${id}.json`), 'utf8'));
    expect(publica.escalacoes).not.toBeNull();
    expect(publica.resultado).toBeNull();
    const antes = (await banco.query<{ seed: number; resultado: unknown }>(`SELECT seed, resultado FROM partida WHERE id = $1`, [id])).rows[0]!;

    // Rodar de novo não refaz nada.
    expect(await jobEscalar(ctx)).toEqual([]);

    // O partida grava e agenda o Reels com a mesma simulação.
    expect(await jobPartida(ctx)).toEqual([id]);
    expect(await status(id!)).toBe('AGENDADA');
    expect(ig.containers).toHaveLength(1);
    const depois = (await banco.query<{ seed: number; resultado: unknown }>(`SELECT seed, resultado FROM partida WHERE id = $1`, [id])).rows[0]!;
    expect(depois).toEqual(antes);
  });

  it('escalar: antes do Corte, sem esperar, não escala', async () => {
    await jobColetar(ctx);
    agora = new Date('2026-11-07T14:25:00Z');
    expect(await jobEscalar(ctx, { esperarCorte: false })).toEqual([]);
    const pendentes = await banco.query(`SELECT 1 FROM partida WHERE status <> 'PENDENTE'`);
    expect(pendentes.rows).toHaveLength(0);
  });

  it('escalar e partida ao mesmo tempo terminam com um Reels só e o OVR da simulação gravada (ADR-0038)', async () => {
    await jobColetar(ctx);
    agora = new Date('2026-11-07T14:31:00Z'); // depois do Corte
    const ovrs = async () => (await banco.query<{ id: string; ovr: number }>(`SELECT id, ovr FROM jogador ORDER BY id`)).rows;
    const [escaladas, feitas] = await Promise.all([jobEscalar(ctx), jobPartida(ctx)]);
    expect(escaladas.length + feitas.length).toBeGreaterThan(0);
    const [id] = feitas;
    expect(await status(id!)).toBe('AGENDADA');
    // O OVR de cada Jogador bate com o "depois" da única simulação gravada.
    const linhas = (await banco.query<{ jogador_id: string | null; ovr_depois: number }>(`SELECT jogador_id, ovr_depois FROM escalacao WHERE partida_id = $1`, [id])).rows;
    const atual = new Map((await ovrs()).map((j) => [j.id, j.ovr]));
    for (const l of linhas) if (l.jogador_id) expect(atual.get(l.jogador_id)).toBe(l.ovr_depois);
    expect(ig.containers).toHaveLength(1);
  });

  it('partida: com duas Séries, cada horário tem uma Partida só e o job grava o Reels dela (ADR-0049)', async () => {
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-20', seed: 4, series: { A: TIMES, B: TIMES_NOVOS } });
    await banco.query(`UPDATE partida SET status = 'PUBLICADA' WHERE rodada_id IN (SELECT id FROM rodada WHERE temporada_id <> $1)`, [t2]);
    // O jogo das 11h já saiu; às 11h25 o job pega só o das 12h (o segundo da Série B).
    await banco.query(`UPDATE partida SET status = 'PUBLICADA' WHERE apito_inicial < '2026-11-20T15:00:00Z'`);
    const doHorario = (
      await banco.query<{ id: number; serie: string }>(
        `SELECT p.id, p.serie FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.apito_inicial = '2026-11-20T15:00:00Z'`,
        [t2],
      )
    ).rows;
    expect(doHorario.map((p) => p.serie)).toEqual(['B']);
    agora = new Date('2026-11-20T14:25:00Z');
    const feitas = await jobPartida({ ...ctx, gravarReels: async (_d, saida) => writeFile(saida, 'mp4 de mentira') });
    expect(feitas).toEqual(doHorario.map((p) => p.id));
    expect(JSON.parse(await readFile(join(pasta, 'privado/partidas', `${doHorario[0]!.id}.json`), 'utf8')).resultado.lances.length).toBeGreaterThan(0);
  });

  it('resumo: fecha a Rodada e agenda para as 19h', async () => {
    await jobColetar(ctx);
    for (const h of [14, 16, 18, 20]) {
      agora = new Date(`2026-11-07T${h}:30:00Z`);
      await jobPartida(ctx);
    }
    agora = new Date('2026-11-07T21:10:00Z');
    const rodada = await jobResumo(ctx);
    expect(rodada).not.toBeNull();
    const chaves = await agenda.listar('agenda/');
    expect(chaves).toHaveLength(5);
    const resumo = (await agenda.ler<ItemDaAgenda>(chaves.at(-1)!))!;
    expect(resumo).toMatchObject({ tipo: 'RESUMO', publicarEm: '2026-11-07T22:00:00.000Z' });
    expect(ig.containers.at(-1)!.legenda).toMatch(/só o número/);
    expect(ig.containers.at(-1)!.legenda).not.toMatch(/@/);
    // Capa: o quadro com o título da abertura, não o campo vazio do começo.
    expect(ig.containers.at(-1)!.capaEmMs).toBe(CAPA_DO_RESUMO_MS);
    expect(await jobResumo(ctx)).toBeNull();
  });
});
