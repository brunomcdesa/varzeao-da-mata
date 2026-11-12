import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { dispararProgramadosAgora, programadosDaVez, type ReelsProgramado } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { AgendaNaMemoria, PastaLocal, type ItemDaAgenda } from '../src/nuvem.js';
import { jobProgramados, legendaDaAbertura } from '../src/programados.js';
import type { Instagram } from '../src/instagram.js';
import { bancoDeTeste } from './banco-de-teste.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LISTA: ReelsProgramado[] = [{ id: 'abertura-t2', ref: 2001, publicarEm: '2026-11-17T15:00:00Z' }];

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

/** Instagram de mentira: conta os containers criados. */
function igFalso() {
  const containers: { legenda: string }[] = [];
  const ig = {
    criarReels: async (o: { legenda: string }) => (containers.push(o), `c${containers.length}`),
    esperarContainer: async () => {},
  } as unknown as Instagram;
  return { ig, containers };
}

describe('Reels Programados (ADR-0051)', () => {
  it('janela: grava de 2 h antes até 1 h depois; a borda dispara 90 e 60 min antes', () => {
    expect(programadosDaVez(new Date('2026-11-17T12:59:00Z'), LISTA)).toEqual([]);
    expect(programadosDaVez(new Date('2026-11-17T13:00:00Z'), LISTA)).toHaveLength(1);
    expect(programadosDaVez(new Date('2026-11-17T15:59:00Z'), LISTA)).toHaveLength(1);
    expect(programadosDaVez(new Date('2026-11-17T16:00:00Z'), LISTA)).toEqual([]);
    expect(dispararProgramadosAgora(new Date('2026-11-17T13:30:00Z'), LISTA)).toBe(true);
    expect(dispararProgramadosAgora(new Date('2026-11-17T14:00:00Z'), LISTA)).toBe(true);
    expect(dispararProgramadosAgora(new Date('2026-11-17T14:30:00Z'), LISTA)).toBe(false);
  });

  it('grava com a estreia da Temporada nova, agenda no horário e não repete', async () => {
    await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-19', seed: 1 });
    const agenda = new AgendaNaMemoria();
    const armazenamento = new PastaLocal(await mkdtemp(join(tmpdir(), 'prog-')));
    const { ig, containers } = igFalso();
    const gravados: string[] = [];
    const c = {
      banco, agenda, armazenamento, ig, lista: LISTA,
      agora: () => new Date('2026-11-17T13:30:00Z'),
      log: () => {},
      gravar: async (id: string, o: { estreia: string }, saida: string) => {
        gravados.push(`${id}:${o.estreia}`);
        await writeFile(saida, 'mp4 de mentira');
      },
    };
    expect(await jobProgramados(c)).toEqual(['abertura-t2']);
    expect(gravados).toEqual(['abertura-t2:2026-11-19']);
    const chaves = await agenda.listar('agenda/');
    expect(chaves).toHaveLength(1);
    const item = (await agenda.ler<ItemDaAgenda>(chaves[0]!))!;
    expect(item).toMatchObject({ tipo: 'APRESENTACAO', ref: 2001, containerId: 'c1', publicarEm: '2026-11-17T15:00:00.000Z' });
    expect(containers[0]!.legenda).toContain('Temporada 2');
    // A reserva (60 min antes) não grava de novo.
    expect(await jobProgramados({ ...c, agora: () => new Date('2026-11-17T14:00:00Z') })).toEqual([]);
    expect(gravados).toHaveLength(1);
  });

  it('atrasado: publica logo; fora da janela não faz nada', async () => {
    const agenda = new AgendaNaMemoria();
    const armazenamento = new PastaLocal(await mkdtemp(join(tmpdir(), 'prog-')));
    const { ig } = igFalso();
    const gravar = async (_id: string, _o: { estreia: string }, saida: string) => writeFile(saida, 'x');
    expect(await jobProgramados({ banco, agenda, armazenamento, ig, gravar, lista: LISTA, agora: () => new Date('2026-11-17T12:00:00Z'), log: () => {} })).toEqual([]);
    expect(await jobProgramados({ banco, agenda, armazenamento, ig, gravar, lista: LISTA, agora: () => new Date('2026-11-17T15:20:00Z'), log: () => {} })).toEqual(['abertura-t2']);
    const item = (await agenda.ler<ItemDaAgenda>((await agenda.listar('agenda/'))[0]!))!;
    expect(item.publicarEm).toBe('2026-11-17T15:21:00.000Z');
  });

  it('legenda da Abertura: Série B, Inscrição e estreia', () => {
    const l = legendaDaAbertura(2, '2026-11-19');
    expect(l).toContain('Jacaré');
    expect(l).toContain('ENTRO + TIME + POSIÇÃO');
    expect(l).toContain('Estreia quinta, 19/11');
  });
});
