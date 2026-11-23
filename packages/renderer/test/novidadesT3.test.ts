import { describe, expect, it } from 'vitest';
import { SERIE_DE_NOVIDADES, cenasDasNovidades, type ReelsDeNovidades } from '../src/novidades.js';

const dados = (reels: ReelsDeNovidades) => ({ reels, estreia: '2026-11-28', publicadoEm: '2026-11-27T15:00:00Z', partidas: [], clipes: {} });

describe('Novidades da T3 (ADR-0092)', () => {
  it('são quatro Reels, na ordem: campo, salário e loja, palpite e conquistas, capitão e batedores', () => {
    expect(SERIE_DE_NOVIDADES[3]).toEqual(['T3_CAMPO', 'T3_LOJA', 'T3_PALPITE', 'T3_CAPITAO']);
  });
  it('cada um chama o seguinte e o último manda para o link na bio', () => {
    const fim = (r: ReelsDeNovidades) => cenasDasNovidades(dados(r)).at(-1)!.fala;
    expect(fim('T3_CAMPO')).toContain('às duas da tarde, tem mais: o salário e a loja!');
    expect(fim('T3_LOJA')).toContain('o palpite e as conquistas');
    expect(fim('T3_PALPITE')).toContain('o capitão e os batedores');
    expect(fim('T3_CAPITAO')).toContain('Link na bio');
  });
  it('os valores falados batem com as regras (ADRs 0087, 0089 e 0090)', () => {
    const tudo = (r: ReelsDeNovidades) => cenasDasNovidades(dados(r)).map((c) => c.fala).join(' ');
    expect(tudo('T3_LOJA')).toContain('dez moedas por rodada');
    expect(tudo('T3_LOJA')).toContain('três moedas por gol e duas por assistência');
    expect(tudo('T3_LOJA')).toContain('cinquenta na Série A, trinta na B e quarenta na Copa');
    expect(tudo('T3_LOJA')).toContain('custa vinte moedas');
    expect(tudo('T3_PALPITE')).toContain('ganha duas moedas');
    expect(tudo('T3_PALPITE')).toContain('dez moedas de palpite por dia');
    expect(tudo('T3_CAPITAO')).toContain('cinco primeiros na disputa de pênaltis');
  });
  it('sem os trechos de jogo, as cenas de jogo saem', () => {
    expect(cenasDasNovidades(dados('T3_CAMPO')).map((c) => c.id)).toEqual(['abertura', 'juiz', 'chamada']);
  });
});
