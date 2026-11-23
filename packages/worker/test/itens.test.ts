import { describe, expect, it } from 'vitest';
import { ITENS, ITEM_POR_CODIGO, PRECO_DO_ITEM, coresDosItens, estilosDosItens, itensValidos } from '@liga/shared';

describe('Itens da Loja (ADR-0101)', () => {
  it('cada Encaixe de cor tem 7 cores básicas e uma dourada rara, na primeira fase', () => {
    expect(ITENS.filter((i) => i.fase === 1)).toHaveLength(32);
    expect(ITENS.filter((i) => i.raridade === 'RARO' && i.fase === 1).map((i) => i.codigo)).toEqual(['CHUTEIRA_DOURADA', 'MUNHEQUEIRA_DOURADA', 'FAIXA_DOURADA', 'LUVA_DOURADA']);
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

  it('segunda fase (ADR-0101): 4 cortes e 3 barbas básicos, 4 comemorações raras', () => {
    const f2 = ITENS.filter((i) => i.fase === 2);
    expect(f2.filter((i) => i.encaixe === 'CORTE').map((i) => i.estilo)).toEqual(['LONGO', 'RASPADO', 'TRANCAS', 'TOPETE']);
    expect(f2.filter((i) => i.encaixe === 'BARBA').every((i) => i.raridade === 'BASICO')).toBe(true);
    expect(f2.filter((i) => i.encaixe === 'COMEMORACAO').map((i) => [i.estilo, i.raridade])).toEqual([['AVIAOZINHO', 'RARO'], ['MORTAL', 'RARO'], ['JOELHADA', 'RARO'], ['DANCINHA', 'RARO']]);
    const itens = { CORTE: 'CORTE_TRANCAS', BARBA: 'BARBA_BIGODE', COMEMORACAO: 'COMEMORACAO_MORTAL', CHUTEIRA: 'CHUTEIRA_AZUL' };
    expect(estilosDosItens(itens)).toEqual({ corte: 'TRANCAS', barba: 'BIGODE', comemoracao: 'MORTAL' });
    expect(coresDosItens(itens, false)).toEqual({ CHUTEIRA: '#2F6FE0' });
  });
});
