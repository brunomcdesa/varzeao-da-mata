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
  // Juiz (ADR-0041): de frente, com o braço direito levantado (apito ou cartão na mão).
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

export function sprite(pose: Pose, v: Visual): HTMLCanvasElement | OffscreenCanvas {
  const k = `${pose}|${v.camisa}|${v.detalhe}|${v.calcao}|${v.meiao}|${v.pele}|${v.cabelo}|${v.penteado ?? ''}`;
  const pronto = cache.get(k);
  if (pronto) return pronto;
  const grade = comPenteado(POSES[pose], v.penteado, pose);
  const c = novoCanvas(LARGURA_SPRITE, ALTURA_SPRITE);
  const g = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const cores: Record<string, string> = {
    K: CONTORNO, H: v.cabelo, S: v.pele, C: v.camisa, c: v.detalhe, B: v.calcao, M: v.meiao, L: v.detalhe,
  };
  grade.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const cor = cores[linha[x]!];
      if (!cor) continue;
      g.fillStyle = cor;
      g.fillRect(x, y, 1, 1);
    }
  });
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
