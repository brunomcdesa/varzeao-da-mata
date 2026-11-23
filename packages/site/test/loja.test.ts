import { describe, expect, it } from 'vitest';
import { ITEM_POR_CODIGO } from '@liga/shared';
import { acaoDoItem, encaixesDaLoja, textoDoBotao, type EstadoDaLoja } from '../src/loja.js';

const e: EstadoDaLoja = { saldo: 45, donos: ['LUVA_LARANJA'], equipados: { LUVA: 'LUVA_LARANJA' }, goleiro: true, fase: 1 };

describe('Loja (ADR-0099)', () => {
  it('compra, equipa ou tira conforme o Item', () => {
    const azul = ITEM_POR_CODIGO.get('CHUTEIRA_AZUL')!;
    expect(acaoDoItem(azul, e)).toEqual({ tipo: 'COMPRAR', preco: 20, podePagar: true });
    expect(acaoDoItem(ITEM_POR_CODIGO.get('LUVA_LARANJA')!, e)).toEqual({ tipo: 'TIRAR' });
    expect(acaoDoItem(ITEM_POR_CODIGO.get('LUVA_LARANJA')!, { ...e, equipados: {} })).toEqual({ tipo: 'EQUIPAR' });
    const dourada = ITEM_POR_CODIGO.get('LUVA_DOURADA')!;
    expect(textoDoBotao(dourada, acaoDoItem(dourada, e))).toBe('Custa 100 Moedas');
  });
  it('a Luva só aparece para o goleiro', () => {
    expect(encaixesDaLoja(false)).toEqual(['CHUTEIRA', 'MUNHEQUEIRA', 'FAIXA']);
    expect(encaixesDaLoja(true)).toContain('LUVA');
  });
});

describe('Atalho da Loja no topo (ADR-0099)', async () => {
  const { conteudoDoAtalho, rotuloDoAtalho } = await import('../src/carteiraDoTopo.js');
  it('sem Vínculo só a sacola; com Vínculo o saldo junto', () => {
    expect(conteudoDoAtalho(null)).not.toContain('data-saldo-topo');
    expect(conteudoDoAtalho(87)).toContain('<span data-saldo-topo>87</span>');
    expect(rotuloDoAtalho(null)).toBe('Loja');
    expect(rotuloDoAtalho(87)).toBe('Loja, 87 Moedas');
  });
});

describe('Loja sem Vínculo', () => {
  it('não mostra saldo nem deixa comprar', async () => {
    const { corpoDaLoja, acaoDoItem: acao } = await import('../src/loja.js');
    const sem = { saldo: null, donos: [], equipados: {}, goleiro: false, fase: 1 as const };
    expect(corpoDaLoja(sem, null).s).not.toContain('saldo-moedas');
    expect(acao(ITEM_POR_CODIGO.get('CHUTEIRA_AZUL')!, sem)).toEqual({ tipo: 'COMPRAR', preco: 20, podePagar: false });
  });
});
