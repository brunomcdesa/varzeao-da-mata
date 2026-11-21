import { describe, expect, it } from 'vitest';
import { corpoDaCarteira } from '../src/carteira.js';

describe('Carteira no painel do dono (ADR-0087)', () => {
  it('mostra saldo, extrato com sinal, Conquistas com o valor pago e os Palpites esperando', () => {
    const s = corpoDaCarteira({
      saldo: 58,
      extrato: [
        { tipo: 'GOL', valor: 6, descricao: '2 gols', em: '2026-12-03T21:00:00.000Z' },
        { tipo: 'COMPRA', valor: -20, descricao: 'Chuteira azul', em: '2026-12-02T21:00:00.000Z' },
      ],
      conquistas: [
        { codigo: 'PRIMEIRA_PARTIDA', temporada: 2, pagou: false },
        { codigo: 'HAT_TRICK', temporada: 3, pagou: true },
      ],
      palpites: [{ partidaId: 1, mandante: 2, visitante: 1, pontos: null }],
    }).s;
    expect(s).toContain('<strong>58</strong> Moedas');
    expect(s).toContain('<strong class="entrada">+6</strong>');
    expect(s).toContain('<strong class="saida">-20</strong>');
    expect(s).toContain('Estreia</span>');
    expect(s).toContain('Hat-trick <small>+10</small>');
    expect(s).toContain('1 esperando o jogo');
  });
});
