import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONQUISTA_POR_CODIGO, MOEDAS, MOEDAS_DO_NIVEL, TIMES_FUNDADORES, TIMES_NOVOS, duracaoAoVivoMs, pontosDoPalpite, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { carteiraDoJogador, registrarPalpite, saldo } from '../src/carteira.js';
import { processarComentario } from '../src/coletar.js';
import { pagarRodada } from '../src/moedas.js';
import { rodarPartida } from '../src/partida.js';
import { aplicarEscolha } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

let n = 0;
async function inscrever(time: TimeId, posicao: string, quem: string, em = '2026-11-10T12:00:00Z'): Promise<string> {
  await processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}
const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
const partidaDe = async (temporadaId: number, time: TimeId) =>
  (
    await banco.query<{ id: number; apito: Date; rodada_id: number }>(
      `SELECT p.id, p.apito_inicial AS apito, p.rodada_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = $2 OR p.visitante_id = $2) ORDER BY p.apito_inicial LIMIT 1`,
      [temporadaId, time],
    )
  ).rows[0]!;
const fimDoAoVivo = (apito: Date) => new Date(new Date(apito).getTime() + duracaoAoVivoMs('MATA_MATA') + 1000);
const extrato = async (id: string) => (await banco.query<{ tipo: string; valor: number; referencia: string }>(`SELECT tipo, valor, referencia FROM lancamento_moedas WHERE jogador_id = $1 ORDER BY id`, [id])).rows;

describe('Palpite (ADR-0089)', () => {
  it('2 no resultado, 5 no placar exato, 0 no erro', () => {
    expect(pontosDoPalpite({ mandante: 2, visitante: 1 }, { mandante: 2, visitante: 1 })).toBe(5);
    expect(pontosDoPalpite({ mandante: 3, visitante: 0 }, { mandante: 2, visitante: 1 })).toBe(2);
    expect(pontosDoPalpite({ mandante: 1, visitante: 1 }, { mandante: 0, visitante: 0 })).toBe(2);
    expect(pontosDoPalpite({ mandante: 0, visitante: 1 }, { mandante: 2, visitante: 1 })).toBe(0);
  });

  it('só até o Corte, pelo caminho das escolhas do site; paga no fim do Ao Vivo, com teto de 10 por dia', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const torcedor = await inscrever('CAP', 'ATA', 'torcedor');
    const oitavas = (await banco.query<{ id: number; apito: Date }>(`SELECT p.id, p.apito_inicial AS apito FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 ORDER BY p.apito_inicial LIMIT 3`, [t])).rows;
    const antes = new Date('2026-11-29T12:00:00Z');
    // Simula antes para saber o placar e palpitar certo nas três (com seeds fixas).
    const placares: { mandante: number; visitante: number }[] = [];
    for (const [k, p] of oitavas.entries()) {
      expect((await registrarPalpite(banco, torcedor, `${p.id}:0-0`, antes)).ok).toBe(true);
      placares.push((await rodarPartida(banco, p.id, { seed: 50 + k })).resultado.gols);
    }
    // Recomeça com Palpites exatos: o primeiro e o segundo pagam 5, o terceiro passa do teto.
    await banco.query(`DELETE FROM lancamento_moedas WHERE tipo = 'PALPITE'`);
    await banco.query(`UPDATE palpite SET pontos = NULL`);
    for (const [k, p] of oitavas.entries()) await banco.query(`UPDATE palpite SET mandante = $2, visitante = $3 WHERE partida_id = $1`, [p.id, placares[k]!.mandante, placares[k]!.visitante]);
    const { pagarPartida } = await import('../src/moedas.js');
    for (const p of oitavas) await banco.transacao((b) => pagarPartida(b, p.id));
    const palpites = (await extrato(torcedor)).filter((l) => l.tipo === 'PALPITE');
    expect(palpites.map((l) => l.valor)).toEqual([5, 5]);
    expect((await banco.query<{ pontos: number }>(`SELECT pontos FROM palpite WHERE jogador_id = $1 ORDER BY partida_id`, [torcedor])).rows.map((r) => r.pontos)).toEqual([5, 5, 5]);

    // Depois do Corte, não dá mais.
    const tarde = new Date(new Date(oitavas[0]!.apito).getTime() - 10 * 60_000);
    expect(await registrarPalpite(banco, torcedor, `${oitavas[0]!.id}:1-0`, tarde)).toEqual({ ok: false, mensagem: 'Os Palpites desse jogo fecharam no Corte.' });
    // E chega pelo mesmo caminho das escolhas do site.
    const quartas = await partidaDe(t, 'TAM');
    expect((await aplicarEscolha(banco, torcedor, { tipo: 'PALPITE', valor: `${quartas.id}:2-2` }, antes, async () => new Set())).ok).toBe(true);
    expect((await aplicarEscolha(banco, torcedor, { tipo: 'PALPITE', valor: 'bobagem' }, antes, async () => new Set())).mensagem).toBe('Palpite inválido.');
  });
});

