/**
 * Reels de Abertura de uma Temporada nova (a partir da T2): anuncia as Séries, o Acesso e o
 * Rebaixamento, avisa que as novidades saem em Reels próprios e chama para a Inscrição.
 * Mesmo estilo e mesmos ajudantes do Reels de apresentação da Liga (apresentacao.ts).
 */
import { FALA_DO_TIME, IDENTIDADE, TIMES_FUNDADORES, TIMES_NOVOS, type Posicao, type TimeId } from '@liga/shared';
import { boneco, dataDa, entre, horaFalada, lista, NUMERO_FALADO, POSICAO_ESCRITA, POSICAO_FALADA, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, plaquinha } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDaAberturaDaTemporada {
  temporada: number;
  /** Dia da Rodada 1, AAAA-MM-DD. */
  estreia: string;
  /** Um jogo por hora, a Série B antes da A (ADR-0050). */
  horarios: { B: number[]; A: number[] };
  horaDoResumo: number;
  serieA: readonly TimeId[];
  serieB: readonly TimeId[];
  /** Hora (no mesmo dia do post) do Reels que conta quem vai para a Série B; null se não houver. */
  horaDoRebalanceamento: number | null;
  exemplo: { time: TimeId; posicao: Posicao; username: string };
}

export const DADOS_DA_ABERTURA_T2: Omit<DadosDaAberturaDaTemporada, 'estreia'> = {
  temporada: 2,
  horarios: { B: [11, 12, 13, 14], A: [15, 16, 17, 18] },
  horaDoResumo: 19,
  serieA: TIMES_FUNDADORES,
  serieB: TIMES_NOVOS,
  // O Rebalanceamento sai antes da Abertura, junto com o Agradecimento: sem aviso aqui.
  horaDoRebalanceamento: null,
  exemplo: { time: 'JAC', posicao: 'ATA', username: 'voce' },
};

export type CartelaAbertura = 'ABERTURA' | 'SERIES' | 'ACESSO' | 'NOVIDADES' | 'ENTRAR' | 'AGENDA' | 'CHAMADA';
export type SegmentoAbertura = Segmento & { cartela: CartelaAbertura };

