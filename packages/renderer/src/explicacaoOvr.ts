/**
 * Reels explicativo do OVR: de onde ele vem, o que faz subir e o que o Jogador pode fazer para
 * subir mais rápido, com as regras da Temporada 1. Mesmo estilo de cartelas do Reels que
 * explica a Escalação. Os números vêm das regras: pesos do OVR (`shared/habilidades.ts`), ações
 * e limites (`sim/evolucao.ts`, ADR-0010), Resenha (ADR-0034) e rodízio (`worker/escalacao.ts`).
 */
import { LIMITE_DELTA_HABILIDADE, MULTIPLICADOR_CLASSICO, PESOS_OVR, PRINCIPAL, type HabilidadeId, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, plaquinha } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDaExplicacaoOvr {
  /** Time que veste os bonecos do vídeo. */
  time: TimeId;
  /** Quanto os ganhos de Habilidade sobem com a Resenha (1,5 = 50% a mais). */
  multiplicadorResenha: number;
  /** Minutos antes do Apito Inicial em que a Escalação fecha (o Corte). */
  corteMinutos: number;
}

export const NOME_DA_HABILIDADE: Record<HabilidadeId, string> = { FIN: 'Finalização', PAS: 'Passe', DRI: 'Drible', DEF: 'Defesa', GOL: 'Goleiro' };
const POSICOES: readonly Posicao[] = ['ATA', 'MEI', 'ZAG', 'GOL'];
const POSICAO_ESCRITA: Record<Posicao, string> = { GOL: 'Goleiro', ZAG: 'Zagueiro', MEI: 'Meia', ATA: 'Atacante' };

/** "Finalização 55%": a Habilidade que mais pesa no OVR da Posição. */
export function principalDa(posicao: Posicao): { habilidade: string; peso: number } {
  const hab = PRINCIPAL[posicao];
  return { habilidade: NOME_DA_HABILIDADE[hab], peso: Math.round(PESOS_OVR[posicao][hab]! * 100) };
}

/** "50%" para 1,5. */
export const bonusDaResenha = (multiplicador: number): number => Math.round((multiplicador - 1) * 100);

/** O que sobe cada Habilidade (as ações de maior valor em `sim/evolucao.ts`). */
export const O_QUE_SOBE: readonly [string, HabilidadeId][] = [
  ['Gol', 'FIN'],
  ['Assistência', 'PAS'],
  ['Passar pelo marcador', 'DRI'],
  ['Desarme e bloqueio', 'DEF'],
  ['Defesa do goleiro', 'GOL'],
];

// ---------------------------------------------------------------- roteiro

export type CartelaOvr = 'ABERTURA' | 'HABILIDADES' | 'ACOES' | 'REGRAS' | 'RESENHA' | 'JOGAR' | 'CHAMADA';
export type SegmentoOvr = Segmento & { cartela: CartelaOvr };