describe('Moedas: Salário, prêmios, bônus e Conquistas (ADRs 0087 e 0090)', () => {
  it('bônus de largada para quem jogou a T2; na T3, gols, Salário e Conquistas, só visíveis no fim do Ao Vivo', async () => {
    const t2 = await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-18', seed: 8, series });
    const veterano = await inscrever('ONC', 'ATA', 'veterano');
    await rodarPartida(banco, (await partidaDe(t2, 'ONC')).id, { seed: 3 });
    expect(await extrato(veterano)).toEqual([]);

    const t3 = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    expect(await extrato(veterano)).toEqual([{ tipo: 'BONUS_LARGADA', valor: MOEDAS.BONUS_POR_TEMPORADA, referencia: 'T2' }]);
    // A Conquista feita na T2 vira selo sem Moedas quando a primeira Partida da T3 roda.
    const p = await partidaDe(t3, 'ONC');
    const r = (await rodarPartida(banco, p.id, { seed: 9 })).resultado;
    const conquistas = (await banco.query<{ codigo: string; temporada: number; pagou: boolean }>(`SELECT codigo, temporada, pagou FROM conquista WHERE jogador_id = $1 ORDER BY em, codigo`, [veterano])).rows;
    expect(conquistas.find((c) => c.codigo === 'PRIMEIRA_PARTIDA')).toEqual({ codigo: 'PRIMEIRA_PARTIDA', temporada: 2, pagou: false });

    const meu = r.desempenhos.find((d) => d.jogadorId === veterano)!;
    const durante = new Date(new Date(p.apito).getTime() + 60_000);
    // No meio do Ao Vivo, o saldo ainda não mostra os gols (não pode estragar o resultado).
    expect(await saldo(banco, veterano, durante)).toBe(MOEDAS.BONUS_POR_TEMPORADA);
    const depois = fimDoAoVivo(p.apito);
    const pagas = conquistas.filter((c) => c.pagou).map((c) => MOEDAS_DO_NIVEL[CONQUISTA_POR_CODIGO.get(c.codigo)!.nivel]).reduce((s, x) => s + x, 0);
    expect(await saldo(banco, veterano, depois)).toBe(MOEDAS.BONUS_POR_TEMPORADA + meu.gols * MOEDAS.GOL + meu.assistencias * MOEDAS.ASSISTENCIA + pagas);

    // Salário do dia para todo o Elenco (uma vez só, mesmo rodando de novo).
    await banco.transacao((b) => pagarRodada(b, p.rodada_id));
    await banco.transacao((b) => pagarRodada(b, p.rodada_id));
    expect((await extrato(veterano)).filter((l) => l.tipo === 'SALARIO')).toEqual([{ tipo: 'SALARIO', valor: MOEDAS.SALARIO, referencia: `r${p.rodada_id}` }]);

    const carteira = await carteiraDoJogador(banco, veterano, new Date('2026-12-31T00:00:00Z'));
    expect(carteira.saldo).toBe((await extrato(veterano)).reduce((s, l) => s + l.valor, 0));
    expect(carteira.extrato[0]).toMatchObject({ tipo: expect.any(String), valor: expect.any(Number) });
    expect(carteira.conquistas.some((c) => c.codigo === 'PRIMEIRA_PARTIDA' && !c.pagou)).toBe(true);
  }, 120_000);
});
