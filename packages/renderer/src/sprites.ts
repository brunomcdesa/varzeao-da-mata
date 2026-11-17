/**
 * Bonecos em pixel art (12×16), desenhados a partir de grades de texto e pintados com as
 * cores do Time. Cada pose vira um canvas pequeno, guardado em cache, e é ampliado sem
 * suavização para manter o pixel nítido.
 *
 * Legenda: . vazio · K contorno · H cabelo · S pele · C camisa · c detalhe da camisa
 *          B calção · M meião · L luva/mão do goleiro (cor da camisa)
 */
import { CABELOS, PELES, type Aparencia, type Penteado } from '@liga/shared';
import type { AcaoJogador } from './jogada.js';
import { contraste } from './pixel.js';

export type Direcao = 'FRENTE' | 'COSTAS' | 'LADO';
export type Pose =
  | 'FRENTE_PARADO' | 'FRENTE_CORRE_A' | 'FRENTE_CORRE_B' | 'FRENTE_COMEMORA'
  | 'COSTAS_PARADO' | 'COSTAS_CORRE_A' | 'COSTAS_CORRE_B'
  | 'LADO_PARADO' | 'LADO_CORRE_A' | 'LADO_CORRE_B' | 'LADO_CHUTE'
  | 'MERGULHO'
  | 'FRENTE_APITO';

const CABECA_FRENTE = [
  '....KKKK....',
  '...KHHHHK...',
  '..KHHHHHHK..',
  '..KHSSSSHK..',
  '..KSKSSKSK..',
  '..KSSSSSSK..',
  '...KSSSSK...',
];
const CABECA_COSTAS = [
  '....KKKK....',
  '...KHHHHK...',
  '..KHHHHHHK..',
  '..KHHHHHHK..',
  '..KHHHHHHK..',
  '..KSHHHHSK..',
  '...KSSSSK...',
];
const CORPO_FRENTE = [
  '..KCCCCCCK..',
  '.KCCCccCCCK.',
  '.KSCCccCCSK.',
  '.KSKCCCCKSK.',
  '..KKBBBBKK..',
  '...KBBBBK...',
];
const CORPO_COSTAS = [
  '..KCCCCCCK..',
  '.KCCccccCCK.',
  '.KSCccccCSK.',
  '.KSKCCCCKSK.',
  '..KKBBBBKK..',
  '...KBBBBK...',
];
const PERNAS_PARADO = ['...KMKKMK...', '...KMKKMK...', '...KKKKKK...'];
const PERNAS_CORRE_A = ['...KMKKMK...', '...KKKKMK...', '......KKK...'];
const PERNAS_CORRE_B = ['...KMKKMK...', '...KMKKKK...', '...KKK......'];

const LADO_CABECA = [
  '....KKKKK...',
  '...KHHHHHK..',
  '..KHHHHHHHK.',
  '..KHHHSSSSK.',
  '..KHHSSSKSK.',
  '..KHHSSSSSSK',
  '...KKSSSKK..',
];
const LADO_CORPO = [
  '...KCCCCK...',
  '...KCCCCK...',
  '...KCCSCK...',
  '...KCCSCK...',
  '...KBBBBK...',
  '...KBBBBK...',
];

