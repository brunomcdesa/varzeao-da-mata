import { describe, expect, it } from 'vitest';
import { GRUPOS_DA_A_DE_16, TIMES_FUNDADORES, TIMES_NOVOS, appLiberado, gruposDaLiga, temRegrasT2, semifinaisProjetadas, tabelaDaPreTemporada, temporadaDoApp, timesDaLiga } from '@liga/shared';

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
  it('com Grupos e a Temporada atual ainda em Pré-temporada, a tabela é a zerada da estreia', () => {
    expect(tabelaDaPreTemporada({ temporada: { status: 'PRE_TEMPORADA' }, grupos })).toBe(true);
  });
  it('depois da estreia, ou sem Grupos, volta a ser a tabela normal', () => {
    expect(tabelaDaPreTemporada({ temporada: { status: 'EM_ANDAMENTO' }, grupos })).toBe(false);
    expect(tabelaDaPreTemporada({ temporada: { status: 'PRE_TEMPORADA' } })).toBe(false);
  });
});

describe('Chaveamento com Grupos (ADR-0064, ADR-0082)', () => {
  const linha = (time: string, jogos: number) => ({ time, jogos, pontos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0 }) as never;
  const grupos = (jogos: number) => [
    { nome: 'Grupo do Barro', tabela: [linha('CAP', jogos), linha('JAC', jogos)] },
    { nome: 'Grupo do Galho', tabela: [linha('ARA', jogos), linha('BES', jogos)] },
  ];
  it('cruza os Grupos: 1º do Barro × 2º do Galho e 1º do Galho × 2º do Barro', () => {
    const [[a, b], [c, d]] = semifinaisProjetadas([], grupos(1));
    expect([a.time, b.time, c.time, d.time]).toEqual(['CAP', 'BES', 'ARA', 'JAC']);
    expect([a.semente, b.semente]).toEqual(['1º Barro', '2º Galho']);
  });
  it('antes do primeiro jogo, só as posições, sem Time', () => {
    const [[a, b]] = semifinaisProjetadas([], grupos(0));
    expect([a.time, b.time]).toEqual([null, null]);
    expect([a.espera, b.espera]).toEqual(['1º do Barro', '2º do Galho']);
  });
  it('sem Grupos, segue 1º × 4º e 2º × 3º', () => {
    const t = ['A', 'B', 'C', 'D'].map((x) => linha(x, 1));
    const [[a, b], [c, d]] = semifinaisProjetadas(t);
    expect([a.time, b.time, c.time, d.time]).toEqual(['A', 'D', 'B', 'C']);
  });
});
