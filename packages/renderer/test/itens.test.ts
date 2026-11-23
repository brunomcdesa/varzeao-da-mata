import { describe, expect, it } from 'vitest';
import { comItens } from '../src/sprites.js';

const FRENTE = [
  '....KKKK....', '...KHHHHK...', '..KHHHHHHK..', '..KHSSSSHK..', '..KSKSSKSK..', '..KSSSSSSK..', '...KSSSSK...',
  '..KCCCCCCK..', '.KCCCccCCCK.', '.KSCCccCCSK.', '.KSKCCCCKSK.', '..KKBBBBKK..', '...KBBBBK...',
  '...KMKKMK...', '...KMKKMK...', '...KKKKKK...',
];

describe('Itens no boneco (ADR-0095)', () => {
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
