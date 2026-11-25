import { describe, expect, it } from 'vitest';
import { amarelosQueContam, escalacaoProvavel, estaPendurado, situacaoDosCartoes, suspensaoPeloJogo } from '@liga/shared';

const jogo = (partidaId: number, amarelos = 0, expulso = false) => ({ partidaId, amarelos, expulso });

describe('Cartões: Suspensão e Pendurado (ADRs 0021 e 0116)', () => {
  it('a cada dois amarelos, um jogo fora; o vermelho tira sozinho e o amarelo do jogo dele não conta', () => {
    expect(suspensaoPeloJogo([], jogo(1, 1))).toBeNull();
    expect(suspensaoPeloJogo([jogo(1, 1)], jogo(2, 1))).toBe('AMARELOS');
    expect(suspensaoPeloJogo([jogo(1, 1), jogo(2, 1)], jogo(3, 1))).toBeNull();
    expect(suspensaoPeloJogo([jogo(1, 1), jogo(2, 1), jogo(3, 1)], jogo(4, 1))).toBe('AMARELOS');
    expect(suspensaoPeloJogo([], jogo(1, 1, true))).toBe('EXPULSAO');
    expect(amarelosQueContam([jogo(1, 1), jogo(2, 1, true)])).toBe(1);
    expect(estaPendurado([jogo(1, 1), jogo(2, 1, true)])).toBe(true);
  });

  it('caso do Thiago: 2º amarelo no último jogo do Time = Suspenso no próximo', () => {
    expect(situacaoDosCartoes([jogo(10, 1), jogo(20), jogo(30, 1)], 30, true)).toEqual({ amarelos: 2, suspenso: 'AMARELOS' });
  });

  it('depois de cumprir (não jogou o último jogo do Time), volta ao normal', () => {
    expect(situacaoDosCartoes([jogo(10, 1), jogo(30, 1)], 40, true)).toEqual({ amarelos: 2 });
  });

  it('com um amarelo na série, Pendurado; sem próximo jogo, só a conta', () => {
    expect(situacaoDosCartoes([jogo(10, 1), jogo(20)], 20, true)).toEqual({ amarelos: 1, pendurado: true });
    expect(situacaoDosCartoes([jogo(10, 1), jogo(20, 1)], 20, false)).toEqual({ amarelos: 2 });
    expect(situacaoDosCartoes([jogo(10), jogo(20)], 20, true)).toBeNull();
  });

  it('a escalação provável deixa o suspenso de fora, como a Escalação', () => {
    const j = (id: string, posicao: 'GOL' | 'ZAG' | 'MEI' | 'ATA', suspenso = false) => ({ id, posicao, ovr: 70, jogos: 0, inscritoEm: '2026-11-01T00:00:00.000Z', ...(suspenso ? { cartoes: { amarelos: 2, suspenso: 'AMARELOS' as const } } : {}) });
    const elenco = [j('gol', 'GOL'), j('thiago', 'ZAG', true), j('a1', 'ATA'), j('a2', 'ATA'), j('a3', 'ATA')];
    const ids = escalacaoProvavel(elenco, null, '2-2-2').map((l) => l.jogador?.id ?? null);
    expect(ids).not.toContain('thiago');
  });
});
