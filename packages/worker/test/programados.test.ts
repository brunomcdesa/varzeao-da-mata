import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { dispararProgramadosAgora, programadosDaVez, type ReelsProgramado } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { AgendaNaMemoria, PastaLocal, type ItemDaAgenda } from '../src/nuvem.js';
import { jobProgramados, legendaDaAbertura, legendaDaAberturaT3, legendaDasNovidades, legendaDasNovidadesT3 } from '../src/programados.js';
import { REELS_PROGRAMADOS } from '@liga/shared';
import { dadosDoPerfilDoTime, legendaDaMudancaDeEndereco, legendaDoPerfilDoTime, legendaDoRebalanceamentoT2 } from '../src/programados.js';
import { definirPerfilDoTime } from '../src/perfilDoTime.js';
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

  it('Novidades da T2 (ADR-0063): quatro Reels na quarta, cada um com a sua legenda', () => {
    const novidades = REELS_PROGRAMADOS.filter((p) => p.id.startsWith('novidades-') && !p.id.startsWith('novidades-t3-'));
    expect(novidades.map((p) => p.id)).toEqual(['novidades-campo', 'novidades-capitao', 'novidades-jogador', 'novidades-site']);
    expect(new Set(REELS_PROGRAMADOS.map((p) => p.ref)).size).toBe(REELS_PROGRAMADOS.length);
    for (const p of novidades) {
      const l = legendaDasNovidades(p.id, '2026-11-19', p.publicarEm);
      expect(l.length).toBeLessThan(2200);
      expect(l).toContain('Estreia amanhã, quinta, 19/11');
      expect(l).not.toMatch(/undefined|@/);
    }
    expect(legendaDasNovidades('novidades-campo', '2026-11-19', novidades[0]!.publicarEm)).toContain('Às 14h: o Capitão.');
    expect(() => legendaDasNovidades('novidades-x', '2026-11-19', novidades[0]!.publicarEm)).toThrow();
  });

  it('legenda da Abertura: Grupos, quem cai, Inscrição e estreia (ADR-0064)', () => {
    const l = legendaDaAbertura(2, '2026-11-19');
    expect(l).toContain('Jacaré');
    expect(l).toContain('Grupo do Barro: Capivara');
    expect(l).toContain('Grupo do Galho: Preguiça');
    expect(l).toContain('Os 4 últimos de cada grupo caem e formam a Série B, que estreia na Temporada 3.');
    expect(l).toContain('das 11h às 18h');
    expect(l).not.toMatch(/Quati|15h às 18h/);
    expect(l).toContain('ENTRO + TIME + POSIÇÃO');
    expect(l).toContain('Estreia quinta, 19/11');
  });

  it('Rebalanceamento da T2 (ADR-0067): quarta 18/11 às 10h, antes das Novidades; legenda sem @', async () => {
    const p = REELS_PROGRAMADOS.find((x) => x.id === 'rebalanceamento-t2')!;
    expect(p.publicarEm).toBe('2026-11-18T13:00:00Z');
    const primeiraNovidade = REELS_PROGRAMADOS.filter((x) => x.id.startsWith('novidades-')).map((x) => Date.parse(x.publicarEm)).sort()[0]!;
    expect(Date.parse(p.publicarEm)).toBeLessThan(primeiraNovidade);
    const l = legendaDoRebalanceamentoT2({ movidos: 61, ficaram: 56, primos: [], estreia: '2026-11-19', primeiroJogoAs: 11 });
    expect(l).toContain('61 mudaram de Time e 56 ficaram');
    expect(l).toContain('Estreia quinta, 19/11, primeiro jogo às 11h');
    expect(l).not.toContain('@');
  });

  it('Mudança de Endereço (ADR-0104): segunda 23/11 às 22h10, logo depois de aprovado; legenda com o domínio novo e os passos do App', () => {
    const p = REELS_PROGRAMADOS.find((x) => x.id === 'mudanca-de-endereco')!;
    expect(p.publicarEm).toBe('2026-11-24T01:10:00Z');
    expect(new Set(REELS_PROGRAMADOS.map((x) => x.ref)).size).toBe(REELS_PROGRAMADOS.length);
    const l = legendaDaMudancaDeEndereco();
    expect(l).toContain('varzeaodamata.com.br');
    expect(l).toContain('Refaça o Vínculo');
    expect(l).toContain('Reative os Avisos');
    expect(l).toContain('Abas embaixo');
    expect(l).not.toContain('pages.dev');
  });

  it('Perfil do Time (ADR-0100): segunda 23/11 às 11h, logo depois de aprovado; perfis do banco na ordem em que viraram oficiais', async () => {
    const p = REELS_PROGRAMADOS.find((x) => x.id === 'perfil-do-time')!;
    expect(p.publicarEm).toBe('2026-11-23T14:00:00Z');
    expect(new Set(REELS_PROGRAMADOS.map((x) => x.ref)).size).toBe(REELS_PROGRAMADOS.length);
    await definirPerfilDoTime(banco, 'JAC', 'jacareacc', { gravar: true, agora: new Date('2026-11-23T12:00:00Z') });
    await definirPerfilDoTime(banco, 'CAP', 'esporte_clube_capivara', { gravar: true, agora: new Date('2026-11-23T12:20:00Z') });
    await definirPerfilDoTime(banco, 'TAM', 'tamanduaofc', { gravar: true, agora: new Date('2026-11-23T12:10:00Z') });
    const d = await dadosDoPerfilDoTime(banco);
    expect(d.perfis.map((x) => x.time)).toEqual(['JAC', 'TAM', 'CAP']);
    expect(d.semPerfil).toHaveLength(13);
    expect(d.semPerfil).not.toContain('JAC');
    const l = legendaDoPerfilDoTime(d);
    expect(l).toContain('👉 Jacaré: @jacareacc');
    expect(l).toContain('Um perfil por Time: vale o primeiro que pedir.');
  });

  it('T3 (ADR-0092): Abertura sábado 21h e as quatro novidades no domingo, véspera da Copa', () => {
    const t3 = REELS_PROGRAMADOS.filter((p) => p.id.endsWith('-t3') || (p.id.startsWith('novidades-t3-') && p.id !== 'novidades-t3-loja2'));
    expect(t3.map((p) => [p.id, p.publicarEm])).toEqual([
      ['abertura-t3', '2026-11-29T00:00:00Z'],
      ['novidades-t3-campo', '2026-11-29T15:00:00Z'],
      ['novidades-t3-loja', '2026-11-29T17:00:00Z'],
      ['novidades-t3-palpite', '2026-11-29T19:00:00Z'],
      ['novidades-t3-capitao', '2026-11-29T21:00:00Z'],
    ]);
    for (const p of t3.slice(1)) {
      const l = legendaDasNovidadesT3(p.id, '2026-11-30', p.publicarEm);
      expect(l.length).toBeLessThan(2200);
      expect(l).toContain('A Copa começa amanhã, segunda, 30/11. A Fase de Liga, quinta, 03/12.');
      expect(l).not.toMatch(/undefined|NaN|@/);
    }
    expect(legendaDasNovidadesT3('novidades-t3-loja', '2026-11-30', t3[2]!.publicarEm)).toContain('10 Moedas por rodada');
    const ab = legendaDaAberturaT3(['CAP', 'ONC'], ['TAM', 'SUC'], '2026-11-30');
    expect(ab).toContain('Série A: Capivara e Onça');
    expect(ab).toContain('A Copa começa segunda, 30/11. A Fase de Liga começa quinta, 03/12');
    expect(ab).toContain('40 Moedas');
  });

  it('a segunda fase da Loja sai no dia da Rodada 4 da T3, às 10h, sem a chamada da Copa', () => {
    const p = REELS_PROGRAMADOS.find((x) => x.id === 'novidades-t3-loja2')!;
    expect(p.publicarEm).toBe('2026-12-06T13:00:00Z');
    const l = legendaDasNovidadesT3(p.id, '2026-11-30', p.publicarEm);
    expect(l).toContain('aviãozinho, mortal, joelhada ou dancinha');
    expect(l).not.toContain('Copa começa');
  });
});
