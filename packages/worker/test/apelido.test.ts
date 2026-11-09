import { apelidoLiberaEm, podeTrocarApelido, validarApelido } from '@liga/shared';
import { apelidoFalavel } from '@liga/renderer';
import { describe, expect, it } from 'vitest';

describe('validarApelido (ADR-0014)', () => {
  it('aceita nomes comuns e arruma os espaços', () => {
    expect(validarApelido('  Zé   do Gol ')).toEqual({ ok: true, apelido: 'Zé do Gol' });
    expect(validarApelido('Bruninho10').ok).toBe(true);
    expect(validarApelido('Cunha').ok).toBe(true);
    expect(validarApelido('Picanha').ok).toBe(true);
  });
  it('recusa palavrão (inclusive disfarçado), tamanho e símbolos', () => {
    for (const ruim of ['P0rr4 loka', 'caaaaralho', 'cu', 'fdp', 'v1ad0', 'Hitler10']) expect(validarApelido(ruim).ok, ruim).toBe(false);
    expect(validarApelido('a').ok).toBe(false);
    expect(validarApelido('Nome Muito Comprido').ok).toBe(false);
    expect(validarApelido('★★★').ok).toBe(false);
    expect(validarApelido('12345').ok).toBe(false);
  });
});

describe('troca uma vez por rodada', () => {
  it('libera à meia-noite de Brasília, com 10 min para corrigir', () => {
    const trocou = new Date('2026-11-08T22:00:00Z'); // 19h em Brasília
    expect(apelidoLiberaEm(trocou).toISOString()).toBe('2026-11-09T03:00:00.000Z');
    expect(podeTrocarApelido(trocou, new Date('2026-11-08T22:05:00Z'))).toBe(true);
    expect(podeTrocarApelido(trocou, new Date('2026-11-08T23:00:00Z'))).toBe(false);
    expect(podeTrocarApelido(trocou, new Date('2026-11-09T03:00:00Z'))).toBe(true);
    expect(podeTrocarApelido(null, new Date())).toBe(true);
  });
});

describe('apelidoFalavel', () => {
  it('fala nomes legíveis; símbolos e números ficam pela posição', () => {
    expect(apelidoFalavel('Zé do Gol')).toBe('Zé do Gol');
    expect(apelidoFalavel('xX_99_Xx')).toBeNull();
    expect(apelidoFalavel('KKK')).toBeNull();
    expect(apelidoFalavel(null)).toBeNull();
  });
});
