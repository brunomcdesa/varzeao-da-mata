import { describe, expect, it } from 'vitest';
import { CLASSICOS, GRUPOS, GRUPOS_DA_A_DE_16, TIMES_DA_SERIE_B, TIMES_FUNDADORES, ehClassico, nomeDoClassico, type TimeId } from '@liga/shared';
import { faseDeGrupos } from '../src/calendario.js';

const rivais = (t: TimeId): TimeId[] => CLASSICOS.filter((p) => p.includes(t)).map(([a, b]) => (a === t ? b : a));

describe('Segundo Clássico (ADR-0066)', () => {
  it('cada Time da A de 16 tem dois Clássicos, os dois no seu Grupo', () => {
    for (const g of GRUPOS) {
      for (const t of GRUPOS_DA_A_DE_16[g]) {
        const r = rivais(t);
        expect(r, t).toHaveLength(2);
        for (const x of r) expect(GRUPOS_DA_A_DE_16[g], `${t} × ${x}`).toContain(x);
      }
    }
  });

  it('o segundo Clássico é sempre de um fundador contra um Time novo', () => {
    for (const t of TIMES_FUNDADORES) {
      const novos = rivais(t).filter((x) => !TIMES_FUNDADORES.includes(x));
      expect(novos, t).toHaveLength(1);
    }
  });

  it('os pares e os nomes aprovados', () => {
    const esperados: Array<[TimeId, TimeId, string]> = [
      ['ONC', 'LEA', 'Clássico dos Felinos'],
      ['CAP', 'SUC', 'Clássico do Pantanal'],
      ['TAT', 'JAC', 'Clássico da Couraça'],
      ['TAM', 'LOB', 'Clássico do Cerrado'],
      ['PRE', 'TAR', 'Clássico do Devagar'],
      ['ARA', 'BOT', 'Clássico das Cores'],
      ['SAG', 'BES', 'Clássico do Tronco'],
      ['TUC', 'COR', 'Clássico do Poleiro'],
    ];
    for (const [a, b, nome] of esperados) {
      expect(ehClassico(a, b)).toBe(true);
      expect(ehClassico(b, a)).toBe(true);
      expect(nomeDoClassico(a, b)).toBe(nome);
    }
  });

  it('todo Clássico tem nome, e nenhum nome se repete', () => {
    const nomes = CLASSICOS.map(([a, b]) => nomeDoClassico(a, b));
    expect(nomes.every((n) => n !== null)).toBe(true);
    expect(new Set(nomes).size).toBe(CLASSICOS.length);
  });

  it('entre os fundadores, os Clássicos da T1 não mudam', () => {
    const entreFundadores = CLASSICOS.filter(([a, b]) => TIMES_FUNDADORES.includes(a) && TIMES_FUNDADORES.includes(b)).map((p) => [...p].sort().join('-'));
    expect(entreFundadores.sort()).toEqual(['ARA-TUC', 'CAP-ONC', 'PRE-SAG', 'TAM-TAT']);
  });

  it('os Times guardados para expansão seguem com um Clássico só', () => {
    for (const t of TIMES_DA_SERIE_B) expect(rivais(t), t).toHaveLength(1);
  });

  it('na Fase de Grupos da T2, cada Time faz os seus dois Clássicos (16 ao todo)', () => {
    for (const seed of [1, 8, 42, 2026]) {
      const jogos = faseDeGrupos(seed, GRUPOS_DA_A_DE_16).flat().filter((j) => ehClassico(j.mandante, j.visitante));
      expect(jogos).toHaveLength(16);
      const porTime = new Map<TimeId, number>();
      for (const j of jogos) for (const t of [j.mandante, j.visitante]) porTime.set(t, (porTime.get(t) ?? 0) + 1);
      expect([...porTime.values()].every((n) => n === 2)).toBe(true);
    }
  });
});
