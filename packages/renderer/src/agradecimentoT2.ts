/**
 * Reels de Fim da Temporada 2 (ADR-0117): obrigado a quem jogou a T2, com os números dela e o
 * presente da T3 (o Bônus de largada em Moedas, ADR-0087). O campeão fica no Resumo da Temporada.
 * Reels Programado: sábado 28/11 às 20h, entre o Resumo da Temporada (19h) e a Abertura da T3
 * (21h). Narrado pelo Seu Dito, no mesmo estilo de cartelas do agradecimento da T1.
 */
import { GRUPOS_DA_A_DE_16, MOEDAS, TIMES_FUNDADORES, type Posicao, type TimeId } from '@liga/shared';
import { horaFalada, NARRADOR_DO_AGRADECIMENTO } from './agradecimentoT1.js';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO } from './desenho.js';
import { ALTURA_ESCUDO, LARGURA_ESCUDO, escudo as escudoDoTime } from './escudos.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export { NARRADOR_DO_AGRADECIMENTO };

export interface DadosDoAgradecimentoT2 {
  /** Jogadores que entraram em campo na Temporada 2 (o critério do Bônus de largada). */
  jogadores: number;
  /** Partidas jogadas na Temporada 2 (Fase de Liga e Mata-mata). */
  jogos: number;
  /** Gols da Temporada 2 (sem os pênaltis da disputa). */
  gols: number;
  /** Hora (Brasília) da Abertura da T3 no mesmo dia, se ela sai depois deste Reels. */
  aberturaAs?: number;
  /** Primeiro dia da Copa da T3 (AAAA-MM-DD). */
  copaEm?: string;
}

/** Os 16 Times da T2, Grupo do Barro e depois Grupo do Galho. */
export const TIMES_DA_T2: readonly TimeId[] = Object.values(GRUPOS_DA_A_DE_16).flat();
/** "16 Times em 2 Grupos", tirado da divisão de verdade. */
export const FORMATO_DA_T2 = `${TIMES_DA_T2.length} Times em ${Object.keys(GRUPOS_DA_A_DE_16).length} Grupos`;

// ---------------------------------------------------------------- roteiro

export type CartelaAgradecimentoT2 = 'ABERTURA' | 'NUMEROS' | 'OBRIGADO' | 'MOEDAS' | 'CHAMADA';
export type SegmentoAgradecimentoT2 = Segmento & { cartela: CartelaAgradecimentoT2 };

