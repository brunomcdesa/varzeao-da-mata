import { describe, expect, it } from 'vitest';
import { partidaDeTeste } from '../scripts/gravacao.js';
import { Timeline, VELOCIDADE_AO_VIVO, DURACAO_JOGO } from '../src/timeline.js';
import { CLARAO_DO_GOL, TREMOR_DO_GOL, cartaoGiganteEm, efeitosDoSite } from '../src/efeitosDoSite.js';
import { DURACAO_DO_CARTAO } from '../src/video.js';
import { COLUNAS, LINHAS } from '../src/pixel.js';

describe('efeitos de momento no Ao Vivo e no Replay (ADR-0095)', () => {
  const casos = [3, 8, 42, 77].map((seed) => {
    const p = partidaDeTeste(seed, 'CAP', 'ONC', undefined, 'LIGA', true);
    return { seed, tl: new Timeline(p.resultado, p.escalacoes) };
  });

  it('campo inteiro: câmera parada no meio, sem zoom', () => {
    for (const { tl } of casos)
      for (let t = 0; t < DURACAO_JOGO; t += 37) {
        const c = efeitosDoSite(tl, t).camera!;
        expect(c).toMatchObject({ cx: COLUNAS / 2, cy: LINHAS / 2, zoom: 1 });
      }
  });

  it('o gol treme por 0,5 s e clareia por 0,3 s de Ao Vivo, logo depois da resolução', () => {
    let gols = 0;
    for (const { tl } of casos)
      for (const j of tl.janelas) {
        if (j.lance.tipo !== 'GOL') continue;
        gols++;
        const em = (s: number) => efeitosDoSite(tl, j.resolucao + s * VELOCIDADE_AO_VIVO).camera!;
        expect(em(-0.05).tremor).toBeUndefined();
        expect(em(0.1).tremor).toBeDefined();
        expect(em(0.1).flash).toBeGreaterThan(0);
        expect(em(CLARAO_DO_GOL + 0.05).flash).toBeUndefined();
        expect(em(CLARAO_DO_GOL + 0.05).tremor).toBeDefined();
        expect(em(TREMOR_DO_GOL + 0.05).tremor).toBeUndefined();
      }
    expect(gols).toBeGreaterThan(0);
  });

  it('fora do gol, nada treme nem clareia', () => {
    for (const { tl } of casos) {
      const gols = tl.janelas.filter((j) => j.lance.tipo === 'GOL').map((j) => j.resolucao);
      for (let t = 0; t < DURACAO_JOGO; t += 3) {
        const c = efeitosDoSite(tl, t).camera!;
        const pertoDeGol = gols.some((g) => t >= g && (t - g) / VELOCIDADE_AO_VIVO < TREMOR_DO_GOL);
        if (!pertoDeGol) {
          expect(c.tremor).toBeUndefined();
          expect(c.flash).toBeUndefined();
        }
      }
    }
  });

  it('quem pediu menos movimento fica sem tremor e clarão, mas com rastro', () => {
    for (const { tl } of casos)
      for (const j of tl.janelas.filter((x) => x.lance.tipo === 'GOL')) {
        const e = efeitosDoSite(tl, j.resolucao + 0.1 * VELOCIDADE_AO_VIVO, { semMovimento: true });
        expect(e.camera!.tremor).toBeUndefined();
        expect(e.camera!.flash).toBeUndefined();
        expect(e.rastro).toHaveLength(5);
      }
  });

  it('o cartão gigante aparece quando o juiz levanta o cartão e some depois de 1,4 s, sem o letreiro de sempre', () => {
    let cartoes = 0;
    for (const { tl } of casos)
      for (const c of tl.cartoes) {
        cartoes++;
        expect(cartaoGiganteEm(tl, c.t - 0.5)?.momento.tJogo).not.toBe(c.t);
        const durante = efeitosDoSite(tl, c.t + 0.5 * VELOCIDADE_AO_VIVO);
        expect(durante.cartao?.momento).toMatchObject({ cartao: c.cartao, lado: c.lado, ocupante: c.ocupante });
        expect(durante.semLetreiro).toBe(true);
        expect(cartaoGiganteEm(tl, c.t + (DURACAO_DO_CARTAO + 0.05) * VELOCIDADE_AO_VIVO)?.momento.tJogo).not.toBe(c.t);
      }
    expect(cartoes).toBeGreaterThan(0);
  });

  it('é determinístico: o mesmo instante dá o mesmo efeito (Ao Vivo, Replay ou depois de pular)', () => {
    const { tl } = casos[0]!;
    for (let t = 0; t < DURACAO_JOGO; t += 11) expect(efeitosDoSite(tl, t)).toEqual(efeitosDoSite(tl, t));
  });
});
