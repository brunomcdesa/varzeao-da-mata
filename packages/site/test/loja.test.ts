import { describe, expect, it } from 'vitest';
import { ITEM_POR_CODIGO } from '@liga/shared';
import { acaoDoItem, encaixesDaLoja, textoDoBotao, type EstadoDaLoja } from '../src/loja.js';

const e: EstadoDaLoja = { saldo: 45, donos: ['LUVA_LARANJA'], equipados: { LUVA: 'LUVA_LARANJA' }, goleiro: true, fase: 1 };

describe('Loja (ADR-0095)', () => {
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
