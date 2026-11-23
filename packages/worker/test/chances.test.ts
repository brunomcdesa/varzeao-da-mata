import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chancesDaTabela, porcentagem, primeiraRodadaDasChances, resumoMostraChances, textoDaQueda, textoDaSemifinal, type TimeId } from '@liga/shared';
import { RoteiroResumo, falaDasChances, falaDoFimDaFaseDeLiga } from '../../renderer/src/resumo.js';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { dadosDoResumo } from '../src/resumo.js';
import { bancoDeTeste } from './banco-de-teste.js';

const linha = (time: TimeId, jogos: number, pontos: number, vitorias: number, saldo: number, golsPro: number) => ({ time, jogos, pontos, vitorias, saldo, golsPro });
const jogo = (s: string) => {
  const [mandante, visitante] = s.split('x') as [TimeId, TimeId];
  return { mandante, visitante };
};

describe('Chances da reta final (ADR-0099)', () => {
  it('aparecem da metade até a última Rodada da Fase de Liga', () => {
    expect(primeiraRodadaDasChances(7)).toBe(4);
    expect([1, 2, 3, 4, 5, 6, 7].filter((r) => resumoMostraChances('LIGA', r, 7))).toEqual([4, 5, 6, 7]);
    expect(resumoMostraChances('MATA_MATA', 8, 7)).toBe(false);
    expect([4, 5, 9].filter((r) => resumoMostraChances('LIGA', r, 9))).toEqual([5, 9]);
  });

  it('selo só quando é certo de verdade; sem certeza, nunca 0% nem 100%', () => {
    // 4 Times, 1 vai à semi, 2 caem; falta uma Rodada. ARA não pode ser alcançada; TUC não alcança ninguém.
    const tabela = [linha('ARA', 3, 9, 3, 6, 7), linha('ONC', 3, 4, 1, 1, 3), linha('CAP', 3, 4, 1, 1, 3), linha('TUC', 3, 0, 0, -8, 0)];
    const c = chancesDaTabela(tabela, [jogo('ARAxTUC'), jogo('ONCxCAP')], { classificam: 1, caem: 2 });
    const de = (t: TimeId) => c.find((x) => x.time === t)!;
    expect(textoDaSemifinal(de('ARA'))).toBe('Na semi');
    expect(textoDaQueda(de('ARA'))).toBe('Salvo');
    expect(textoDaSemifinal(de('TUC'))).toBe('Fora');
    expect(textoDaQueda(de('TUC'))).toBe('Caiu');
    // ONC x CAP: quem vencer escapa; no empate, o desempate depende dos gols.
    expect(de('ONC').certezaQueda).toBeNull();
    expect(de('ONC').queda).toBeGreaterThan(0.3);
    expect(de('ONC').queda).toBeLessThan(0.7);
    // Exatamente 2 caem e 1 vai à semi, somando as chances de todos.
    expect(c.reduce((s, x) => s + x.queda, 0)).toBeCloseTo(2, 5);
    expect(c.reduce((s, x) => s + x.semifinal, 0)).toBeCloseTo(1, 5);
    expect(porcentagem(0.001)).toBe('<1%');
    expect(porcentagem(0.999)).toBe('>99%');
    expect(porcentagem(0.37)).toBe('37%');
  });

  it('a mesma conta dá sempre os mesmos números (semente fixa)', () => {
    const tabela = [linha('ARA', 1, 3, 1, 1, 2), linha('ONC', 1, 0, 0, -1, 1), linha('CAP', 1, 1, 0, 0, 1), linha('TUC', 1, 1, 0, 0, 1)];
    const faltam = [jogo('ARAxONC'), jogo('CAPxTUC'), jogo('ARAxCAP'), jogo('ONCxTUC')];
    expect(chancesDaTabela(tabela, faltam, { classificam: 2, caem: 1 })).toEqual(chancesDaTabela(tabela, faltam, { classificam: 2, caem: 1 }));
  });

  it('a cartela vem depois da Tabela e o Narrador fala do que está nela', () => {
    const tabela = [linha('ARA', 3, 9, 3, 6, 7), linha('ONC', 3, 4, 1, 1, 3), linha('CAP', 3, 4, 1, 1, 3), linha('TUC', 3, 0, 0, -8, 0)];
    const times = chancesDaTabela(tabela, [jogo('ARAxTUC'), jogo('ONCxCAP')], { classificam: 1, caem: 2 });
    const chances = [{ grupo: 'COPA' as const, classificam: 1, caem: 2, times }];
    const r = new RoteiroResumo({ temporada: 2, rodada: 5, fase: 'LIGA', placares: [], tabela: [], novosContratados: [], totalNovos: 0, candidatos: [], chances });
    const cartelas = r.segmentos.map((s) => s.cartela);
    expect(cartelas.indexOf('CHANCES')).toBe(cartelas.indexOf('TABELA') + 1);
    expect(falaDasChances(chances)).toBe('Hora da matemática! Simulamos os jogos que faltam. No Grupo do Galho, com mais chances de semifinal, a Arara, já garantida. E com mais risco de cair, o Tucano, que já caiu, e a Onça, com 64 por cento.');
  });
});