const ORDEM: CartelaOvr[] = ['ABERTURA', 'HABILIDADES', 'ACOES', 'REGRAS', 'RESENHA', 'JOGAR', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaOvr, number> = { ABERTURA: 4.5, HABILIDADES: 8, ACOES: 9, REGRAS: 8, RESENHA: 9, JOGAR: 8.5, CHAMADA: 6 };
const CORTE = 0.3;

export class RoteiroExplicacaoOvr {
  readonly segmentos: SegmentoOvr[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDaExplicacaoOvr,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    let cursor = 0;
    this.segmentos = ORDEM.map((cartela, i) => {
      const inicio = cursor;
      cursor += Math.max(DURACAO_BASE[cartela], (minimos[i]?.antes ?? 0) + 0.6);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoOvr; indice: number; tempo: number; escurecer: number } {
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

const NUMERO: Record<number, string> = { 1: 'um ponto', 2: 'dois pontos', 3: 'três pontos', 4: 'quatro pontos' };
const POR_EXTENSO: Record<number, string> = { 25: 'vinte e cinco', 50: 'cinquenta', 75: 'setenta e cinco', 100: 'cem' };

export function narracaoDaExplicacaoOvr(roteiro: RoteiroExplicacaoOvr): Fala[] {
  const d = roteiro.dados;
  const bonus = bonusDaResenha(d.multiplicadorResenha);
  const corte = d.corteMinutos === 30 ? 'meia hora' : `${d.corteMinutos} minutos`;
  const texto: Record<CartelaOvr, string> = {
    ABERTURA: 'Quer ver o seu OVR subir? Então presta atenção, que agora ele pesa mais em cada lance!',
    HABILIDADES: 'O OVR é a média das suas cinco habilidades, com o peso da sua posição. Atacante vive de finalização, meia de passe, zagueiro de defesa, e goleiro de pegar tudo.',
    ACOES: 'Cada ação sua no jogo mexe numa habilidade. Gol sobe finalização, assistência sobe passe, desarme sobe defesa. Mas chute pra fora e bola perdida fazem cair.',
    REGRAS: `Só evolui quem entra em campo, e quem fica de fora não perde nada. Cada habilidade muda no máximo ${NUMERO[LIMITE_DELTA_HABILIDADE] ?? `${LIMITE_DELTA_HABILIDADE} pontos`} por jogo. E no clássico, tudo vale ${MULTIPLICADOR_CLASSICO === 2 ? 'em dobro' : `${MULTIPLICADOR_CLASSICO} vezes mais`}.`,
    RESENHA: `E tem novidade: a resenha! Comentou no vídeo do último jogo do seu time, até ${corte} antes do próximo? Se você for escalado, as suas habilidades sobem ${POR_EXTENSO[bonus] ?? bonus} por cento mais rápido.`,
    JOGAR: 'Quer jogar mais vezes? Escolha uma posição com vaga, use a sua transferência, ou seja o Craque da Rodada, que tem lugar garantido no jogo seguinte.',
    CHAMADA: 'Então já sabe: teve jogo do seu time, comenta no vídeo do jogo!',
  };
  return roteiro.segmentos.map((s, i): Fala => {
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA';
    return { id: `explicacao-ovr-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesExplicacaoOvr {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const VERDE = '#A5CF8E';
const VERMELHO = '#E8846B';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function desenharQuadroExplicacaoOvr(ctx: CanvasRenderingContext2D, roteiro: RoteiroExplicacaoOvr, tVideo: number, o: OpcoesExplicacaoOvr = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const passo = Math.floor(tVideo * 4);
  const bonus = bonusDaResenha(d.multiplicadorResenha);
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
  /** Seta de subir (ou descer) em pixels: triângulo com cabo. */
  const seta = (x: number, y: number, cor: string, sobe = true) => {
    for (let k = 0; k < 4; k++) pin.r(x - k, y + (sobe ? k : 7 - k), 1 + 2 * k, 1, cor);
    pin.r(x - 1, y + (sobe ? 4 : 0), 3, 4, cor);
  };
  /** Tábua com uma frase forte e uma linha de apoio. */
  const tabuaDeTexto = (y: number, h: number, forte: string, apoio: string, cor: string = COR.amarelo) => {
    pin.tabua(14, y, 242, h);
    pin.texto(forte, COLUNAS / 2, y + h / 2 - 10, pin.caber(forte, 222, 22, display), display, cor, { contorno: COR.contorno });
    pin.texto(apoio, COLUNAS / 2, y + h / 2 + 13, pin.caber(apoio, 222, 11, texto, 700), texto, COR.placa, { peso: 700 });
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      surge(entre(t, 0, 0.5), () => {
        pin.texto('Como o seu', COLUNAS / 2, 92, 38, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('OVR sobe?', COLUNAS / 2, 132, 46, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      // O Jogador comemorando, com a plaquinha do OVR subindo ponto a ponto.
      surge(entre(t, 0.6, 1.1), () => {
        boneco(pin, corre(0), uniforme(d.time, 'ATA', 'ovr-abertura'), COLUNAS / 2 - 62, 186, 4);
        const ovr = 64 + Math.min(4, Math.floor(Math.max(0, t - 1.1) / 0.55));
        plaquinha(pin, COLUNAS / 2 + 36, 196, 64, 44, String(ovr), display);
        pin.texto('OVR', COLUNAS / 2 + 36, 250, 11, texto, COR.placa, { peso: 700 });
        seta(COLUNAS / 2 + 84, 208 - (passo % 2), VERDE);
        seta(COLUNAS / 2 + 84, 222 - (passo % 2), VERDE);
      });
      surge(entre(t, 1.6, 2.1), () => tabuaDeTexto(290, 62, 'Agora o OVR pesa mais', 'em cada lance da Partida'));
      if (o.escudo) surge(entre(t, 2.1, 2.6), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 408, 64));
      break;
    }
    case 'HABILIDADES': {
      titulo('O OVR vem das Habilidades');
      surge(entre(t, 0.3, 0.7), () => {
        pin.texto('A média das suas 5 Habilidades, com o', COLUNAS / 2, 86, 11, texto, COR.placa, { peso: 700 });
        pin.texto('peso da Posição. A que mais pesa:', COLUNAS / 2, 100, 11, texto, COR.placa, { peso: 700 });
      });
      POSICOES.forEach((p, k) => {
        const y = 114 + k * 64;
        const pr = principalDa(p);
        surge(entre(t, 0.9 + k * 0.7, 1.3 + k * 0.7), () => {
          pin.tabua(14, y, 242, 58);
          boneco(pin, p === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme(d.time, p, `ovr-hab-${k}`), 24, y + 6, 2.75);
          pin.texto(POSICAO_ESCRITA[p], 70, y + 16, 13, texto, COR.placa, { alinhar: 'left', peso: 700 });
          pin.texto(pr.habilidade, 70, y + 38, pin.caber(pr.habilidade, 116, 24, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          plaquinha(pin, 222, y + 14, 50, 32, `${pr.peso}%`, display);
        }, 8);
      });
      surge(entre(t, 4.2, 4.6), () => {
        pin.texto('Subiu a Habilidade, subiu o OVR', COLUNAS / 2, 386, 13, texto, VERDE, { peso: 700 });
      });
      break;
    }
    case 'ACOES': {
      titulo('O que faz subir');
      O_QUE_SOBE.forEach(([acao, hab], k) => {
        const y = 80 + k * 44;
        surge(entre(t, 0.5 + k * 0.7, 0.9 + k * 0.7), () => {
          pin.tabua(14, y, 242, 38);
          seta(30, y + 15, VERDE);
          pin.texto(acao, 44, y + 19, pin.caber(acao, 118, 16, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(NOME_DA_HABILIDADE[hab], 246, y + 19, pin.caber(NOME_DA_HABILIDADE[hab], 78, 16, display), display, COR.amarelo, { alinhar: 'right', contorno: COR.contorno });
        }, 8);
      });
      surge(entre(t, 4.4, 4.8), () => {
        pin.placa(14, 306, 242, 76, { fundo: '#5C2A20', luz: '#7A3A2C', sombra: '#3F1C15', degrau: 3 });
        seta(30, 318, VERMELHO, false);
        pin.texto('E o que faz descer', 44, 322, 16, display, VERMELHO, { alinhar: 'left', contorno: COR.contorno });
        pin.texto('chute pra fora, defendido ou bloqueado,', COLUNAS / 2, 346, 10.5, texto, COR.placa, { peso: 700 });
        pin.texto('perder a bola, ser driblado e levar gol', COLUNAS / 2, 362, 10.5, texto, COR.placa, { peso: 700 });
      });
      break;
    }
    case 'REGRAS': {
      titulo('Regras da evolução');
      const regras: [string, string][] = [
        ['Só evolui quem joga', 'ficou fora da Escalação? não perde nada'],
        [`Máximo ${LIMITE_DELTA_HABILIDADE} pontos`, 'por Habilidade, em cada Partida'],
        [MULTIPLICADOR_CLASSICO === 2 ? 'Clássico vale em dobro' : `Clássico vale ${MULTIPLICADOR_CLASSICO}x`, 'sobe mais rápido (e desce também)'],
      ];
      regras.forEach(([a, b], k) => {
        const y = 86 + k * 96;
        surge(entre(t, 0.5 + k * 1.7, 0.9 + k * 1.7), () => tabuaDeTexto(y, 84, a, b, k === 2 ? COR.amarelo : COR.placa), 12);
      });
      surge(entre(t, 5.6, 6.0), () => {
        pin.texto('Quem já está alto sobe mais devagar', COLUNAS / 2, 392, 11, texto, COR.placaSombra, { peso: 700 });
      });
      break;
    }
    case 'RESENHA': {
      titulo('Novidade: Resenha');
      const passos: [string, string][] = [
        ['Comente no Reels', 'do último jogo do seu Time'],
        [`Até ${d.corteMinutos} min antes`, 'do próximo jogo do Time (o Corte)'],
        ['Foi escalado?', 'suas Habilidades sobem mais rápido'],
      ];
      passos.forEach(([a, b], k) => {
        const y = 82 + k * 66;
        surge(entre(t, 0.5 + k * 1.4, 0.9 + k * 1.4), () => {
          pin.tabua(14, y, 242, 58);
          plaquinha(pin, 38, y + 12, 30, 34, String(k + 1), display);
          pin.texto(a, 62, y + 21, pin.caber(a, 184, 19, display), display, k === 2 ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(b, 62, y + 42, pin.caber(b, 184, 10.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
        }, 10);
      });
      surge(entre(t, 4.6, 5.0), () => {
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        seta(62, 300 - (passo % 2), VERDE);
        seta(62, 314 - (passo % 2), VERDE);
        pin.texto(`+${bonus}%`, COLUNAS / 2 + 8, 310, 50 * pulso, display, VERDE, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('nos ganhos de Habilidade daquela Partida', COLUNAS / 2, 348, 11, texto, COR.placa, { peso: 700 });
      });
      surge(entre(t, 5.6, 6.0), () => {
        pin.placa(22, 366, 226, 34, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('Um comentário basta. Vale qualquer comentário.', COLUNAS / 2, 383, pin.caber('Um comentário basta. Vale qualquer comentário.', 210, 10, texto, 700), texto, COR.tinta, { peso: 700 });
      });
      break;
    }
    case 'JOGAR': {
      titulo('Jogue mais vezes');
      surge(entre(t, 0.3, 0.6), () => {
        pin.texto('Mais jogos, mais chances de subir', COLUNAS / 2, 86, 11, texto, COR.placa, { peso: 700 });
      });
      const dicas: [string, string, string][] = [
        ['Posição com vaga', 'menos gente na fila do rodízio:', 'você entra em mais jogos'],
        ['Transferência', 'comente TRANSFERIR + Time ou Posição', 'vale uma por Temporada'],
        ['Craque da Rodada', 'tem lugar garantido no jogo seguinte:', 'peça votos no Resumo da Rodada'],
      ];
      dicas.forEach(([a, b, c], k) => {
        const y = 100 + k * 98;
        surge(entre(t, 0.7 + k * 1.7, 1.1 + k * 1.7), () => {
          pin.tabua(14, y, 242, 88);
          pin.texto(a, COLUNAS / 2, y + 22, pin.caber(a, 222, 24, display), display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(b, COLUNAS / 2, y + 50, pin.caber(b, 224, 11, texto, 700), texto, COR.placa, { peso: 700 });
          pin.texto(c, COLUNAS / 2, y + 68, pin.caber(c, 224, 11, texto, 700), texto, COR.placa, { peso: 700 });
        }, 12);
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Quer subir', COLUNAS / 2, 66, 36, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('o seu OVR?', COLUNAS / 2, 102, 42, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.5, 0.9), () => {
        pin.tabua(14, 134, 242, 128);
        pin.texto('Teve jogo do seu Time?', COLUNAS / 2, 156, 12, texto, COR.placa, { peso: 700 });
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('COMENTE', COLUNAS / 2, 190, 34 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('NO REELS DO JOGO', COLUNAS / 2, 222, pin.caber('NO REELS DO JOGO', 220, 24, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto(`e evolua ${bonus}% mais rápido no próximo`, COLUNAS / 2, 246, 10, texto, COR.placaSombra, { peso: 700 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.texto('Suas Habilidades e o seu histórico', COLUNAS / 2, 284, 10, texto, COR.placa, { peso: 600 });
        pin.texto('no site: link na bio', COLUNAS / 2, 300, 10, texto, COR.placa, { peso: 600 });
      });
      if (o.escudo) surge(entre(t, 1.6, 2.2), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 380, 96));
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
