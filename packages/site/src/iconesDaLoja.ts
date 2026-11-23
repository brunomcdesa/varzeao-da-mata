/**
 * Ícones das peças da Loja (ADR-0101), em pixel como o resto do jogo. Peças de cor (chuteira,
 * munhequeira, faixa e luva) têm um desenho próprio na cor do Item; penteado e barba mostram a
 * cabeça do próprio boneco com a peça; a comemoração mostra o boneco no meio dela.
 */
import { ITEM_POR_CODIGO, type Item } from '@liga/shared';
import { quadroDaComemoracao, sprite, type Visual } from '@liga/renderer';

const CONTORNO = '#20140b';

/** K contorno, P cor do Item, L brilho da cor, W branco, . vazio. */
const DESENHOS: Record<string, string[]> = {
  CHUTEIRA: [
    '..KKKK......',
    '..KPPPKK....',
    '..KPLPPPKK..',
    '.KPPPPPPPPK.',
    'KPPPPPPPPPPK',
    'KKKKKKKKKKKK',
    '.K..K..K..K.',
  ],
  MUNHEQUEIRA: [
    '.KKKKKKKKKK.',
    'KPPPPPPPPPPK',
    'KPLLPPPPLLPK',
    'KPPPWWWWPPPK',
    'KPPPPPPPPPPK',
    '.KKKKKKKKKK.',
  ],
  FAIXA: [
    '..KKKKKKKK..',
    '.KPPLLPPPPK.',
    'KPKKKKKKKKPK',
    'KPK......KPK',
    'KPKKKKKKKKPK',
    '.KPPPPPPPPKK',
    '..KKKKKKKKPK',
    '.........KK.',
  ],
  LUVA: [
    '..K.K.K.K...',
    '.KPKPKPKPK..',
    '.KPKPKPKPK..',
    '.KPPPPPPPKK.',
    '.KPLPPPPPPPK',
    '.KPPPPPPPKK.',
    '..KWWWWWK...',
    '..KKKKKKK...',
  ],
};

/** Clareia a cor do Item para o brilho do desenho. */
function clarear(hex: string, k = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `rgb(${c.join(',')})`;
}

function desenharGrade(ctx: CanvasRenderingContext2D, grade: string[], cor: string, w: number, h: number): void {
  const px = Math.floor(Math.min(w / grade[0]!.length, h / grade.length));
  const x0 = Math.floor((w - grade[0]!.length * px) / 2);
  const y0 = Math.floor((h - grade.length * px) / 2);
  const cores: Record<string, string> = { K: CONTORNO, P: cor, L: clarear(cor), W: '#f3e6c9' };
  grade.forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      const f = cores[c];
      if (!f) return;
      ctx.fillStyle = f;
      ctx.fillRect(x0 + x * px, y0 + y * px, px, px);
    }),
  );
}

/** Momento da comemoração que melhor a resume parada. */
const PARADA: Record<string, number> = { AVIAOZINHO: 0.12, MORTAL: 0.45, JOELHADA: 0.6, DANCINHA: 0.2 };

/** Desenha o ícone de uma peça. `base` é o boneco do dono (ou o de exemplo). */
export function desenharIcone(canvas: HTMLCanvasElement, item: Item, base: Visual): void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { width: w, height: h } = canvas;
  const grade = DESENHOS[item.encaixe];
  if (grade) return desenharGrade(ctx, grade, item.cor, w, h);
  if (item.encaixe === 'COMEMORACAO') {
    const q = quadroDaComemoracao(item.estilo as never, PARADA[item.estilo!] ?? 0.5);
    const img = sprite(q.pose, base) as CanvasImageSource;
    const esc = Math.floor(h / 16);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    if (q.angulo) ctx.rotate(q.angulo);
    if (q.espelhar) ctx.scale(-1, 1);
    ctx.drawImage(img, -6 * esc, -8 * esc, 12 * esc, 16 * esc);
    ctx.restore();
    return;
  }
  // Penteado e barba: só a cabeça do boneco (as 7 primeiras linhas), de frente e bem grande.
  const v: Visual = { ...base, numero: null, ...(item.encaixe === 'CORTE' ? { corte: item.estilo as NonNullable<Visual['corte']> } : { barba: item.estilo as NonNullable<Visual['barba']> }) };
  const img = sprite('FRENTE_PARADO', v) as CanvasImageSource;
  const esc = Math.floor(Math.min(h / 7, w / 12));
  ctx.drawImage(img, 0, 0, 12, 7, Math.floor((w - 12 * esc) / 2), Math.floor((h - 7 * esc) / 2), 12 * esc, 7 * esc);
}

/** Desenha todos os ícones de peça dentro de `raiz`. */
export function desenharIcones(raiz: ParentNode, base: Visual): void {
  for (const c of raiz.querySelectorAll<HTMLCanvasElement>('canvas[data-icone]')) {
    const item = ITEM_POR_CODIGO.get(c.dataset.icone ?? '');
    if (item) desenharIcone(c, item, base);
  }
}
