/**
 * Reels de agradecimento da Temporada 1 (ADR-0047): obrigado a quem se inscreveu e acreditou na
 * Liga desde o começo, com os números da T1 e a Recompensa da Temporada 1 (Selo, Piso e Bônus).
 * Com a T2 em Séries, mostra também o Rebalanceamento (quem vai para a Série B e o título de
 * Fundador). Reels Programado: terça 17/11 às 20h, entre o Resumo da Temporada (que já mostra o
 * campeão) e a Abertura da T2. Narrado pelo Seu Dito. Mesmo estilo de cartelas do Reels do OVR.
 */
import { TIMES_FUNDADORES, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, plaquinha } from './desenho.js';
import { ALTURA_ESCUDO, LARGURA_ESCUDO, escudo as escudoDoTime } from './escudos.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDoAgradecimentoT1 {
  /** Jogadores que se inscreveram na Temporada 1 (os que ganham o Selo). */
  inscritos: number;
  /** Partidas jogadas na Temporada 1. */
  jogos: number;
  /** Gols da Temporada 1. */
  gols: number;
  /** Piso da Temporada 1 (OVR). */
  piso: number;
  /** Rodadas da T2 com o Bônus da Temporada 1. */
  rodadasDoBonus: number;
  /** 1,5 = ganhos 50% maiores. */
  multiplicadorDoBonus: number;
  /** Rebalanceamento da T2 (ADR-0036), se já foi feito: sem ele, o Reels não tem essas cartelas. */
  rebalanceamento?: {
    /** Jogadores que foram para a Série B. */
    movidos: number;
    /** Quantos Jogadores cada Time da A manteve (os primeiros inscritos). */
    tamanhoDaA: number;
    /** Time da A e o seu Time Primo da B. */
    pares: readonly (readonly [TimeId, TimeId])[];
  };
  /** Hora (Brasília) da Abertura da T2 no mesmo dia, se ela sai depois deste Reels. */
  aberturaAs?: number;
}

/** O Narrador do Reels de agradecimento (decisão do dono): Seu Dito. */
export const NARRADOR_DO_AGRADECIMENTO = 'DITO';

export const bonusPorCento = (multiplicador: number): number => Math.round((multiplicador - 1) * 100);

// ---------------------------------------------------------------- roteiro

export type CartelaAgradecimento = 'ABERTURA' | 'NUMEROS' | 'OBRIGADO' | 'SELO' | 'PISO' | 'BONUS' | 'REBALANCEAMENTO' | 'FUNDADOR' | 'CHAMADA';
export type SegmentoAgradecimento = Segmento & { cartela: CartelaAgradecimento };

const DURACAO_BASE: Record<CartelaAgradecimento, number> = { ABERTURA: 5, NUMEROS: 7, OBRIGADO: 8, SELO: 7, PISO: 7.5, BONUS: 8, REBALANCEAMENTO: 9, FUNDADOR: 8, CHAMADA: 6.5 };

/** As cartelas, na ordem; as do Rebalanceamento só quando ele já foi feito e moveu alguém. */
export function cartelasDoAgradecimento(d: DadosDoAgradecimentoT1): CartelaAgradecimento[] {
  const rebal: CartelaAgradecimento[] = d.rebalanceamento && d.rebalanceamento.movidos > 0 ? ['REBALANCEAMENTO', 'FUNDADOR'] : [];
  return ['ABERTURA', 'NUMEROS', 'OBRIGADO', 'SELO', 'PISO', 'BONUS', ...rebal, 'CHAMADA'];
}
const CORTE = 0.3;

