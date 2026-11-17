import { describe, expect, it } from 'vitest';
import { IDENTIDADE, TIMES } from '@liga/shared';
import { ALGARISMOS, LARGURA_SPRITE, corDoNumero, espelharNoSprite, numeroNasCostas, pontosDoNumero } from '../src/sprites.js';

describe('número na camisa', () => {
  it('só aparece de costas', () => {
    expect(numeroNasCostas('COSTAS_PARADO', 10)).toBe(10);
    expect(numeroNasCostas('COSTAS_CORRE_A', 7)).toBe(7);
    for (const pose of ['FRENTE_PARADO', 'LADO_CORRE_A', 'FRENTE_COMEMORA', 'MERGULHO'] as const) {
      expect(numeroNasCostas(pose, 10)).toBeNull();
    }
  });

  it('quem não escolheu número joga com a camisa lisa', () => {
    expect(numeroNasCostas('COSTAS_PARADO', null)).toBeNull();
    expect(numeroNasCostas('COSTAS_PARADO', undefined)).toBeNull();
  });

  it('número fora de 1 a 99 não é desenhado', () => {
    for (const n of [0, 100, -3, 7.5]) expect(numeroNasCostas('COSTAS_PARADO', n)).toBeNull();
    expect(numeroNasCostas('COSTAS_PARADO', 1)).toBe(1);
    expect(numeroNasCostas('COSTAS_PARADO', 99)).toBe(99);
  });

  it('cabe nas costas da camisa, centrado (meio pixel: grade 24×32)', () => {
    for (let n = 1; n <= 99; n++) {
      const pontos = pontosDoNumero(n);
      const xs = pontos.map((p) => p.x);
      const ys = pontos.map((p) => p.y);
      // Miolo da camisa nas linhas 7 a 9 do boneco: colunas 4 a 7 (8 a 15 em meio pixel).
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(8);
      expect(Math.max(...xs)).toBeLessThanOrEqual(15);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(14);
      expect(Math.max(...ys)).toBeLessThanOrEqual(19);
      const meio = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
      expect(Math.abs(meio - LARGURA_SPRITE)).toBeLessThanOrEqual(1);
    }
  });

  it('cada algarismo tem 3×5 pontos', () => {
    for (const a of Object.values(ALGARISMOS)) {
      expect(a).toHaveLength(5);
      for (const l of a) expect(l).toMatch(/^[01]{3}$/);
    }
  });

  it('usa a segunda cor do Time, ou branco/escuro quando ela se confunde com a camisa', () => {
    expect(corDoNumero(IDENTIDADE.ONC.primaria, IDENTIDADE.ONC.secundaria)).toBe(IDENTIDADE.ONC.secundaria);
    // Tatu: cinza com verde-escuro, as duas se confundem.
    expect(corDoNumero(IDENTIDADE.TAT.primaria, IDENTIDADE.TAT.secundaria)).not.toBe(IDENTIDADE.TAT.secundaria);
    expect(corDoNumero('#1F4FD1', '#1F4FD1')).toBe('#FFFFFF');
    for (const t of TIMES) expect(corDoNumero(IDENTIDADE[t].primaria, IDENTIDADE[t].secundaria)).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('número na camisa de quem corre para a esquerda', () => {
  it('o boneco vira no sprite, e não no canvas, para o número não sair invertido', () => {
    expect(espelharNoSprite('COSTAS_CORRE_A', 22, true)).toBe(true);
    expect(espelharNoSprite('COSTAS_CORRE_A', 22, false)).toBe(false);
    expect(espelharNoSprite('COSTAS_CORRE_A', null, true)).toBe(false);
    expect(espelharNoSprite('LADO_CORRE_A', 22, true)).toBe(false);
  });
});
