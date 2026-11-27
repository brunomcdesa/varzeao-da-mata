import { describe, expect, it } from 'vitest';
import { CONQUISTAS, MOEDAS_DO_NIVEL, type CarreiraAteAqui } from '@liga/shared';

/** Carreira zerada: nenhuma Conquista feita. */
const zero: CarreiraAteAqui = { jogos: 0, gols: 0, assistencias: 0, vitorias: 0, classicosVencidos: 0, titulos: 0, golsNaPartida: 0, golDePlacaNaPartida: false, goleiroSemSofrer: false };

/** Para cada Conquista (ADR-0090): logo abaixo do limite não vale; no limite, vale. */
const LIMITES: Record<string, [Partial<CarreiraAteAqui>, Partial<CarreiraAteAqui>]> = {
  PRIMEIRA_PARTIDA: [{ jogos: 0 }, { jogos: 1 }],
  PRIMEIRO_GOL: [{ gols: 0 }, { gols: 1 }],
  PRIMEIRA_ASSISTENCIA: [{ assistencias: 0 }, { assistencias: 1 }],
  PRIMEIRA_VITORIA: [{ vitorias: 0 }, { vitorias: 1 }],
  HAT_TRICK: [{ golsNaPartida: 2 }, { golsNaPartida: 3 }],
  CINCO_GOLS: [{ gols: 4 }, { gols: 5 }],
  CLASSICO_VENCIDO: [{ classicosVencidos: 0 }, { classicosVencidos: 1 }],
  GOL_DE_PLACA: [{ golDePlacaNaPartida: false }, { golDePlacaNaPartida: true }],
  MURALHA: [{ goleiroSemSofrer: false }, { goleiroSemSofrer: true }],
  DEZ_JOGOS: [{ jogos: 9 }, { jogos: 10 }],
  PRIMEIRO_TITULO: [{ titulos: 0 }, { titulos: 1 }],
  VINTE_GOLS: [{ gols: 19 }, { gols: 20 }],
  CINQUENTA_JOGOS: [{ jogos: 49 }, { jogos: 50 }],
  TRES_TITULOS: [{ titulos: 2 }, { titulos: 3 }],
};

describe('Conquistas (ADR-0090): uma a uma', () => {
  it('toda Conquista tem caso de teste, código único e valor pelo nível', () => {
    expect(CONQUISTAS.map((c) => c.codigo).sort()).toEqual(Object.keys(LIMITES).sort());
    expect(new Set(CONQUISTAS.map((c) => c.codigo)).size).toBe(CONQUISTAS.length);
    for (const c of CONQUISTAS) expect(MOEDAS_DO_NIVEL[c.nivel]).toBeGreaterThan(0);
  });

  for (const c of CONQUISTAS) {
    it(`${c.codigo} (${c.nome}): só a partir do limite`, () => {
      const [abaixo, no] = LIMITES[c.codigo]!;
      expect(c.feita({ ...zero, ...abaixo })).toBe(false);
      expect(c.feita({ ...zero, ...no })).toBe(true);
    });
  }

  it('carreira zerada não faz nenhuma', () => {
    expect(CONQUISTAS.filter((c) => c.feita(zero))).toEqual([]);
  });
});
