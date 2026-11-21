import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OITAVAS_DE_CLASSICO, CLASSICOS, TIMES_FUNDADORES, TIMES_NOVOS, estruturaDaLiga, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { avancarCopa, cabeACopa } from '../src/copa.js';
import { estrelasNoBanco, estruturaDaTemporada } from '../src/mataMata.js';
import { rodarPartida } from '../src/partida.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

interface Jogo {
  id: number;
  etapa: string;
  rodada: number;
  dia: string;
  hora: number;
  mandante: TimeId;
  visitante: TimeId;
}
const jogosDaCopa = async (temporadaId: number): Promise<Jogo[]> =>
  (
    await banco.query<Jogo>(
      `SELECT p.id, p.copa_etapa AS etapa, r.numero AS rodada, to_char(r.data, 'YYYY-MM-DD') AS dia,
              ((extract(hour from p.apito_inicial AT TIME ZONE 'UTC')::int + 21) % 24) AS hora, p.mandante_id AS mandante, p.visitante_id AS visitante
       FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND p.copa_etapa IS NOT NULL ORDER BY p.apito_inicial`,
      [temporadaId],
    )
  ).rows;
const jogar = async (js: Jogo[]) => {
  for (const [k, j] of js.entries()) await rodarPartida(banco, j.id, { seed: 100 + k });
};
const vencedor = async (id: number): Promise<TimeId> => {
  const r = (await banco.query<{ resultado: { vencedor: 'mandante' | 'visitante'; times: Record<string, TimeId> } }>(`SELECT resultado FROM partida WHERE id = $1`, [id])).rows[0]!.resultado;
  return r.times[r.vencedor]!;
};
const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };

describe('Copa A+B na Pré-temporada (ADR-0088)', () => {
  it('as Oitavas de Clássico são os 8 segundos Clássicos e cobrem os 16 Times', () => {
    expect(OITAVAS_DE_CLASSICO).toEqual(CLASSICOS.slice(8, 16));
    expect(cabeACopa([...TIMES_FUNDADORES, ...TIMES_NOVOS])).toBe(true);
    expect(cabeACopa(TIMES_FUNDADORES)).toBe(false);
  });

  it('nasce com a Temporada da T3: Oitavas no 1º dia (11h às 18h) e a Fase de Liga 3 dias depois', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const oitavas = await jogosDaCopa(t);
    expect(oitavas).toHaveLength(8);
    expect(oitavas.every((j) => j.etapa === 'OITAVAS' && j.rodada === 101 && j.dia === '2026-11-30')).toBe(true);
    expect(oitavas.map((j) => j.hora)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    // Quem manda é o fundador do Clássico (Série A).
    expect(oitavas.map((j) => [j.mandante, j.visitante])).toEqual(OITAVAS_DE_CLASSICO.map(([a, b]) => [a, b]));
    const primeira = (await banco.query<{ dia: string }>(`SELECT to_char(data, 'YYYY-MM-DD') AS dia FROM rodada WHERE temporada_id = $1 AND numero = 1`, [t])).rows[0]!;
    expect(primeira.dia).toBe('2026-12-03');
    expect(await estruturaDaTemporada(banco, t)).toEqual(estruturaDaLiga(7));
  });

  it('a T2 não tem Copa', async () => {
    const t = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-30', seed: 4, series });
    expect(await jogosDaCopa(t)).toHaveLength(0);
  });

  it('avança a chave: Quartas no dia seguinte, Semifinais no mesmo dia, Final no outro; campeão ganha a bronze', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    expect(await avancarCopa(banco, t)).toBe('NADA');
    const oitavas = await jogosDaCopa(t);
    await jogar(oitavas);
    expect(await avancarCopa(banco, t)).toBe('QUARTAS_CRIADAS');
    expect(await avancarCopa(banco, t)).toBe('NADA');
    const quartas = (await jogosDaCopa(t)).filter((j) => j.etapa === 'QUARTAS');
    expect(quartas.map((j) => [j.dia, j.hora, j.rodada])).toEqual([11, 12, 13, 14].map((h) => ['2026-12-01', h, 102]));
    // A chave é fixa: vencedor do jogo 1 contra o do jogo 2...
    const v = await Promise.all(oitavas.map((j) => vencedor(j.id)));
    expect(quartas.map((j) => [j.mandante, j.visitante].sort())).toEqual([0, 2, 4, 6].map((k) => [v[k]!, v[k + 1]!].sort()));

    await jogar(quartas);
    expect(await avancarCopa(banco, t)).toBe('SEMIFINAIS_CRIADAS');
    const semis = (await jogosDaCopa(t)).filter((j) => j.etapa === 'SEMIFINAL');
    expect(semis.map((j) => [j.dia, j.hora, j.rodada])).toEqual([['2026-12-01', 16, 102], ['2026-12-01', 17, 102]]);

    await jogar(semis);
    expect(await avancarCopa(banco, t)).toBe('FINAL_CRIADA');
    const [final] = (await jogosDaCopa(t)).filter((j) => j.etapa === 'FINAL');
    expect([final!.dia, final!.hora, final!.rodada]).toEqual(['2026-12-02', 18, 103]);

    await jogar([final!]);
    expect(await avancarCopa(banco, t)).toBe('COPA_ENCERRADA');
    expect(await avancarCopa(banco, t)).toBe('NADA');
    const campeao = await vencedor(final!.id);
    expect((await banco.query<{ c: TimeId }>(`SELECT campeao_copa_id AS c FROM temporada WHERE id = $1`, [t])).rows[0]!.c).toBe(campeao);
    expect((await estrelasNoBanco(banco))[campeao]).toMatchObject({ bronze: 1 });
  });
});
