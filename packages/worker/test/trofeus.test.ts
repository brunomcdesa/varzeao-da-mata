import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES as TIMES, type JogadorPublico, type LigaPublica } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { writeFile } from 'node:fs/promises';
import { jobAgradecimentoT1, jobCraqueDaTemporada, sincronizarPublicados, type ContextoDoJob } from '../src/jobs.js';
import { avancarMataMata } from '../src/mataMata.js';
import { AgendaNaMemoria, PastaLocal } from '../src/nuvem.js';
import { rodarPartida } from '../src/partida.js';
import { fecharRodada } from '../src/resumo.js';
import { exportarSite } from '../src/site.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
let temporada: number;
beforeEach(async () => {
  banco = await bancoDeTeste();
  temporada = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 5 });
  let n = 0;
  for (const t of TIMES) {
    for (const pos of ['ATA', 'MEI', 'GOL']) {
      const u = `${t}_${pos}`.toLowerCase();
      await processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: u, username: u, texto: `ENTRO ${t} ${pos}`, comentadoEm: new Date('2026-11-06T12:00:00Z') }, { rodadaEmVotacao: null });
    }
  }
});
afterEach(async () => {
  await banco.fechar();
});

async function jogarRodada(numero: number) {
  const r = (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE numero = $1`, [numero])).rows[0]!.id;
  for (const { id } of (await banco.query<{ id: number }>(`SELECT id FROM partida WHERE rodada_id = $1 ORDER BY apito_inicial`, [r])).rows) await rodarPartida(banco, id, { seed: id * 13 });
  await fecharRodada(banco, r);
  await avancarMataMata(banco, temporada);
  return r;
}

describe('Craque da Temporada e troféus', () => {
  it('Final abre a votação da Temporada; no dia seguinte às 18h sai o Craque; campeões ganham o título', async () => {
    for (let n = 1; n <= 8; n++) await jogarRodada(n);
    const final = await jogarRodada(9);
    const candidatos = (await banco.query<{ nota: string }>(`SELECT nota FROM candidato WHERE rodada_id = $1`, [final])).rows;
    expect(candidatos.length).toBe(5);

    const ctx = { banco, armazenamento: new PastaLocal('/tmp/varzea-trofeus'), agenda: new AgendaNaMemoria(), ig: null, log: () => {} };
    // Final no dia 15/11 (9º dia); a votação fecha às 18h do dia 16 (21h UTC).
    expect(await jobCraqueDaTemporada({ ...ctx, agora: () => new Date('2026-11-16T20:00:00Z') })).toBeNull();
    expect(await jobCraqueDaTemporada({ ...ctx, agora: () => new Date('2026-11-16T21:10:00Z') })).toBe(temporada);
    const t = (await banco.query<{ craque_jogador_id: string | null; campeao_id: string | null; craque_revelado_em: Date }>(`SELECT craque_jogador_id::text, campeao_id, craque_revelado_em FROM temporada WHERE id = $1`, [temporada])).rows[0]!;
    expect(t.craque_jogador_id).not.toBeNull();
    expect(t.campeao_id).not.toBeNull();
    // A Temporada 2 nasce no anúncio, com a Rodada 1 dois dias depois (18/11).
    const t2 = (await banco.query<{ inicio: Date | string }>(`SELECT inicio FROM temporada WHERE numero = 2`)).rows[0]!;
    expect(new Date(t2.inicio).toISOString().slice(0, 10)).toBe('2026-11-18');

    // Antes das 19h o site não conta; depois, sim.
    const antes = await exportarSite(banco, new Date('2026-11-16T21:30:00Z'));
    expect((antes.arquivos.get('liga.json') as LigaPublica).craqueDaTemporada).toBeNull();
    const { arquivos } = await exportarSite(banco, new Date('2026-11-16T22:05:00Z'));
    const liga = arquivos.get('liga.json') as LigaPublica;
    const jogadores = arquivos.get('jogadores.json') as JogadorPublico[];
    expect(liga.craqueDaTemporada?.jogadorId).toBe(t.craque_jogador_id);
    expect(liga.temporadas.find((x) => x.numero === 1)).toMatchObject({ numero: 1, campeao: t.campeao_id });
    // Até a Temporada 2 começar, o site segue na 1 e anuncia a próxima.
    expect(liga.temporada?.numero).toBe(1);
    expect(liga.proximaTemporada).toEqual({ numero: 2, inicio: '2026-11-18' });
    const craque = jogadores.find((j) => j.id === t.craque_jogador_id)!;
    expect(craque.trofeus.some((x) => x.tipo === 'CRAQUE_TEMPORADA')).toBe(true);
    const campeoes = jogadores.filter((j) => j.titulos > 0);
    expect(campeoes.length).toBeGreaterThan(0);
    expect(campeoes.every((j) => j.time === t.campeao_id && j.jogos > 0)).toBe(true);
    // Craque da Rodada: 7 Rodadas + Semifinais (a Final é a votação da Temporada).
    expect(jogadores.reduce((s, j) => s + j.craqueDaRodada, 0)).toBe(8);
  }, 60_000);
});

describe('Seleção da Rodada no site (ADR-0041)', () => {
  it('na T1 não há Seleção da Rodada', async () => {
    await jogarRodada(1);
    await banco.query(`UPDATE rodada SET resumo_status = 'PUBLICADO'`);
    const jogadores = (await exportarSite(banco, new Date('2026-11-08T12:00:00Z'))).arquivos.get('jogadores.json') as JogadorPublico[];
    expect(jogadores.flatMap((j) => j.trofeus).some((t) => t.tipo === 'SELECAO_RODADA')).toBe(false);
  }, 60_000);

  it('da T2 em diante, cada Posição entra na Seleção da Rodada depois que o Resumo vai ao ar', async () => {
    await banco.query(`UPDATE temporada SET numero = 2 WHERE id = $1`, [temporada]);
    await jogarRodada(1);
    const antes = (await exportarSite(banco, new Date('2026-11-08T12:00:00Z'))).arquivos.get('jogadores.json') as JogadorPublico[];
    expect(antes.flatMap((j) => j.trofeus).some((t) => t.tipo === 'SELECAO_RODADA')).toBe(false);
    await banco.query(`UPDATE rodada SET resumo_status = 'PUBLICADO' WHERE numero = 1`);
    const { arquivos } = await exportarSite(banco, new Date('2026-11-08T12:00:00Z'));
    const destaques = (arquivos.get('jogadores.json') as JogadorPublico[]).flatMap((j) => j.trofeus.filter((t) => t.tipo === 'SELECAO_RODADA').map((t) => ({ ...t, posicaoDoJogador: j.posicao })));
    // Os inscritos são GOL, MEI e ATA (zagueiros são da Base, que não concorre).
    expect(destaques.map((t) => t.posicao).sort()).toEqual(['ATA', 'GOL', 'MEI']);
    expect(destaques.every((t) => t.temporada === 2 && t.rodada === 1 && t.posicao === t.posicaoDoJogador)).toBe(true);
    if (process.env.SALVAR_DADOS) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      const { dirname, join } = await import('node:path');
      for (const [nome, conteudo] of arquivos) {
        const caminho = join(process.env.SALVAR_DADOS, nome);
        await mkdir(dirname(caminho), { recursive: true });
        await writeFile(caminho, JSON.stringify(conteudo));
      }
    }
  }, 60_000);
});

describe('Recompensa e agradecimento automáticos (ADR-0047)', () => {
  it('Recompensa e agradecimento da T1 saem sozinhos (ADR-0047)', async () => {
    for (let n = 1; n <= 9; n++) await jogarRodada(n);
    const containers: { videoUrl: string; legenda: string }[] = [];
    const ig = {
      async criarReels(o: { videoUrl: string; legenda: string }) {
        containers.push(o);
        return `C${containers.length}`;
      },
      async statusDoContainer() {
        return { status: 'FINISHED' as const };
      },
      async esperarContainer() {},
    };
    const gravados: unknown[] = [];
    const ctx = {
      banco,
      armazenamento: new PastaLocal('/tmp/varzea-agradecimento'),
      agenda: new AgendaNaMemoria(),
      ig,
      log: () => {},
      gravarAgradecimentoT1: async (d: unknown, saida: string) => {
        gravados.push(d);
        await writeFile(saida, 'mp4');
      },
    } as unknown as ContextoDoJob;
    // Antes do Craque da Temporada (16/11, 18h), nem Recompensa nem agradecimento.
    expect(await jobAgradecimentoT1({ ...ctx, agora: () => new Date('2026-11-16T20:00:00Z') })).toBeNull();
    expect(await jobCraqueDaTemporada({ ...ctx, agora: () => new Date('2026-11-16T21:10:00Z') })).toBe(temporada);
    // A T2 nasce na Pré-temporada e a Recompensa vem junto: todos os inscritos ganham o Selo.
    expect((await banco.query(`SELECT 1 FROM selo_temporada1`)).rows).toHaveLength(24);
    // No mesmo dia do Resumo da Temporada, o agradecimento ainda não sai.
    expect(await jobAgradecimentoT1({ ...ctx, agora: () => new Date('2026-11-16T21:20:00Z') })).toBeNull();
    // No dia seguinte (17/11), o job das 18h10 grava e agenda para as 19h.
    const n = containers.length;
    expect(await jobAgradecimentoT1({ ...ctx, agora: () => new Date('2026-11-17T21:10:00Z') })).toBe(temporada);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({ inscritos: 24, piso: 63, rodadasDoBonus: 3 });
    expect(containers.slice(n)).toHaveLength(1);
    expect(containers.at(-1)!.legenda).toContain('Selo Temporada 1');
    const item = (await Promise.all((await ctx.agenda.listar('agenda/')).map((k) => ctx.agenda.ler<{ tipo: string; publicarEm: string; ref: number }>(k)))).find((x) => x?.tipo === 'AGRADECIMENTO')!;
    expect(item.publicarEm).toBe('2026-11-17T22:00:00.000Z');
    // Uma vez só.
    expect(await jobAgradecimentoT1({ ...ctx, agora: () => new Date('2026-11-18T21:10:00Z') })).toBeNull();
    // Publicado pela borda, o banco fica sabendo.
    for (const k of await ctx.agenda.listar('agenda/')) {
      const x = await ctx.agenda.ler<{ tipo: string }>(k);
      if (x?.tipo === 'AGRADECIMENTO') await ctx.agenda.gravar(k, { ...x, publicadoEm: '2026-11-17T22:00:05Z', mediaId: 'M1' });
    }
    await sincronizarPublicados({ ...ctx, agora: () => new Date('2026-11-17T22:10:00Z') });
    expect((await banco.query<{ s: string }>(`SELECT agradecimento_status AS s FROM temporada WHERE id = $1`, [temporada])).rows[0]!.s).toBe('PUBLICADO');
  }, 60_000);
});
