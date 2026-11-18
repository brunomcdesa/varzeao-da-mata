import { describe, expect, it } from 'vitest';
import { contraO, linhaDaPresenca, quandoDoJogo } from '../src/presenca.js';

// Terça, 17/11/2026, 21h em Brasília (meia-noite UTC do dia 18).
const agora = new Date('2026-11-18T00:00:00Z');

describe('selo de Presença (ADR-0023)', () => {
  it('diz quando é o jogo no horário de Brasília', () => {
    expect(quandoDoJogo('2026-11-18T00:30:00Z', agora)).toBe('hoje às 21h30');
    expect(quandoDoJogo('2026-11-18T14:00:00Z', agora)).toBe('amanhã às 11h');
    expect(quandoDoJogo('2026-11-19T18:00:00Z', agora)).toBe('quinta às 15h');
  });
  it('usa o artigo do Time', () => {
    expect(contraO('JAC')).toBe('contra o Jacaré');
    expect(contraO('ONC')).toBe('contra a Onça');
  });
  it('monta a linha embaixo do selo, e sem o jogo fica só o efeito', () => {
    expect(linhaDaPresenca({ apito: '2026-11-19T18:00:00Z', adversario: 'JAC' }, agora)).toBe('Quinta às 15h, contra o Jacaré. Você entra antes no rodízio, logo depois do Craque.');
    expect(linhaDaPresenca(null, agora)).toBe('Você entra antes no rodízio, logo depois do Craque.');
  });
});
