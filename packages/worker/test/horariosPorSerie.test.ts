import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { FUSO_BRASILIA, criarTemporada, horariosDaLiga } from '../src/calendario.js';
import { horarioDaFinal, horariosDasSemifinais } from '../src/mataMata.js';
import { subtituloDaPartida } from '../src/partida.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

async function horasPorSerie(temporadaId: number): Promise<Record<string, number[]>> {
  const linhas = (
    await banco.query<{ serie: string; apito_inicial: Date }>(
      `SELECT p.serie, p.apito_inicial FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND r.numero = 1 ORDER BY p.apito_inicial`,
      [temporadaId],
    )
  ).rows;
  const porSerie: Record<string, number[]> = {};
  for (const l of linhas) (porSerie[l.serie] ??= []).push((new Date(l.apito_inicial).getUTCHours() + FUSO_BRASILIA + 24) % 24);
  return porSerie;
}

describe('Horários por Série (ADR-0049)', () => {
  it('com duas Séries, um jogo por hora: a B das 11h às 14h, a A das 15h às 18h', async () => {
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-19', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
    expect(await horasPorSerie(t2)).toEqual({ B: [11, 12, 13, 14], A: [15, 16, 17, 18] });
  });

  it('com uma Série só, continua 12h, 14h, 16h e 18h', async () => {
    const t1 = await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-08', seed: 3 });
    expect(await horasPorSerie(t1)).toEqual({ A: [12, 14, 16, 18] });
    expect(horariosDaLiga('A', false)).toEqual([12, 14, 16, 18]);
  });

  it('Mata-mata com duas Séries: Semis B 13h e 14h, A 15h e 16h; Finais B 16h, A 18h', () => {
    expect(horariosDasSemifinais('B', true)).toEqual([13, 14]);
    expect(horariosDasSemifinais('A', true)).toEqual([15, 16]);
    expect(horarioDaFinal('B', true)).toBe(16);
    expect(horarioDaFinal('A', true)).toBe(18);
  });

  it('Mata-mata com uma Série só não muda: Semis 14h e 16h, Final 18h', () => {
    expect(horariosDasSemifinais('A', false)).toEqual([14, 16]);
    expect(horarioDaFinal('A', false)).toBe(18);
  });

  it('o Reels diz o horário de qualquer jogo da Fase de Liga', () => {
    expect(subtituloDaPartida(1, 'LIGA', new Date('2026-11-19T14:00:00Z'))).toBe('Rodada 1, jogo das 11h');
    expect(subtituloDaPartida(1, 'LIGA', new Date('2026-11-19T20:00:00Z'))).toBe('Rodada 1, jogo das 17h');
  });
});