const POSES: Record<Pose, string[]> = {
  FRENTE_PARADO: [...CABECA_FRENTE, ...CORPO_FRENTE, ...PERNAS_PARADO],
  FRENTE_CORRE_A: [...CABECA_FRENTE, ...CORPO_FRENTE, ...PERNAS_CORRE_A],
  FRENTE_CORRE_B: [...CABECA_FRENTE, ...CORPO_FRENTE, ...PERNAS_CORRE_B],
  FRENTE_COMEMORA: [
    '.S..KKKK..S.',
    '.SKKHHHHKKS.',
    '.CKHHHHHHKC.',
    '.CKHSSSSHKC.',
    '.CKSKSSKSKC.',
    '.CKSSKKSSKC.',
    '.KKKSSSSKKK.',
    '..KCCCCCCK..',
    '..KCCccCCK..',
    '..KCCccCCK..',
    '..KCCCCCCK..',
    '..KKBBBBKK..',
    '...KBBBBK...',
    ...PERNAS_PARADO,
  ],
  COSTAS_PARADO: [...CABECA_COSTAS, ...CORPO_COSTAS, ...PERNAS_PARADO],
  COSTAS_CORRE_A: [...CABECA_COSTAS, ...CORPO_COSTAS, ...PERNAS_CORRE_A],
  COSTAS_CORRE_B: [...CABECA_COSTAS, ...CORPO_COSTAS, ...PERNAS_CORRE_B],
  LADO_PARADO: [...LADO_CABECA, ...LADO_CORPO, '....KMMK....', '....KMMK....', '....KKKKK...'],
  LADO_CORRE_A: [...LADO_CABECA, ...LADO_CORPO, '...KMKKMK...', '..KMK..KMK..', '.KKK....KKKK'],
  LADO_CORRE_B: [...LADO_CABECA, ...LADO_CORPO, '....KMMK....', '....KMKK....', '....KKKKK...'],
  LADO_CHUTE: [
    ...LADO_CABECA,
    '...KCCCCK...',
    '..KSCCCCK...',
    '..KSCCCCK...',
    '...KCCCCK...',
    '...KBBBBKK..',
    '...KBBKKMMK.',
    '...KMK..KKKK',
    '..KMK.......',
    '.KKK........',
  ],
  // Juiz (ADR-0054): de frente, com o braço direito levantado (apito ou cartão na mão).
  FRENTE_APITO: [
    '....KKKK..S.',
    '...KHHHHKKS.',
    '..KHHHHHHKC.',
    '..KHSSSSHKC.',
    '..KSKSSKSKC.',
    '..KSSSSSSKC.',
    '...KSSSSKKK.',
    '..KCCCCCCK..',
    '.KCCCccCCK..',
    '.KSCCccCCK..',
    '.KSKCCCCKK..',
    '..KKBBBBKK..',
    '...KBBBBK...',
    ...PERNAS_PARADO,
  ],
  // Goleiro esticado no ar, de lado (para a direita).
  MERGULHO: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.........KK.',
    '..KKKK..KHHK',
    '.KMKBBKKCKHK',
    'KMMKBBBCCSSK',
    'KKKKBBBCCSKK',
    '.KMKBBKCCCLL',
    '..KK.KKKKKLL',
    '..........K.',
    '............',
    '............',
  ],
};

export const LARGURA_SPRITE = 12;
export const ALTURA_SPRITE = 16;


export interface Visual {
  camisa: string;
  detalhe: string;
  calcao: string;
  meiao: string;
  pele: string;
  cabelo: string;
  penteado?: Penteado;
  /** Número da camisa escolhido pelo dono (1 a 99): só aparece de costas. Sem ele, camisa lisa. */
  numero?: number | null;
}


/** Aparências escolhidas pelos donos, pelo @ (sem @, minúsculo). Sem escolha, vale o sorteio. */
const escolhidas = new Map<string, Aparencia>();
const chaveDoNome = (nome: string) => nome.replace(/^@/, '').toLowerCase();
export function definirAparencias(lista: Record<string, Aparencia>): void {
  for (const [nome, a] of Object.entries(lista)) escolhidas.set(chaveDoNome(nome), a);
}

/** Pele e cabelo do Jogador: os que o dono escolheu, ou os sorteados pelo @ (sempre os mesmos). */
export function aparencia(nome: string): Aparencia {
  const escolhida = escolhidas.get(chaveDoNome(nome));
  if (escolhida) return escolhida;
  let h = 2166136261;
  for (let i = 0; i < nome.length; i++) h = Math.imul(h ^ nome.charCodeAt(i), 16777619);
  h >>>= 0;
  return { pele: PELES[h % PELES.length]!, cabelo: CABELOS[(h >>> 8) % 7]! };
}

