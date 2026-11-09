import { describe, expect, it } from 'vitest';
import type { LigaPublica, PartidaNoCalendario } from '@liga/shared';
import { rodadaAtual } from '../src/calendario.js';

const jogo = (id: number, rodada: number, apito: string): PartidaNoCalendario => ({ id, rodada, fase: 'LIGA', apito, mandante: 'CAP', visitante: 'ONC', situacao: 'AGENDADA', classico: false, escalada: false });
const liga = (resumoPublicado: boolean) =>
  ({
    calendario: [jogo(1, 2, '2026-11-09T21:00:00Z'), jogo(2, 3, '2026-11-10T15:00:00Z')],
    rodadas: [{ id: 2, numero: 2, fase: 'LIGA', data: '2026-11-09', resumoPublicado, votacao: 'RODADA', candidatos: [], craque: null }],
  }) as unknown as LigaPublica;

describe('Rodada da vez', () => {
  const as2010 = Date.parse('2026-11-09T23:10:00Z'); // 20h10 em Brasília
  it('continua na Rodada que terminou hoje até o Resumo dela sair', () => {
    expect(rodadaAtual(liga(false), as2010)).toBe(2);
  });
  it('vira para a próxima Rodada assim que o Resumo sai no Instagram', () => {
    expect(rodadaAtual(liga(true), as2010)).toBe(3);
  });
  it('sem o Resumo, vira à meia-noite', () => {
    expect(rodadaAtual(liga(false), Date.parse('2026-11-10T03:30:00Z'))).toBe(3);
  });
});
