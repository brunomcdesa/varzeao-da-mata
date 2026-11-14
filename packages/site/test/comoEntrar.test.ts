import { describe, expect, it } from 'vitest';
import { faixaDoOvrInicialDaLiga } from '@liga/shared';

describe('OVR inicial mostrado em "Quer jogar?" (ADR-0056)', () => {
  it('durante a T1, de 60 a 70', () => {
    expect(faixaDoOvrInicialDaLiga({ temporada: { numero: 1, status: 'EM_ANDAMENTO' } })).toEqual({ min: 60, max: 70 });
    expect(faixaDoOvrInicialDaLiga({ temporada: null })).toEqual({ min: 60, max: 70 });
  });
  it('depois da T1, de 60 a 65 (o Piso da Temporada 1)', () => {
    expect(faixaDoOvrInicialDaLiga({ temporada: { numero: 1, status: 'ENCERRADA' } })).toEqual({ min: 60, max: 65 });
    expect(faixaDoOvrInicialDaLiga({ temporada: { numero: 1, status: 'EM_ANDAMENTO' }, proximaTemporada: { numero: 2 } })).toEqual({ min: 60, max: 65 });
    expect(faixaDoOvrInicialDaLiga({ temporada: { numero: 2, status: 'EM_ANDAMENTO' } })).toEqual({ min: 60, max: 65 });
  });
});
