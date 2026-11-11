import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_PENDENCIAS, comPendencia, ehHoraDaVarredura } from '@liga/shared';
import type { Banco } from '../src/banco.js';
import { AgendaNaMemoria } from '../src/nuvem.js';
import { processarPedidosDoSite } from '../src/pedidosSite.js';
import { tomarPendencias } from '../src/pendencias.js';
import { CHAVE_VINCULOS, jogadoresComVinculo } from '../src/temporada2.js';
import { bancoDeTeste } from './banco-de-teste.js';

/** Agenda que conta as listagens: é o que o plano grátis do KV limita a 1.000 por dia. */
class AgendaContada extends AgendaNaMemoria {
  listagens: string[] = [];
  override async listar(prefixo: string): Promise<string[]> {
    this.listagens.push(prefixo);
    return super.listar(prefixo);
  }
}

let banco: Banco;
let agenda: AgendaContada;
const t0 = new Date('2026-11-11T12:07:00Z');
const depois = (min: number) => new Date(t0.getTime() + min * 60_000);

beforeEach(async () => {
  banco = await bancoDeTeste();
  agenda = new AgendaContada();
});
afterEach(async () => {
  await banco.fechar();
});

describe('Pendências do KV (ADR-0035)', () => {
  it('a borda só grava a marca quando o tipo ainda não estava marcado', () => {
    const agora = new Date('2026-11-11T12:00:00Z');
    expect(comPendencia(null, 'votos', agora)).toEqual({ votos: '2026-11-11T12:00:00.000Z' });
    expect(comPendencia({ votos: 'x' }, 'votos', agora)).toBeNull();
    expect(comPendencia({ votos: 'x' }, 'pedidos', agora)).toEqual({ votos: 'x', pedidos: '2026-11-11T12:00:00.000Z' });
  });

  it('varre tudo na primeira coleta e depois só uma vez por hora', () => {
    expect(ehHoraDaVarredura(null, t0)).toBe(true);
    expect(ehHoraDaVarredura(t0, depois(10))).toBe(false);
    expect(ehHoraDaVarredura(t0, depois(55))).toBe(true);
  });

  it('sem marca, a coleta não lista nada; com marca, lista só o tipo marcado e apaga a marca', async () => {
    expect((await tomarPendencias(banco, agenda, t0))('pedidos')).toBe(true); // a primeira varre tudo
    agenda.listagens = [];

    const nada = await tomarPendencias(banco, agenda, depois(10));
    await processarPedidosDoSite(banco, agenda, depois(10), nada);
    expect(agenda.listagens).toEqual([]);

    await agenda.gravar(CHAVE_PENDENCIAS, { pedidos: depois(12).toISOString() });
    const marcado = await tomarPendencias(banco, agenda, depois(20));
    await processarPedidosDoSite(banco, agenda, depois(20), marcado);
    expect(agenda.listagens).toEqual(['pedido-site/']);
    expect(await agenda.ler(CHAVE_PENDENCIAS)).toBeNull();
  });

  it('a varredura de hora em hora lista tudo mesmo sem marca', async () => {
    await tomarPendencias(banco, agenda, t0);
    const p = await tomarPendencias(banco, agenda, depois(60));
    expect(['votos', 'perfis', 'escolhas', 'pedidos', 'vinculos', 'publicados'].every((t) => p(t as never))).toBe(true);
  });

  it('quem tem Vínculo vem da cópia guardada, sem listar as sessões', async () => {
    await agenda.gravar('vinculo/sessao/h1', { jogadorId: '7' });
    expect([...(await jogadoresComVinculo(agenda, { recarregar: false }))]).toEqual(['7']); // sem cópia: lista e guarda
    expect(await agenda.ler(CHAVE_VINCULOS)).toEqual(['7']);
    agenda.listagens = [];
    await agenda.gravar('vinculo/sessao/h2', { jogadorId: '9' });
    expect([...(await jogadoresComVinculo(agenda, { recarregar: false }))]).toEqual(['7']);
    expect(agenda.listagens).toEqual([]);
    expect([...(await jogadoresComVinculo(agenda))].sort()).toEqual(['7', '9']); // marcado: recarrega
  });
});
