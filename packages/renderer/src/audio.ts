/**
 * Áudio do Reels, sintetizado em código: trilha chiptune (8-bit, combina com o pixel art),
 * torcida, apitos e chutes, mais a mixagem com a narração do Locutor.
 *
 * Tudo é determinístico (ruído com seed fixa) e sem arquivos de terceiros: não há
 * risco de direitos autorais (ADR-0003 exige trilha própria ou livre).
 */
import type { EventoSonoro, Fala } from './narracao.js';
import type { Segmento } from './roteiro.js';

export const TAXA = 48000;

// ---------------------------------------------------------------- utilidades

function ruidoBranco(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Filtro passa-faixa (biquad RBJ) com frequência central variável por amostra. */
function passaFaixa(q: number) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number, freq: number): number => {
    const w = (2 * Math.PI * freq) / TAXA;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w)) / a0;
    const a2 = (1 - alpha) / a0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function passaBaixa(freq: number) {
  const a = 1 - Math.exp((-2 * Math.PI * freq) / TAXA);
  let y = 0;
  return (x: number) => (y += a * (x - y));
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function somar(destino: Float32Array, inicio: number, gerar: (i: number, t: number) => number, duracao: number): void {
  const i0 = Math.max(0, Math.floor(inicio * TAXA));
  const n = Math.min(destino.length - i0, Math.floor(duracao * TAXA));
  for (let i = 0; i < n; i++) destino[i0 + i]! += gerar(i, i / TAXA);
}

// ---------------------------------------------------------------- trilha chiptune

const BPM = 128;
const SEMICOLCHEIA = 60 / BPM / 4;
/** Progressão C – Am – F – G, um compasso cada. */
const ACORDES: { raiz: number; menor: boolean }[] = [
  { raiz: 48, menor: false },
  { raiz: 45, menor: true },
  { raiz: 41, menor: false },
  { raiz: 43, menor: false },
];
/** Melodia do tema (abertura e fim): 4 compassos de 8 colcheias, em semitons acima do Dó central; null = pausa. */
const TEMA: (number | null)[] = [
  0, 4, 7, 12, 11, 7, 4, null, 9, 12, 9, 4, 5, 4, 2, null,
  5, 9, 12, 9, 7, 5, 4, 5, 7, 11, 14, 11, 12, null, null, null,
];

function quadrada(fase: number, ciclo: number): number {
  return fase % 1 < ciclo ? 1 : -1;
}
function triangular(fase: number): number {
  const f = fase % 1;
  return f < 0.5 ? 4 * f - 1 : 3 - 4 * f;
}

/**
 * Trilha completa com a duração pedida. `intensidade(t)` (0–1) controla a densidade:
 * no lance só baixo e bateria; nas cartelas entra o tema.
 */
export function trilha(duracao: number, intensidade: (t: number) => number): { esq: Float32Array; dir: Float32Array } {
  const n = Math.ceil(duracao * TAXA);
  const esq = new Float32Array(n);
  const dir = new Float32Array(n);
  const ruido = ruidoBranco(1234);
  const nSemis = Math.ceil(duracao / SEMICOLCHEIA);

  for (let k = 0; k < nSemis; k++) {
    const t0 = k * SEMICOLCHEIA;
    const compasso = Math.floor(k / 16);
    const passo = k % 16;
    const acorde = ACORDES[compasso % 4]!;
    const terca = acorde.menor ? 3 : 4;
    const forte = intensidade(t0);

    // Baixo (triangular), em colcheias: raiz, oitava, quinta, oitava.
    if (passo % 2 === 0) {
      const nota = acorde.raiz - 12 + [0, 12, 7, 12][(passo / 2) % 4]!;
      const f = midi(nota);
      somar(esq, t0, (_, t) => triangular(t * f) * 0.32 * Math.exp(-t * 3), SEMICOLCHEIA * 2);
    }
    // Arpejo (quadrada fina), em semicolcheias.
    const arp = [0, terca, 7, 12][passo % 4]!;
    const fa = midi(acorde.raiz + 12 + arp);
    const volArp = 0.07 + forte * 0.05;
    somar(esq, t0, (_, t) => quadrada(t * fa, 0.125) * volArp * Math.exp(-t * 14), SEMICOLCHEIA);
    // Bateria.
    if (passo % 8 === 0) somar(esq, t0, (_, t) => Math.sin(2 * Math.PI * (55 + 110 * Math.exp(-t * 30)) * t) * 0.55 * Math.exp(-t * 18), 0.18);
    if (passo % 8 === 4) somar(esq, t0, (_, t) => ruido() * 0.22 * Math.exp(-t * 28), 0.12);
    if (passo % 2 === 0) somar(esq, t0, (_, t) => ruido() * 0.05 * Math.exp(-t * 90), 0.04);
    // Tema (só quando a intensidade é alta).
    if (forte > 0.6 && passo % 2 === 0) {
      const nota = TEMA[(compasso % 4) * 8 + passo / 2] ?? null;
      if (nota !== null) {
        const fm = midi(60 + nota + 12);
        somar(esq, t0, (_, t) => quadrada(t * fm, 0.5) * 0.09 * Math.min(1, t * 200) * Math.exp(-t * 4), SEMICOLCHEIA * 2);
      }
    }
  }
  // Estéreo simples: o mesmo sinal com um leve atraso do outro lado.
  const atraso = Math.floor(0.012 * TAXA);
  for (let i = 0; i < n; i++) dir[i] = esq[i - atraso] ?? 0;
  return { esq, dir };
}

// ---------------------------------------------------------------- efeitos

function torcidaAmbiente(duracao: number, seed: number): Float32Array {
  const n = Math.ceil(duracao * TAXA);
  const out = new Float32Array(n);
  const r = ruidoBranco(seed);
  const bp = passaFaixa(0.6);
  const lp = passaBaixa(1800);
  for (let i = 0; i < n; i++) {
    const t = i / TAXA;
    const ondula = 0.75 + 0.25 * Math.sin(t * 0.7 + seed) * Math.sin(t * 0.23);
    out[i] = lp(bp(r(), 700)) * 0.5 * ondula;
  }
  return out;
}

function somarEvento(esq: Float32Array, dir: Float32Array, e: EventoSonoro, seed: number): void {
  const r = ruidoBranco(seed);
  const bpE = passaFaixa(0.8);
  const bpD = passaFaixa(0.8);
  const ambos = (gerar: (t: number) => [number, number], dur: number, t0 = e.t) => {
    const i0 = Math.max(0, Math.floor(t0 * TAXA));
    const n = Math.min(esq.length - i0, Math.floor(dur * TAXA));
    for (let i = 0; i < n; i++) {
      const [a, b] = gerar(i / TAXA);
      esq[i0 + i]! += a;
      dir[i0 + i]! += b;
    }
  };
  const apito = (t0: number, dur: number) =>
    ambos((t) => {
      const env = Math.min(1, t * 60) * Math.min(1, (dur - t) * 40);
      const trilo = 0.65 + 0.35 * Math.sin(2 * Math.PI * 28 * t);
      const s = (Math.sin(2 * Math.PI * 2900 * t) + 0.6 * Math.sin(2 * Math.PI * 3150 * t)) * 0.16 * env * trilo;
      return [s, s];
    }, dur, t0);

  switch (e.tipo) {
    case 'APITO_INICIAL':
      apito(e.t, 0.7);
      break;
    case 'APITO_FINAL':
      apito(e.t, 0.22);
      apito(e.t + 0.38, 0.22);
      apito(e.t + 0.76, 0.9);
      break;
    case 'CHUTE':
    case 'PASSE': {
      const forte = e.tipo === 'CHUTE';
      const f0 = forte ? 85 : 140;
      ambos((t) => {
        const s = (Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 28) + r() * 0.5 * Math.exp(-t * 220)) * (forte ? 0.55 : 0.25);
        return [s, s];
      }, 0.15);
      break;
    }
    case 'GOL':
      // Explosão da torcida: sobe rápido, segura e desce devagar.
      ambos((t) => {
        const env = Math.min(1, t / 0.25) * (t < 2.4 ? 1 : Math.exp(-(t - 2.4) * 1.6));
        const vibr = 1 + 0.25 * Math.sin(2 * Math.PI * 5.5 * t);
        return [bpE(r(), 900 * vibr) * 0.95 * env, bpD(r(), 1000 * vibr) * 0.95 * env];
      }, 4.5);
      break;
    case 'QUASE':
      // "Uuuh": faixa de ruído que desce de tom.
      ambos((t) => {
        const env = Math.sin(Math.min(1, t / 1.3) * Math.PI);
        const f = 620 - 260 * Math.min(1, t / 1.3);
        return [bpE(r(), f) * 0.7 * env, bpD(r(), f * 1.05) * 0.7 * env];
      }, 1.3);
      break;
    case 'DESARME':
      ambos((t) => {
        const env = Math.sin(Math.min(1, t / 0.7) * Math.PI);
        return [bpE(r(), 800) * 0.3 * env, bpD(r(), 850) * 0.3 * env];
      }, 0.7);
      break;
  }
}

