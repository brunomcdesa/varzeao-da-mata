import { describe, expect, it } from 'vitest';
import { comBarba, comCorte, quadroDaComemoracao } from '../src/sprites.js';

const FRENTE = [
  '....KKKK....', '...KHHHHK...', '..KHHHHHHK..', '..KHSSSSHK..', '..KSKSSKSK..', '..KSSSSSSK..', '...KSSSSK...',
  '..KCCCCCCK..', '.KCCCccCCCK.', '.KSCCccCCSK.', '.KSKCCCCKSK.', '..KKBBBBKK..', '...KBBBBK...',
  '...KMKKMK...', '...KMKKMK...', '...KKKKKK...',
];

describe('Loja, segunda fase, no boneco (ADR-0101)', () => {
  it('a barba pinta o rosto na cor do cabelo e some de costas', () => {
    expect(comBarba(FRENTE, 'BIGODE', 'FRENTE_PARADO')[5]).toBe('..KSHHHHSK..');
    expect(comBarba(FRENTE, 'CAVANHAQUE', 'FRENTE_PARADO')[6]).toBe('...KSHHSK...');
    expect(comBarba(FRENTE, 'BIGODE', 'COSTAS_PARADO')).toBe(FRENTE);
  });
  it('o corte longo desce dos lados; o raspado tira o cabelo dos lados', () => {
    expect(comCorte(FRENTE, 'LONGO', 'FRENTE_PARADO')[5]).toBe('..KHSSSSHK..');
    expect(comCorte(FRENTE, 'RASPADO', 'FRENTE_PARADO')[3]).toBe('..KSSSSSSK..');
    // O corpo não muda.
    expect(comCorte(FRENTE, 'TRANCAS', 'FRENTE_PARADO').slice(7)).toEqual(FRENTE.slice(7));
  });
  it('a comemoração começa e termina no chão, e o mortal dá uma volta inteira', () => {
    for (const c of ['AVIAOZINHO', 'MORTAL', 'JOELHADA', 'DANCINHA'] as const) {
      expect(quadroDaComemoracao(c, 0).pulo).toBeCloseTo(0);
      expect(quadroDaComemoracao(c, 1).pulo).toBeCloseTo(0);
    }
    // O mortal gira grupado em passos de 90° e cai de braços para cima.
    const giros = [0.2, 0.4, 0.6, 0.75].map((f) => quadroDaComemoracao('MORTAL', f));
    expect(giros.map((q) => q.pose)).toEqual(['GRUPADO', 'GRUPADO', 'GRUPADO', 'GRUPADO']);
    expect(giros.map((q) => Math.round((-q.angulo * 2) / Math.PI))).toEqual([0, 1, 2, 3]);
    expect(quadroDaComemoracao('MORTAL', 0.05).pose).toBe('AGACHADO');
    expect(quadroDaComemoracao('MORTAL', 0.95).pose).toBe('FRENTE_COMEMORA');
    expect(quadroDaComemoracao('JOELHADA', 0.5).pose).toBe('JOELHADA');
  });
});