export class RoteiroAgradecimentoT1 {
  readonly segmentos: SegmentoAgradecimento[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDoAgradecimentoT1,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    let cursor = 0;
    this.segmentos = cartelasDoAgradecimento(dados).map((cartela, i) => {
      const inicio = cursor;
      cursor += Math.max(DURACAO_BASE[cartela], (minimos[i]?.antes ?? 0) + 0.6);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoAgradecimento; indice: number; tempo: number; escurecer: number } {
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

const POR_EXTENSO: Record<number, string> = {
  1: 'uma', 2: 'duas', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
  25: 'vinte e cinco', 50: 'cinquenta', 60: 'sessenta', 61: 'sessenta e um', 62: 'sessenta e dois', 63: 'sessenta e três', 64: 'sessenta e quatro', 65: 'sessenta e cinco', 75: 'setenta e cinco', 100: 'cem',
};
const extenso = (n: number) => POR_EXTENSO[n] ?? String(n);
const HORA_FALADA: Record<number, string> = { 1: 'uma', 2: 'duas', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze' };
/** "às nove da noite", "ao meio-dia", "às dez da manhã". */
export function horaFalada(h: number): string {
  if (h === 12) return 'ao meio-dia';
  if (h > 12) return `às ${HORA_FALADA[h - 12] ?? h - 12} da ${h >= 18 ? 'noite' : 'tarde'}`;
  return `às ${HORA_FALADA[h] ?? h} da manhã`;
}

/** Uma fala por cartela, no texto aprovado pelo dono (sem o campeão: está no Resumo da Temporada). */
export function narracaoDoAgradecimentoT1(roteiro: RoteiroAgradecimentoT1): Fala[] {
  const d = roteiro.dados;
  const r = d.rebalanceamento;
  const horas = d.aberturaAs !== undefined ? horaFalada(d.aberturaAs) : '';
  const rodadas = d.rodadasDoBonus === 1 ? 'na primeira rodada' : `nas ${extenso(d.rodadasDoBonus)} primeiras rodadas`;
  const texto: Record<CartelaAgradecimento, string> = {
    ABERTURA: 'Acabou a primeira temporada do Varzeão da Mata! E antes de tudo: muito obrigado!',
    NUMEROS: `Foram ${d.inscritos} jogadores inscritos, ${d.jogos} jogos e ${d.gols} gols, tudo nos comentários de vocês.`,
    OBRIGADO: 'Essa liga só existe porque vocês comentaram, se inscreveram e acreditaram num projeto que tinha acabado de nascer.',
    SELO: 'Por isso, todo mundo que jogou a temporada um ganha o selo Temporada Um, na página de carreira do site.',
    PISO: `E tem presente: ninguém da primeira temporada começa a próxima com OVR abaixo de ${extenso(d.piso)}.`,
    BONUS: `E ${rodadas} da temporada dois, as suas habilidades sobem ${extenso(bonusPorCento(d.multiplicadorDoBonus))} por cento mais rápido. E isso soma com a resenha!`,
    REBALANCEAMENTO: r
      ? `E agora são duas séries. Pra todo mundo jogar todas as partidas, cada time da Série A fica com os ${extenso(r.tamanhoDaA)} primeiros inscritos, e ${r.movidos} jogadores vão pra Série B, no time primo, na mesma posição.`
      : '',
    FUNDADOR: 'Quem foi pra Série B vira Fundador do time novo: título na carreira, prioridade na camisa e volta grátis na próxima janela. Confere no site o seu time!',
    CHAMADA: d.aberturaAs !== undefined
      ? `E hoje, ${horas}, sai a abertura da temporada dois, cheia de novidade. Fica ligado!`
      : 'A temporada dois tá chegando, cheia de novidade. Fica ligado, que logo a gente conta tudo!',
  };
  return roteiro.segmentos.map((s, i): Fala => {
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA' || s.cartela === 'BONUS';
    return { id: `agradecimento-t1-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesAgradecimentoT1 {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const VERDE = '#A5CF8E';
const DOURADO = '#F2C14E';
const MADEIRA = '#5B3A1E';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));
/** Uma Posição por Time, para a fila de bonecos variar. */
const POSICAO_DA_FILA: readonly Posicao[] = ['ATA', 'MEI', 'ZAG', 'GOL', 'ATA', 'MEI', 'ZAG', 'ATA'];

export function desenharQuadroAgradecimentoT1(ctx: CanvasRenderingContext2D, roteiro: RoteiroAgradecimentoT1, tVideo: number, o: OpcoesAgradecimentoT1 = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const passo = Math.floor(tVideo * 4);
  const bonus = bonusPorCento(d.multiplicadorDoBonus);
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
  const seta = (x: number, y: number, cor: string) => {
    for (let k = 0; k < 4; k++) pin.r(x - k, y + k, 1 + 2 * k, 1, cor);
    pin.r(x - 1, y + 4, 3, 4, cor);
  };
  /** Os 8 Times da T1, um boneco de cada, comemorando. */
  const filaDosTimes = (y: number, escala: number, pula = true) => {
    const largura = 12 * escala;
    const vao = (COLUNAS - 16 - TIMES_FUNDADORES.length * largura) / (TIMES_FUNDADORES.length - 1);
    TIMES_FUNDADORES.forEach((time: TimeId, k) => {
      const pos = POSICAO_DA_FILA[k]!;
      const salto = pula && (passo + k) % 4 === 0 ? 2 : 0;
      boneco(pin, pos === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme(time, pos, `agradecimento-${k}`), 8 + k * (largura + vao), y - salto, escala);
    });
  };
  const escudoDe = (time: TimeId, cx: number, y: number, escala: number) => {
    pin.ctx.imageSmoothingEnabled = false;
    pin.ctx.drawImage(escudoDoTime(time), Math.round((cx - (LARGURA_ESCUDO * escala) / 2) * pin.px), Math.round(y * pin.px), LARGURA_ESCUDO * escala * pin.px, ALTURA_ESCUDO * escala * pin.px);
  };
  /** O Selo da Temporada 1, como na página de Carreira: madeira, borda dourada e estrela. */
  const selo = (cx: number, cy: number, escala: number) => {
    const w = 132 * escala;
    const h = 30 * escala;
    pin.placa(cx - w / 2, cy - h / 2, w, h, { fundo: MADEIRA, luz: DOURADO, sombra: '#3A2410', degrau: Math.max(2, Math.round(2 * escala)) });
    pin.texto('★', cx - w / 2 + 16 * escala, cy + 1, 18 * escala, texto, DOURADO, { peso: 700 });
    pin.texto('Temporada 1', cx + 10 * escala, cy + 1, pin.caber('Temporada 1', w - 40 * escala, 18 * escala, display), display, '#FFF6DF', { contorno: COR.contorno });
  };
  /** Número que conta até o valor em `dur` segundos a partir de `de`. */
  const conta = (valor: number, de: number, dur = 1.2) => String(Math.round(valor * Math.min(1, Math.max(0, (t - de) / dur))));

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      if (o.escudo) surge(entre(t, 0, 0.5), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 96, 88));
      surge(entre(t, 0.4, 0.9), () => {
        pin.texto('Fim da', COLUNAS / 2, 178, 34, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('Temporada 1', COLUNAS / 2, 218, pin.caber('Temporada 1', 240, 46, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.2, 1.7), () => filaDosTimes(262, 2.5));
      surge(entre(t, 2.0, 2.5), () => {
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('OBRIGADO!', COLUNAS / 2, 362, 40 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
      });
      break;
    }
    case 'NUMEROS': {
      titulo('A Temporada 1 em números');
      const linhas: [string, number, string][] = [
        ['Jogadores inscritos', d.inscritos, 'pelos comentários'],
        ['Jogos', d.jogos, 'Fase de Liga e Mata-mata'],
        ['Gols', d.gols, 'cada um narrado'],
      ];
      linhas.forEach(([nome, valor, apoio], k) => {
        const y = 92 + k * 96;
        const de = 0.5 + k * 1.4;
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(14, y, 242, 84);
          pin.texto(nome, 30, y + 26, pin.caber(nome, 140, 18, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(apoio, 30, y + 54, pin.caber(apoio, 140, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
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
        const frases = ['A cada um que comentou,', 'se inscreveu e acreditou', 'num projeto que tinha', 'acabado de nascer.'];
        frases.forEach((f, k) => pin.texto(f, COLUNAS / 2, 170 + k * 22, pin.caber(f, 222, 14, texto, 700), texto, COR.placa, { peso: 700 }));
      });
      // Os escudos dos 8 Times, um a um.
      TIMES_FUNDADORES.forEach((time: TimeId, k) => {
        const col = k % 4;
        const lin = Math.floor(k / 4);
        surge(entre(t, 2.4 + k * 0.25, 2.8 + k * 0.25), () => escudoDe(time, 48 + col * 58, 276 + lin * 66, 2.2), 8);
      });
      surge(entre(t, 5.0, 5.4), () => pin.texto('A Liga é de vocês', COLUNAS / 2, 424, 15, display, VERDE, { contorno: COR.contorno }));
      break;
    }
    case 'SELO': {
      titulo('Selo da Temporada 1');
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Para todo mundo que jogou', COLUNAS / 2, 90, 12, texto, COR.placa, { peso: 700 });
        pin.texto('a primeira Temporada', COLUNAS / 2, 106, 12, texto, COR.placa, { peso: 700 });
      });
      surge(entre(t, 1.0, 1.6), () => {
        const brilho = 1 + 0.03 * Math.sin(t * 5);
        selo(COLUNAS / 2, 168, 1.6 * brilho);
      }, 16);
      surge(entre(t, 2.0, 2.5), () => {
        boneco(pin, corre(0), uniforme('ONC', 'ATA', 'agradecimento-selo'), COLUNAS / 2 - 24, 214, 4);
      });
      surge(entre(t, 3.0, 3.4), () => {
        pin.placa(22, 304, 226, 52, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('Na sua página de Carreira', COLUNAS / 2, 322, 12, texto, COR.tinta, { peso: 700 });
        pin.texto('no site: link na bio', COLUNAS / 2, 340, 11, texto, COR.tinta, { peso: 600 });
      });
      surge(entre(t, 4.0, 4.4), () => pin.texto('Pra sempre: só quem estava aqui no começo', COLUNAS / 2, 384, pin.caber('Pra sempre: só quem estava aqui no começo', 236, 11, texto, 700), texto, COR.placaSombra, { peso: 700 }));
      break;
    }
    case 'PISO': {
      titulo('Presente: OVR mínimo');
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Ninguém da Temporada 1', COLUNAS / 2, 90, 13, texto, COR.placa, { peso: 700 });
        pin.texto('começa a Temporada 2 abaixo de', COLUNAS / 2, 108, 13, texto, COR.placa, { peso: 700 });
      });
      surge(entre(t, 0.9, 1.4), () => {
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto(String(d.piso), COLUNAS / 2, 166, 64 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 2 });
        pin.texto('OVR', COLUNAS / 2, 206, 14, texto, COR.placa, { peso: 700 });
      });
      // Um Jogador que estava abaixo vendo o OVR subir até o piso.
      surge(entre(t, 2.2, 2.7), () => {
        pin.tabua(14, 230, 242, 96);
        boneco(pin, corre(1), uniforme('TAT', 'ZAG', 'agradecimento-piso'), 30, 244, 4);
        const antes = d.piso - 4;
        const ovr = Math.min(d.piso, antes + Math.floor(Math.max(0, t - 3.0) / 0.45));
        plaquinha(pin, 168, 254, 64, 44, String(ovr), display);
        if (ovr < d.piso || passo % 2) {
          seta(214, 252 - (passo % 2), VERDE);
          seta(214, 266 - (passo % 2), VERDE);
        }
      }, 12);
      surge(entre(t, 4.4, 4.8), () => {
        pin.texto('Quem está abaixo sobe a Habilidade', COLUNAS / 2, 354, pin.caber('Quem está abaixo sobe a Habilidade', 236, 11.5, texto, 700), texto, COR.placa, { peso: 700 });
        pin.texto('principal da Posição', COLUNAS / 2, 372, 11.5, texto, COR.placa, { peso: 700 });
        pin.texto('Quem já está acima, continua onde está', COLUNAS / 2, 398, pin.caber('Quem já está acima, continua onde está', 236, 10.5, texto, 700), texto, COR.placaSombra, { peso: 700 });
      });
      break;
    }
    case 'BONUS': {
      titulo('E tem mais: evolução turbo');
      surge(entre(t, 0.5, 1.0), () => {
        const pulso = 1 + 0.05 * Math.sin(t * 6);
        seta(58, 116 - (passo % 2), VERDE);
        seta(58, 130 - (passo % 2), VERDE);
        pin.texto(`+${bonus}%`, COLUNAS / 2 + 10, 128, 58 * pulso, display, VERDE, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('nos ganhos de Habilidade', COLUNAS / 2, 170, 13, texto, COR.placa, { peso: 700 });
      });
      const passos: [string, string][] = [
        [`${d.rodadasDoBonus} primeiras Rodadas`, 'da Temporada 2'],
        ['Soma com a Resenha', 'comentou no Reels do jogo? evolui ainda mais'],
      ];
      passos.forEach(([a, b], k) => {
        const y = 196 + k * 74;
        surge(entre(t, 2.0 + k * 1.6, 2.4 + k * 1.6), () => {
          pin.tabua(14, y, 242, 64);
          plaquinha(pin, 38, y + 15, 30, 34, String(k + 1), display);
          pin.texto(a, 62, y + 24, pin.caber(a, 184, 19, display), display, k === 1 ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(b, 62, y + 46, pin.caber(b, 184, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
        }, 10);
      });
      surge(entre(t, 5.2, 5.6), () => pin.texto('Só pra quem tem o Selo da Temporada 1', COLUNAS / 2, 372, pin.caber('Só pra quem tem o Selo da Temporada 1', 236, 11.5, texto, 700), texto, DOURADO, { peso: 700 }));
      break;
    }
    case 'REBALANCEAMENTO': {
      const r = d.rebalanceamento!;
      titulo('Agora são duas Séries');
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Pra todo mundo jogar todas as partidas:', COLUNAS / 2, 88, pin.caber('Pra todo mundo jogar todas as partidas:', 236, 12, texto, 700), texto, COR.placa, { peso: 700 });
      });
      surge(entre(t, 0.9, 1.4), () => {
        pin.tabua(14, 104, 242, 62);
        pin.texto('Série A', 30, 128, 18, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
        pin.texto(`f\u200cica com os ${r.tamanhoDaA} primeiros inscritos`, 30, 150, pin.caber(`f\u200cica com os ${r.tamanhoDaA} primeiros inscritos`, 210, 11, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
      }, 10);
      // Os pares de Time Primo, um por vez: escudo da A → escudo da B.
      const pares = r.pares.length ? r.pares : [];
      if (pares.length) {
        surge(entre(t, 2.0, 2.4), () => {
          const k = Math.min(pares.length - 1, Math.floor(Math.max(0, t - 2.0) / 1.1) % pares.length);
          const [de, para] = pares[k]!;
          escudoDe(de, 72, 186, 2.6);
          // Seta para a direita: cabo e ponta em pixels.
          const dx = (passo % 2) * 2;
          pin.r(114 + dx, 213, 32, 4, VERDE);
          for (let i = 0; i < 7; i++) pin.r(146 + dx + i, 208 + i, 1, 14 - 2 * i, VERDE);
          escudoDe(para, 198, 186, 2.6);
          pin.texto('Série A', 72, 262, 11, texto, COR.placaSombra, { peso: 700 });
          pin.texto('Time Primo na B', 198, 262, 11, texto, COR.placaSombra, { peso: 700 });
        });
      }
      surge(entre(t, 3.6, 4.1), () => {
        pin.tabua(14, 280, 242, 92);
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto(String(r.movidos), 56, 326, 40 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('Jogadores vão pra', 92, 312, pin.caber('Jogadores vão pra', 150, 15, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
        pin.texto('Série B', 92, 334, 20, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
        pin.texto('mesma posição, no Time Primo', 92, 356, pin.caber('mesma posição, no Time Primo', 156, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
      }, 10);
      surge(entre(t, 5.2, 5.6), () => pin.texto('OVR, apelido e Carreira vão junto', COLUNAS / 2, 398, pin.caber('OVR, apelido e Carreira vão junto', 236, 12, texto, 700), texto, VERDE, { peso: 700 }));
      break;
    }
    case 'FUNDADOR': {
      titulo('Quem foi pra B é Fundador');
      const itens: [string, string][] = [
        ['Título de Fundador', 'na sua página de Carreira'],
        ['Prioridade na camisa', 'escolhe o número primeiro'],
        ['Volta grátis', 'na próxima Janela, sem gastar a Transferência'],
      ];
      itens.forEach(([a, b], k) => {
        const y = 86 + k * 74;
        surge(entre(t, 0.6 + k * 1.3, 1.0 + k * 1.3), () => {
          pin.tabua(14, y, 242, 64);
          plaquinha(pin, 38, y + 15, 30, 34, String(k + 1), display);
          pin.texto(a, 62, y + 24, pin.caber(a, 184, 19, display), display, k === 0 ? DOURADO : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(b, 62, y + 46, pin.caber(b, 184, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
        }, 10);
      });
      surge(entre(t, 4.6, 5.0), () => {
        pin.placa(22, 322, 226, 52, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('Mudou de Time? Confere no site', COLUNAS / 2, 340, pin.caber('Mudou de Time? Confere no site', 210, 12, texto, 700), texto, COR.tinta, { peso: 700 });
        pin.texto('link na bio', COLUNAS / 2, 358, 11, texto, COR.tinta, { peso: 600 });
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Temporada 2', COLUNAS / 2, 70, pin.caber('Temporada 2', 240, 44, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('vem aí!', COLUNAS / 2, 112, 38, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.6, 1.0), () => {
        pin.tabua(14, 140, 242, 96);
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        if (d.aberturaAs !== undefined) {
          pin.texto('Hoje, Abertura da Temporada 2', COLUNAS / 2, 166, pin.caber('Hoje, Abertura da Temporada 2', 220, 13, texto, 700), texto, COR.placa, { peso: 700 });
          pin.texto(`ÀS ${d.aberturaAs}H`, COLUNAS / 2, 198, pin.caber(`ÀS ${d.aberturaAs}H`, 220, 30 * pulso, display), display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
          pin.texto('cheia de novidade: f\u200cica ligado!', COLUNAS / 2, 222, 10.5, texto, COR.placaSombra, { peso: 700 });
        } else {
          pin.texto('Cheia de novidade.', COLUNAS / 2, 166, 13, texto, COR.placa, { peso: 700 });
          pin.texto('FICA LIGADO', COLUNAS / 2, 198, pin.caber('FICA LIGADO', 220, 30 * pulso, display), display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
          pin.texto('ative as notificações do Instagram', COLUNAS / 2, 222, 10.5, texto, COR.placaSombra, { peso: 700 });
        }
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
