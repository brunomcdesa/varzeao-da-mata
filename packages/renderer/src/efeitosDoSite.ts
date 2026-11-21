/**
 * Efeitos de momento no Ao Vivo e no Replay do site (ADR-0094): os mesmos do Reels (ADR-0072 e
 * ADR-0074), mas com o campo inteiro, sem zoom e sem pausa.
 *
 * - No gol, a imagem treme por 0,5 s e clareia por 0,3 s; a rede estufa e balança.
 * - A bola deixa um rastro curto quando anda rápido; o carrinho levanta poeira.
 * - No cartão, o cartão gigante aparece por 1,4 s, sem o lance parar (o Ao Vivo segue o relógio).
 *
 * Tudo sai do tempo de jogo, então o mesmo instante fica igual no Ao Vivo, no Replay e depois
 * de pular na barra. As durações são em "s de Ao Vivo" (s de jogo ÷ VELOCIDADE_AO_VIVO), que é o
 * tempo que a pessoa vê na velocidade normal.
 */
import { COLUNAS, LINHAS, Pincel } from './pixel.js';
import { desenharQuadro, type Camera, type OpcoesDesenho } from './desenho.js';
import { DURACAO_DO_CARTAO, desenharCartaoGigante, type MomentoDoCartao } from './video.js';
import { DURACAO_JOGO, VELOCIDADE_AO_VIVO, type Timeline } from './timeline.js';

/** Quanto dura o tremor do gol (s de Ao Vivo). */
export const TREMOR_DO_GOL = 0.5;
/** Quanto dura o clarão do gol (s de Ao Vivo). */
export const CLARAO_DO_GOL = 0.3;
/** Quanto dura o rastro da bola (s de Ao Vivo). */
const RASTRO = 0.2;

export interface EfeitosDoSite extends Pick<OpcoesDesenho, 'camera' | 'rastro' | 'semLetreiro'> {
  /** Cartão gigante na tela agora, com o quanto dele já passou (0 a 1). */
  cartao?: { momento: MomentoDoCartao; f: number };
}

/**
 * Efeitos do instante `t` (s de jogo). `semMovimento` (quem pediu menos movimento no aparelho)
 * tira o tremor e o clarão; o resto fica.
 */
export function efeitosDoSite(tl: Timeline, t: number, o: { semMovimento?: boolean } = {}): EfeitosDoSite {
  // Câmera parada no campo inteiro (zoom 1): só serve para o tremor e para ligar rede e poeira.
  const camera: Camera = { cx: COLUNAS / 2, cy: LINHAS / 2, zoom: 1 };
  // Na disputa de pênaltis a tela já tem o efeito dela.
  const disputa = t > DURACAO_JOGO;
  if (!o.semMovimento && !disputa) {
    for (const j of tl.janelas) {
      if (j.lance.tipo !== 'GOL') continue;
      const dt = (t - j.resolucao) / VELOCIDADE_AO_VIVO;
      if (dt < 0 || dt >= TREMOR_DO_GOL) continue;
      camera.tremor = { x: Math.sin(dt * 70) * 2.5 * (1 - dt / TREMOR_DO_GOL), y: Math.cos(dt * 55) * 1.5 * (1 - dt / TREMOR_DO_GOL) };
      if (dt < CLARAO_DO_GOL) camera.flash = 1 - dt / CLARAO_DO_GOL;
      break;
    }
  }
  const rastro = disputa ? [] : [RASTRO, 0.15, 0.1, 0.05, 0].map((d) => tl.bolaNoInstante(t - d * VELOCIDADE_AO_VIVO));
  const efeitos: EfeitosDoSite = { camera, rastro };
  const cartao = cartaoGiganteEm(tl, t);
  if (cartao) {
    efeitos.cartao = cartao;
    // O gigante já diz "Amarelo!"/"Expulso!": o letreiro de sempre sai da tela.
    efeitos.semLetreiro = true;
  }
  return efeitos;
}

/** O cartão gigante no instante `t` (s de jogo): aparece quando o juiz levanta o cartão. */
export function cartaoGiganteEm(tl: Timeline, t: number): { momento: MomentoDoCartao; f: number } | null {
  for (const c of tl.cartoes) {
    const dt = (t - c.t) / VELOCIDADE_AO_VIVO;
    if (dt < 0 || dt >= DURACAO_DO_CARTAO) continue;
    const inicio = c.t / VELOCIDADE_AO_VIVO;
    return { momento: { inicio, fim: inicio + DURACAO_DO_CARTAO, tJogo: c.t, cartao: c.cartao, lado: c.lado, ocupante: c.ocupante }, f: dt / DURACAO_DO_CARTAO };
  }
  return null;
}

/** Desenha um quadro do Ao Vivo ou do Replay com os efeitos de momento. */
export function desenharQuadroDoSite(ctx: CanvasRenderingContext2D, tl: Timeline, t: number, o: OpcoesDesenho & { semMovimento?: boolean }): void {
  const { cartao, ...efeitos } = efeitosDoSite(tl, t, { semMovimento: o.semMovimento ?? false });
  desenharQuadro(ctx, tl.estado(t), { ...o, ...efeitos });
  if (cartao) desenharCartaoGigante(new Pincel(ctx), cartao.momento, cartao.f, o);
}
