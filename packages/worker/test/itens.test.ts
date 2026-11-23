import { describe, expect, it } from 'vitest';
import { ITENS, ITEM_POR_CODIGO, PRECO_DO_ITEM, coresDosItens, itensValidos } from '@liga/shared';

describe('Itens da Loja (ADR-0101)', () => {
  it('cada Encaixe tem 7 cores básicas e uma dourada rara, todas na primeira fase', () => {
    expect(ITENS).toHaveLength(32);
    expect(ITENS.filter((i) => i.raridade === 'RARO').map((i) => i.codigo)).toEqual(['CHUTEIRA_DOURADA', 'MUNHEQUEIRA_DOURADA', 'FAIXA_DOURADA', 'LUVA_DOURADA']);
    expect(PRECO_DO_ITEM).toEqual({ BASICO: 20, RARO: 100 });
    expect(ITEM_POR_CODIGO.get('FAIXA_VERDE')?.nome).toBe('Faixa na cabeça verde-limão');
  });
  it('a Luva só aparece no goleiro e código errado é ignorado', () => {
    const itens = { CHUTEIRA: 'CHUTEIRA_AZUL', LUVA: 'LUVA_ROSA', FAIXA: 'CHUTEIRA_PRETA' };
    expect(coresDosItens(itens, false)).toEqual({ CHUTEIRA: '#2F6FE0' });
    expect(coresDosItens(itens, true)).toEqual({ CHUTEIRA: '#2F6FE0', LUVA: '#F06AB0' });
    expect(coresDosItens(null, true)).toEqual({});
  });
  it('valida um código por Encaixe', () => {
    expect(itensValidos({ CHUTEIRA: 'CHUTEIRA_AZUL', MUNHEQUEIRA: 'MUNHEQUEIRA_DOURADA' })).toBe(true);
    expect(itensValidos({ CHUTEIRA: 'FAIXA_AZUL' })).toBe(false);
    expect(itensValidos({ CAPA: 'CHUTEIRA_AZUL' })).toBe(false);
    expect(itensValidos(['CHUTEIRA_AZUL'])).toBe(false);
  });
});
