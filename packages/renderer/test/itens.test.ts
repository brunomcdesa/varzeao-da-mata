import { describe, expect, it } from 'vitest';
import { comItens } from '../src/sprites.js';

const FRENTE = [
  '....KKKK....', '...KHHHHK...', '..KHHHHHHK..', '..KHSSSSHK..', '..KSKSSKSK..', '..KSSSSSSK..', '...KSSSSK...',
  '..KCCCCCCK..', '.KCCCccCCCK.', '.KSCCccCCSK.', '.KSKCCCCKSK.', '..KKBBBBKK..', '...KBBBBK...',
  '...KMKKMK...', '...KMKKMK...', '...KKKKKK...',
];

describe('Itens no boneco (ADR-0101)', () => {
  it('sem Itens a grade não muda', () => {
    expect(comItens(FRENTE, undefined, 'FRENTE_PARADO')).toBe(FRENTE);
  });
  it('chuteira no pé, munhequeira no pulso, luva na mão e faixa na testa', () => {
    const g = comItens(FRENTE, { CHUTEIRA: '#00f', MUNHEQUEIRA: '#fff', LUVA: '#f80', FAIXA: '#000' }, 'FRENTE_PARADO');
    expect(g[15]).toBe('...KPKKPK...');
    expect(g[9]).toBe('.KWCCccCCWK.');
    expect(g[10]).toBe('.KGKCCCCKGK.');
    expect(g[2]).toBe('..KFFFFFFK..');
    // O rosto continua com a pele.
    expect(g[5]).toBe(FRENTE[5]);
  });
});

describe('Faixa da Mata (ADR-0108)', () => {
  it('a faixa dourada ganha a folha nos dois pixels do centro', () => {
    const g = comItens(FRENTE, { FAIXA: '#E7B73C' }, 'FRENTE_PARADO', { FAIXA: '#1F7A3A' });
    expect(g[2]).toBe('..KFFffFFK..');
  });
  it('vestir leva a segunda cor só para o Item que tem', async () => {
    const { vestir } = await import('../src/sprites.js');
    expect(vestir({ FAIXA: 'FAIXA_DA_MATA' }, false).detalhesDosItens).toEqual({ FAIXA: '#1F7A3A' });
    expect(vestir({ FAIXA: 'FAIXA_DOURADA' }, false).detalhesDosItens).toBeUndefined();
  });
});
