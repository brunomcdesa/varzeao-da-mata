/**
 * Cenário fixo: campo de várzea (grama gasta, terrão nas áreas e no meio, cal das linhas,
 * traves com rede) cercado pela mata. É desenhado uma vez na grade lógica e reaproveitado.
 */
import { COLUNAS, COR, LINHAS, ruido } from './pixel.js';

/** Retângulo do campo na grade lógica. */
export const CAMPO = { x: 18, y: 62, w: 234, h: 400 } as const;

let cache: HTMLCanvasElement | OffscreenCanvas | null = null;

export function cenario(): HTMLCanvasElement | OffscreenCanvas {
  if (cache) return cache;
  const c: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(COLUNAS, LINHAS) : Object.assign(document.createElement('canvas'), { width: COLUNAS, height: LINHAS });
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const px = (x: number, y: number, cor: string) => {
    g.fillStyle = cor;
    g.fillRect(x, y, 1, 1);
  };
  const ret = (x: number, y: number, w: number, h: number, cor: string) => {
    g.fillStyle = cor;
    g.fillRect(x, y, w, h);
  };

  ret(0, 0, COLUNAS, LINHAS, COR.mata);

  // Mata: copas de árvore em volta do campo.
  const arvore = (cx: number, cy: number, raio: number, semente: number) => {
    for (let y = -raio; y <= raio; y++) {
      for (let x = -raio; x <= raio; x++) {
        const d = Math.hypot(x, y * 1.15) / raio;
        if (d > 1 - ruido(cx + x, cy + y, semente) * 0.18) continue;
        const luz = -x * 0.5 - y; // luz de cima à esquerda
        const cor = luz > raio * 0.55 ? COR.folha : luz > -raio * 0.1 ? COR.mataClara : COR.mataMedia;
        px(cx + x, cy + y, cor);
      }
    }
  };
  for (let i = 0; i < 70; i++) {
    const r = ruido(i, 1, 11);
    const lado = i % 4;
    const raio = 6 + Math.floor(ruido(i, 2, 11) * 7);
    if (lado === 0) arvore(Math.floor(r * COLUNAS), 50 + Math.floor(ruido(i, 3, 11) * 10), raio, i);
    else if (lado === 1) arvore(Math.floor(r * COLUNAS), 470 + Math.floor(ruido(i, 3, 11) * 10), raio, i);
    else if (lado === 2) arvore(4 + Math.floor(ruido(i, 4, 11) * 8), 60 + Math.floor(r * 410), raio, i);
    else arvore(COLUNAS - 4 - Math.floor(ruido(i, 4, 11) * 8), 60 + Math.floor(r * 410), raio, i);
  }

  const { x: X, y: Y, w: W, h: H } = CAMPO;

  // Grama cortada em faixas.
  for (let y = 0; y < H; y++) ret(X, Y + y, W, 1, Math.floor(y / 40) % 2 === 0 ? COR.grama : COR.gramaFaixa);

  // Terrão onde a bola mais passa: bocas do gol e círculo central.
  const terrao = (cx: number, cy: number, rx: number, ry: number, semente: number) => {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = Math.hypot(x / rx, y / ry);
        const n = ruido(cx + x, cy + y, semente);
        // miolo de terra batida com borda irregular, que se mistura com a grama
        const borda = 0.78 + (ruido(Math.floor((cx + x) / 3), Math.floor((cy + y) / 3), semente + 9) - 0.5) * 0.3;
        if (d < borda) px(cx + x, cy + y, n < 0.06 ? COR.terraoEscuro : COR.terrao);
        else if (d < borda + 0.12 && n < 0.35) px(cx + x, cy + y, COR.terrao);
      }
    }
  };
  terrao(X + W / 2, Y + 14, 34, 20, 1);
  terrao(X + W / 2, Y + H - 14, 34, 20, 2);
  terrao(X + W / 2, Y + H / 2, 26, 18, 3);
  // Tufos de grama mais escura espalhados.
  for (let i = 0; i < 260; i++) px(X + Math.floor(ruido(i, 9, 5) * W), Y + Math.floor(ruido(i, 8, 5) * H), COR.gramaFaixa);

  // Cal: linhas com pequenas falhas, como cal passada à mão.
  const cal = (x: number, y: number) => {
    if (ruido(x, y, 4) > 0.07) px(x, y, COR.cal);
  };
  const linhaH = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) cal(x, y);
  };
  const linhaV = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) cal(x, y);
  };
  linhaH(X, X + W - 1, Y);
  linhaH(X, X + W - 1, Y + H - 1);
  linhaV(X, Y, Y + H - 1);
  linhaV(X + W - 1, Y, Y + H - 1);
  linhaH(X, X + W - 1, Y + Math.floor(H / 2));
  const raio = Math.round(W * 0.14);
  for (let a = 0; a < 360; a += 0.6) cal(Math.round(X + W / 2 + Math.cos((a * Math.PI) / 180) * raio), Math.round(Y + H / 2 + Math.sin((a * Math.PI) / 180) * raio));
  ret(X + W / 2 - 1, Y + H / 2 - 1, 2, 2, COR.cal);
  for (const topo of [true, false]) {
    const aw = Math.round(W * 0.5);
    const ah = Math.round(H * 0.12);
    const pw = Math.round(W * 0.26);
    const ph = Math.round(H * 0.045);
    const ax = X + Math.round((W - aw) / 2);
    const px0 = X + Math.round((W - pw) / 2);
    const ay = topo ? Y : Y + H - 1 - ah;
    const py = topo ? Y : Y + H - 1 - ph;
    linhaV(ax, ay, ay + ah);
    linhaV(ax + aw, ay, ay + ah);
    linhaH(ax, ax + aw, topo ? ay + ah : ay);
    linhaV(px0, py, py + ph);
    linhaV(px0 + pw, py, py + ph);
    linhaH(px0, px0 + pw, topo ? py + ph : py);
    ret(X + W / 2 - 1, topo ? Y + Math.round(H * 0.085) : Y + H - 1 - Math.round(H * 0.085), 2, 1, COR.cal);

    // Trave com rede quadriculada, atrás da linha.
    const gw = Math.round(W * 0.24);
    const gx = X + Math.round((W - gw) / 2);
    const prof = 6;
    const gy = topo ? Y - prof : Y + H;
    for (let y = 0; y < prof; y++) for (let x = 0; x < gw; x++) px(gx + x, gy + y, (x + y) % 2 === 0 ? '#C9D3C4' : COR.mataMedia);
    ret(gx - 1, gy, 1, prof, '#FFFFFF');
    ret(gx + gw, gy, 1, prof, '#FFFFFF');
    ret(gx - 1, topo ? gy : gy + prof - 1, gw + 2, 1, '#FFFFFF');
  }
  // Bandeirinhas de escanteio.
  for (const [fx, fy] of [[X, Y], [X + W - 1, Y], [X, Y + H - 1], [X + W - 1, Y + H - 1]] as const) {
    ret(fx, fy - 6, 1, 6, COR.cal);
    ret(fx + (fx === X ? 1 : -3), fy - 6, 3, 2, COR.amarelo);
  }

  cache = c;
  return c;
}
