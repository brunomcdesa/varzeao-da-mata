import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida } from '@liga/sim';
import { DURACAO_JOGO, Timeline } from '../src/timeline.js';
import { GESTOS, JUIZ_NO_APITO_INICIAL, acaoNaFalta, alvoDoJuiz, uniformeDoJuiz, visualDoJuiz } from '../src/juiz.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId, ovr: number): Escalacao => ({
  time,
  jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) })),
});
const POSTURA = { postura: { mandante: 'EQUILIBRADA', visitante: 'EQUILIBRADA' } } as const;

function timeline(seed: number, t2: boolean) {
  const escalacoes = { mandante: esc('CAP', 72), visitante: esc('ONC', 68) };
  const resultado = simularPartida({ ...escalacoes, seed, fase: 'LIGA', ...(t2 ? { t2: POSTURA } : {}) });
  return new Timeline(resultado, escalacoes);
}

describe('Juiz (ADR-0041)', () => {
  it('usa o preto quando nenhum Time se parece com ele', () => {
    expect(uniformeDoJuiz({ mandante: 'CAP', visitante: 'TAM' }, null)).toBe('PRETO');
  });

  it('troca o preto quando um Time ou goleiro joga de preto', () => {
    expect(uniformeDoJuiz({ mandante: 'TUC', visitante: 'ARA' }, null)).not.toBe('PRETO');
    // A Onça tem o goleiro de preto (cor secundária).
    expect(uniformeDoJuiz({ mandante: 'CAP', visitante: 'ONC' }, null)).not.toBe('PRETO');
  });

  it('o visual do juiz é o mesmo a Partida toda e muda de uma Partida para outra só na pele e no cabelo', () => {
    const times = { mandante: 'CAP', visitante: 'TAM' } as const;
    expect(visualDoJuiz(times, null, 7)).toEqual(visualDoJuiz(times, null, 7));
    expect(visualDoJuiz(times, null, 7).camisa).toBe(visualDoJuiz(times, null, 8).camisa);
  });

  it('acompanha a bola na diagonal, do lado de dentro do campo', () => {
    const esquerda = alvoDoJuiz({ tipo: 'JOGO', bola: { x: 0.05, y: 0.5 } }).pos;
    const direita = alvoDoJuiz({ tipo: 'JOGO', bola: { x: 0.95, y: 0.95 } }).pos;
    expect(esquerda.x).toBeGreaterThan(0.05);
    expect(direita.x).toBeLessThan(0.95);
    for (const p of [esquerda, direita]) {
      expect(p.x).toBeGreaterThanOrEqual(0.1);
      expect(p.x).toBeLessThanOrEqual(0.9);
      expect(p.y).toBeLessThanOrEqual(0.92);
    }
  });

  it('corre até a falta e volta ao meio depois do gol', () => {
    expect(alvoDoJuiz({ tipo: 'FALTA', autor: { x: 0.3, y: 0.2 } }).naJogada).toBe(true);
    expect(alvoDoJuiz({ tipo: 'GOL' }).pos).toEqual(JUIZ_NO_APITO_INICIAL);
  });

  it('apita no começo da falta e só mostra o cartão quando há cartão', () => {
    expect(acaoNaFalta(0.01, undefined, 0.5)).toBe('APITO');
    expect(acaoNaFalta(0.5, undefined, 0)).toBeNull();
    expect(acaoNaFalta(0.3, 'AMARELO', 0.05)).toBe('CARTAO');
    // Longe de quem fez, espera chegar (até o limite).
    expect(acaoNaFalta(GESTOS.cartaoDe, 'VERMELHO', 0.5)).toBe('APITO');
    expect(acaoNaFalta(GESTOS.cartaoForcadoDe, 'VERMELHO', 0.5)).toBe('CARTAO');
    // O cartão desce antes de o expulso sair (0,7 do letreiro).
    expect(acaoNaFalta(0.7, 'VERMELHO', 0)).toBeNull();
  });

  it('Partida da T1 não tem juiz; na T2 ele fica em campo o jogo todo', () => {
    expect(timeline(3, false).estado(DURACAO_JOGO / 2).juiz).toBeNull();
    const tl = timeline(3, true);
    for (let t = 0; t <= DURACAO_JOGO; t += 120) {
      const j = tl.estado(t).juiz!;
      expect(j).not.toBeNull();
      expect(j.pos.x).toBeGreaterThanOrEqual(0.03);
      expect(j.pos.x).toBeLessThanOrEqual(0.97);
      expect(j.pos.y).toBeGreaterThanOrEqual(0.02);
      expect(j.pos.y).toBeLessThanOrEqual(0.98);
    }
  });

  it('na falta com cartão, o juiz levanta o cartão certo', () => {
    for (let seed = 1; seed < 200; seed++) {
      const tl = timeline(seed, true);
      const i = tl.resultado.lances.findIndex((l) => l.falta?.cartao);
      if (i < 0) continue;
      const cartao = tl.resultado.lances[i]!.falta!.cartao;
      const inicio = tl.instanteDoLance(i);
      const gestos = Array.from({ length: 40 }, (_, k) => tl.estado(inicio + k).juiz!);
      expect(gestos.some((j) => j.acao === 'APITO')).toBe(true);
      expect(gestos.some((j) => j.acao === 'CARTAO' && j.cartao === cartao)).toBe(true);
      return;
    }
    throw new Error('nenhuma partida com cartão');
  });
});
