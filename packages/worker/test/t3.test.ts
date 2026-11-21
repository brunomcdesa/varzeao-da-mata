import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, perfilDoJuiz, type TimeId } from '@liga/shared';
import { VERSAO_SIM_T3 } from '@liga/sim';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { processarComentario } from '../src/coletar.js';
import { rodarPartida } from '../src/partida.js';
import { aplicarEscolha, batedoresDaPartida, capitaniaDoJogador } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

let banco: Banco;
beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

let n = 0;
async function inscrever(time: TimeId, posicao: string, quem = `${time}_${posicao}_${++n}`.toLowerCase(), em = '2026-11-17T12:00:00Z'): Promise<string> {
  await processarComentario(banco, { igCommentId: `c${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date(em) }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}
const primeiraPartida = async (temporadaId: number, time: TimeId) =>
  (
    await banco.query<{ id: number; mandante_id: TimeId; visitante_id: TimeId }>(
      `SELECT p.id, p.mandante_id, p.visitante_id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = $2 OR p.visitante_id = $2) ORDER BY p.apito_inicial LIMIT 1`,
      [temporadaId, time],
    )
  ).rows[0]!;
const nova = (numero: number) => criarTemporada(banco, { numero, primeiraRodada: '2026-11-30', seed: 8, series: { A: TIMES_FUNDADORES, B: TIMES_NOVOS } });
const antes = new Date('2026-11-29T12:00:00Z');

describe('Batedores escolhidos pelo Capitão (ADR-0091)', () => {
  it('só o Capitão escolhe, no máximo 5, só do próprio Time; a simulação usa a ordem', async () => {
    const t3 = await nova(3);
    const capitao = await inscrever('ONC', 'MEI', 'capitao_onc', '2026-11-10T12:00:00Z');
    const outro = await inscrever('ONC', 'ATA', 'outro_onc', '2026-11-12T12:00:00Z');
    const zag = await inscrever('ONC', 'ZAG', 'zag_onc', '2026-11-12T12:00:00Z');
    const deFora = await inscrever('CAP', 'ATA', 'de_fora', '2026-11-12T12:00:00Z');
    const p = await primeiraPartida(t3, 'ONC');
    const vinc = async () => new Set([capitao, outro]);

    expect((await aplicarEscolha(banco, outro, { tipo: 'BATEDORES', valor: [outro] }, antes, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'BATEDORES', valor: [outro, deFora] }, antes, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'BATEDORES', valor: [outro, outro] }, antes, vinc)).ok).toBe(false);
    expect((await aplicarEscolha(banco, capitao, { tipo: 'BATEDORES', valor: ['1', '2', '3', '4', '5', '6'] }, antes, vinc)).ok).toBe(false);
    const ok = await aplicarEscolha(banco, capitao, { tipo: 'BATEDORES', valor: [zag, outro] }, antes, vinc);
    expect(ok).toMatchObject({ ok: true, mensagem: '2 Batedores salvos para o próximo jogo.' });
    // A Formação escolhida depois não apaga os Batedores (a linha guarda tudo).
    expect((await aplicarEscolha(banco, capitao, { tipo: 'FORMACAO', valor: '3-2-1' }, antes, vinc)).ok).toBe(true);
    const lado = p.mandante_id === 'ONC' ? 'mandante' : 'visitante';
    expect((await batedoresDaPartida(banco, p.id, p.mandante_id, p.visitante_id))[lado]).toEqual([zag, outro]);

    // Quem é do Time vê os Batedores e o Elenco para escolher.
    const cap = await capitaniaDoJogador(banco, outro, antes, vinc);
    expect(cap?.batedores).toEqual([zag, outro]);
    expect(cap?.elenco?.map((x) => x.id).sort()).toEqual([capitao, outro, zag].sort());
    expect(cap?.elenco?.find((x) => x.id === zag)).toMatchObject({ nome: '@zag_onc', posicao: 'ZAG' });

    // Lista vazia volta à ordem automática.
    expect((await aplicarEscolha(banco, capitao, { tipo: 'BATEDORES', valor: [] }, antes, vinc)).mensagem).toBe('Ordem automática dos pênaltis no próximo jogo.');
  });

  it('na Temporada 2 os Batedores não existem', async () => {
    const t2 = await nova(2);
    const capitao = await inscrever('ONC', 'MEI', 'capitao_onc', '2026-11-10T12:00:00Z');
    await primeiraPartida(t2, 'ONC');
    const r = await aplicarEscolha(banco, capitao, { tipo: 'BATEDORES', valor: [capitao] }, antes, async () => new Set([capitao]));
    expect(r).toEqual({ ok: false, mensagem: 'Os Batedores chegam na Temporada 3.' });
    expect((await capitaniaDoJogador(banco, capitao, antes, async () => new Set([capitao])))?.elenco).toBeUndefined();
  });
});

describe('Simulação da Temporada 3 no worker (ADR-0094)', () => {
  it('a Partida da T3 sai na VERSAO_SIM_T3 com o Juiz do id dela; a da T2 continua igual', async () => {
    const t3 = await nova(3);
    await inscrever('ONC', 'ATA');
    const p = await primeiraPartida(t3, 'ONC');
    const job = await rodarPartida(banco, p.id, { seed: 5 });
    expect(job.resultado.versaoSim).toBe(VERSAO_SIM_T3);
    expect(job.resultado.juiz).toBe(perfilDoJuiz(p.id));
    expect(job.resultado.acrescimos).toBeGreaterThanOrEqual(1);
  });

  it('na T2, sem Juiz nem Acréscimos', async () => {
    const t2 = await nova(2);
    await inscrever('ONC', 'ATA');
    const p = await primeiraPartida(t2, 'ONC');
    const job = await rodarPartida(banco, p.id, { seed: 5 });
    expect(job.resultado.versaoSim).toBeLessThan(VERSAO_SIM_T3);
    expect(job.resultado.juiz).toBeUndefined();
  });
});