describe('Fim da Fase de Liga (ADR-0099)', () => {
  it('o Narrador diz quem foi à Semifinal e quem caiu, na ordem da tabela', () => {
    const tabela = [linha('ARA', 3, 9, 3, 6, 7), linha('ONC', 3, 4, 1, 1, 3), linha('CAP', 3, 3, 1, 0, 3), linha('TUC', 3, 0, 0, -8, 0)];
    const times = chancesDaTabela(tabela, [], { classificam: 1, caem: 2 });
    expect(times.every((c) => c.certezaSemifinal !== null && c.certezaQueda !== null)).toBe(true);
    expect(falaDoFimDaFaseDeLiga([{ grupo: 'CHAO', classificam: 1, caem: 2, times }])).toBe(
      'Fim da Fase de Liga! A conta fechou. No Grupo do Barro, na semifinal, a Arara. E caem para a Série B a Capivara e o Tucano.',
    );
  });
});

describe('Chances no Resumo (banco)', () => {
  let banco: Banco;
  beforeEach(async () => {
    banco = await bancoDeTeste();
    await criarTemporada(banco, { numero: 1, primeiraRodada: '2026-11-07', seed: 9 });
  });
  afterEach(async () => {
    await banco.fechar();
  });

  /** Placar das Rodadas até `ate`, direto no banco (a simulação não importa aqui). */
  async function jogarAte(ate: number): Promise<number> {
    const ps = (await banco.query<{ id: number; numero: number }>(`SELECT p.id, r.numero FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.fase = 'LIGA' AND r.numero <= $1`, [ate])).rows;
    for (const p of ps) await banco.query(`UPDATE partida SET gols_mandante = $2, gols_visitante = $3 WHERE id = $1`, [p.id, p.id % 3, (p.id * 7) % 3]);
    return (await banco.query<{ id: number }>(`SELECT id FROM rodada WHERE fase = 'LIGA' AND numero = $1`, [ate])).rows[0]!.id;
  }

  it('antes da metade, sem Chances', async () => {
    const d = await dadosDoResumo(banco, await jogarAte(3));
    expect(d.chances).toBeUndefined();
  });

  it('da metade em diante, um bloco com os 8 Times (T1: 4 na semi, ninguém cai)', async () => {
    const d = await dadosDoResumo(banco, await jogarAte(4));
    expect(d.chances).toHaveLength(1);
    const [b] = d.chances!;
    expect(b!.times).toHaveLength(8);
    expect(b!.caem).toBe(0);
    expect(b!.times.map((c) => c.time)).toEqual(d.tabela.map((l) => l.time));
    expect(b!.times.reduce((s, c) => s + c.semifinal, 0)).toBeCloseTo(4, 5);
    expect(b!.times.every((c) => c.queda === 0)).toBe(true);
  });

  it('no Resumo da última Rodada vira "Fim da Fase de Liga": todo mundo com selo', async () => {
    const d = await dadosDoResumo(banco, await jogarAte(7));
    expect(d.fimDaFaseDeLiga).toBe(true);
    const [b] = d.chances!;
    expect(b!.times.every((c) => c.certezaSemifinal !== null)).toBe(true);
    expect(b!.times.filter((c) => c.certezaSemifinal === 'GARANTIDO').map((c) => c.time)).toEqual(d.tabela.slice(0, 4).map((l) => l.time));
  });

  it('antes da última Rodada, não é o Fim da Fase de Liga', async () => {
    const d = await dadosDoResumo(banco, await jogarAte(6));
    expect(d.chances).toHaveLength(1);
    expect(d.fimDaFaseDeLiga).toBeUndefined();
  });
});
