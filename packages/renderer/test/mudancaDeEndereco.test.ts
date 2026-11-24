import { describe, expect, it } from 'vitest';
import { ENDERECO_NOVO, RoteiroMudancaDeEndereco, narracaoDaMudancaDeEndereco } from '../src/mudancaDeEndereco.js';

describe('Reels da Mudança de Endereço (ADR-0104) e a repaginada do App (ADR-0103)', () => {
  it('seis cartelas, uma fala em cada, sem @ e sem endereço escrito na fala', () => {
    const r = new RoteiroMudancaDeEndereco();
    const falas = narracaoDaMudancaDeEndereco(r);
    expect(r.segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'ENDERECO', 'APP', 'CONTINUA', 'CARA_NOVA', 'CHAMADA']);
    expect(falas).toHaveLength(6);
    expect(falas.every((f) => !f.texto.includes('@') && !f.texto.includes(ENDERECO_NOVO) && !f.texto.includes('.com'))).toBe(true);
  });

  it('o Narrador soletra o endereço e conta o que refazer no App', () => {
    const falas = narracaoDaMudancaDeEndereco(new RoteiroMudancaDeEndereco());
    expect(falas[1]!.texto).toContain('ponto com, ponto bê érre');
    expect(falas[2]!.texto).toMatch(/instala de novo, refaz o vínculo .* e reativa os avisos/);
    expect(falas[3]!.texto).toContain('Só mudou o endereço.');
    expect(falas[4]!.texto).toMatch(/abas embaixo, o sininho dos avisos/);
  });

  it('a cartela estica para caber a fala', () => {
    const base = new RoteiroMudancaDeEndereco();
    const longa = new RoteiroMudancaDeEndereco({ 2: { antes: 12 } });
    expect(longa.segmentos[2]!.fim - longa.segmentos[2]!.inicio).toBeCloseTo(12.6);
    expect(longa.duracao).toBeGreaterThan(base.duracao);
  });
});
