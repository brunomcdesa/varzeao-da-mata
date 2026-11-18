import { describe, expect, it } from 'vitest';
import { contagem } from '../src/contagem.js';

const agora = (isoBrasilia: string) => Date.parse(`${isoBrasilia}-03:00`);

describe('contagem até o Apito (dias de calendário em Brasília)', () => {
  it('terça 23h39 para quinta 11h é daqui a 2 dias, não amanhã', () => {
    expect(contagem('2026-11-19T14:00:00Z', agora('2026-11-17T23:39:00'))).toBe('em 2 dias');
  });
  it('terça 23h39 para quarta 11h é em horas; para quarta 23h é amanhã', () => {
    expect(contagem('2026-11-18T14:00:00Z', agora('2026-11-17T23:39:00'))).toBe('em 11h 21min');
    expect(contagem('2026-11-19T02:00:00Z', agora('2026-11-17T08:00:00'))).toBe('amanhã');
  });
  it('mais de 24h dentro do dia seguinte continua amanhã', () => {
    expect(contagem('2026-11-19T01:00:00Z', agora('2026-11-17T21:00:00'))).toBe('amanhã');
  });
  it('terça de manhã para quinta de manhã são 2 dias; para sexta, 3', () => {
    expect(contagem('2026-11-19T14:00:00Z', agora('2026-11-17T09:00:00'))).toBe('em 2 dias');
    expect(contagem('2026-11-20T14:00:00Z', agora('2026-11-17T09:00:00'))).toBe('em 3 dias');
  });
  it('minutos e horas seguem iguais', () => {
    expect(contagem('2026-11-17T15:30:00Z', agora('2026-11-17T12:00:00'))).toBe('em 30 min');
    expect(contagem('2026-11-17T20:00:00Z', agora('2026-11-17T12:00:00'))).toBe('em 5h');
    expect(contagem('2026-11-17T12:00:00Z', agora('2026-11-17T12:00:00'))).toBe('agora');
  });
});
