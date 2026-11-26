import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOEDAS, REELS_PROGRAMADOS, TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { rodarPartida } from '../src/partida.js';
import { dadosDoAgradecimentoT2, legendaDasNovidadesT3, legendaDoAgradecimentoT2, numerosDaTemporada2 } from '../src/programados.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
async function inscrever(time: TimeId, posicao: string, quem: string): Promise<string> {
  await processarComentario(banco, { igCommentId: `c-${quem}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date('2026-11-10T12:00:00Z') }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}

describe('Reels de Fim da Temporada 2 (ADR-0117)', () => {
  it('sai sábado 28/11 às 20h, entre o Resumo da Temporada (19h) e a Abertura da T3 (21h)', () => {
    const p = REELS_PROGRAMADOS.find((x) => x.id === 'agradecimento-t2')!;
    expect(p.publicarEm).toBe('2026-11-28T23:00:00Z');
    expect(Date.parse(p.publicarEm)).toBeLessThan(Date.parse(REELS_PROGRAMADOS.find((x) => x.id === 'abertura-t3')!.publicarEm));
    expect(new Set(REELS_PROGRAMADOS.map((x) => x.ref)).size).toBe(REELS_PROGRAMADOS.length);
  });

  it('números da T2: Jogadores em campo (critério do Bônus de largada), jogos e gols; espera o último resultado', async () => {
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series });
    const veterano = await inscrever('ONC', 'ATA', 'veterano');
    await inscrever('CAP', 'MEI', 'so-inscrito'); // inscrito, mas nunca entrou em campo
    const ps = (await banco.query<{ id: number; onca: boolean }>(`SELECT p.id, 'ONC' IN (p.mandante_id, p.visitante_id) AS onca FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial`, [t2])).rows;
    await expect(numerosDaTemporada2(banco)).rejects.toThrow('ainda não tem jogos');

    const daOnca = ps.find((p) => p.onca)!;
    const r = (await rodarPartida(banco, daOnca.id, { seed: 3 })).resultado;
    expect(r.desempenhos.some((d) => d.jogadorId === veterano)).toBe(true);
    await expect(numerosDaTemporada2(banco)).rejects.toThrow(`${ps.length - 1} jogo(s) sem resultado`);

    await banco.query(`UPDATE partida SET gols_mandante = 1, gols_visitante = 0 WHERE id = ANY($1)`, [ps.filter((p) => p.id !== daOnca.id).map((p) => p.id)]);
    expect(await numerosDaTemporada2(banco)).toEqual({ jogadores: 1, jogos: ps.length, gols: ps.length - 1 + r.gols.mandante + r.gols.visitante });

    const d = await dadosDoAgradecimentoT2(banco, { copaEm: '2026-11-30' });
    expect(d.aberturaAs).toBe(21);
    expect(d.copaEm).toBe('2026-11-30');
  });

  it('legenda: números, o presente em Moedas e a Copa na segunda (não no sábado da Abertura)', () => {
    const l = legendaDoAgradecimentoT2({ jogadores: 184, jogos: 59, gols: 231, aberturaAs: 21, copaEm: '2026-11-30' });
    expect(l).toContain('184 Jogadores em campo, 59 jogos e 231 gols');
    expect(l).toContain(`${MOEDAS.BONUS_POR_TEMPORADA} Moedas por Temporada jogada (jogou a T1 e a T2: ${2 * MOEDAS.BONUS_POR_TEMPORADA})`);
    expect(l).toContain('Hoje, às 21h, sai a Abertura da Temporada 3. E a Copa começa segunda, 30/11!');
    expect(l).not.toMatch(/campeão|undefined|NaN|@/i);
    expect(l.length).toBeLessThan(2200);
  });
});

describe('Capitão ativo nas Novidades da T3 (ADR-0114)', () => {
  it('a legenda da Parte 5 avisa que o Capitão e o Técnico parados 3 jogos perdem a faixa e o cargo', () => {
    const p = REELS_PROGRAMADOS.find((x) => x.id === 'novidades-t3-capitao')!;
    const l = legendaDasNovidadesT3(p.id, '2026-11-30', p.publicarEm);
    expect(l).toContain('3 jogos do Time sem escolher nada perde a faixa');
    expect(l).toContain('Só confirmar a Presença não conta');
    expect(l).toContain('3 jogos parado e ele perde o cargo');
    expect(l.length).toBeLessThan(2200);
  });
});
