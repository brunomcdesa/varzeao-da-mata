/**
 * Técnico à beira do campo (ADR-0111): a área técnica de cada Time, perto do meio de campo, na
 * lateral da Arquibancada (mandante à esquerda, visitante à direita), com o Banco de madeira e o
 * boneco do Técnico. Ele vibra no gol a favor, põe as mãos na cabeça no gol sofrido e reclama nos
 * cartões contra o Time. Sem Técnico, a área fica vazia. O boneco usa a aparência do dono (como
 * a de um Jogador) e os Itens da Loja do Técnico congelados na Escalação.
 */
import { IDENTIDADE, ITEM_POR_CODIGO, type ItensEquipados, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';
import { CAMPO } from './cenario.js';
import { COLUNAS, COR, type Pincel } from './pixel.js';
import { aparencia, ALTURA_SPRITE, LARGURA_SPRITE } from './sprites.js';
import type { EstadoQuadro } from './timeline.js';

export type GestoDoTecnico = 'PARADO' | 'VIBRA' | 'MAOS_NA_CABECA' | 'RECLAMA';

/** O Técnico de um lado, como a Escalação guardou. */
export interface TecnicoNoJogo {
  /** O @ do dono (a aparência sai dele, como a de um Jogador). */
  nome: string;
  itens?: ItensEquipados | null;
}

const CABECA = [
  '....KKKK....',
  '...KHHHHK...',
  '..KHHHHHHK..',
  '..KHSSSSHK..',
  '..KSKSSKSK..',
  '..KSSSSSSK..',
  '...KSSSSK...',
];
const PERNAS = ['...KBKKBK...', '...KBKKBK...', '...KKKKKK...'];

/** Grades 12 × 16, como as dos Jogadores: C jaqueta, c zíper, B calça. */
export const GRADES_DO_TECNICO: Record<GestoDoTecnico, readonly string[]> = {
  PARADO: [...CABECA, '..KCCCCCCK..', '.KCCCccCCCK.', '.KCKCccCKCK.', '.KSKCccCKSK.', '..KBBBBBBK..', '...KBBBBK...', ...PERNAS],
  VIBRA: [
    '.S..KKKK..S.',
    '.CKKHHHHKKC.',
    '.CKHHHHHHKC.',
    '.CKHSSSSHKC.',
    '.CKSKSSKSKC.',
    '.CKSSKKSSKC.',
    '.KKKSSSSKKK.',
    '..KCCCCCCK..',
    '..KCCccCCK..',
    '..KCCccCCK..',
    '..KCCccCCK..',
    '..KBBBBBBK..',
    '...KBBBBK...',
    ...PERNAS,
  ],
  // Mãos em cima da cabeça e cotovelos para fora (o losango dos braços).
  MAOS_NA_CABECA: [
    '....KKKK....',
    '..SSHHHHSS..',
    '.CKHHHHHHKC.',
    'C.KHSSSSHK.C',
    '.CKSKSSKSKC.',
    '.CKSSKKSSKC.',
    '.CKKSSSSKKC.',
    '..KCCCCCCK..',
    '..KCCccCCK..',
    '..KCCccCCK..',
    '..KCCccCCK..',
    '..KBBBBBBK..',
    '...KBBBBK...',
    ...PERNAS,
  ],
  RECLAMA: [
    '....KKKK..S.',
    '...KHHHHK.C.',
    '..KHHHHHHKC.',
    '..KHSSSSHKC.',
    '..KSKSSKSKC.',
    '..KSSKKSSKC.',
    '...KSSSSKKK.',
    '..KCCCCCCK..',
    '.KCCCccCCK..',
    '.KCKCccCCK..',
    '.KSKCccCKK..',
    '..KBBBBBBK..',
    '...KBBBBK...',
    ...PERNAS,
  ],
};

/** Linha da cabeça com os olhos (o "KSSK" do rosto) e a de cima do rosto, em cada gesto. */
const OLHOS: Record<GestoDoTecnico, number> = { PARADO: 4, VIBRA: 4, MAOS_NA_CABECA: 4, RECLAMA: 4 };

/** O que cada Item muda na grade (ADR-0111). */
export function vestirTecnico(grade: readonly string[], gesto: GestoDoTecnico, itens: ItensEquipados | null | undefined): string[] {
  const g = grade.map((l) => [...l]);
  const tem = (e: keyof ItensEquipados) => {
    const item = ITEM_POR_CODIGO.get(itens?.[e] ?? '');
    return !!item && item.encaixe === e;
  };
  const olhos = OLHOS[gesto];
  if (tem('BONE')) {
    // Copa do boné por cima do cabelo e aba na testa (a linha de cima do rosto).
    for (let y = 0; y < olhos - 1; y++) for (let x = 0; x < 12; x++) if (g[y]![x] === 'H') g[y]![x] = 'N';
    for (let x = 3; x <= 8; x++) if (g[olhos - 1]![x] === 'H' || g[olhos - 1]![x] === 'S') g[olhos - 1]![x] = 'n';
  }
  if (tem('OCULOS')) {
    const l = g[olhos]!;
    for (const x of [3, 4, 7, 8]) if (l[x] === 'S' || l[x] === 'K') l[x] = 'O';
    for (const x of [5, 6]) if (l[x] === 'S') l[x] = 'K';
  }
  if (tem('ROUPA')) {
    // Terno: a gola da camisa branca e a gravata no lugar do zíper.
    for (let x = 5; x <= 6; x++) if (g[7]![x] === 'C') g[7]![x] = 't';
    for (let y = 8; y <= 10; y++) for (let x = 0; x < 12; x++) if (g[y]![x] === 'c') g[y]![x] = 'g';
  }
  if (tem('APITO')) {
    // Cordão no peito e o apito pendurado.
    if (g[7]![4] === 'C') g[7]![4] = 'a';
    if (g[7]![7] === 'C') g[7]![7] = 'a';
    if (g[8]![4] === 'C') g[8]![4] = 'a';
    if (g[9]![4] !== undefined && g[9]![4] !== '.') g[9]![4] = 'A';
  }
  if (tem('PRANCHETA') && (gesto === 'PARADO' || gesto === 'RECLAMA')) {
    // Na mão esquerda (a da direita da tela), encostada no corpo.
    const placa = ['KKKK', 'KqqK', 'KqqK', 'KQQK', 'KKKK'];
    placa.forEach((l, k) => [...l].forEach((c, i) => (g[8 + k]![gesto === 'RECLAMA' ? i : 8 + i] = c)));
  }
  return g.map((l) => l.join(''));
}

/** O gesto do Técnico agora, pelo destaque da Partida. */
export function gestoDoTecnico(e: Pick<EstadoQuadro, 'destaque'>, lado: Lado): GestoDoTecnico {
  const d = e.destaque;
  if (!d || d.progresso > 0.9) return 'PARADO';
  if (d.tipo === 'GOL') return d.lado === lado ? 'VIBRA' : 'MAOS_NA_CABECA';
  // Cartão contra o Time: quem leva o cartão é o protagonista da falta.
  if (d.tipo === 'FALTA' && d.cartao && d.protagonista.lado === lado) return 'RECLAMA';
  return 'PARADO';
}

const escurecer = (hex: string, f: number) => {
  const v = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((v >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

/** As cores do boneco: o agasalho do Time, ou o Terno; a pele e o cabelo do dono. */
export function coresDoTecnico(time: TimeId, nome: string, itens: ItensEquipados | null | undefined): Record<string, string> {
  const id = IDENTIDADE[time];
  const a = aparencia(nome);
  const terno = ITEM_POR_CODIGO.get(itens?.ROUPA ?? '')?.encaixe === 'ROUPA';
  return {
    K: '#15110E',
    H: a.cabelo,
    S: a.pele,
    C: terno ? '#2B2F3A' : id.primaria,
    c: id.secundaria,
    B: terno ? '#22252E' : escurecer(id.primaria, 0.55),
    N: id.primaria,
    n: escurecer(id.primaria, 0.6),
    O: '#101010',
    t: '#F2F2EE',
    g: id.secundaria,
    a: '#E9E2CF',
    A: '#C8CCD2',
    Q: '#A0703C',
    q: '#F2F2EE',
  };
}

/** Largura da área técnica (a da Arquibancada) e o pedaço que ela ocupa da lateral. */
const LARGURA = CAMPO.x;
/** Logo abaixo da faixa do Time (que vai de meio - 22 a meio + 22), com folga. */
const TOPO = CAMPO.y + CAMPO.h / 2 + 28;
const ALTURA = 40;

/** Desenha a área técnica e, se o Time tiver, o Técnico. `tecnicos` ausente: Partida antes da T3. */
export function desenharTecnicos(
  pin: Pincel,
  e: EstadoQuadro,
  times: Record<Lado, TimeId>,
  tecnicos: Partial<Record<Lado, TecnicoNoJogo>> | undefined,
  escala: number,
): void {
  if (!tecnicos || !e.t2) return;
  for (const lado of ['mandante', 'visitante'] as const) {
    const x0 = lado === 'mandante' ? 0 : COLUNAS - LARGURA;
    const fora = lado === 'mandante' ? x0 : x0 + LARGURA - 5;
    // Chão de terra batida, o Banco de madeira encostado na mata e a cal do limite.
    pin.r(x0, TOPO, LARGURA, ALTURA, COR.terrao);
    for (let k = 0; k < ALTURA; k += 3) pin.r(x0 + ((k * 7) % LARGURA), TOPO + k, 1, 1, COR.terraoEscuro);
    pin.r(fora, TOPO + 4, 5, ALTURA - 8, COR.madeiraEscura);
    pin.r(lado === 'mandante' ? fora : fora + 1, TOPO + 4, 4, ALTURA - 9, COR.madeira);
    pin.r(fora, TOPO + 4, 5, 1, COR.madeiraLuz);
    pin.r(x0, TOPO, LARGURA, 1, COR.contorno);
    pin.r(x0, TOPO + ALTURA - 1, LARGURA, 1, COR.contorno);
    const t = tecnicos[lado];
    if (!t) continue;
    const gesto = gestoDoTecnico(e, lado);
    // Vibra pulando; reclama trocando de braço.
    const pulo = gesto === 'VIBRA' ? Math.round(Math.abs(Math.sin(e.t * 1.6)) * 3) : 0;
    const espelhar = gesto === 'RECLAMA' ? Math.floor(e.t * 0.9) % 2 === 1 : lado === 'visitante';
    const grade = vestirTecnico(GRADES_DO_TECNICO[gesto], gesto, t.itens);
    const cores = coresDoTecnico(times[lado], t.nome, t.itens);
    const s = escala;
    const cx = lado === 'mandante' ? x0 + LARGURA - 8 : x0 + 8;
    const pe = TOPO + ALTURA - 8;
    const xi = cx - (LARGURA_SPRITE / 2) * s;
    const yi = pe - ALTURA_SPRITE * s - pulo;
    pin.r(cx - 5, pe - 1, 10, 2, 'rgba(0,0,0,0.28)');
    // Como os Jogadores: 1 pixel do boneco = `escala` pixels lógicos, alinhado em px reais.
    const real = pin.px * s;
    const ox = Math.round(xi * pin.px);
    const oy = Math.round(yi * pin.px);
    grade.forEach((linha, y) => {
      for (let x = 0; x < linha.length; x++) {
        const cor = cores[linha[x]!];
        if (!cor) continue;
        const xx = espelhar ? LARGURA_SPRITE - 1 - x : x;
        pin.ctx.fillStyle = cor;
        const a0 = ox + Math.round(xx * real);
        const b0 = oy + Math.round(y * real);
        pin.ctx.fillRect(a0, b0, ox + Math.round((xx + 1) * real) - a0, oy + Math.round((y + 1) * real) - b0);
      }
    });
  }
}

/** O boneco do Técnico num canvas 12 × 16 (a Loja do site usa de prévia). */
export function spriteDoTecnico(gesto: GestoDoTecnico, time: TimeId, nome: string, itens: ItensEquipados | null | undefined): HTMLCanvasElement | OffscreenCanvas {
  const c: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(LARGURA_SPRITE, ALTURA_SPRITE) : Object.assign(document.createElement('canvas'), { width: LARGURA_SPRITE, height: ALTURA_SPRITE });
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const cores = coresDoTecnico(time, nome, itens);
  vestirTecnico(GRADES_DO_TECNICO[gesto], gesto, itens).forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const cor = cores[linha[x]!];
      if (!cor) continue;
      g.fillStyle = cor;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}
