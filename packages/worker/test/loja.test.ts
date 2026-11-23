import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMES_FUNDADORES, TIMES_NOVOS, type TimeId } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { criarTemporada } from '../src/calendario.js';
import { carteiraDoJogador, lancar, saldo } from '../src/carteira.js';
import { processarComentario } from '../src/coletar.js';
import { escalarPartida } from '../src/escalacao.js';
import { itensEquipadosAtuais } from '../src/loja.js';
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
async function inscrever(time: TimeId, posicao: string, quem: string): Promise<string> {
  await processarComentario(banco, { igCommentId: `l${++n}`, igMediaId: 'm', igUserId: quem, username: quem, texto: `ENTRO ${time} ${posicao}`, comentadoEm: new Date('2026-11-10T12:00:00Z') }, { rodadaEmVotacao: null });
  return (await banco.query<{ id: string }>(`SELECT id::text AS id FROM jogador WHERE ig_user_id = $1`, [quem])).rows[0]!.id;
}
const series = { A: TIMES_FUNDADORES, B: TIMES_NOVOS };
const agora = new Date('2026-11-29T12:00:00Z');
const escolher = (id: string, tipo: 'COMPRA' | 'EQUIPAR' | 'TIRAR', valor: string) => aplicarEscolha(banco, id, { tipo, valor }, agora, async () => new Set());
const dar = (id: string, valor: number) => lancar(banco, { jogadorId: id, tipo: 'BONUS_LARGADA', referencia: `teste${valor}`, valor, descricao: 'Teste', visivelEm: new Date('2026-11-28T00:00:00Z') });

describe('Loja (ADR-0099)', () => {
  it('compra com Moedas e equipa; não cobra duas vezes; troca e tira sem pagar', async () => {
    await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'comprador');
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).mensagem).toBe('Faltam 20 Moedas para esse Item.');
    await dar(id, 45);
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).ok).toBe(true);
    expect(await saldo(banco, id, agora)).toBe(25);
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).ok).toBe(false);
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_DOURADA')).mensagem).toBe('Faltam 75 Moedas para esse Item.');
    expect((await escolher(id, 'COMPRA', 'LUVA_ROSA')).mensagem).toBe('A Luva é só para goleiro.');
    expect((await escolher(id, 'COMPRA', 'FAIXA_BRANCA')).ok).toBe(true);
    expect(await saldo(banco, id, agora)).toBe(5);
    // Equipar só o que é seu; trocar e tirar não cobram.
    expect((await escolher(id, 'EQUIPAR', 'FAIXA_PRETA')).ok).toBe(false);
    expect((await escolher(id, 'TIRAR', 'CHUTEIRA')).ok).toBe(true);
    expect((await escolher(id, 'EQUIPAR', 'CHUTEIRA_AZUL')).ok).toBe(true);
    expect(await saldo(banco, id, agora)).toBe(5);
    const c = await carteiraDoJogador(banco, id, agora);
    expect(c.loja).toEqual({ donos: ['CHUTEIRA_AZUL', 'FAIXA_BRANCA'], equipados: { FAIXA: 'FAIXA_BRANCA', CHUTEIRA: 'CHUTEIRA_AZUL' }, goleiro: false, fase: 1 });
    expect(c.extrato.filter((l) => l.tipo === 'COMPRA').map((l) => l.valor)).toEqual([-20, -20]);
    expect(await itensEquipadosAtuais(banco)).toEqual({ comprador: { FAIXA: 'FAIXA_BRANCA', CHUTEIRA: 'CHUTEIRA_AZUL' } });
  });

  it('antes da T3 a Loja não abre', async () => {
    await criarTemporada(banco, { numero: 2, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'cedo');
    expect((await escolher(id, 'COMPRA', 'CHUTEIRA_AZUL')).mensagem).toBe('A Loja abre na Temporada 3.');
  });

  it('a Escalação congela os Itens do Corte: trocar depois não muda o jogo', async () => {
    const t = await criarTemporada(banco, { numero: 3, primeiraRodada: '2026-11-30', seed: 4, series });
    const id = await inscrever('CAP', 'ATA', 'vaidoso');
    await dar(id, 40);
    await escolher(id, 'COMPRA', 'CHUTEIRA_VERDE');
    const p = (await banco.query<{ id: number }>(`SELECT p.id FROM partida p JOIN rodada r ON r.id = p.rodada_id WHERE r.temporada_id = $1 AND (p.mandante_id = 'CAP' OR p.visitante_id = 'CAP') ORDER BY p.apito_inicial LIMIT 1`, [t])).rows[0]!;
    const e = await escalarPartida(banco, p.id);
    const lado = e.escalacoes.mandante.time === 'CAP' ? 'mandante' : 'visitante';
    const lugar = e.nomes[lado].indexOf('@vaidoso');
    expect(e.itens[lado][lugar]).toEqual({ CHUTEIRA: 'CHUTEIRA_VERDE' });
    await escolher(id, 'TIRAR', 'CHUTEIRA');
    // Reescalar devolve o que ficou gravado.
    const de = await escalarPartida(banco, p.id);
    expect(de.itens[lado][lugar]).toEqual({ CHUTEIRA: 'CHUTEIRA_VERDE' });
  });
});