/** Troca o cabelo da grade: careca (H vira pele), moicano (só o meio), black (cabelo mais largo). */
function comPenteado(grade: string[], penteado: Penteado | undefined, pose: Pose): string[] {
  if (!penteado || penteado === 'CURTO' || pose === 'MERGULHO') return grade;
  if (penteado === 'CARECA') return grade.map((l) => l.replace(/H/g, 'S'));
  if (penteado === 'MOICANO') return grade.map((l) => [...l].map((c, x) => (c === 'H' && (x < 5 || x > 6) ? 'S' : c)).join(''));
  // BLACK: as três primeiras linhas da cabeça ganham uma coluna de cabelo de cada lado.
  return grade.map((l, y) => {
    if (y > 2) return l;
    const a = l.indexOf('K');
    const b = l.lastIndexOf('K');
    if (a < 1 || b > l.length - 2 || l[a - 1] !== '.' || l[b + 1] !== '.') return l;
    const c = [...l];
    c[a - 1] = 'K';
    c[b + 1] = 'K';
    // Na linha de cima só o contorno cresce; nas outras, o cabelo também.
    if (y > 0) {
      c[a] = 'H';
      c[b] = 'H';
    }
    return c.join('');
  });
}

const CONTORNO = '#15110E';
const cache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function novoCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Algarismos 3×5 do número da camisa (1 = ponto aceso), em meio pixel do boneco. */
export const ALGARISMOS: Readonly<Record<string, readonly string[]>> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

/** Abaixo disso a segunda cor some em cima da camisa, e o número sai em branco ou escuro. */
const CONTRASTE_MINIMO_DO_NUMERO = 90;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Cor do número: a segunda cor do uniforme, ou branco/escuro se ela se confunde com a camisa. */
export function corDoNumero(camisa: string, detalhe: string): string {
  const d = Math.hypot(...rgb(camisa).map((v, i) => v - rgb(detalhe)[i]!));
  return d >= CONTRASTE_MINIMO_DO_NUMERO ? detalhe : contraste(camisa);
}

/** O número só vai nas costas, e só se o dono escolheu um válido (1 a 99). */
export function numeroNasCostas(pose: Pose, numero: number | null | undefined): number | null {
  if (!pose.startsWith('COSTAS_') || numero == null) return null;
  return Number.isInteger(numero) && numero >= 1 && numero <= 99 ? numero : null;
}

/** Com número nas costas, o boneco vem espelhado do sprite() e o número continua legível. */
export function espelharNoSprite(pose: Pose, numero: number | null | undefined, espelhar: boolean): boolean {
  return espelhar && numeroNasCostas(pose, numero) !== null;
}

/**
 * Pontos acesos do número, em meio pixel do boneco (grade 24×32): centrado nas costas,
 * nas linhas 7 a 9 do boneco, onde fica a faixa de detalhe da camisa lisa.
 */
export function pontosDoNumero(numero: number): { x: number; y: number }[] {
  const texto = String(numero);
  const largura = texto.length * 4 - 1;
  const x0 = LARGURA_SPRITE - Math.ceil(largura / 2);
  const y0 = 15;
  const pontos: { x: number; y: number }[] = [];
  [...texto].forEach((a, i) =>
    ALGARISMOS[a]!.forEach((linha, y) => {
      for (let x = 0; x < 3; x++) if (linha[x] === '1') pontos.push({ x: x0 + i * 4 + x, y: y0 + y });
    }),
  );
  return pontos;
}

/**
 * `espelhado` vira o boneco já no desenho, para quem corre para a esquerda sem inverter o
 * número (quem desenha não espelha o canvas nesse caso; veja precisaEspelharNoDesenho).
 */
