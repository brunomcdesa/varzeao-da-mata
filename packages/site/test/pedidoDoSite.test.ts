import { describe, expect, it } from 'vitest';
import { JANELA_DO_PEDIDO_MS, pedidoValido } from '../src/pedidoDoSite.js';

const agora = new Date('2026-11-18T11:00:00Z');
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString();

describe('pedido de Transferência no painel (ADR-0085)', () => {
  it('pendente vale sempre', () => {
    const p = { time: 'TAT', pedidoEm: minutosAtras(600) };
    expect(pedidoValido(p, agora)).toBe(p);
  });
  it('processado agora vale (o jogadores.json ainda não foi republicado)', () => {
    const p = { time: 'TAT', pedidoEm: minutosAtras(3), resultado: 'TRANSFERIDO', processadoEm: minutosAtras(2) };
    expect(pedidoValido(p, agora)).toBe(p);
  });
  it('processado há mais tempo que a janela não conta: o Time do jogadores.json manda', () => {
    // Transferiu para o Tatu na T1 e foi remanejado para a Sucuri no Rebalanceamento da T2.
    const p = { time: 'TAT', pedidoEm: '2026-11-12T20:00:00Z', resultado: 'TRANSFERIDO', processadoEm: '2026-11-12T20:01:00Z' };
    expect(pedidoValido(p, agora)).toEqual({});
    const noLimite = { ...p, processadoEm: new Date(agora.getTime() - JANELA_DO_PEDIDO_MS - 1).toISOString() };
    expect(pedidoValido(noLimite, agora)).toEqual({});
  });
  it('sem pedido ou com data inválida não conta', () => {
    expect(pedidoValido(null, agora)).toEqual({});
    expect(pedidoValido({}, agora)).toEqual({});
    expect(pedidoValido({ pedidoEm: minutosAtras(1), processadoEm: 'ontem' }, agora)).toEqual({});
  });
});
