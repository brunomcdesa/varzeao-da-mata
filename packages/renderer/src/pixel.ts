/**
 * Ferramentas de desenho em pixel art. O quadro tem uma grade lógica de 270 colunas
 * (1 pixel lógico = 4 px no vídeo de 1080); tudo é desenhado em unidades dessa grade
 * para manter o pixel nítido em qualquer tamanho de canvas.
 */

export const COLUNAS = 270;
export const LINHAS = 480;

export const COR = {
  mata: '#132A1C',
  mataMedia: '#1C3D27',
  mataClara: '#2A5934',
  folha: '#3A7344',
  grama: '#4D8A35',
  gramaFaixa: '#467F30',
  terrao: '#A85D37',
  terraoEscuro: '#8C4A2B',
  cal: '#EFE8D6',
  madeira: '#7A4E2D',
  madeiraEscura: '#5C3920',
  madeiraLuz: '#956238',
  contorno: '#20140B',
  placa: '#F3E6C9',
  placaSombra: '#D9C7A2',
  tinta: '#24170E',
  amarelo: '#F2B705',
  corda: '#C9A46A',
} as const;

/** Ruído determinístico em [0, 1) para (x, y, semente). */
export function ruido(x: number, y: number, s = 0): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function contraste(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.58 ? COR.tinta : '#FFFFFF';
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class Pincel {
  /** Tamanho de 1 pixel lógico em px reais. */
  readonly px: number;

  constructor(readonly ctx: Ctx) {
    this.px = ctx.canvas.width / COLUNAS;
  }

  /** Retângulo em pixels lógicos, alinhado à grade. */
  r(x: number, y: number, w: number, h: number, cor: string): void {
    const p = this.px;
    const x0 = Math.round(x) * p;
    const y0 = Math.round(y) * p;
    this.ctx.fillStyle = cor;
    this.ctx.fillRect(x0, y0, Math.round(x + w) * p - x0, Math.round(y + h) * p - y0);
  }

  /**
   * Placa com cantos em degrau (nada de retângulo seco): contorno, preenchimento,
   * linha de luz em cima e de sombra embaixo.
   */
  placa(x: number, y: number, w: number, h: number, c: { fundo: string; luz?: string; sombra?: string; contorno?: string; degrau?: number }): void {
    const d = c.degrau ?? 2;
    const k = c.contorno ?? COR.contorno;
    // contorno com cantos cortados
    this.r(x + d, y, w - 2 * d, h, k);
    this.r(x, y + d, w, h - 2 * d, k);
    this.r(x + 1, y + 1, w - 2, h - 2, k);
    // miolo
    this.r(x + d, y + 1, w - 2 * d, h - 2, c.fundo);
    this.r(x + 1, y + d, w - 2, h - 2 * d, c.fundo);
    if (d > 1) this.r(x + 2, y + 2, w - 4, h - 4, c.fundo);
    if (c.luz) this.r(x + d, y + 1, w - 2 * d, 1, c.luz);
    if (c.sombra) this.r(x + d, y + h - 2, w - 2 * d, 1, c.sombra);
  }

  /** Tábua de madeira com veios. */
  tabua(x: number, y: number, w: number, h: number): void {
    this.placa(x, y, w, h, { fundo: COR.madeira, luz: COR.madeiraLuz, sombra: COR.madeiraEscura, degrau: 3 });
    for (let yy = y + 7; yy < y + h - 4; yy += 8) this.r(x + 3, yy, w - 6, 1, COR.madeiraEscura);
    for (let i = 0; i < w; i += 1) {
      if (ruido(x + i, y, 7) < 0.05) this.r(x + i, y + 3 + Math.floor(ruido(i, y, 3) * (h - 6)), 3, 1, COR.madeiraEscura);
    }
    for (const [nx, ny] of [[x + 4, y + 3], [x + w - 5, y + 3], [x + 4, y + h - 4], [x + w - 5, y + h - 4]] as const) this.r(nx, ny, 1, 1, COR.placaSombra);
  }

  /** Texto em pixels lógicos; `tamanho` é a altura da fonte na grade. */
  texto(
    txt: string,
    x: number,
    y: number,
    tamanho: number,
    familia: string,
    cor: string,
    o: { alinhar?: CanvasTextAlign; base?: CanvasTextBaseline; contorno?: string; peso?: number | string; espessura?: number } = {},
  ): number {
    const p = this.px;
    const c = this.ctx;
    c.font = `${o.peso ?? 400} ${tamanho * p}px ${familia}`;
    c.textAlign = o.alinhar ?? 'center';
    c.textBaseline = o.base ?? 'middle';
    const X = Math.round(x * p);
    const Y = Math.round(y * p);
    if (o.contorno) {
      // contorno "pixelado": o texto repetido nas 8 direções, 1 pixel lógico para fora
      const e = (o.espessura ?? 1) * p;
      c.fillStyle = o.contorno;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.fillText(txt, X + dx * e, Y + dy * e);
    }
    c.fillStyle = cor;
    c.fillText(txt, X, Y);
    return c.measureText(txt).width / p;
  }

  /** Maior tamanho (até `max`) em que o texto cabe em `largura` pixels lógicos. */
  caber(txt: string, largura: number, max: number, familia: string, peso: number | string = 400): number {
    this.ctx.font = `${peso} ${max * this.px}px ${familia}`;
    const w = this.ctx.measureText(txt).width / this.px;
    return w <= largura ? max : Math.floor((max * largura) / w);
  }
}
