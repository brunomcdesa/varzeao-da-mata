/**
 * Bonecos em pixel art (12×16), desenhados a partir de grades de texto e pintados com as
 * cores do Time. Cada pose vira um canvas pequeno, guardado em cache, e é ampliado sem
 * suavização para manter o pixel nítido.
 *
 * Legenda: . vazio · K contorno · H cabelo · S pele · C camisa · c detalhe da camisa
 *          B calção · M meião · L luva/mão do goleiro (cor da camisa)
 *          Itens da Loja (ADR-0101): P chuteira · W munhequeira · F faixa · G luva do goleiro
 */
import { CABELOS, PELES, coresDosItens, detalhesDosItens, estilosDosItens, type Aparencia, type BarbaDaLoja, type ComemoracaoDaLoja, type CorteDaLoja, type Encaixe, type ItensEquipados, type Penteado } from '@liga/shared';
import type { AcaoJogador } from './jogada.js';
import { contraste } from './pixel.js';

export type Direcao = 'FRENTE' | 'COSTAS' | 'LADO';
export type Pose =
  | 'FRENTE_PARADO' | 'FRENTE_CORRE_A' | 'FRENTE_CORRE_B' | 'FRENTE_COMEMORA'
  | 'COSTAS_PARADO' | 'COSTAS_CORRE_A' | 'COSTAS_CORRE_B'
  | 'LADO_PARADO' | 'LADO_CORRE_A' | 'LADO_CORRE_B' | 'LADO_CHUTE'
  | 'MERGULHO'
  | 'FRENTE_APITO'
  | 'FRENTE_AVIAO' | 'JOELHADA' | 'AGACHADO' | 'GRUPADO';

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
  // Comemoração de gol da Loja (segunda fase): o aviãozinho, de braços abertos.
  FRENTE_AVIAO: [
    ...CABECA_FRENTE,
    '..KCCCCCCK..',
    'KKCCCccCCCKK',
    'SCCCCccCCCCS',
    '.KKKCCCCKKK.',
    '..KKBBBBKK..',
    '...KBBBBK...',
    ...PERNAS_PARADO,
  ],
  // De joelhos, deslizando na grama: a comemoração sem as pernas, mais baixa.
  // Mortal: agachado para pular e cair, e grupado (joelhos no peito) no ar. A grade de verdade
  // sai do boneco de frente já vestido (ver `sprite`); estas só reservam o nome.
  AGACHADO: [],
  GRUPADO: [],
  JOELHADA: [
    '............',
    '............',
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
    '.KMMKBBKMMK.',
    '.KKKK..KKKK.',
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
  /** Cores dos Itens equipados (ADR-0101), já sem a Luva de quem não é goleiro. */
  itens?: Partial<Record<Encaixe, string>>;
  /** Segundas cores dos Itens (o centro da Faixa da Mata, ADR-0108). */
  detalhesDosItens?: Partial<Record<Encaixe, string>>;
  /** Corte e barba da Loja (segunda fase). */
  corte?: CorteDaLoja;
  barba?: BarbaDaLoja;
  /** Comemoração de gol da Loja: só muda o desenho de quem marcou, na hora do gol. */
  comemoracao?: ComemoracaoDaLoja;
}


/** Aparências escolhidas pelos donos, pelo @ (sem @, minúsculo). Sem escolha, vale o sorteio. */
const escolhidas = new Map<string, Aparencia>();
const chaveDoNome = (nome: string) => nome.replace(/^@/, '').toLowerCase();
export function definirAparencias(lista: Record<string, Aparencia>): void {
  for (const [nome, a] of Object.entries(lista)) escolhidas.set(chaveDoNome(nome), a);
}

