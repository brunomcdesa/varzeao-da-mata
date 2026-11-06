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
