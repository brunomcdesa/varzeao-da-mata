import { describe, expect, it } from 'vitest';
import { GRUPOS_DA_A_DE_16, TIMES_FUNDADORES, TIMES_NOVOS, appLiberado, gruposDaLiga, temRegrasT2, tabelaDaPreTemporada, temporadaDoApp, timesDaLiga } from '@liga/shared';

const DEZESSEIS = [...TIMES_FUNDADORES, ...TIMES_NOVOS];
const GRUPOS = { CHAO: [...GRUPOS_DA_A_DE_16.CHAO], COPA: [...GRUPOS_DA_A_DE_16.COPA] };

describe('Times e App na Pré-temporada da T2 (ADR-0068)', () => {
  it('na Pré-temporada, a Temporada atual ainda é a 1, mas o site já lista os 16 Times e os Grupos', () => {
    const l = { temporada: { numero: 1 }, ativa: { numero: 2, times: DEZESSEIS, grupos: GRUPOS } };
    expect(timesDaLiga(l)).toEqual(DEZESSEIS);
    expect(gruposDaLiga(l)).toEqual(GRUPOS);
  });

  it('na Pré-temporada, o App, os Avisos e as telas da T2 já valem', () => {
    const l = { temporada: { numero: 1 }, ativa: { numero: 2 } };
    expect(temporadaDoApp(l)).toBe(2);
    expect(appLiberado(temporadaDoApp(l))).toBe(true);
    expect(temRegrasT2(temporadaDoApp(l) ?? 0)).toBe(true);
  });

  it('na T1, nada da T2: 8 Times, sem Grupos e sem App', () => {
    const l = { temporada: { numero: 1 }, ativa: { numero: 1, times: [...TIMES_FUNDADORES], grupos: null } };
    expect(timesDaLiga(l)).toEqual(TIMES_FUNDADORES);
    expect(gruposDaLiga(l)).toBeNull();
    expect(appLiberado(temporadaDoApp(l))).toBe(false);
  });

  it('dados antigos, sem `ativa`: as Séries, ou os fundadores', () => {
    expect(timesDaLiga({})).toEqual(TIMES_FUNDADORES);
    expect(timesDaLiga({ series: { A: ['CAP'], B: ['QUA'] } })).toEqual(['CAP', 'QUA']);
    expect(temporadaDoApp({ temporada: { numero: 2 } })).toBe(2);
    expect(temporadaDoApp(null)).toBeNull();
  });
});

describe('Tabela na Pré-temporada da T2 (ADR-0081)', () => {
  const grupos = [{ grupo: 'CHAO' as const, nome: 'Grupo do Barro', tabela: [] }];
  it('com os Grupos da T2 e o site ainda na T1, a tabela é a da Pré-temporada', () => {
    expect(tabelaDaPreTemporada({ temporada: { numero: 1 }, grupos, gruposDaTemporada: 2 })).toBe(true);
  });
  it('quando a T2 começa, volta a ser a tabela normal; sem Grupos, também', () => {
    expect(tabelaDaPreTemporada({ temporada: { numero: 2 }, grupos, gruposDaTemporada: 2 })).toBe(false);
    expect(tabelaDaPreTemporada({ temporada: { numero: 1 } })).toBe(false);
  });
});