// ---------------------------------------------------------------- narração: agenda

export interface FalaAgendada {
  id: string;
  inicio: number;
}

const RESPIRO = 0.12;

/**
 * Encaixa as falas no tempo, sem sobreposição. Nenhuma é acelerada, cortada ou tirada:
 * o Roteiro é esticado antes (exigenciasDaNarracao) para todas caberem.
 */
export function agendarFalas(falas: Fala[], duracao: (id: string) => number): FalaAgendada[] {
  const agenda: FalaAgendada[] = [];
  let livre = -Infinity;
  for (const f of [...falas].sort((a, b) => a.inicio - b.inicio)) {
    const inicio = Math.max(f.inicio, livre + RESPIRO);
    agenda.push({ id: f.id, inicio });
    livre = inicio + duracao(f.id);
  }
  return agenda;
}

// ---------------------------------------------------------------- mixagem

export interface VozNaMixagem {
  inicio: number;
  amostras: Float32Array; // mono, TAXA
}

export function mixar(o: { duracao: number; segmentos: Segmento[]; eventos: EventoSonoro[]; vozes: VozNaMixagem[] }): { esq: Float32Array; dir: Float32Array } {
  const n = Math.ceil(o.duracao * TAXA);
  const intensidade = (t: number) => {
    const s = o.segmentos.find((x) => t < x.fim) ?? o.segmentos[o.segmentos.length - 1]!;
    return s.tipo === 'LANCE' ? 0.3 : 1;
  };
  const musica = trilha(o.duracao, intensidade);
  const ambE = torcidaAmbiente(o.duracao, 7);
  const ambD = torcidaAmbiente(o.duracao, 8);
  const efE = new Float32Array(n);
  const efD = new Float32Array(n);
  o.eventos.forEach((e, i) => somarEvento(efE, efD, e, 100 + i));

  const voz = new Float32Array(n);
  for (const v of o.vozes) {
    const i0 = Math.floor(v.inicio * TAXA);
    for (let i = 0; i < v.amostras.length && i0 + i < n; i++) voz[i0 + i]! += v.amostras[i]!;
  }
  // Envelope de "voz ativa", suavizado, para abaixar a trilha e a torcida debaixo da fala.
  const ativa = new Float32Array(n);
  const janela = Math.floor(0.05 * TAXA);
  let soma = 0;
  for (let i = 0; i < n; i++) {
    soma += Math.abs(voz[i]!);
    if (i >= janela) soma -= Math.abs(voz[i - janela]!);
    ativa[i] = soma / janela > 0.01 ? 1 : 0;
  }
  const esq = new Float32Array(n);
  const dir = new Float32Array(n);
  let duck = 0;
  const ataque = 1 - Math.exp(-1 / (0.03 * TAXA));
  const soltura = 1 - Math.exp(-1 / (0.35 * TAXA));
  for (let i = 0; i < n; i++) {
    const alvo = ativa[i]!;
    duck += (alvo - duck) * (alvo > duck ? ataque : soltura);
    const gMus = (intensidade(i / TAXA) > 0.5 ? 0.5 : 0.36) * (1 - 0.65 * duck);
    const gAmb = 0.18 * (1 - 0.5 * duck);
    const l = musica.esq[i]! * gMus + ambE[i]! * gAmb + efE[i]! * 0.7 + voz[i]! * 1.0;
    const r = musica.dir[i]! * gMus + ambD[i]! * gAmb + efD[i]! * 0.7 + voz[i]! * 1.0;
    esq[i] = Math.tanh(l * 1.1) * 0.92;
    dir[i] = Math.tanh(r * 1.1) * 0.92;
  }
  return { esq, dir };
}