export function sprite(pose: Pose, v: Visual, espelhado = false): HTMLCanvasElement | OffscreenCanvas {
  const numero = numeroNasCostas(pose, v.numero);
  const k = `${pose}|${v.camisa}|${v.detalhe}|${v.calcao}|${v.meiao}|${v.pele}|${v.cabelo}|${v.penteado ?? ''}|${numero ?? ''}|${espelhado ? 'E' : ''}`;
  const pronto = cache.get(k);
  if (pronto) return pronto;
  let grade = comPenteado(POSES[pose], v.penteado, pose);
  if (espelhado) grade = grade.map((l) => [...l].reverse().join(''));
  // Com número, a faixa de detalhe das costas sai e o boneco é pintado em dobro (meio pixel
  // para o número caber). Quem desenha sempre passa o tamanho final, então nada mais muda.
  const passo = numero === null ? 1 : 2;
  if (numero !== null) grade = grade.map((l) => l.replace(/c/g, 'C'));
  const c = novoCanvas(LARGURA_SPRITE * passo, ALTURA_SPRITE * passo);
  const g = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const cores: Record<string, string> = {
    K: CONTORNO, H: v.cabelo, S: v.pele, C: v.camisa, c: v.detalhe, B: v.calcao, M: v.meiao, L: v.detalhe,
  };
  grade.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const cor = cores[linha[x]!];
      if (!cor) continue;
      g.fillStyle = cor;
      g.fillRect(x * passo, y * passo, passo, passo);
    }
  });
  if (numero !== null) {
    g.fillStyle = corDoNumero(v.camisa, v.detalhe);
    for (const p of pontosDoNumero(numero)) g.fillRect(p.x, p.y, 1, 1);
  }
  cache.set(k, c);
  return c;
}

/**
 * Escolhe pose, direção e espelhamento a partir do movimento e da ação do Jogador.
 * `fase` alterna os quadros da corrida.
 */
export function escolherPose(acao: AcaoJogador, vel: { x: number; y: number }, olhar: { x: number; y: number }, fase: number): { pose: Pose; espelhar: boolean; pulo: number } {
  const andando = Math.hypot(vel.x, vel.y) > 0.0016;
  const ref = andando ? vel : olhar;
  const lateral = Math.abs(ref.x) > Math.abs(ref.y) * 1.1;
  const direcao: Direcao = lateral ? 'LADO' : ref.y < 0 ? 'COSTAS' : 'FRENTE';
  const espelhar = ref.x < 0;

  switch (acao) {
    case 'COMEMORANDO':
      return { pose: 'FRENTE_COMEMORA', espelhar: false, pulo: fase % 2 === 0 ? 3 : 0 };
    case 'ARREMESSO':
      // Lateral: as duas mãos para cima, segurando a bola.
      return { pose: 'FRENTE_COMEMORA', espelhar: false, pulo: 0 };
    case 'MERGULHO':
    case 'CARRINHO':
      return { pose: 'MERGULHO', espelhar, pulo: acao === 'MERGULHO' ? 2 : 0 };
    case 'CHUTE':
    case 'PASSE':
      return { pose: 'LADO_CHUTE', espelhar, pulo: 0 };
    case 'CABECEIO':
      return { pose: direcao === 'COSTAS' ? 'COSTAS_PARADO' : direcao === 'LADO' ? 'LADO_PARADO' : 'FRENTE_PARADO', espelhar, pulo: 4 };
    default: {
      if (!andando) return { pose: `${direcao}_PARADO` as Pose, espelhar, pulo: 0 };
      const quadro = fase % 4;
      const sufixo = quadro === 0 ? 'CORRE_A' : quadro === 2 ? 'CORRE_B' : 'PARADO';
      return { pose: `${direcao}_${sufixo}` as Pose, espelhar, pulo: quadro % 2 === 1 ? 1 : 0 };
    }
  }
}

/** Pixel (coluna, linha) da mão levantada na pose FRENTE_APITO: onde o cartão aparece. */
export const MAO_DO_APITO = { x: 10, y: 0 } as const;

export const TODAS_AS_POSES = Object.keys(POSES) as Pose[];
