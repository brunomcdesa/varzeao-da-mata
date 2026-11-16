/**
 * Escudos dos Times em pixel art: um brasão nas cores do Time com o bicho dentro.
 * O brasão tem 20×24 pixels; o bicho, 14×14, desenhado a partir de grades de texto.
 *
 * Legenda dos bichos: . vazio · K contorno · W branco · e mais as cores de cada um (PALETAS).
 */
import { IDENTIDADE, type TimeId } from '@liga/shared';

const BICHOS: Record<TimeId, string[]> = {
  // Capivara de frente: cabeçona quadrada, orelhinhas, focinho largo.
  CAP: [
    '..KK......KK..',
    '.KbbK....KbbK.',
    '.KbbKKKKKKbbK.',
    '..KbbbbbbbbK..',
    '.KbbbbbbbbbbK.',
    '.KbKKbbbbKKbK.',
    '.KbbbbbbbbbbK.',
    '.KbbbbbbbbbbK.',
    '.KbbccccccbbK.',
    '.KbcccccccccK.',
    '.KbccKccKcccK.',
    '.KbcccccccccK.',
    '..KccccccccK..',
    '...KKKKKKKK...',
  ],
  // Onça de frente: amarela com pintas, focinho branco.
  ONC: [
    '.KKK......KKK.',
    'KyyyK....KyyyK',
    'KyKyKKKKKKyKyK',
    '.KyyyyKyyyyyK.',
    'KyyKyyyyyyKyyK',
    'KyyyyyyyyyyyyK',
    'KyKWKyyyyKWKyK',
    'KyyyyyyyyyyKyK',
    'KyyyWWWWWWyyyK',
    '.KyWWKKKKWWyK.',
    '.KyWWWKKWWWyK.',
    '..KWWKWWKWWK..',
    '...KWWWWWWK...',
    '....KKKKKK....',
  ],
  // Tatu de frente: orelhas compridas, carapaça com faixas, focinho fino.
  TAT: [
    '..KK......KK..',
    '.KgK......KgK.',
    '.KgK......KgK.',
    '.KgKKKKKKKKgK.',
    'KcgcgcgcgcgcgK',
    'KcgcgcgcgcgcgK',
    '.KgggggggggggK',
    '.KgKKggggKKgK.',
    '.KgggggggggggK',
    '..KgggggggggK.',
    '...KgggggggK..',
    '....KgggggK...',
    '.....KgggK....',
    '......KKK.....',
  ],
  // Tamanduá: cabeça de lado com o focinho comprido descendo, faixa clara no pescoço.
  TAM: [
    '..............',
    '.......KK.....',
    '......KmmK....',
    '.....KmmmmKK..',
    '....KmmmKmmmK.',
    '...KmmmmmmmmmK',
    '..KmmmmmmmWWWK',
    '.KmmmmKKKWKKK.',
    'KmmmmK..KWK...',
    'KmmmK...KdK...',
    'KmmK....KdK...',
    'KdK.....KKK...',
    '.K............',
    '..............',
  ],
  // Preguiça de frente: cara clara, máscara escura nos olhos, sorriso.
  PRE: [
    '....KKKKKK....',
    '..KKppppppKK..',
    '.KppppppppppK.',
    'KppWWWWWWWWppK',
    'KpWWWWWWWWWWpK',
    'KpWddWWWWddWpK',
    'KdddKdWWdKdddK',
    'KpdddWWWWdddpK',
    'KpWWWWKKWWWWpK',
    'KppWWWWWWWWppK',
    '.KppWKWWKWppK.',
    '.KpppWKKWpppK.',
    '..KKppppppKK..',
    '....KKKKKK....',
  ],
  // Sagui de frente: tufos brancos nas orelhas, cara pequena.
  SAG: [
    'WW..........WW',
    'WWW........WWW',
    'WWWWKKKKKKWWWW',
    '.WWKssssssKWW.',
    '..KssWWWWssK..',
    '.KssWWWWWWssK.',
    '.KsWKWWWWKWsK.',
    '.KsWWWWWWWWsK.',
    '.KssWWKKWWssK.',
    '..KssWWWWssK..',
    '...KssKKssK...',
    '...KssssssK...',
    '....KKKKKK....',
    '..............',
  ],
  // Tucano de lado: corpo preto, papo branco, bicão laranja.
  TUC: [
    '..............',
    '..KKKK........',
    '.KkkkkK.......',
    'KkkkkkkKKKKKK.',
    'KkWKkkkoooooaK',
    'KkkkkWoooooooK',
    'KkkWWWKoooooK.',
    'KkWWWWWKKKKK..',
    'KkWWWWWK......',
    'KkkWWWkK......',
    'KkkkkkkK......',
    '.KkkkkkK......',
    '..KkkkK.......',
    '...KKK........',
  ],
  // Arara-azul de lado: anel amarelo no olho e bicão escuro curvado para baixo.
  ARA: [
    '..............',
    '....KKKKK.....',
    '..KKzzzzzK....',
    '.KzzzzzzzzK...',
    'KzzzzzzyyyK...',
    'KzzzzzyKKyKK..',
    'KzzzzzyKKyKjK.',
    'KzzzzzzyyKjjjK',
    'KzzzzzzzyKjjjK',
    'KzzzzzzzzKKjjK',
    '.KzzzzzzzzyKjK',
    '.KzzzzzzzzKKK.',
    '..KzzzzzzK....',
    '...KKKKKK.....',
  ],
  // Jacaré de lado: olho no alto da cabeça, focinho comprido e dentes à mostra.
  JAC: [
    '..............',
    '..............',
    '..KKK.........',
    '.KvWKK........',
    'KvvvvvKKKKKKK.',
    'KvvvvvvvvvvvvK',
    'KvvvvvvvvvvvKK',
    'KhWhWhWhWhWhK.',
    'KhhhhhhhhhhhK.',
    '.KhhhhhhhhhK..',
    '..KKKKKKKKK...',
    '..............',
    '..............',
    '..............',
  ],
  // Sucuri enrolada: cabeça de cima, com manchas, e o corpo dando a volta.
  SUC: [
    '....KKKKKK....',
    '...KnnnnnnK...',
    '..KnKnnnnKnK..',
    '..KnnqnnqnnK..',
    '...KnnnnnnK...',
    '....KnnnnK....',
    '.....KiiK.....',
    '..KKKKnnKKKK..',
    '.KnqnnnnnqnnK.',
    'KnnnnKKKKnnnnK',
    'KnqnK....KnqnK',
    'KnnnnKKKKnnnnK',
    '.KnnqnnnnqnnK.',
    '..KKKKKKKKKK..',
  ],
  // Lobo-guará de frente: orelhonas, focinho branco e a crina preta embaixo.
  LOB: [
    'KK..........KK',
    'KlK........KlK',
    'KllK......KllK',
    'KlWlKKKKKKlWlK',
    '.KllllllllllK.',
    '.KlKKllllKKlK.',
    '.KllllllllllK.',
    '..KllWWWWllK..',
    '..KlWWWWWWlK..',
    '...KWWKKWWK...',
    '...KWWKKWWK...',
    '....KWWWWK....',
    '.....KkkK.....',
    '......KK......',
  ],
  // Cachorro-do-mato de frente: orelhas curtas e redondas, cara acinzentada.
  CDM: [
    '..............',
    '.KK........KK.',
    'KeeK......KeeK',
    'KeeeKKKKKKeeeK',
    '.KeeeeeeeeeeK.',
    'KeeKKeeeeKKeeK',
    'KeeeeeeeeeeeeK',
    '.KeeeeWWeeeeK.',
    '.KeeeWWWWeeeK.',
    '..KeeWKKWeeK..',
    '..KeeWKKWeeK..',
    '...KeWWWWeK...',
    '....KKKKKK....',
    '..............',
  ],
  // Boto-cor-de-rosa de lado: testa redonda e bico comprido para a esquerda.
  BOT: [
    '..............',
    '..............',
    '.....KKKK.....',
    '...KKrrrrK....',
    '..KrrrrrrrK...',
    '.KrrKrrrrrrK..',
    'KrrrrrrrrrrrK.',
    'KKKKKrrrrrrrrK',
    '....KWWrrrrrrK',
    '.....KWWWrrrK.',
    '......KKWWrK..',
    '........KKrK..',
    '.........KK...',
    '..............',
  ],
  // Pirarucu de lado: corpo escuro e o rabo vermelho.
  PIR: [
    '..............',
    '..............',
    '..............',
    '...KKKKKKK....',
    '.KKuuuuuuuKK.K',
    'KuuKuuuuuiiuKK',
    'KuuuuuuuiiiiiK',
    'KKuuuuuiiiiiiK',
    '.KuuuuuuiiiiKK',
    '..KKiiiiiiKK.K',
    '....KKKKKK....',
    '..............',
    '..............',
    '..............',
  ],
  // Coruja de frente: tufos nas orelhas, olhões amarelos e bico pequeno.
  COR: [
    'KK..........KK',
    'KxK........KxK',
    'KxxKKKKKKKKxxK',
    'KxxxxxxxxxxxxK',
    'KxWWWxxxxWWWxK',
    'KWfffWxxWfffWK',
    'KWfKfWxxWfKfWK',
    'KWfffWaaWfffWK',
    'KxWWWxaaxWWWxK',
    'KxxxxxxxxxxxxK',
    '.KxWxWxWxWxxK.',
    '..KxxxxxxxxK..',
    '...KKKKKKKK...',
    '..............',
  ],
  // Morcego de frente: asas abertas, orelhas pontudas e olhos claros.
  MOR: [
    '..............',
    '.....K..K.....',
    '....KtKKtK....',
    'K...KttttK...K',
    'KK.KtWttWtK.KK',
    'KtKKtKttKtKKtK',
    'KttKttttttKttK',
    'KtttKtWWtKtttK',
    'KttttKttKttttK',
    'KtKtttKKtttKtK',
    'K.KtKttttKtK.K',
    '...K.KttK.K...',
    '......KK......',
    '..............',
  ],
  // Quati de frente: máscara clara nos olhos, focinho comprido para baixo.
  QUA: [
    '..KK......KK..',
    '.KAAK....KAAK.',
    '.KAAAKKKKAAAK.',
    '.KAAAAAAAAAAK.',
    '.KACCAAAACCAK.',
    '.KCKBCAACBKCK.',
    '.KACCAAAACCAK.',
    '..KAAAAAAAAK..',
    '...KACCCCAK...',
    '....KCCCCK....',
    '....KCCCCK....',
    '.....KCCK.....',
    '.....KKKK.....',
    '..............',
  ],
  // Gambá de frente: cara branca, orelhas escuras e focinho rosado.
  GAM: [
    '.KK........KK.',
    'KDDK......KDDK',
    'KDDDKKKKKKDDDK',
    '.KDWWWDDWWWDK.',
    '.KWWWWDDWWWWK.',
    '.KWKWWDDWWKWK.',
    '.KWWWWWWWWWWK.',
    '..KWWWWWWWWK..',
    '...KWWWWWWK...',
    '....KWWWWK....',
    '.....KWWK.....',
    '.....KEEK.....',
    '......KK......',
    '..............',
  ],
  // Jabuti de lado: casco de placas e cabeça laranja à direita.
  JAB: [
    '..............',
    '..............',
    '....KKKKK.....',
    '..KKGGFGGKK...',
    '.KGGFGGGFGGK..',
    '.KFFGGFGGFFKKK',
    'KGGFGGFGGFGHWK',
    'KFFFFFFFFFFHHK',
    '.KHHKKKKKKHHK.',
    '.KHK......KHK.',
    '.KK.......KK..',
    '..............',
    '..............',
    '..............',
  ],
  // Teiú visto de cima: listras claras, patas abertas e o rabo enrolando.
  TEI: [
    '.....KKKK.....',
    '....KJJJJK....',
    '....KWJJWK....',
    '....KJJJJK....',
    '.K...KIIK...K.',
    '.KJKKJJJJKKJK.',
    '..KJJIIIIJJK..',
    '....KJJJJK....',
    '..KJKIIIIKJK..',
    '.KJK.KJJK.KJK.',
    '.KK..KIIK..KK.',
    '......KJK.....',
    '.......KIK....',
    '........KK....',
  ],
  // Ariranha de frente: cara marrom e o papo claro.
  ARI: [
    '..............',
    '..KK......KK..',
    '.KMMKKKKKKMMK.',
    '.KMMMMMMMMMMK.',
    'KMMMMMMMMMMMMK',
    'KMMKMMMMMMKMMK',
    'KMMMMMMMMMMMMK',
    'KMMMMKKKKMMMMK',
    '.KMMMMKKMMMMK.',
    '.KNNMMMMMMNNK.',
    '..KNNNNNNNNK..',
    '...KNNNNNNK...',
    '....KKKKKK....',
    '..............',
  ],
  // Anta de lado: orelha de ponta branca e a tromba curta.
  ANT: [
    '..............',
    '........KK....',
    '.......KWOK...',
    '...KKKKOOOKKK.',
    '..KOOOOOOOOOOK',
    '.KOOKOOOOOOOOK',
    'KOOOOOOOOOOOOK',
    'KOOKKOOOOOOOK.',
    '.KK..KOOOOOK..',
    '......KKKKK...',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  // Seriema de lado: topete, bico e pernas vermelhas.
  SER: [
    '...K.K........',
    '..KXKXK.......',
    '...KXK........',
    '..KRRRRK......',
    '.KRKRRRRKUUK..',
    '.KRRRRRRKKKK..',
    '..KRRRRK......',
    '...KRRRK......',
    '...KRRRRKKKK..',
    '..KRRXRXRRRRK.',
    '..KRRRRRRRRK..',
    '...KKUKKKUK...',
    '....KUK.KUK...',
    '....KK..KK....',
  ],
  // Bugio de frente: cara escura no meio da juba ruiva.
  BUG: [
    '...KKKKKKKK...',
    '..KYYYYYYYYK..',
    '.KYYYYYYYYYYK.',
    'KYYKZZZZZZKYYK',
    'KYKZZZZZZZZKYK',
    'KYKZWZZZZWZKYK',
    'KYKZZZZZZZZKYK',
    'KYKZZZKKZZZKYK',
    'KYYKZZZZZZKYYK',
    '.KYYKZZZZKYYK.',
    '.KYYYYYYYYYYK.',
    '..KYYYYYYYYK..',
    '...KYYYYYYK...',
    '....KKKKKK....',
  ],
};

const PALETAS: Record<string, string> = {
  K: '#15110E',
  W: '#F7F1E3',
  b: '#9A6A3E', // capivara
  c: '#7A5130',
  y: '#F2B705', // onça
  g: '#8C949C', // tatu
  m: '#6E5A48', // tamanduá
  p: '#B9A07A', // preguiça
  d: '#4A3726',
  s: '#6B5A4A', // sagui
  k: '#1A1A1A', // tucano
  o: '#F28C1C',
  a: '#F2C94C',
  z: '#2D63E0', // arara
  j: '#3A3A3A',
  v: '#3F7A3A', // jacaré
  h: '#CFC47A',
  n: '#6B7A2E', // sucuri
  q: '#2E3A16',
  i: '#C8343A', // língua da sucuri, rabo do pirarucu
  l: '#D9762B', // lobo-guará
  e: '#7E7468', // cachorro-do-mato
  r: '#E8A0B4', // boto
  u: '#4E5B4A', // pirarucu
  x: '#9B7653', // coruja
  f: '#F2C14E',
  t: '#4A3F66', // morcego
  // Times da Série B (ADR-0058): letras maiúsculas.
  A: '#A0612E',
  B: '#3B2618',
  C: '#E8D2A6',
  D: '#3A3A3A',
  E: '#F0A0B0',
  F: '#6B4A22',
  G: '#C9A227',
  H: '#D9622B',
  I: '#E8E2C8',
  J: '#2A2A2A',
  M: '#5A3825',
  N: '#E9DCC0',
  O: '#4A4040',
  R: '#BFA98A',
  U: '#C1272D',
  X: '#6E5E44',
  Y: '#B9471E',
  Z: '#3A2418',
};

/** Fundo do medalhão por Time; null = o bicho fica direto na cor do Time. */
const MEDALHAO: Record<TimeId, string | null> = {
  CAP: '#EADFC4',
  ONC: '#2A2A2A',
  TAT: '#EADFC4',
  TAM: '#EADFC4',
  PRE: null,
  SAG: null,
  TUC: '#EADFC4',
  ARA: '#FFD23F',
  JAC: '#EADFC4',
  SUC: '#EADFC4',
  LOB: '#EADFC4',
  CDM: '#EADFC4',
  BOT: '#1C2E5A',
  PIR: '#EADFC4',
  COR: '#EADFC4',
  MOR: '#8FD3FF',
  QUA: '#EADFC4',
  GAM: '#8FB0A8',
  JAB: '#EADFC4',
  TEI: '#EADFC4',
  ARI: '#EADFC4',
  ANT: '#EADFC4',
  SER: null,
  BUG: '#EADFC4',
};

/** Forma do brasão (20×24): P = fundo (primária), S = borda/faixa (secundária), K = contorno. */
const BRASAO = [
  '..KKKKKKKKKKKKKKKK..',
  '.KSSSSSSSSSSSSSSSSK.',
  'KSSPPPPPPPPPPPPPPSSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSPPPPPPPPPPPPPPPPSK',
  'KSSPPPPPPPPPPPPPPSSK',
  '.KSPPPPPPPPPPPPPPSK.',
  '.KSSPPPPPPPPPPPPSSK.',
  '..KSSPPPPPPPPPPSSK..',
  '...KSSPPPPPPPPSSK...',
  '....KKSSPPPPSSKK....',
  '......KKSSSSKK......',
  '........KKKK........',
];

export const LARGURA_ESCUDO = 20;
export const ALTURA_ESCUDO = 24;

const cache = new Map<TimeId, HTMLCanvasElement | OffscreenCanvas>();

export function escudo(time: TimeId): HTMLCanvasElement | OffscreenCanvas {
  const pronto = cache.get(time);
  if (pronto) return pronto;
  const id = IDENTIDADE[time];
  const c: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(LARGURA_ESCUDO, ALTURA_ESCUDO)
      : Object.assign(document.createElement('canvas'), { width: LARGURA_ESCUDO, height: ALTURA_ESCUDO });
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const ponto = (x: number, y: number, cor: string) => {
    g.fillStyle = cor;
    g.fillRect(x, y, 1, 1);
  };
  BRASAO.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const ch = linha[x];
      if (ch === 'K') ponto(x, y, PALETAS.K!);
      else if (ch === 'S') ponto(x, y, id.secundaria);
      else if (ch === 'P') ponto(x, y, id.primaria);
    }
  });
  // Medalhão atrás do bicho quando a cor do Time não dá contraste com ele.
  const fundo = MEDALHAO[time];
  if (fundo) {
    for (let y = 0; y < ALTURA_ESCUDO; y++) {
      for (let x = 0; x < LARGURA_ESCUDO; x++) {
        const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 11);
        if (d < 8.2) ponto(x, y, d > 7.3 ? id.secundaria : fundo);
      }
    }
  }
  // Bicho centralizado no medalhão.
  const ox = 3;
  const oy = 4;
  const grade = BICHOS[time];
  grade.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const ch = linha[x]!;
      if (ch === '.') continue;
      ponto(ox + x, oy + y, PALETAS[ch] ?? PALETAS.K!);
    }
  });
  cache.set(time, c);
  return c;
}
