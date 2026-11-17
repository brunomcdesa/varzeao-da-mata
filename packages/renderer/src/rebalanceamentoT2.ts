/**
 * Reels do Rebalanceamento da T2 (ADR-0066): conta a regra (cada Time fundador fica com uma
 * Escalação, os mais antigos de cada Posição; quem sai vai para o Time Primo), os números do
 * Rebalanceamento que já rodou e o título de Fundador. Sem nomes de Jogadores (decisão do dono).
 * Reels Programado: quarta 18/11 às 10h, antes das Novidades. Narrado pelo Seu Dito, no mesmo
 * estilo de cartelas do Agradecimento.
 */
import { FALA_DO_TIME, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, plaquinha } from './desenho.js';
import { ALTURA_ESCUDO, LARGURA_ESCUDO, escudo as escudoDoTime } from './escudos.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDoRebalanceamentoT2 {
  /** Jogadores que mudaram de Time no Rebalanceamento. */
  movidos: number;
  /** Jogadores que ficaram nos Times fundadores. */
  ficaram: number;
  /** Pares Time fundador → Time Primo (que chegou na T2), na ordem dos Clássicos fundadores. */
  primos: readonly (readonly [TimeId, TimeId])[];
  /** Dia da Rodada 1 (AAAA-MM-DD). */
  estreia: string;
  /** Hora (Brasília) do primeiro jogo da estreia. */
  primeiroJogoAs: number;
}

/** O Narrador do Reels do Rebalanceamento: Seu Dito, como no Agradecimento. */
export const NARRADOR_DO_REBALANCEAMENTO = 'DITO';

// ---------------------------------------------------------------- roteiro

export type CartelaRebalanceamento = 'ABERTURA' | 'REGRA' | 'PRIMOS' | 'NUMEROS' | 'FUNDADOR' | 'CHAMADA';
export type SegmentoRebalanceamento = Segmento & { cartela: CartelaRebalanceamento };