const CARTELAS: readonly CartelaAgradecimentoT2[] = ['ABERTURA', 'NUMEROS', 'OBRIGADO', 'MOEDAS', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaAgradecimentoT2, number> = { ABERTURA: 5.5, NUMEROS: 8, OBRIGADO: 8.5, MOEDAS: 11, CHAMADA: 7 };
const CORTE = 0.3;

export class RoteiroAgradecimentoT2 {
  readonly segmentos: SegmentoAgradecimentoT2[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDoAgradecimentoT2,
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

  em(tBruto: number): { segmento: SegmentoAgradecimentoT2; indice: number; tempo: number; escurecer: number } {
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

const POR_EXTENSO: Record<number, string> = { 20: 'vinte', 30: 'trinta', 40: 'quarenta', 50: 'cinquenta', 60: 'sessenta' };
const extenso = (n: number) => POR_EXTENSO[n] ?? String(n);
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "segunda, 30/11" a partir de "2026-11-30". */
export function diaDaCopa(data: string): { semana: string; dia: string } {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  return { semana: DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!, dia: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` };
}

/** Uma fala por cartela (sem o campeão: está no Resumo da Temporada). */
export function narracaoDoAgradecimentoT2(roteiro: RoteiroAgradecimentoT2): Fala[] {
  const d = roteiro.dados;
  const bonus = MOEDAS.BONUS_POR_TEMPORADA;
  const copa = d.copaEm ? ` E a Copa começa ${diaDaCopa(d.copaEm).semana}!` : '';
  const texto: Record<CartelaAgradecimentoT2, string> = {
    ABERTURA: 'Acabou a temporada dois do Varzeão da Mata! E de novo: muito obrigado!',
    NUMEROS: `Foram ${d.jogadores} jogadores em campo, ${d.jogos} jogos e ${d.gols} gols, tudo nos comentários de vocês.`,
    OBRIGADO: 'Obrigado a cada um que comentou, confirmou presença, escolheu a formação e torceu pelo seu time. A liga é de vocês.',
    MOEDAS: `E tem presente: na temporada três chegam as moedas, e quem jogou já começa com ${extenso(bonus)} moedas por temporada jogada. Jogou as duas? São ${extenso(2 * bonus)} moedas, na sua sacola, pra gastar na loja do boneco.`,
    CHAMADA: d.aberturaAs !== undefined
      ? `E hoje, ${horaFalada(d.aberturaAs)}, sai a abertura da temporada três.${copa} Fica ligado!`
      : `A temporada três tá chegando.${copa} Fica ligado!`,
  };
  return roteiro.segmentos.map((s, i): Fala => {
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA' || s.cartela === 'MOEDAS';
    return { id: `agradecimento-t2-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesAgradecimentoT2 {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const VERDE = '#A5CF8E';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));
/** Uma Posição por Time, para a fila de bonecos variar. */
const POSICAO_DA_FILA: readonly Posicao[] = ['ATA', 'MEI', 'ZAG', 'GOL', 'ATA', 'MEI', 'ZAG', 'ATA'];

export function desenharQuadroAgradecimentoT2(ctx: CanvasRenderingContext2D, roteiro: RoteiroAgradecimentoT2, tVideo: number, o: OpcoesAgradecimentoT2 = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const passo = Math.floor(tVideo * 4);
  const bonus = MOEDAS.BONUS_POR_TEMPORADA;
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
  /** Oito bonecos comemorando (os Times fundadores, como no agradecimento da T1). */
  const filaDosTimes = (y: number, escala: number) => {
    const largura = 12 * escala;
    const vao = (COLUNAS - 16 - TIMES_FUNDADORES.length * largura) / (TIMES_FUNDADORES.length - 1);
    TIMES_FUNDADORES.forEach((time: TimeId, k) => {
      const pos = POSICAO_DA_FILA[k]!;
      const salto = (passo + k) % 4 === 0 ? 2 : 0;
      boneco(pin, pos === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme(time, pos, `agradecimento-t2-${k}`), 8 + k * (largura + vao), y - salto, escala);
    });
  };
  const escudoDe = (time: TimeId, cx: number, y: number, escala: number) => {
    pin.ctx.imageSmoothingEnabled = false;
    pin.ctx.drawImage(escudoDoTime(time), Math.round((cx - (LARGURA_ESCUDO * escala) / 2) * pin.px), Math.round(y * pin.px), LARGURA_ESCUDO * escala * pin.px, ALTURA_ESCUDO * escala * pin.px);
  };
  /** Moeda redonda em pixel art; `giro` de 0 a 1 achata a moeda (girando). */
  const moeda = (cx: number, cy: number, r: number, giro = 0) => {
    const larg = Math.max(0.12, Math.abs(Math.cos(giro * Math.PI)));
    for (let y = -r; y <= r; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, r * r - y * y)) * larg);
      if (meia <= 0) continue;
      pin.r(cx - meia, cy + y, 2 * meia, 1, COR.contorno);
      const dentro = Math.max(0, meia - 1);
      const cor = y > r * 0.45 ? '#C9962A' : '#F2C230';
      if (Math.abs(y) < r && dentro > 0) pin.r(cx - dentro, cy + y, 2 * dentro, 1, cor);
    }
    if (larg > 0.55) pin.texto('$', cx, cy - 1, r * 1.1, display, '#8A5A12');
  };
  /** Número que conta até o valor em `dur` segundos a partir de `de`. */
  const conta = (valor: number, de: number, dur = 1.2) => String(Math.round(valor * Math.min(1, Math.max(0, (t - de) / dur))));

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      if (o.escudo) surge(entre(t, 0, 0.5), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 96, 88));
      surge(entre(t, 0.4, 0.9), () => {
        pin.texto('Fim da', COLUNAS / 2, 178, 34, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('Temporada 2', COLUNAS / 2, 218, pin.caber('Temporada 2', 240, 46, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.2, 1.7), () => filaDosTimes(262, 2.5));
      surge(entre(t, 2.0, 2.5), () => {
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('OBRIGADO!', COLUNAS / 2, 362, 40 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
      });
      break;
    }
    case 'NUMEROS': {
      titulo('A Temporada 2 em números');
      const linhas: [string, number, string][] = [
        ['Jogadores em campo', d.jogadores, FORMATO_DA_T2],
        ['Jogos', d.jogos, 'Grupos e Mata-mata'],
        ['Gols', d.gols, 'cada um narrado'],
      ];
      linhas.forEach(([nome, valor, apoio], k) => {
        const y = 92 + k * 96;
        const de = 0.5 + k * 1.4;
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(14, y, 242, 84);
          pin.texto(nome, 30, y + 26, pin.caber(nome, 150, 18, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
          // Na fonte de título: na Pixelify o "2" parece um "8" ("16 Times em 8 Grupos").
          pin.texto(apoio, 30, y + 54, pin.caber(apoio, 140, 14, display), display, COR.placaSombra, { alinhar: 'left' });
          pin.texto(conta(valor, de + 0.2), 240, y + 44, pin.caber(String(valor), 80, 40, display), display, COR.amarelo, { alinhar: 'right', contorno: COR.contorno, espessura: 1.5 });
        }, 12);
      });
      surge(entre(t, 5.0, 5.4), () => pin.texto('Tudo nos comentários de vocês', COLUNAS / 2, 398, 13, texto, VERDE, { peso: 700 }));
      break;
    }
    case 'OBRIGADO': {
      surge(entre(t, 0, 0.5), () => {
        const pulso = 1 + 0.03 * Math.sin(t * 5);
        pin.texto('Muito', COLUNAS / 2, 70, 36, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('obrigado!', COLUNAS / 2, 112, 48 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 0.8, 1.3), () => {
        pin.tabua(14, 146, 242, 112);
        const frases = ['A cada um que comentou,', 'confirmou Presença, escolheu', 'a Formação e torceu', 'pelo seu Time.'];
        frases.forEach((f, k) => pin.texto(f, COLUNAS / 2, 170 + k * 22, pin.caber(f, 222, 14, texto, 700), texto, COR.placa, { peso: 700 }));
      });
      // Os escudos dos 16 Times da T2, um a um, em 4 linhas de 4.
      TIMES_DA_T2.forEach((time, k) => {
        const col = k % 4;
        const lin = Math.floor(k / 4);
        surge(entre(t, 2.2 + k * 0.15, 2.6 + k * 0.15), () => escudoDe(time, 48 + col * 58, 272 + lin * 36, 1.5), 8);
      });
      surge(entre(t, 5.4, 5.8), () => pin.texto('A Liga é de vocês', COLUNAS / 2, 430, 15, display, VERDE, { contorno: COR.contorno }));
      break;
    }
    case 'MOEDAS': {
      titulo('Presente: Moedas');
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Na Temporada 3 chegam as Moedas', COLUNAS / 2, 90, pin.caber('Na Temporada 3 chegam as Moedas', 236, 17, display), display, COR.placa, { contorno: COR.contorno });
        pin.texto('e quem jogou já começa com', COLUNAS / 2, 108, 17, display, COR.placa, { contorno: COR.contorno });
      });
      surge(entre(t, 0.9, 1.4), () => {
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        moeda(COLUNAS / 2 - 58, 152, 14, (t * 0.6) % 1);
        pin.texto(String(bonus), COLUNAS / 2 + 18, 154, 52 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 2 });
        pin.texto('Moedas por Temporada jogada', COLUNAS / 2, 196, 12, texto, COR.placa, { peso: 700 });
      });
      const faixas: [string, number][] = [['Jogou a T1 ou a T2', bonus], ['Jogou as duas', 2 * bonus]];
      faixas.forEach(([quem, valor], k) => {
        const y = 222 + k * 74;
        surge(entre(t, 2.6 + k * 1.8, 3.0 + k * 1.8), () => {
          pin.tabua(14, y, 242, 60);
          pin.texto(quem, 30, y + 30, pin.caber(quem, 120, 17, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(`${valor} Moedas`, 240, y + 30, pin.caber(`${valor} Moedas`, 110, 20, display), display, k === 1 ? COR.amarelo : '#FFFFFF', { alinhar: 'right', contorno: COR.contorno });
        }, 10);
      });
      surge(entre(t, 6.4, 6.8), () => {
        pin.texto('Na sua sacola, no site e no App', COLUNAS / 2, 380, pin.caber('Na sua sacola, no site e no App', 236, 12, texto, 700), texto, VERDE, { peso: 700 });
        pin.texto('para gastar na Loja do boneco', COLUNAS / 2, 398, pin.caber('para gastar na Loja do boneco', 236, 12, texto, 700), texto, VERDE, { peso: 700 });
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Temporada 3', COLUNAS / 2, 70, pin.caber('Temporada 3', 240, 44, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('vem aí!', COLUNAS / 2, 112, 38, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.6, 1.0), () => {
        pin.tabua(14, 140, 242, 96);
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        const copa = d.copaEm ? diaDaCopa(d.copaEm) : null;
        const rodape = copa ? `e a Copa começa ${copa.semana}, ${copa.dia}` : 'f\u200cica ligado!';
        if (d.aberturaAs !== undefined) {
          pin.texto('Hoje, Abertura da Temporada 3', COLUNAS / 2, 166, pin.caber('Hoje, Abertura da Temporada 3', 220, 18, display), display, COR.placa, { contorno: COR.contorno });
          pin.texto(`ÀS ${d.aberturaAs}H`, COLUNAS / 2, 198, pin.caber(`ÀS ${d.aberturaAs}H`, 220, 30 * pulso, display), display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        } else {
          pin.texto('Cheia de novidade.', COLUNAS / 2, 166, 13, texto, COR.placa, { peso: 700 });
          pin.texto('FICA LIGADO', COLUNAS / 2, 198, pin.caber('FICA LIGADO', 220, 30 * pulso, display), display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        }
        pin.texto(rodape, COLUNAS / 2, 222, pin.caber(rodape, 220, 15, display), display, COR.placaSombra);
      });
      surge(entre(t, 1.4, 1.9), () => filaDosTimes(256, 2.5));
      if (o.escudo) surge(entre(t, 2.0, 2.6), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 392, 80));
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