/** Itens equipados agora (ADR-0101), pelo @: valem nos cards e no Resumo. O jogo usa os da Escalação. */
const itensAtuais = new Map<string, ItensEquipados>();
export function definirItens(lista: Record<string, ItensEquipados>): void {
  itensAtuais.clear();
  for (const [nome, i] of Object.entries(lista)) itensAtuais.set(chaveDoNome(nome), i);
}
/** O que os Itens mudam no Visual: as cores (a Luva só no goleiro), o corte, a barba e a comemoração. */
export function vestir(itens: ItensEquipados | null | undefined, goleiro: boolean): Pick<Visual, 'itens' | 'detalhesDosItens' | 'corte' | 'barba' | 'comemoracao'> {
  const detalhes = detalhesDosItens(itens, goleiro);
  return { itens: coresDosItens(itens, goleiro), ...(Object.keys(detalhes).length ? { detalhesDosItens: detalhes } : {}), ...estilosDosItens(itens) };
}
/** Os Itens equipados agora pelo dono do @, prontos para espalhar no Visual. */
export function itensDe(nome: string, goleiro: boolean): Pick<Visual, 'itens' | 'detalhesDosItens' | 'corte' | 'barba' | 'comemoracao'> {
  return vestir(itensAtuais.get(chaveDoNome(nome)), goleiro);
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

/**
 * Veste os Itens na grade (ADR-0101). A regra vale para todas as poses, sem desenho novo:
 * - Chuteira: o contorno logo abaixo do meião (o pé) ganha a cor da chuteira.
 * - Munhequeira: no braço (pele fora do rosto com pele logo abaixo), o pixel do
 *   pulso, que é o de cima com o braço para baixo e o de baixo com o braço levantado.
 * - Luva: a mão do goleiro (a outra ponta do braço) e a luva do mergulho.
 * - Faixa: a terceira linha da cabeça, por cima do cabelo (ou da careca). Com segunda cor
 *   (Faixa da Mata, ADR-0108), os pixels do centro da faixa ficam com ela.
 */
export function comItens(grade: string[], itens: Visual['itens'], pose: Pose, detalhes?: Visual['detalhesDosItens']): string[] {
  if (!itens || !Object.keys(itens).length) return grade;
  const g = grade.map((l) => [...l]);
  const cabeca = pose === 'MERGULHO' ? -1 : 6;
  if (itens.CHUTEIRA) {
    for (let x = 0; x < LARGURA_SPRITE; x++) {
      for (let y = 1; y < g.length; y++) if (grade[y]![x] === 'K' && grade[y - 1]![x] === 'M' && (y + 1 >= grade.length || grade[y + 1]![x] !== 'M')) g[y]![x] = 'P';
    }
  }
  if ((itens.MUNHEQUEIRA || itens.LUVA) && pose !== 'MERGULHO') {
    for (let y = 0; y < g.length - 1; y++) {
      for (let x = 0; x < LARGURA_SPRITE; x++) {
        if (grade[y]![x] !== 'S' || grade[y + 1]![x] !== 'S' || noRosto(grade, x, y) || noRosto(grade, x, y + 1)) continue;
        // Par vertical de pele fora do rosto: o braço. Levantado (na altura da cabeça), a mão fica em cima.
        const [pulso, mao] = y < 7 ? [y + 1, y] : [y, y + 1];
        if (itens.MUNHEQUEIRA) g[pulso]![x] = 'W';
        if (itens.LUVA) g[mao]![x] = 'G';
      }
    }
  }
  if (itens.LUVA) for (const l of g) for (let x = 0; x < l.length; x++) if (l[x] === 'L') l[x] = 'G';
  if (itens.FAIXA && cabeca > 0) {
    const l = g[2]!;
    for (let x = 0; x < l.length; x++) if (l[x] === 'H' || (l[x] === 'S' && grade[2]![x] !== '.' && x > l.indexOf('K') && x < l.lastIndexOf('K'))) l[x] = 'F';
    if (detalhes?.FAIXA) {
      const faixa = l.flatMap((c, x) => (c === 'F' ? [x] : []));
      const meio = faixa.length / 2;
      // O centro: dois pixels se a faixa tem largura par, um se ímpar.
      for (const x of faixa.length % 2 ? [faixa[Math.floor(meio)]!] : [faixa[meio - 1]!, faixa[meio]!]) l[x] = 'f';
    }
  }
  return g.map((l) => l.join(''));
}

/** Pele da cabeça (rosto e pescoço): nas 7 primeiras linhas, entre o primeiro e o último contorno. */
function noRosto(grade: string[], x: number, y: number): boolean {
  if (y >= 7) return false;
  const l = grade[y]!;
  return x > l.indexOf('K') && x < l.lastIndexOf('K');
}

/** Cortes (por cima da grade, nas 7 linhas da cabeça) e barbas (na cor do cabelo, de frente e de lado) da Loja, segunda fase (ADR-0101). */

const familia = (pose: Pose): 'FRENTE' | 'COSTAS' | 'LADO' | 'OUTRA' =>
  pose.startsWith('COSTAS') ? 'COSTAS' : pose.startsWith('LADO') ? 'LADO' : pose === 'MERGULHO' ? 'OUTRA' : 'FRENTE';
/** Desloca a cabeça da comemoração (braços para cima nas laterais): o rosto fica igual. */
const pinta = (g: string[][], y: number, x: number, c: string, so?: string) => {
  const l = g[y];
  if (!l || x < 0 || x >= l.length) return;
  if (so !== undefined && !so.includes(l[x]!)) return;
  l[x] = c;
};

export function comCorte(grade: string[], corte: CorteDaLoja | undefined, pose: Pose): string[] {
  const f = familia(pose);
  if (!corte || f === 'OUTRA') return grade;
  const g = grade.map((l) => [...l]);
  // Colunas da cabeça em cada linha (entre o primeiro e o último contorno da cabeça).
  const dentro = (y: number) => {
    const l = grade[y]!;
    const xs = [...l].map((c, x) => (c === 'K' || c === 'H' || c === 'S' ? x : -1)).filter((x) => x >= 0 && x > 0 && x < 11);
    // Na comemoração, as mãos ficam nas pontas: a cabeça é o miolo.
    return xs.filter((x) => !(pose === 'FRENTE_COMEMORA' && (x <= 1 || x >= 10)));
  };
  if (corte === 'RASPADO') {
    // Degradê: o cabelo fica só no alto; dos lados e da nuca, pele.
    for (let y = 3; y < 7; y++) for (const x of dentro(y)) if (g[y]![x] === 'H' && (y >= 4 || f !== 'COSTAS' || x < 4 || x > 7)) g[y]![x] = 'S';
    if (f === 'FRENTE') { pinta(g, 2, 3, 'S', 'H'); pinta(g, 2, 8, 'S', 'H'); }
  }
  if (corte === 'LONGO') {
    // Cabelo até o ombro: dos lados de frente, a nuca inteira de costas.
    if (f === 'FRENTE') for (let y = 4; y <= 6; y++) { pinta(g, y, 3, 'H', 'SK'); pinta(g, y, 8, 'H', 'SK'); pinta(g, y, 2, 'K', '.'); pinta(g, y, 9, 'K', '.'); }
    if (f === 'COSTAS') for (let y = 5; y <= 6; y++) for (const x of dentro(y)) if (g[y]![x] === 'S') g[y]![x] = 'H';
    if (f === 'LADO') for (let y = 5; y <= 6; y++) { pinta(g, y, 3, 'H', 'SK'); pinta(g, y, 4, 'H', 'SK'); }
  }
  if (corte === 'TRANCAS') {
    // Trança nagô: listras de cabelo e contorno no alto da cabeça.
    for (let y = 1; y <= (f === 'COSTAS' ? 5 : 2); y++) for (const x of dentro(y)) if (g[y]![x] === 'H' && x % 2 === 1) g[y]![x] = 'K';
  }
  if (corte === 'TOPETE') {
    // Topete: o alto da cabeça sobe e avança um pixel.
    if (f === 'FRENTE') { pinta(g, 0, 4, 'H', 'K'); pinta(g, 0, 5, 'H', 'K'); pinta(g, 0, 6, 'H', 'K'); pinta(g, 0, 3, 'K', '.'); pinta(g, 0, 7, 'K', 'K'); }
    if (f === 'LADO') { pinta(g, 0, 9, 'K', '.'); pinta(g, 1, 9, 'H', 'K'); pinta(g, 1, 10, 'K', '.'); pinta(g, 0, 5, 'H', 'K'); pinta(g, 0, 6, 'H', 'K'); }
    if (f === 'COSTAS') { pinta(g, 0, 5, 'H', 'K'); pinta(g, 0, 6, 'H', 'K'); }
  }
  return g.map((l) => l.join(''));
}

export function comBarba(grade: string[], barba: BarbaDaLoja | undefined, pose: Pose): string[] {
  const f = familia(pose);
  if (!barba || f === 'OUTRA' || f === 'COSTAS') return grade;
  const g = grade.map((l) => [...l]);
  // De frente, a boca fica na linha 5 e o queixo na 6; de lado, o rosto vai para a direita.
  const [boca, queixo] = f === 'FRENTE' ? [[4, 5, 6, 7], [4, 5, 6, 7]] : [[8, 9], [5, 6, 7]];
  if (barba === 'BIGODE') for (const x of boca) pinta(g, 5, x, 'H', 'S');
  if (barba === 'CAVANHAQUE') for (const x of f === 'FRENTE' ? [5, 6] : [6, 7]) pinta(g, 6, x, 'H', 'S');
  if (barba === 'CHEIA') {
    for (const x of queixo) pinta(g, 6, x, 'H', 'S');
    if (f === 'FRENTE') { pinta(g, 5, 3, 'H', 'S'); pinta(g, 5, 8, 'H', 'S'); pinta(g, 4, 3, 'H', 'S'); pinta(g, 4, 8, 'H', 'S'); }
    else { pinta(g, 5, 5, 'H', 'S'); pinta(g, 5, 6, 'H', 'S'); }
  }
  return g.map((l) => l.join(''));
}

/**
 * Quadro da comemoração de gol da Loja (ADR-0101), com f de 0 a 1 ao longo de cerca de 1 s:
 * a pose, o giro (radianos), o pulo (pixels do boneco) e se espelha. O deslocamento no campo
 * continua sendo o da corrida de comemoração.
 */
export function quadroDaComemoracao(c: ComemoracaoDaLoja, f: number): { pose: Pose; angulo: number; pulo: number; espelhar: boolean } {
  const x = Math.min(1, Math.max(0, f));
  switch (c) {
    case 'AVIAOZINHO':
      // Braços abertos, balançando as asas.
      return { pose: 'FRENTE_AVIAO', angulo: Math.sin(x * Math.PI * 4) * 0.25, pulo: Math.abs(Math.sin(x * Math.PI * 4)) * 1, espelhar: false };
    case 'MORTAL': {
      // Agacha, pula grupado girando para trás em passos de 90° (giro liso borra o pixel), cai
      // agachado e levanta de braços para cima.
      if (x < 0.12) return { pose: 'AGACHADO', angulo: 0, pulo: 0, espelhar: false };
      if (x < 0.8) {
        const voo = (x - 0.12) / 0.68;
        const passo = Math.min(3, Math.floor(voo * 4));
        return { pose: 'GRUPADO', angulo: -passo * (Math.PI / 2), pulo: Math.sin(voo * Math.PI) * 12, espelhar: false };
      }
      if (x < 0.9) return { pose: 'AGACHADO', angulo: 0, pulo: 0, espelhar: false };
      return { pose: 'FRENTE_COMEMORA', angulo: 0, pulo: 0, espelhar: false };
    }
    case 'JOELHADA':
      // Cai de joelhos e desliza.
      return { pose: x < 0.2 ? 'FRENTE_CORRE_A' : 'JOELHADA', angulo: 0, pulo: 0, espelhar: false };
    case 'DANCINHA': {
      // Troca de pose e de lado no ritmo, com um pulinho.
      const passo = Math.floor(x * 8);
      return { pose: passo % 2 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO', angulo: 0, pulo: passo % 2 ? 1 : 0, espelhar: passo % 4 >= 2 };
    }
  }
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
  const k = `${pose}|${v.camisa}|${v.detalhe}|${v.calcao}|${v.meiao}|${v.pele}|${v.cabelo}|${v.penteado ?? ''}|${numero ?? ''}|${espelhado ? 'E' : ''}|${v.itens ? Object.entries(v.itens).map((e) => e.join(':')).join(',') : ''}|${v.detalhesDosItens ? Object.entries(v.detalhesDosItens).map((e) => e.join(':')).join(',') : ''}|${v.corte ?? ''}|${v.barba ?? ''}`;
  const pronto = cache.get(k);
  if (pronto) return pronto;
  // A joelhada é a comemoração de braços para cima, dois pixels mais baixa e de joelhos: veste
  // tudo como a comemoração e só depois desce e troca as pernas.
  const base = pose === 'JOELHADA' ? 'FRENTE_COMEMORA' : pose === 'AGACHADO' || pose === 'GRUPADO' ? 'FRENTE_PARADO' : pose;
  let grade = comItens(comBarba(comCorte(comPenteado(POSES[base], v.corte ? 'CURTO' : v.penteado, base), v.corte, base), v.barba, base), v.itens, base, v.detalhesDosItens);
  if (pose === 'JOELHADA') grade = ['............', '............', ...grade.slice(0, 12), '.KMMKBBKMMK.', '.KKKK..KKKK.'];
  // Agachado: a cabeça e o tronco descem dois pixels e as pernas dobram para os lados.
  if (pose === 'AGACHADO') grade = ['............', '............', ...grade.slice(0, 12), '..KMMKKMMK..', '..KKKKKKKK..'];
  // Grupado: a cabeça e, logo abaixo, os joelhos no peito com as mãos segurando. Fica no meio
  // da grade, para girar em volta do próprio centro.
  if (pose === 'GRUPADO')
    grade = [
      '............',
      '............',
      ...grade.slice(0, 7),
      '.KKCCCCCCKK.',
      '.KSMMKKMMSK.',
      '.KCMMKKMMCK.',
      '..KKBBBBKK..',
      '...KPPPPK...'.replace(/P/g, grade[15]!.includes('P') ? 'P' : 'K'),
      '............',
      '............',
    ];
  if (espelhado) grade = grade.map((l) => [...l].reverse().join(''));
  // Com número, a faixa de detalhe das costas sai e o boneco é pintado em dobro (meio pixel
  // para o número caber). Quem desenha sempre passa o tamanho final, então nada mais muda.
  const passo = numero === null ? 1 : 2;
  if (numero !== null) grade = grade.map((l) => l.replace(/c/g, 'C'));
  const c = novoCanvas(LARGURA_SPRITE * passo, ALTURA_SPRITE * passo);
  const g = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const cores: Record<string, string> = {
    K: CONTORNO, H: v.cabelo, S: v.pele, C: v.camisa, c: v.detalhe, B: v.calcao, M: v.meiao, L: v.detalhe,
    P: v.itens?.CHUTEIRA ?? CONTORNO, W: v.itens?.MUNHEQUEIRA ?? v.pele, F: v.itens?.FAIXA ?? v.cabelo, f: v.detalhesDosItens?.FAIXA ?? v.itens?.FAIXA ?? v.cabelo, G: v.itens?.LUVA ?? v.pele,
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