const CARTELAS: readonly CartelaRebalanceamento[] = ['ABERTURA', 'REGRA', 'PRIMOS', 'NUMEROS', 'FUNDADOR', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaRebalanceamento, number> = { ABERTURA: 5, REGRA: 8.5, PRIMOS: 9, NUMEROS: 6.5, FUNDADOR: 8, CHAMADA: 8 };
const CORTE = 0.3;

export class RoteiroRebalanceamentoT2 {
  readonly segmentos: SegmentoRebalanceamento[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDoRebalanceamentoT2,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    let cursor = 0;
    this.segmentos = CARTELAS.map((cartela, i) => {
      const inicio = cursor;
      cursor += Math.max(DURACAO_BASE[cartela], (minimos[i]?.antes ?? 0) + 0.6);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoRebalanceamento; indice: number; tempo: number; escurecer: number } {
    const t = Math.min(Math.max(tBruto, 0), this.duracao - 1e-9);
    const indice = Math.max(0, this.segmentos.findIndex((s) => t < s.fim));
    const segmento = this.segmentos[indice]!;
    const tempo = t - segmento.inicio;
    const meio = CORTE / 2;
    const entrada = indice === 0 ? 1 : Math.min(1, tempo / meio);
    const saida = indice === this.segmentos.length - 1 ? 1 : Math.min(1, (segmento.fim - t) / meio);
    return { segmento, indice, tempo, escurecer: 1 - Math.min(entrada, saida) };
  }
}

// ---------------------------------------------------------------- narração

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const HORA_FALADA: Record<number, string> = { 1: 'uma', 2: 'duas', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze' };
function horaFalada(h: number): string {
  if (h === 12) return 'ao meio-dia';
  if (h > 12) return `às ${HORA_FALADA[h - 12] ?? h - 12} da ${h >= 18 ? 'noite' : 'tarde'}`;
  return `às ${HORA_FALADA[h] ?? h} da manhã`;
}
export function diaDaEstreia(estreia: string): { semana: string; dia: number; mes: number } {
  const [a, m, d] = estreia.split('-').map(Number) as [number, number, number];
  return { semana: DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!, dia: d, mes: m };
}

export function narracaoDoRebalanceamentoT2(roteiro: RoteiroRebalanceamentoT2): Fala[] {
  const d = roteiro.dados;
  const { semana, dia } = diaDaEstreia(d.estreia);
  const texto: Record<CartelaRebalanceamento, string> = {
    ABERTURA: 'Chegou a hora de contar como ficaram os times da temporada dois!',
    REGRA: 'Cada time da temporada um fica com uma escalação inteira: um goleiro, dois zagueiros, dois meias e dois atacantes. Ficam os mais antigos de cada posição.',
    PRIMOS: 'Quem saiu foi pro time primo, um dos times que chegaram. Primo cheio na posição? Aí vai pra outro time novo, na mesma posição.',
    NUMEROS: `Foram ${d.movidos} jogadores que mudaram de time, e ${d.ficaram} que ficaram onde estavam.`,
    FUNDADOR: 'E quem joga nos times que chegaram vira fundador: ganha o selo de fundador na carreira e escolhe o número da camisa primeiro.',
    CHAMADA: `Confere o seu time no site, link na bio. E até a estreia, trocar de time não gasta a sua transferência. A temporada dois começa ${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${dia}, ${horaFalada(d.primeiroJogoAs)}!`,
  };
  return roteiro.segmentos.map((s, i): Fala => {
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA' || s.cartela === 'FUNDADOR';
    return { id: `rebalanceamento-t2-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesRebalanceamentoT2 {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const VERDE = '#A5CF8E';
const DOURADO = '#F2C14E';
const MADEIRA = '#5B3A1E';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));
const VAGAS: readonly [Posicao, number, string][] = [
  ['GOL', 1, 'goleiro'],
  ['ZAG', 2, 'zagueiros'],
  ['MEI', 2, 'meias'],
  ['ATA', 2, 'atacantes'],
];

export function desenharQuadroRebalanceamentoT2(ctx: CanvasRenderingContext2D, roteiro: RoteiroRebalanceamentoT2, tVideo: number, o: OpcoesRebalanceamentoT2 = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const passo = Math.floor(tVideo * 4);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);

  const titulo = (txt: string, y = 34) => {
    const a = entre(t, 0, 0.35);
    pin.ctx.globalAlpha = a;
    pin.tabua(COLUNAS / 2 - 118, y - (1 - a) * 8, 236, 34);
    pin.texto(txt, COLUNAS / 2, y + 17 - (1 - a) * 8, pin.caber(txt, 216, 24, display), display, COR.amarelo, { contorno: COR.contorno });
    pin.ctx.globalAlpha = 1;
  };
  const surge = (a: number, desenhar: () => void, dy = 10) => {
    if (a <= 0) return;
    pin.ctx.save();
    pin.ctx.globalAlpha *= a;
    pin.ctx.translate(0, (1 - a) * dy * pin.px);
    desenhar();
    pin.ctx.restore();
  };
  const corre = (k: number): Pose => ((passo + k) % 2 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B');
  const escudoDe = (time: TimeId, cx: number, y: number, escala: number) => {
    pin.ctx.imageSmoothingEnabled = false;
    pin.ctx.drawImage(escudoDoTime(time), Math.round((cx - (LARGURA_ESCUDO * escala) / 2) * pin.px), Math.round(y * pin.px), LARGURA_ESCUDO * escala * pin.px, ALTURA_ESCUDO * escala * pin.px);
  };
  const conta = (valor: number, de: number, dur = 1.2) => String(Math.round(valor * Math.min(1, Math.max(0, (t - de) / dur))));
  const seta = (x: number, y: number, cor: string) => {
    // Seta para a direita, 7 de altura.
    for (let k = 0; k < 4; k++) pin.r(x + k, y - 3 + k, 1, 7 - 2 * k, cor);
    pin.r(x - 6, y - 1, 6, 3, cor);
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      if (o.escudo) surge(entre(t, 0, 0.5), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 96, 88));
      surge(entre(t, 0.4, 0.9), () => {
        pin.texto('Rebalanceamento', COLUNAS / 2, 186, pin.caber('Rebalanceamento', 240, 34, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('da Temporada 2', COLUNAS / 2, 222, 24, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.4, 1.9), () => {
        pin.tabua(24, 256, 222, 48);
        pin.texto('Como ficaram os Times', COLUNAS / 2, 281, pin.caber('Como ficaram os Times', 206, 18, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      break;
    }
    case 'REGRA': {
      titulo('Cada Time fundador');
      surge(entre(t, 0.4, 0.8), () => pin.texto('f\u200cica com uma Escalação inteira', COLUNAS / 2, 92, pin.caber('f\u200cica com uma Escalação inteira', 236, 13, texto, 700), texto, COR.placa, { peso: 700 }));
      VAGAS.forEach(([pos, n, nome], k) => {
        const y = 110 + k * 58;
        surge(entre(t, 1.0 + k * 0.6, 1.4 + k * 0.6), () => {
          pin.tabua(14, y, 242, 50);
          boneco(pin, pos === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme('ONC', pos, `rebal-${k}`), 26, y + 4, 2.2);
          plaquinha(pin, 92, y + 10, 30, 30, String(n), display);
          pin.texto(nome, 116, y + 27, pin.caber(nome, 130, 20, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
        }, 8);
      });
      surge(entre(t, 4.4, 4.8), () => {
        pin.placa(22, 352, 226, 40, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('Ficam os mais antigos', COLUNAS / 2, 366, pin.caber('Ficam os mais antigos', 210, 14, display), display, COR.tinta);
        pin.texto('de cada posição', COLUNAS / 2, 382, 11, texto, COR.tinta, { peso: 700 });
      });
      break;
    }
    case 'PRIMOS': {
      titulo('Quem sai vai pro Primo');
      d.primos.forEach(([de, para], k) => {
        const y = 78 + k * 40;
        surge(entre(t, 0.5 + k * 0.35, 0.9 + k * 0.35), () => {
          escudoDe(de, 58, y, 1.4);
          pin.texto(FALA_DO_TIME[de].curto, 78, y + 18, pin.caber(FALA_DO_TIME[de].curto, 52, 9, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
          seta(146 + ((passo + k) % 2), y + 17, VERDE);
          escudoDe(para, 176, y, 1.4);
          pin.texto(FALA_DO_TIME[para].curto, 196, y + 18, pin.caber(FALA_DO_TIME[para].curto, 66, 9, texto, 700), texto, COR.amarelo, { alinhar: 'left', peso: 700 });
        }, 6);
      });
      surge(entre(t, 4.0, 4.4), () => {
        pin.placa(22, 404, 226, 30, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        const txt = 'Primo cheio? Outro Time novo, mesma posição';
        pin.texto(txt, COLUNAS / 2, 420, pin.caber(txt, 214, 11, texto, 700), texto, COR.tinta, { peso: 700 });
      });
      break;
    }
    case 'NUMEROS': {
      titulo('Em números');
      const linhas: [string, number, string][] = [
        ['Mudaram de Time', d.movidos, 'foram para os Times novos'],
        ['Ficaram', d.ficaram, 'nos Times da Temporada 1'],
      ];
      linhas.forEach(([nome, valor, apoio], k) => {
        const y = 100 + k * 110;
        const de = 0.5 + k * 1.4;
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(14, y, 242, 96);
          pin.texto(nome, 30, y + 32, pin.caber(nome, 150, 18, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(apoio, 30, y + 62, pin.caber(apoio, 150, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
          pin.texto(conta(valor, de + 0.2), 240, y + 52, pin.caber(String(valor), 80, 44, display), display, COR.amarelo, { alinhar: 'right', contorno: COR.contorno, espessura: 1.5 });
        }, 12);
      });
      surge(entre(t, 3.6, 4.0), () => pin.texto('Ninguém ficou de fora', COLUNAS / 2, 352, 15, display, VERDE, { contorno: COR.contorno }));
      break;
    }
    case 'FUNDADOR': {
      titulo('Fundador');
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Quem joga nos Times que chegaram', COLUNAS / 2, 90, pin.caber('Quem joga nos Times que chegaram', 236, 12, texto, 700), texto, COR.placa, { peso: 700 });
      });
      surge(entre(t, 1.0, 1.6), () => {
        const brilho = 1 + 0.03 * Math.sin(t * 5);
        const w = 190 * brilho;
        const h = 44 * brilho;
        pin.placa(COLUNAS / 2 - w / 2, 120, w, h, { fundo: MADEIRA, luz: DOURADO, sombra: '#3A2410', degrau: 3 });
        pin.texto('★', COLUNAS / 2 - w / 2 + 22, 143, 24, texto, DOURADO, { peso: 700 });
        pin.texto('Fundador', COLUNAS / 2 + 12, 143, pin.caber('Fundador', w - 56, 26, display), display, '#FFF6DF', { contorno: COR.contorno });
      }, 16);
      const passos: [string, string][] = [
        ['Selo na Carreira', 'pra sempre, no site'],
        ['Camisa primeiro', 'na Pré-temporada, escolhe o número antes'],
      ];
      passos.forEach(([a, b], k) => {
        const y = 186 + k * 74;
        surge(entre(t, 2.4 + k * 1.4, 2.8 + k * 1.4), () => {
          pin.tabua(14, y, 242, 64);
          plaquinha(pin, 38, y + 15, 30, 34, String(k + 1), display);
          pin.texto(a, 62, y + 24, pin.caber(a, 184, 19, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(b, 62, y + 46, pin.caber(b, 184, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
        }, 10);
      });
      surge(entre(t, 5.4, 5.8), () => {
        d.primos.forEach(([, novo], k) => escudoDe(novo, 26 + k * 31, 354, 1.25));
      });
      break;
    }
    case 'CHAMADA': {
      const { semana, dia, mes } = diaDaEstreia(d.estreia);
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Confere o seu Time', COLUNAS / 2, 70, pin.caber('Confere o seu Time', 240, 30, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('no site: link na bio', COLUNAS / 2, 102, 16, display, COR.placa, { contorno: COR.contorno });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.8, 1.2), () => {
        pin.tabua(14, 128, 242, 80);
        pin.texto('Até a estreia, trocar de Time', COLUNAS / 2, 156, pin.caber('Até a estreia, trocar de Time', 222, 13, texto, 700), texto, COR.placa, { peso: 700 });
        pin.texto('não gasta a Transferência', COLUNAS / 2, 182, pin.caber('não gasta a Transferência', 222, 18, display), display, VERDE, { contorno: COR.contorno });
      });
      surge(entre(t, 2.6, 3.0), () => {
        pin.tabua(14, 222, 242, 96);
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('Estreia da Temporada 2', COLUNAS / 2, 246, 13, texto, COR.placa, { peso: 700 });
        const data = `${semana} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
        pin.texto(data, COLUNAS / 2, 278, pin.caber(data, 222, 28 * pulso, display), display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        pin.texto(`primeiro jogo às ${d.primeiroJogoAs}h`, COLUNAS / 2, 304, 11, texto, COR.placaSombra, { peso: 700 });
      });
      if (o.escudo) surge(entre(t, 3.6, 4.2), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 392, 80));
      break;
    }
  }

  if (q.escurecer > 0) {
    ctx.save();
    ctx.globalAlpha = q.escurecer;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
}
