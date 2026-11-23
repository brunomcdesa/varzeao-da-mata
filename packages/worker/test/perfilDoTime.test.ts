import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco.js';
import { colaboradoresDaPartida, definirPerfilDoTime, perfisDosTimes, tirarPerfilDoTime } from '../src/perfilDoTime.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

describe('Perfil do Time (ADR-0100)', () => {
  it('sem gravar é só simulação; gravado, aparece sem o @', async () => {
    const sim = await definirPerfilDoTime(banco, 'JAC', '@jacareacc', { gravar: false });
    expect(sim).toEqual({ time: 'JAC', antes: null, depois: 'jacareacc', gravado: false });
    expect((await perfisDosTimes(banco)).size).toBe(0);
    await definirPerfilDoTime(banco, 'JAC', '@jacareacc', { gravar: true });
    expect((await perfisDosTimes(banco)).get('JAC')).toBe('jacareacc');
  });

  it('fica o primeiro que pediu: outro perfil para o mesmo Time só com "trocar"', async () => {
    await definirPerfilDoTime(banco, 'TAM', 'tamanduaofc', { gravar: true });
    await expect(definirPerfilDoTime(banco, 'TAM', 'tamandua_torcida', { gravar: true })).rejects.toThrow(/primeiro que pediu/);
    const r = await definirPerfilDoTime(banco, 'TAM', 'tamandua_torcida', { gravar: true, trocar: true });
    expect(r.antes).toBe('tamanduaofc');
    expect((await perfisDosTimes(banco)).get('TAM')).toBe('tamandua_torcida');
  });

  it('um perfil não pode ser de dois Times, e o @ precisa ser válido', async () => {
    await definirPerfilDoTime(banco, 'CAP', 'esporte_clube_capivara', { gravar: true });
    await expect(definirPerfilDoTime(banco, 'ONC', 'Esporte_Clube_Capivara', { gravar: true })).rejects.toThrow(/já é o Perfil do Time do CAP/);
    await expect(definirPerfilDoTime(banco, 'ONC', 'com espaço', { gravar: true })).rejects.toThrow(/não é um @ válido/);
  });

  it('tirar apaga o perfil do Time', async () => {
    await definirPerfilDoTime(banco, 'JAC', 'jacareacc', { gravar: true });
    expect((await tirarPerfilDoTime(banco, 'JAC', { gravar: true })).antes).toBe('jacareacc');
    expect((await perfisDosTimes(banco)).size).toBe(0);
  });

  it('o Reels da Partida convida o Perfil de cada Time que tiver um', () => {
    const perfis = new Map([['JAC', 'jacareacc'], ['TAM', 'tamanduaofc']] as const);
    expect(colaboradoresDaPartida(perfis, 'JAC', 'TAM')).toEqual(['jacareacc', 'tamanduaofc']);
    expect(colaboradoresDaPartida(perfis, 'SUC', 'JAC')).toEqual(['jacareacc']);
    expect(colaboradoresDaPartida(perfis, 'ONC', 'LEA')).toEqual([]);
  });
});
