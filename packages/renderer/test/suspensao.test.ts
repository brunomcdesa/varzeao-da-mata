import { describe, expect, it } from 'vitest';
import { habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { simularPartida, type Lado } from '@liga/sim';
import { Timeline } from '../src/timeline.js';
import { Roteiro } from '../src/roteiro.js';
import { montarNarracao } from '../src/narracao.js';
import { cartaoSuspende, penduradosDaEscalacao, type SuspensaoNaPartida } from '../src/suspensao.js';

const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
const esc = (time: TimeId): Escalacao => ({ time, jogadores: ORDEM.map((posicao, i) => ({ jogadorId: `${time}-${i}`, posicao, ovr: 70, habilidades: habilidadesDoPerfil(posicao, 70) })) });
const e = { mandante: esc('ONC'), visitante: esc('TAT') };
const tl = (seed: number) => new Timeline(simularPartida({ ...e, seed, fase: 'LIGA', t2: { postura: { mandante: 'OFENSIVA', visitante: 'OFENSIVA' } } }), e);

/** Primeira Partida (pela seed) com um cartão do tipo pedido. */
function comCartao(cartao: 'AMARELO' | 'VERMELHO') {
  for (let seed = 1; seed < 400; seed++) {
    const t = tl(seed);
    const i = t.resultado.lances.findIndex((l) => l.falta?.cartao === cartao);
    if (i >= 0) return { t, i, autor: t.resultado.lances[i]!.falta!.autor };
  }
  throw new Error(`nenhum ${cartao} nas seeds`);
}

const falaDoCartao = (t: Timeline, i: number, suspensao: SuspensaoNaPartida) =>
  montarNarracao(new Roteiro(t, { duracaoMaxima: 1e9, bolasParadas: true }), undefined, { suspensao }).find((f) => f.id === `lance-${i}-b`)?.texto;

describe('Suspensão na transmissão (ADR-0116)', () => {
  it('vermelho sempre tira do próximo jogo; amarelo só de quem chegou pendurado; na Final, nada', () => {
    const s = { pendurados: { mandante: [2] } as Partial<Record<Lado, number[]>> };
    expect(cartaoSuspende(s, 'visitante', 4, 'VERMELHO')).toBe(true);
    expect(cartaoSuspende(s, 'mandante', 2, 'AMARELO')).toBe(true);
    expect(cartaoSuspende(s, 'mandante', 3, 'AMARELO')).toBe(false);
    expect(cartaoSuspende(s, 'visitante', 2, 'AMARELO')).toBe(false);
    expect(cartaoSuspende({ ...s, semProximoJogo: true }, 'mandante', 2, 'AMARELO')).toBe(false);
    // Partidas antigas, sem a informação: o cartão segue como antes.
    expect(cartaoSuspende(undefined, 'mandante', 2, 'VERMELHO')).toBe(false);
  });

  it('os pendurados da Escalação pública contam titulares (pelo lugar) e depois o Banco', () => {
    const j = (lugar: number, pendurado = false) => ({ lugar, ...(pendurado ? { pendurado: true as const } : {}) });
    expect(penduradosDaEscalacao({ jogadores: [j(1, true), j(0), j(2)], banco: [{}, { pendurado: true }] })).toEqual([1, 4]);
  });

  it('o Narrador diz que o pendurado que levou amarelo está fora do próximo jogo', () => {
    const { t, i, autor } = comCartao('AMARELO');
    const sem = falaDoCartao(t, i, { pendurados: {} })!;
    const com = falaDoCartao(t, i, { pendurados: { [autor.lado]: [autor.indice] } })!;
    expect(sem).not.toContain('próximo jogo');
    expect(com).toBe(`${sem} Tava pendurado: tá fora do próximo jogo!`);
  });

  it('no vermelho, o Narrador avisa o próximo jogo; na Final, não', () => {
    const { t, i } = comCartao('VERMELHO');
    expect(falaDoCartao(t, i, { pendurados: {} })).toMatch(/E tá fora do próximo jogo!$/);
    expect(falaDoCartao(t, i, { pendurados: {}, semProximoJogo: true })).not.toContain('próximo jogo');
  });
});
