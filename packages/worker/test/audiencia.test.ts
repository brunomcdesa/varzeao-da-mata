import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { coletarAudiencia, resumoValido } from '../src/audiencia.js';
import { AgendaNaMemoria } from '../src/nuvem.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

const resumo = { partidaId: '42', pico: 9, entradas: 14, media: 5.5, primeiraConexao: Date.parse('2026-11-27T22:00:00Z'), fim: Date.parse('2026-11-27T22:30:00Z') };

describe('audiência do Ao Vivo no banco (ADR-0118)', () => {
  it('leva o resumo do KV para o banco e apaga a chave', async () => {
    const agenda = new AgendaNaMemoria();
    await agenda.gravar('audiencia/42', resumo);
    expect(await coletarAudiencia(banco, agenda)).toBe(1);
    const l = (await banco.query<{ partida_id: number; pico: number; entradas: number; media: string; fim: Date }>(`SELECT * FROM audiencia_ao_vivo`)).rows;
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ partida_id: 42, pico: 9, entradas: 14, media: '5.50' });
    expect(l[0]!.fim.toISOString()).toBe('2026-11-27T22:30:00.000Z');
    expect(await agenda.listar('audiencia/')).toEqual([]);
  });

  it('reprocessar não duplica nem sobrescreve', async () => {
    const agenda = new AgendaNaMemoria();
    await agenda.gravar('audiencia/42', resumo);
    await coletarAudiencia(banco, agenda);
    await agenda.gravar('audiencia/42', { ...resumo, pico: 99 });
    expect(await coletarAudiencia(banco, agenda)).toBe(0);
    expect((await banco.query<{ pico: number }>(`SELECT pico FROM audiencia_ao_vivo`)).rows).toEqual([{ pico: 9 }]);
  });

  it('descarta resumo estranho sem travar os outros', async () => {
    const agenda = new AgendaNaMemoria();
    await agenda.gravar('audiencia/abc', { ...resumo, partidaId: 'abc' });
    await agenda.gravar('audiencia/7', { ...resumo, partidaId: '7', media: 50 });
    await agenda.gravar('audiencia/8', { ...resumo, partidaId: '8' });
    expect(await coletarAudiencia(banco, agenda)).toBe(1);
    expect((await banco.query<{ partida_id: number }>(`SELECT partida_id FROM audiencia_ao_vivo`)).rows).toEqual([{ partida_id: 8 }]);
    expect(await agenda.listar('audiencia/')).toEqual([]);
  });

  it('valida o resumo', () => {
    expect(resumoValido(resumo)).toBe(true);
    expect(resumoValido(null)).toBe(false);
    expect(resumoValido({ ...resumo, pico: -1 })).toBe(false);
  });
});
