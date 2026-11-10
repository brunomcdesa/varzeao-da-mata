import { describe, expect, it } from 'vitest';
import { NARRADORES, narradorDa } from '../src/narradores.js';

describe('Narradores', () => {
  it('cada Narrador tem uma voz diferente', () => {
    expect(new Set(NARRADORES.map((n) => n.voz)).size).toBe(NARRADORES.length);
  });

  it('o Zé da Várzea fica na voz original; os outros usam a biblioteca pt-BR, cada um com o seu jeito', () => {
    const ze = NARRADORES.find((n) => n.id === 'ZE')!;
    const outros = NARRADORES.filter((n) => n.id !== 'ZE');
    expect(ze.voz).toBe('Lumi');
    expect(ze.jeito).toBeUndefined();
    for (const n of outros) {
      expect(n.voz, n.nome).toMatch(/^pt-br-/);
      expect(n.jeito, n.nome).toBeTruthy();
    }
    expect(new Set(outros.map((n) => n.jeito)).size).toBe(outros.length);
  });

  it('o sorteio do Narrador pela semente não muda', () => {
    expect(narradorDa(12345)).toBe(narradorDa(12345));
    const sorteados = new Set(Array.from({ length: 200 }, (_, i) => narradorDa(i * 7919 + 1).id));
    expect(sorteados.size).toBe(NARRADORES.length);
  });
});
