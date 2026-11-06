import { describe, expect, it } from 'vitest';
import { LIMITE_DELTA_OVR, LIMITE_DELTA_OVR_CLASSICO, OVR_MAX } from '@liga/shared';
import { simularPartida } from '../src/partida.js';
import { deltaOvr, notaDaPartida } from '../src/nota.js';
import { escalacao } from './fabricas.js';

const base = { fase: 'LIGA' as const };

describe('determinismo (ADR-0002)', () => {
  it('mesma entrada e mesmo seed geram exatamente o mesmo resultado', () => {
    const entrada = { ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 68), seed: 123 };
    expect(simularPartida(entrada)).toEqual(simularPartida(entrada));
  });

  it('seeds diferentes geram partidas diferentes', () => {
    const e = { ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70) };
    const resultados = new Set(
      [1, 2, 3, 4, 5].map((seed) => JSON.stringify(simularPartida({ ...e, seed }).lances)),
    );
    expect(resultados.size).toBe(5);
  });
});

describe('validação da Escalação', () => {
  it('recusa Escalação sem goleiro', () => {
    const semGoleiro = escalacao('CAP', 70);
    const jogadores = semGoleiro.jogadores.map((j) => (j.posicao === 'GOL' ? { ...j, posicao: 'ZAG' as const } : j));
    expect(() =>
      simularPartida({ ...base, mandante: { ...semGoleiro, jogadores }, visitante: escalacao('TAT', 70), seed: 1 }),
    ).toThrow(/GOL/);
  });

  it('recusa Vantagem do Empate na Fase de Liga', () => {
    expect(() =>
      simularPartida({
        ...base,
        mandante: escalacao('CAP', 70),
        visitante: escalacao('TAT', 70),
        seed: 1,
        vantagemDoEmpate: 'mandante',
      }),
    ).toThrow(/Mata-mata/);
  });
});

describe('placar e lances', () => {
  it('o placar bate com os lances de GOL e com os gols dos Jogadores', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = simularPartida({ ...base, mandante: escalacao('ARA', 72), visitante: escalacao('TUC', 66), seed });
      for (const lado of ['mandante', 'visitante'] as const) {
        const golsLances = r.lances.filter((l) => l.tipo === 'GOL' && l.ataque === lado).length;
        const golsJogadores = r.desempenhos.filter((d) => d.slot.lado === lado).reduce((s, d) => s + d.gols, 0);
        expect(golsLances).toBe(r.gols[lado]);
        expect(golsJogadores).toBe(r.gols[lado]);
      }
    }
  });

  it('marca Clássico só entre rivais fixos', () => {
    const r1 = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('ONC', 70), seed: 1 });
    const r2 = simularPartida({ ...base, mandante: escalacao('CAP', 70), visitante: escalacao('TAT', 70), seed: 1 });
    expect(r1.classico).toBe(true);
    expect(r2.classico).toBe(false);
  });
});

describe('Mata-mata', () => {
  it('empate com Vantagem do Empate classifica quem tem a vantagem, sem pênaltis', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = simularPartida({
        mandante: escalacao('CAP', 70),
        visitante: escalacao('TAT', 70),
        seed,
        fase: 'MATA_MATA',
        vantagemDoEmpate: 'visitante',
      });
      if (r.gols.mandante === r.gols.visitante) {
        expect(r.vencedor).toBe('visitante');
        expect(r.penaltis).toBeUndefined();
        return;
      }
    }
    throw new Error('nenhum empate em 300 seeds');
  });

  it('empate sem vantagem vai para os pênaltis e sempre tem vencedor', () => {
    let disputas = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = simularPartida({ mandante: escalacao('PRE', 70), visitante: escalacao('SAG', 70), seed, fase: 'MATA_MATA' });
      expect(r.vencedor).not.toBeNull();
      if (r.penaltis) {
        disputas++;
        const { placar } = r.penaltis;
        expect(placar.mandante).not.toBe(placar.visitante);
        expect(r.decisivo).not.toBeNull();
      }
    }
    expect(disputas).toBeGreaterThan(0);
  });
});

describe('OVR dinâmico (ADR-0004)', () => {
  it('nunca passa do limite por Partida: ±3 normal, ±4 em Clássico', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const normal = simularPartida({ ...base, mandante: escalacao('CAP', 60), visitante: escalacao('TAT', 80), seed });
      const classico = simularPartida({ ...base, mandante: escalacao('CAP', 60), visitante: escalacao('ONC', 80), seed });
      for (const d of normal.desempenhos) expect(Math.abs(d.deltaOvr)).toBeLessThanOrEqual(LIMITE_DELTA_OVR);
      for (const d of classico.desempenhos) expect(Math.abs(d.deltaOvr)).toBeLessThanOrEqual(LIMITE_DELTA_OVR_CLASSICO);
    }
  });

  it('Clássico move 1,5× mais', () => {
    expect(deltaOvr(7, false)).toBe(1);
    expect(deltaOvr(7, true)).toBe(2); // 1,5 arredonda para 2
    expect(deltaOvr(4, true)).toBe(-3);
  });

  it('arredondamento simétrico: ±0,5 não vira viés para cima', () => {
    expect(deltaOvr(6.5, false)).toBe(1);
    expect(deltaOvr(5.5, false)).toBe(-1);
  });

  it('a mesma atuação vale mais para quem tem OVR baixo (nota relativa)', () => {
    const atuacao = { posicao: 'ATA' as const, gols: 1, assistencias: 0, desarmes: 0, defesas: 0, golsSofridos: 0, resultado: 'empate' as const };
    expect(notaDaPartida(atuacao, 50)).toBeGreaterThan(notaDaPartida(atuacao, 90));
  });

  it('Jogador da Base não tem OVR alterado', () => {
    const comBase = escalacao('CAP', 70);
    const jogadores = comBase.jogadores.map((j, i) => (i === 6 ? { ...j, jogadorId: null, ovr: 45 } : j));
    for (let seed = 1; seed <= 50; seed++) {
      const r = simularPartida({ ...base, mandante: { ...comBase, jogadores }, visitante: escalacao('TAT', 70), seed });
      const daBase = r.desempenhos.find((d) => d.jogadorId === null)!;
      expect(daBase.deltaOvr).toBe(0);
    }
  });

  it('OVR nunca passa de 99', () => {
    const r = simularPartida({ ...base, mandante: escalacao('CAP', 99), visitante: escalacao('TAT', 40), seed: 7 });
    for (const d of r.desempenhos) expect(d.ovrDepois).toBeLessThanOrEqual(OVR_MAX);
  });
});

describe('calibração', () => {
  const N = 4000;
  const taxaDoForte = (forte: number, fraco: number) => {
    let vitorias = 0;
    for (let seed = 1; seed <= N; seed++) {
      const emCasa = seed % 2 === 0;
      const r = simularPartida({
        ...base,
        mandante: escalacao(emCasa ? 'CAP' : 'TAT', emCasa ? forte : fraco),
        visitante: escalacao(emCasa ? 'TAT' : 'CAP', emCasa ? fraco : forte),
        seed,
      });
      if (r.vencedor === (emCasa ? 'mandante' : 'visitante')) vitorias++;
    }
    return vitorias / N;
  };

  it('time bem mais forte (+15 de OVR) vence por volta de 60–65% das vezes', () => {
    const taxa = taxaDoForte(80, 65);
    expect(taxa).toBeGreaterThan(0.58);
    expect(taxa).toBeLessThan(0.7);
  });

  it('zebra existe: mesmo +25 de OVR perde de vez em quando', () => {
    expect(taxaDoForte(85, 60)).toBeLessThan(0.85);
  });
});
