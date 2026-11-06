import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import type { Comentario } from '../src/coletar.js';
import type { Instagram } from '../src/instagram.js';
import { jobColetar, jobPartida, jobResumo, sincronizarPublicados, type ContextoDoJob } from '../src/jobs.js';
import { AgendaNaMemoria, CHAVE_TOKEN, PastaLocal, type ItemDaAgenda } from '../src/nuvem.js';
import { bancoDeTeste } from './banco-de-teste.js';

/** Instagram de mentira: posts com comentários, containers que ficam prontos na hora. */
class InstagramFalso {
  comentariosPorMidia = new Map<string, Comentario[]>();
  containers: { id: string; videoUrl: string; legenda: string }[] = [];
  token = 'T0';
  renovacoes = 0;
  async midiasDesde() {
    return [...this.comentariosPorMidia.keys()].map((id) => ({ id, timestamp: new Date().toISOString() }));
  }
  async comentarios(id: string) {
    return this.comentariosPorMidia.get(id) ?? [];
  }
  async criarReels(o: { videoUrl: string; legenda: string }) {
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

  it('partida: espera o Corte, grava, sobe, agenda para o fim do Ao Vivo e não repete', async () => {
    await jobColetar(ctx);
    agora = new Date('2026-11-07T14:25:00Z'); // 11h25: 35 min antes do jogo das 12h
    const [id] = await jobPartida(ctx);
    expect(id).toBeDefined();
    expect(agora.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-07T14:30:00Z')); // esperou o Corte
    expect(await status(id!)).toBe('AGENDADA');
    const [chave] = await agenda.listar('agenda/');
    const item = (await agenda.ler<ItemDaAgenda>(chave!))!;
    expect(item).toMatchObject({ tipo: 'PARTIDA', ref: id, containerId: 'C1', publicarEm: '2026-11-07T15:06:00.000Z' });
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
    expect(ig.containers.at(-1)!.legenda).toMatch(/CRAQUE @/);
    expect(await jobResumo(ctx)).toBeNull();
  });
});