const ORDEM: CartelaAbertura[] = ['ABERTURA', 'SERIES', 'ACESSO', 'NOVIDADES', 'ENTRAR', 'AGENDA', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaAbertura, number> = { ABERTURA: 4.5, SERIES: 9, ACESSO: 6.5, NOVIDADES: 8, ENTRAR: 8.5, AGENDA: 7, CHAMADA: 6 };
const CORTE = 0.3;

export class RoteiroAberturaDaTemporada {
  readonly segmentos: SegmentoAbertura[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDaAberturaDaTemporada,
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

  em(tBruto: number): { segmento: SegmentoAbertura; indice: number; tempo: number; escurecer: number } {
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

const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
/** "onze da manhã", "duas da tarde", "meio-dia". */
const horaComPeriodo = (h: number) => (h === 12 ? 'meio-dia' : h < 12 ? `${horaFalada(h, false)} da manhã` : horaFalada(h, true));
/** "das onze da manhã às duas da tarde", "do meio-dia às três da tarde". */
const faixa = (hs: number[]) => {
  const ini = hs[0]!;
  const fim = hs[hs.length - 1]!;
  const de = ini === 12 ? 'do meio-dia' : ini > 12 && fim > 12 ? `das ${horaFalada(ini, false)}` : `das ${horaComPeriodo(ini)}`;
  return `${de} às ${horaComPeriodo(fim)}`;
};

export function narracaoDaAbertura(roteiro: RoteiroAberturaDaTemporada): Fala[] {
  const d = roteiro.dados;
  const { dia, semana } = dataDa(d);
  const ex = d.exemplo;
  const n = d.temporada;
  return roteiro.segmentos.map((s, i): Fala => {
    const texto: Record<CartelaAbertura, string> = {
      ABERTURA: `Acabou a Temporada ${n - 1}. E já vem aí a Temporada ${n} do Varzeão da Mata!`,
      SERIES: `Agora são dezesseis times, em duas séries. Na Série A, os oito times que fizeram a Temporada ${n - 1}. Na Série B, chegam oito times novos: ${lista(d.serieB.map(curto))}.`,
      ACESSO: 'No fim da temporada, os dois últimos da Série A caem. E os dois finalistas da Série B sobem.',
      NOVIDADES:
        'E tem muita novidade: dentro de campo, pro capitão, pro seu jogador e no site. Amanhã sai um Reels explicando cada uma.' +
        (d.horaDoRebalanceamento ? ` E hoje, às ${horaFalada(d.horaDoRebalanceamento, true)}: quem vai jogar a Série B.` : ''),
      ENTRAR: `Quer jogar? Comenta ENTRO, o time e a posição. Tipo: ENTRO ${curto(ex.time)} ${POSICAO_FALADA[ex.posicao]}. Vale time da Série A ou da Série B. E quem já joga continua com o seu jogador.`,
      AGENDA: `A estreia é ${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO_FALADO[dia] ?? dia}. É um jogo por hora: a Série B ${faixa(d.horarios.B)}, e a Série A ${faixa(d.horarios.A)}.`,
      CHAMADA: `As inscrições estão abertas. Comenta aí e garante a sua vaga na Temporada ${n}!`,
    };
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA' || s.cartela === 'ENTRAR';
    return { id: `abertura-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesAbertura {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

/** Seta em pixel, para cima (subir) ou para baixo (cair). */
function seta(pin: Pincel, cx: number, y: number, paraCima: boolean, cor: string): void {
  const corpo = paraCima ? y + 10 : y;
  pin.r(cx - 3, corpo, 7, 14, COR.contorno);
  pin.r(cx - 2, corpo + 1, 5, 12, cor);
  for (let k = 0; k < 6; k++) {
    const w = 2 + k * 2;
    const yy = paraCima ? y + k * 2 : y + 22 - k * 2;
    pin.r(cx - w / 2 - 1, yy, w + 3, 2, COR.contorno);
    pin.r(cx - w / 2, yy, w + 1, 2, cor);
  }
}

export function desenharQuadroAbertura(ctx: CanvasRenderingContext2D, roteiro: RoteiroAberturaDaTemporada, tVideo: number, o: OpcoesAbertura = {}): void {
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
    pin.tabua(COLUNAS / 2 - 110, y - (1 - a) * 8, 220, 34);
    pin.texto(txt, COLUNAS / 2, y + 17 - (1 - a) * 8, pin.caber(txt, 200, 24, display), display, COR.amarelo, { contorno: COR.contorno });
    pin.ctx.globalAlpha = 1;
  };
  const surge = (a: number, desenhar: () => void, dy = 10) => {
    if (a <= 0) return;
    pin.ctx.save();
    pin.ctx.globalAlpha = a;
    pin.ctx.translate(0, (1 - a) * dy * pin.px);
    desenhar();
    pin.ctx.restore();
  };
  /** Grade de escudos com o nome curto embaixo, 4 por linha. */
  const grade = (times: readonly TimeId[], y: number, inicio: number, passoT: number) => {
    times.forEach((time, k) => {
      const x = 22 + (k % 4) * 58;
      const yy = y + Math.floor(k / 4) * 58;
      surge(entre(t, inicio + k * passoT, inicio + 0.3 + k * passoT), () => {
        desenharEscudo(pin, time, x + 9, yy, 1.4);
        const nome = curto(time);
        pin.texto(nome, x + 26, yy + 44, pin.caber(nome, 54, 9, texto, 700), texto, COR.placa, { peso: 700 });
      }, 8);
    });
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      const a = entre(t, 0, 0.7);
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 130 - (1 - a) * 30, 110 * (0.7 + 0.3 * a));
      surge(entre(t, 0.5, 1.0), () => {
        pin.texto('Temporada', COLUNAS / 2, 228, 34, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        const pulso = 1 + 0.05 * Math.sin(Math.max(0, t - 1) * 5);
        pin.texto(String(d.temporada), COLUNAS / 2, 290, 84 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 2 });
      });
      surge(entre(t, 1.2, 1.7), () => {
        pin.tabua(60, 334, 150, 30);
        pin.texto('vem aí!', COLUNAS / 2, 349, 18, display, COR.placa, { contorno: COR.contorno });
      });
      // Os 16 escudos no pé da tela, em duas fileiras.
      surge(entre(t, 1.6, 2.2), () => {
        [...d.serieA, ...d.serieB].forEach((time, k) => desenharEscudo(pin, time, 15 + (k % 8) * 31, 386 + Math.floor(k / 8) * 34, 1.1));
      });
      break;
    }
    case 'SERIES': {
      titulo('16 Times, 2 Séries');
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(12, 78, 246, 160);
        pin.texto('Série A', COLUNAS / 2, 96, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto(`os 8 da Temporada ${d.temporada - 1}`, COLUNAS / 2, 113, 8, texto, COR.placaSombra, { peso: 600 });
      });
      grade(d.serieA, 124, 0.6, 0.12);
      surge(entre(t, 3.2, 3.6), () => {
        pin.tabua(12, 250, 246, 160);
        pin.texto('Série B', COLUNAS / 2, 268, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('8 times novos', COLUNAS / 2, 285, 8, texto, COR.placaSombra, { peso: 600 });
      });
      grade(d.serieB, 296, 3.6, 0.45);
      // Selo "novo" piscando sobre a Série B.
      if (t > 3.6) {
        const piscar = Math.floor(t * 3) % 2 === 0;
        pin.ctx.globalAlpha = entre(t, 3.6, 3.9);
        pin.placa(196, 252, 54, 18, { fundo: piscar ? COR.amarelo : '#FFE07A', luz: '#FFE07A', sombra: '#B88600' });
        pin.texto('NOVOS', 223, 261, 10, display, COR.tinta);
        pin.ctx.globalAlpha = 1;
      }
      break;
    }
    case 'ACESSO': {
      titulo('Sobe e desce');
      const pula = (k: number) => Math.round(Math.sin(t * 5 + k) * 2);
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(12, 82, 246, 140);
        pin.texto('Série A', 70, 104, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('os 2 últimos da', 70, 128, 9, texto, COR.placa, { peso: 600 });
        pin.texto('Fase de Liga', 70, 141, 9, texto, COR.placa, { peso: 600 });
        pin.texto('caem', 70, 172, 26, display, '#FF6B5B', { contorno: COR.contorno, espessura: 1.5 });
        ['7', '8'].forEach((pos, k) => {
          const y = 104 + k * 50;
          plaquinha(pin, 150, y, 30, 26, pos, display);
          pin.texto('lugar', 165, y + 36, 7, texto, COR.placa, { peso: 700 });
          seta(pin, 210, y + pula(k), false, '#FF6B5B');
        });
      });
      surge(entre(t, 2.4, 2.8), () => {
        pin.tabua(12, 238, 246, 140);
        pin.texto('Série B', 70, 260, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('os 2 finalistas', 70, 284, 9, texto, COR.placa, { peso: 600 });
        pin.texto('do Mata-mata', 70, 297, 9, texto, COR.placa, { peso: 600 });
        pin.texto('sobem', 70, 328, 26, display, '#7FD36B', { contorno: COR.contorno, espessura: 1.5 });
        [0, 1].forEach((k) => {
          const y = 260 + k * 50;
          plaquinha(pin, 150, y, 30, 26, '?', display);
          seta(pin, 210, y + pula(k + 2), true, '#7FD36B');
        });
      });
      surge(entre(t, 4.2, 4.6), () => {
        pin.texto('o Jogador vai junto com o Time', COLUNAS / 2, 404, pin.caber('o Jogador vai junto com o Time', 230, 11, texto, 700), texto, COR.placa, { peso: 700 });
      });
      break;
    }
    case 'NOVIDADES': {
      titulo('Muita novidade');
      const blocos: [string, (x: number, y: number) => void][] = [
        ['Dentro de campo', (x, y) => {
          // cartão amarelo e apito
          pin.r(x - 9, y - 12, 14, 20, COR.contorno);
          pin.r(x - 8, y - 11, 12, 18, COR.amarelo);
          pin.r(x + 8, y + 1, 12, 7, COR.contorno);
          pin.r(x + 9, y + 2, 10, 5, '#C9C9C9');
        }],
        ['Capitão', (x, y) => {
          pin.r(x - 12, y - 8, 24, 16, COR.contorno);
          pin.r(x - 11, y - 7, 22, 14, '#1F4FD1');
          pin.texto('C', x, y, 14, display, '#FFFFFF');
        }],
        ['Seu Jogador', (x, y) => boneco(pin, (passo % 2 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO') as Pose, uniforme('ARA', 'MEI', 'novidade'), x - 9, y - 13, 1.5)],
        ['Site e App', (x, y) => {
          pin.r(x - 8, y - 13, 16, 26, COR.contorno);
          pin.r(x - 7, y - 12, 14, 22, '#8FD3FF');
          pin.r(x - 7, y + 9, 14, 1, COR.contorno);
          pin.r(x - 4, y - 8, 8, 3, COR.amarelo);
          pin.r(x - 4, y - 3, 8, 2, '#FFFFFF');
          pin.r(x - 4, y + 1, 6, 2, '#FFFFFF');
        }],
      ];
      blocos.forEach(([nome, icone], k) => {
        const x = 14 + (k % 2) * 124;
        const y = 80 + Math.floor(k / 2) * 92;
        surge(entre(t, 0.4 + k * 0.5, 0.75 + k * 0.5), () => {
          pin.tabua(x, y, 118, 84);
          icone(x + 59, y + 30);
          pin.texto(nome, x + 59, y + 64, pin.caber(nome, 106, 15, display), display, COR.amarelo, { contorno: COR.contorno });
        }, 12);
      });
      surge(entre(t, 2.8, 3.2), () => {
        pin.tabua(14, 274, 242, 54);
        pin.texto('Amanhã', COLUNAS / 2, 292, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('um Reels explicando cada uma', COLUNAS / 2, 312, 9, texto, COR.placa, { peso: 700 });
      });
      if (d.horaDoRebalanceamento) {
        surge(entre(t, 4.6, 5.0), () => {
          pin.tabua(14, 340, 242, 54);
          pin.texto(`Hoje, ${d.horaDoRebalanceamento}h`, COLUNAS / 2, 358, 18, display, COR.amarelo, { contorno: COR.contorno });
          pin.texto('quem vai jogar a Série B', COLUNAS / 2, 378, 12, display, COR.placa, { contorno: COR.contorno });
        });
      }
      break;
    }
    case 'ENTRAR': {
      titulo('Como entrar');
      const ex = d.exemplo;
      const comando = `ENTRO ${curto(ex.time).toUpperCase()} ${POSICAO_ESCRITA[ex.posicao]}`;
      surge(entre(t, 0.2, 0.5), () => {
        pin.placa(14, 82, 242, 58, { fundo: '#FFFFFF', luz: '#FFFFFF', sombra: '#C9C9C9' });
        const av = IDENTIDADE[ex.time];
        pin.r(24, 94, 18, 18, av.primaria);
        pin.r(24, 94, 18, 2, COR.contorno);
        boneco(pin, 'FRENTE_PARADO', uniforme(ex.time, ex.posicao, `@${ex.username}`), 27, 93, 1);
        pin.texto(`@${ex.username}`, 50, 99, 9, texto, COR.tinta, { alinhar: 'left', peso: 700 });
        const letras = Math.floor(entre(t, 0.7, 2.4) * comando.length);
        const cursor = Math.floor(t * 3) % 2 === 0 && letras < comando.length ? '|' : '';
        pin.texto(comando.slice(0, letras) + cursor, 50, 120, pin.caber(comando, 196, 16, display), display, COR.tinta, { alinhar: 'left' });
      }, 0);
      surge(entre(t, 2.8, 3.2), () => {
        pin.tabua(14, 156, 242, 96);
        pin.texto('Vale qualquer Time', COLUNAS / 2, 176, 16, display, COR.amarelo, { contorno: COR.contorno });
        const tres = [d.serieA[0]!, d.serieA[1]!, d.serieB[0]!, d.serieB[4]!];
        tres.forEach((time, k) => desenharEscudo(pin, time, 40 + k * 50, 192, 1.2));
        pin.texto('Série A ou Série B', COLUNAS / 2, 238, 13, display, COR.placa, { contorno: COR.contorno });
      });
      surge(entre(t, 5.0, 5.4), () => {
        pin.tabua(14, 266, 242, 140);
        pin.texto('Já joga?', COLUNAS / 2, 286, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('seu Jogador continua', COLUNAS / 2, 306, 10, texto, COR.placa, { peso: 700 });
        pin.texto('com OVR e carreira', COLUNAS / 2, 320, 10, texto, COR.placa, { peso: 700 });
        const pose: Pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        boneco(pin, pose, uniforme('CAP', 'ATA', 'veterano'), COLUNAS / 2 - 18, 330, 3);
        plaquinha(pin, COLUNAS / 2 + 26, 340, 28, 24, '71', display);
      });
      break;
    }
    case 'AGENDA': {
      titulo(`Temporada ${d.temporada}`);
      const { dia, mes, semana } = dataDa(d);
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(22, 84, 226, 100);
        pin.texto('Estreia', COLUNAS / 2, 102, 14, texto, COR.placa, { peso: 700 });
        pin.texto(`${semana}, ${dia} de ${mes}`, COLUNAS / 2, 132, pin.caber(`${semana}, ${dia} de ${mes}`, 206, 28, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('uma rodada por dia', COLUNAS / 2, 162, 10, texto, COR.placaSombra, { peso: 600 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.tabua(14, 196, 242, 108);
        pin.texto('Um jogo por hora', COLUNAS / 2, 212, 12, texto, COR.placa, { peso: 700 });
        (['B', 'A'] as const).forEach((serie, linha) => {
          const y = 226 + linha * 38;
          pin.texto(`Série ${serie}`, 44, y + 13, 12, display, COR.amarelo, { contorno: COR.contorno });
          d.horarios[serie].forEach((h, k) => plaquinha(pin, 80 + k * 44, y, 38, 26, `${h}h`, display));
        });
      });
      surge(entre(t, 3.4, 3.8), () => {
        pin.tabua(22, 308, 226, 52);
        pin.texto(`${d.horaDoResumo}h: Resumo e votação`, COLUNAS / 2, 334, pin.caber(`${d.horaDoResumo}h: Resumo e votação`, 206, 18, display), display, COR.placa, { contorno: COR.contorno });
      });
      surge(entre(t, 4.0, 4.4), () => {
        pin.tabua(22, 372, 226, 52);
        pin.texto('7 rodadas, semifinal e final', COLUNAS / 2, 398, pin.caber('7 rodadas, semifinal e final', 206, 18, display), display, COR.amarelo, { contorno: COR.contorno });
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Inscrições', COLUNAS / 2, 66, 36, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('abertas!', COLUNAS / 2, 100, 44, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.5, 0.9), () => {
        pin.tabua(14, 130, 242, 132);
        pin.texto('Comente aqui embaixo', COLUNAS / 2, 150, 11, texto, COR.placa, { peso: 700 });
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('ENTRO', COLUNAS / 2, 184, 34 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('+ TIME + POSIÇÃO', COLUNAS / 2, 216, pin.caber('+ TIME + POSIÇÃO', 220, 24, display), display, COR.amarelo, { contorno: COR.contorno });
        const ex = `Ex.: ENTRO ${curto(d.exemplo.time).toUpperCase()} ${POSICAO_ESCRITA[d.exemplo.posicao]}`;
        pin.texto(ex, COLUNAS / 2, 244, pin.caber(ex, 220, 9, texto, 600), texto, COR.placaSombra, { peso: 600 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.texto('tabela, jogadores e votação', COLUNAS / 2, 284, 10, texto, COR.placa, { peso: 600 });
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
