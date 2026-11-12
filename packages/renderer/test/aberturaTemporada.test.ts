import { describe, expect, it } from 'vitest';
import { DADOS_DA_ABERTURA_T2, RoteiroAberturaDaTemporada, narracaoDaAbertura } from '../src/aberturaTemporada.js';

const roteiro = (extra: Partial<typeof DADOS_DA_ABERTURA_T2> = {}) => new RoteiroAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, ...extra, estreia: '2026-11-19' });

describe('Reels de Abertura da Temporada', () => {
  it('tem as sete cartelas, na ordem', () => {
    expect(roteiro().segmentos.map((s) => s.cartela)).toEqual(['ABERTURA', 'SERIES', 'ACESSO', 'NOVIDADES', 'ENTRAR', 'AGENDA', 'CHAMADA']);
  });

  it('fala os 8 Times novos, a estreia e as duas Séries no mesmo horário', () => {
    const falas = narracaoDaAbertura(roteiro()).map((f) => f.texto).join(' ');
    for (const nome of ['Jacaré', 'Sucuri', 'Lobo-guará', 'Cachorro-do-mato', 'Boto', 'Pirarucu', 'Coruja', 'Morcego']) expect(falas).toContain(nome);
    expect(falas).toContain('na quinta, dia dezenove');
    expect(falas).toContain('as duas séries no mesmo horário');
    expect(falas).toContain('Temporada 2');
    expect(falas).not.toContain('@');
  });

  it('só anuncia o Rebalanceamento quando há hora marcada', () => {
    const com = narracaoDaAbertura(roteiro())[3]!.texto;
    const sem = narracaoDaAbertura(roteiro({ horaDoRebalanceamento: null }))[3]!.texto;
    expect(com).toContain('hoje, às quatro da tarde');
    expect(sem).not.toContain('hoje');
  });

  it('estica a cartela até a fala caber', () => {
    expect(roteiro().segmentos[1]!.fim - roteiro().segmentos[1]!.inicio).toBe(9);
    const longo = new RoteiroAberturaDaTemporada({ ...DADOS_DA_ABERTURA_T2, estreia: '2026-11-19' }, { 1: { antes: 12 } });
    expect(longo.segmentos[1]!.fim - longo.segmentos[1]!.inicio).toBeCloseTo(12.6);
  });
});