// ---------------------------------------------------------------- WAV

export function codificarWav(esq: Float32Array, dir: Float32Array): Uint8Array {
  const n = esq.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, TAXA, true);
  v.setUint32(28, TAXA * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  txt(36, 'data');
  v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, esq[i]!)) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, dir[i]!)) * 32767, true);
  }
  return new Uint8Array(buf);
}

/** Lê um WAV PCM 16 bits (mono ou estéreo) e devolve mono em Float32. */
export function lerWavMono(bytes: Uint8Array): { amostras: Float32Array; taxa: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  let canais = 1;
  let taxa = TAXA;
  let bits = 16;
  while (pos + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[pos]!, bytes[pos + 1]!, bytes[pos + 2]!, bytes[pos + 3]!);
    const tam = v.getUint32(pos + 4, true);
    if (id === 'fmt ') {
      canais = v.getUint16(pos + 10, true);
      taxa = v.getUint32(pos + 12, true);
      bits = v.getUint16(pos + 22, true);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`WAV com ${bits} bits não suportado`);
      const quadros = Math.floor(tam / (2 * canais));
      const out = new Float32Array(quadros);
      for (let i = 0; i < quadros; i++) {
        let s = 0;
        for (let c = 0; c < canais; c++) s += v.getInt16(pos + 8 + (i * canais + c) * 2, true);
        out[i] = s / canais / 32768;
      }
      return { amostras: out, taxa };
    }
    pos += 8 + tam + (tam % 2);
  }
  throw new Error('WAV sem bloco de dados');
}
