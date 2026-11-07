/**
 * Ao Vivo e Replay no navegador: o mesmo renderer do vídeo, no "tempo de relógio".
 * Ao Vivo segue o relógio (90 min de jogo em 6 min, ninguém adianta); o Replay deixa
 * pausar, pular e acelerar.
 */
import { DURACAO_JOGO, Timeline, VELOCIDADE_AO_VIVO, desenharQuadro } from '@liga/renderer';
import type { Escalacao, EscalacaoPublica, PartidaPublica } from '@liga/shared';
import type { Lado, ResultadoPartida } from '@liga/sim';

export interface Transmissao {
  parar(): void;
}

const paraEscalacao = (e: EscalacaoPublica): Escalacao => ({
  time: e.time,
  jogadores: [...e.jogadores].sort((a, b) => a.lugar - b.lugar).map((j) => ({ jogadorId: j.jogadorId, posicao: j.posicao, ovr: j.ovr })),
});
const nomesDe = (e: EscalacaoPublica) => [...e.jogadores].sort((a, b) => a.lugar - b.lugar).map((j) => (j.username ? `@${j.username}` : null));

export function montarTimeline(p: PartidaPublica): Timeline | null {
  if (!p.resultado || !p.escalacoes) return null;
  return new Timeline(p.resultado as ResultadoPartida, { mandante: paraEscalacao(p.escalacoes.mandante), visitante: paraEscalacao(p.escalacoes.visitante) });
}

/** Segundos de jogo agora, para uma Partida ao vivo. */
export const tempoAoVivo = (apito: string, fim = DURACAO_JOGO, agora = Date.now()) => Math.min(fim, ((agora - Date.parse(apito)) / 1000) * VELOCIDADE_AO_VIVO);

export function transmitir(
  raiz: HTMLElement,
  p: PartidaPublica,
  timeline: Timeline,
  o: { aoVivo: boolean; aoMudar?: ((t: number) => void) | undefined; aoAcabar?: (() => void) | undefined },
): Transmissao & { irPara(t: number): void } {
  const canvas = raiz.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const botao = raiz.querySelector<HTMLButtonElement>('[data-acao="tocar"]');
  const barra = raiz.querySelector<HTMLInputElement>('input[type="range"]');
  const velocidades = [...raiz.querySelectorAll<HTMLButtonElement>('[data-velocidade]')];
  const nomes: Record<Lado, (string | null)[]> = { mandante: nomesDe(p.escalacoes!.mandante), visitante: nomesDe(p.escalacoes!.visitante) };
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FIM = timeline.duracao;
  let t = o.aoVivo ? tempoAoVivo(p.apito, FIM) : 0;
  let tocando = o.aoVivo || !reduzido;
  let velocidade = VELOCIDADE_AO_VIVO;
  let ultimo = performance.now();
  let quadroId = 0;
  let acabou = false;

  const marcar = () => {
    botao?.setAttribute('aria-pressed', String(tocando));
    if (botao) botao.textContent = tocando ? 'Pausar' : t >= FIM ? 'Ver de novo' : 'Tocar';
  };

  function quadro(agora: number): void {
    const dt = (agora - ultimo) / 1000;
    ultimo = agora;
    if (o.aoVivo) t = tempoAoVivo(p.apito, FIM);
    else if (tocando) t = Math.min(FIM, t + dt * velocidade);
    if (t >= FIM && tocando && !o.aoVivo) {
      tocando = false;
      marcar();
    }
    desenharQuadro(ctx, timeline.estado(t), { times: timeline.resultado.times, nomes });
    if (barra) barra.value = String(Math.round(t));
    o.aoMudar?.(t);
    if (t >= FIM && !acabou) {
      acabou = true;
      o.aoAcabar?.();
    }
    quadroId = requestAnimationFrame(quadro);
  }

  botao?.addEventListener('click', () => {
    if (!tocando && t >= FIM) {
      t = 0;
      acabou = false;
    }
    tocando = !tocando;
    ultimo = performance.now();
    marcar();
  });
  barra?.addEventListener('input', () => {
    t = Number(barra.value);
    acabou = t >= FIM;
  });
  for (const b of velocidades) {
    b.addEventListener('click', () => {
      velocidade = Number(b.dataset.velocidade);
      for (const outro of velocidades) outro.setAttribute('aria-pressed', String(outro === b));
    });
  }
  if (barra) barra.max = String(FIM);
  marcar();
  void document.fonts.ready.then(() => (quadroId = requestAnimationFrame(quadro)));

  return {
    parar: () => cancelAnimationFrame(quadroId),
    irPara(novo: number) {
      if (o.aoVivo) return;
      t = novo;
      acabou = false;
      tocando = true;
      ultimo = performance.now();
      marcar();
    },
  };
}
