import { describe, expect, it } from 'vitest';
import { RoteiroPerfilDoTime, narracaoDoPerfilDoTime, timesFalados, type DadosDoPerfilDoTime } from '../src/perfilDoTime.js';

const dados: DadosDoPerfilDoTime = {
  perfis: [
    { time: 'JAC', usuario: 'jacareacc' },
    { time: 'TAM', usuario: 'tamanduaofc' },
    { time: 'CAP', usuario: 'esporte_clube_capivara' },
  ],
  semPerfil: ['ONC', 'TAT', 'SUC', 'LOB', 'LEA', 'PRE', 'SAG', 'TUC', 'ARA', 'COR', 'BES', 'BOT', 'TAR'],
};

describe('Reels do Perfil do Time (ADR-0100)', () => {
  it('seis cartelas, uma fala em cada, e o Narrador nunca fala @', () => {
    const r = new RoteiroPerfilDoTime(dados);
    const falas = narracaoDoPerfilDoTime(r);
    expect(r.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'EXEMPLOS', 'REGRAS', 'PEDIDO', 'GANHA', 'CHAMADA']);
    expect(falas).toHaveLength(6);
    expect(falas.every((f) => !f.texto.includes('@') && !/jacareacc|tamanduaofc|capivara_/i.test(f.texto))).toBe(true);
  });

  it('fala os Times com artigo e conta os que ainda não têm perfil', () => {
    const falas = narracaoDoPerfilDoTime(new RoteiroPerfilDoTime(dados));
    expect(falas[1]!.texto).toBe('O Jacaré, o Tamanduá e a Capivara já têm o deles, criado pelos próprios jogadores.');
    expect(falas[5]!.texto).toMatch(/^Ainda faltam treze times\./);
    expect(timesFalados(['ONC'])).toBe('a Onça');
  });

  it('a cartela estica para caber a fala', () => {
    const base = new RoteiroPerfilDoTime(dados);
    const longa = new RoteiroPerfilDoTime(dados, { 2: { antes: 14 } });
    expect(longa.segmentos[2]!.fim - longa.segmentos[2]!.inicio).toBeCloseTo(14.6);
    expect(longa.duracao).toBeGreaterThan(base.duracao);
  });
});
