/**
 * Reels de anúncio: "cuide do seu personagem pelo site" (ADR-0013). Mesmo estilo do Reels
 * de apresentação (tábuas sobre o campo, narrado pelo Locutor); cada tela estica até a fala
 * caber. Ensina o vínculo pela DM e a Transferência.
 */
import { IDENTIDADE, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export type CartelaAnuncio = 'NOVIDADE' | 'TRANSFERENCIA' | 'SITE' | 'CODIGO' | 'DM' | 'PRONTO' | 'PEDIR' | 'COMENTARIO';
export type SegmentoAnuncio = Segmento & { cartela: CartelaAnuncio };

const ORDEM: CartelaAnuncio[] = ['NOVIDADE', 'TRANSFERENCIA', 'SITE', 'CODIGO', 'DM', 'PRONTO', 'PEDIR', 'COMENTARIO'];
const DURACAO_BASE: Record<CartelaAnuncio, number> = { NOVIDADE: 4.5, TRANSFERENCIA: 5.5, SITE: 5.5, CODIGO: 6, DM: 5.5, PRONTO: 5.5, PEDIR: 6.5, COMENTARIO: 7.5 };
const CORTE = 0.3;

/** O exemplo do vídeo: um atacante da Onça que vai para a Preguiça como zagueiro. */
const EX = { de: 'ONC' as TimeId, para: 'PRE' as TimeId, posicao: 'ATA' as Posicao, nova: 'ZAG' as Posicao, username: 'voce', codigo: 'VZ-1234' };

export class RoteiroAnuncio {
  readonly segmentos: SegmentoAnuncio[];
  readonly duracao: number;

  constructor(minimos: Record<number, { antes?: number }> = {}) {
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

  em(tBruto: number): { segmento: SegmentoAnuncio; indice: number; tempo: number; escurecer: number } {
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

export function narracaoDoAnuncio(roteiro: RoteiroAnuncio): Fala[] {
  const texto: Record<CartelaAnuncio, string> = {
    NOVIDADE: 'Novidade no Varzeão da Mata! Agora você cuida do seu personagem pelo site.',
    TRANSFERENCIA: 'Uma vez por temporada, você pode trocar de time, de posição, ou dos dois.',
    SITE: 'É fácil: abre o site, que tá no link da bio, e procura o seu arroba.',
    CODIGO: 'Toca em Vincular pela DM. Vai aparecer um código, tipo vê zê, um, dois, três, quatro.',
    DM: 'Manda esse código aqui na nossa DM, pela sua própria conta.',
    PRONTO: 'Volta no site e toca em Já mandei. Pronto: personagem vinculado!',
    PEDIR: 'Agora é só escolher o time e a posição, e pedir a transferência. Vale do próximo jogo em diante.',
    COMENTARIO: 'Prefere comentar? Escreve TRANSFERIR, o time e a posição. Só não vale ir pra time lotado: a Liga mantém os times equilibrados!',
  };
  return roteiro.segmentos.map((s, i): Fala => ({
    id: `anuncio-${i}`,
    texto: texto[s.cartela],
    inicio: s.inicio + 0.35,
    limite: s.fim,
    tom: s.cartela === 'NOVIDADE' || s.cartela === 'PRONTO' ? 'animado' : 'normal',
    segmento: i,
    parte: 'antes',
  }));
}

/** Telas reais do site (capturas a 360×640), na ordem do passo a passo. */
export type TelaDoSite = 'busca' | 'convite' | 'codigo' | 'vinculado' | 'pedido' | 'feito';

export interface OpcoesAnuncio {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
  telas?: Partial<Record<TelaDoSite, CanvasImageSource>>;
}

/** Onde estão os botões nas capturas (px CSS da tela de 360×640), para o dedo tocar. */
const ALVO = {
  linhaDoJogador: [80, 545],
  vincular: [113, 347],
  jaMandei: [89, 421],
  time: [180, 452],
  posicao: [180, 534],
  pedir: [132, 601],
} as const;
const LARGURA_TELA = 360;
const ALTURA_TELA = 640;

const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function desenharQuadroAnuncio(ctx: CanvasRenderingContext2D, roteiro: RoteiroAnuncio, tVideo: number, o: OpcoesAnuncio = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const t = q.tempo;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);

  const titulo = (txt: string, y = 34) => {
    const a = entre(t, 0, 0.35);
    pin.ctx.globalAlpha = a;
    pin.tabua(COLUNAS / 2 - 100, y - (1 - a) * 8, 200, 34);
    pin.texto(txt, COLUNAS / 2, y + 17 - (1 - a) * 8, pin.caber(txt, 180, 24, display), display, COR.amarelo, { contorno: COR.contorno });
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
  const legenda = (txt: string, y: number, de: number) =>
    surge(entre(t, de, de + 0.4), () => {
      pin.tabua(14, y - 14, 242, 28);
      pin.texto(txt, COLUNAS / 2, y, pin.caber(txt, 226, 12, texto, 700), texto, COR.placa, { peso: 700 });
    });
  /** Celular: moldura escura e tela clara. Devolve onde a tela começa. */
  const celular = (x: number, y: number, w: number, h: number) => {
    pin.placa(x, y, w, h, { fundo: '#1E1E1E', luz: '#3A3A3A', sombra: '#000000' });
    pin.r(x + 5, y + 12, w - 10, h - 22, '#FFFFFF');
    pin.r(x + w / 2 - 10, y + 5, 20, 3, '#3A3A3A');
    return { x: x + 5, y: y + 12, w: w - 10 };
  };
  /** O celular com as telas reais do site; troca de uma para a outra com um esmaecer rápido. */
  const site = (telas: [TelaDoSite, number][]) => {
    const s = celular(45, 66, 180, 22 + Math.round((170 * ALTURA_TELA) / LARGURA_TELA));
    const h = (s.w * ALTURA_TELA) / LARGURA_TELA;
    let atual = 0;
    telas.forEach(([, de], k) => {
      if (t >= de) atual = k;
    });
    const desenha = (tela: TelaDoSite, alfa: number) => {
      const img = o.telas?.[tela];
      if (!img || alfa <= 0) return;
      pin.ctx.save();
      pin.ctx.globalAlpha *= alfa;
      pin.ctx.imageSmoothingEnabled = true;
      pin.ctx.imageSmoothingQuality = 'high';
      pin.ctx.drawImage(img, s.x * pin.px, s.y * pin.px, s.w * pin.px, h * pin.px);
      pin.ctx.restore();
    };
    const [tela, de] = telas[atual]!;
    if (atual > 0) desenha(telas[atual - 1]![0], 1);
    desenha(tela, atual > 0 ? entre(t, de, de + 0.25) : 1);
    return { ...s, h, em: (cx: number, cy: number) => [s.x + (cx * s.w) / LARGURA_TELA, s.y + (cy * s.w) / LARGURA_TELA] as const };
  };
  /** O dedo: chega ao alvo, toca (aperta) e sai. */
  const dedo = (alvo: readonly [number, number], quando: number) => {
    const a = entre(t, quando - 0.5, quando);
    const sai = entre(t, quando + 0.35, quando + 0.7);
    if (a <= 0 || sai >= 1) return;
    const [x, y] = alvo;
    const yy = y + (1 - a) * 30;
    pin.ctx.save();
    pin.ctx.globalAlpha = a * (1 - sai);
    const aperta = t > quando && t < quando + 0.25;
    const r = aperta ? 5 : 6;
    pin.r(x - r, yy - r + 1, r * 2, r * 2, 'rgba(0,0,0,0.25)');
    pin.r(x - r, yy - r, r * 2, r * 2, '#FFFFFF');
    pin.r(x - r + 2, yy - r + 2, r * 2 - 4, r * 2 - 4, aperta ? COR.amarelo : '#F1F1F1');
    pin.ctx.restore();
    if (t > quando) toque(x, y, entre(t, quando, quando + 0.5));
  };
  const botao = (x: number, y: number, w: number, txt: string, apertado = false) => {
    pin.placa(x, y + (apertado ? 2 : 0), w, 22, { fundo: COR.amarelo, luz: '#FFE07A', sombra: apertado ? COR.amarelo : '#B88600' });
    pin.texto(txt, x + w / 2, y + 11 + (apertado ? 2 : 0), pin.caber(txt, w - 10, 11, texto, 700), texto, COR.tinta, { peso: 700 });
  };
  const toque = (x: number, y: number, a: number) => {
    if (a <= 0 || a >= 1) return;
    pin.ctx.globalAlpha = 1 - a;
    const r = 4 + a * 10;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      pin.r(x + Math.cos(ang) * r - 1, y + Math.sin(ang) * r - 1, 2, 2, COR.amarelo);
    }
    pin.ctx.globalAlpha = 1;
  };
  const pose = (rapido = 3): Pose => (Math.floor(tVideo * rapido) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO');

  switch (q.segmento.cartela) {
    case 'NOVIDADE': {
      const a = entre(t, 0, 0.7);
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 130 - (1 - a) * 30, 110 * (0.7 + 0.3 * a));
      surge(entre(t, 0.5, 1.0), () => {
        const pulso = 1 + 0.05 * Math.sin(t * 7);
        pin.texto('Novidade!', COLUNAS / 2, 232, 46 * pulso, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.0, 1.5), () => {
        pin.tabua(20, 262, 230, 52);
        pin.texto('Cuide do seu personagem', COLUNAS / 2, 280, pin.caber('Cuide do seu personagem', 210, 16, display), display, COR.placa);
        pin.texto('pelo site', COLUNAS / 2, 300, 16, display, COR.amarelo);
      });
      surge(entre(t, 1.5, 2.0), () => boneco(pin, pose(), uniforme(EX.de, EX.posicao, `@${EX.username}`), COLUNAS / 2 - 24, 334, 4));
      break;
    }
    case 'TRANSFERENCIA': {
      titulo('Transferência');
      surge(entre(t, 0.3, 0.7), () => {
        desenharEscudo(pin, EX.de, 22, 120, 2);
        desenharEscudo(pin, EX.para, COLUNAS - 22 - 50, 120, 2);
        for (let k = 0; k < 7; k++) pin.r(92 + k * 13, 150, 7, 3, COR.amarelo);
        pin.r(184, 146, 3, 11, COR.amarelo);
        pin.r(187, 148, 2, 7, COR.amarelo);
      });
      // O boneco atravessa de um time para o outro e troca de uniforme no meio.
      const ida = entre(t, 1.0, 3.0);
      if (t > 0.9) {
        const x = 30 + ida * (COLUNAS - 60 - 48);
        const time = ida < 0.5 ? EX.de : EX.para;
        const posicao = ida < 0.5 ? EX.posicao : EX.nova;
        const p: Pose = ida >= 1 ? pose() : Math.floor(tVideo * 6) % 2 === 0 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B';
        boneco(pin, p, uniforme(time, posicao, `@${EX.username}`), x, 196, 4);
      }
      surge(entre(t, 0.8, 1.2), () => {
        pin.tabua(14, 290, 242, 92);
        pin.texto('1 vez por temporada', COLUNAS / 2, 312, 22, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('troque de time, de posição', COLUNAS / 2, 340, 12, texto, COR.placa, { peso: 700 });
        pin.texto('ou dos dois', COLUNAS / 2, 358, 12, texto, COR.placa, { peso: 700 });
      });
      break;
    }
    case 'SITE': {
      titulo('1. Abra o site');
      surge(entre(t, 0.2, 0.6), () => {
        const c = site([['busca', 0], ['convite', 2.6]]);
        dedo(c.em(...ALVO.linhaDoJogador), 2.2);
      });
      legenda('link na bio: ache o seu @', 432, 0.8);
      break;
    }
    case 'CODIGO': {
      titulo('2. Peça o código');
      surge(entre(t, 0.2, 0.6), () => {
        const c = site([['convite', 0], ['codigo', 1.6]]);
        dedo(c.em(...ALVO.vincular), 1.2);
      });
      legenda('toque em "Vincular pela DM"', 432, 0.8);
      break;
    }
    case 'DM': {
      titulo('3. Mande na DM');
      surge(entre(t, 0.2, 0.6), () => {
        const s = celular(45, 66, 180, 22 + Math.round((170 * ALTURA_TELA) / LARGURA_TELA));
        pin.r(s.x, s.y, s.w, 26, '#F4F4F4');
        if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, s.x + 16, s.y + 13, 18);
        pin.texto('@varzeao_da_mata', s.x + 30, s.y + 13, 10, texto, COR.tinta, { alinhar: 'left', peso: 700 });
        pin.r(s.x, s.y + 26, s.w, 1, '#DDDDDD');
        // A mensagem com o código, enviada pela conta do Jogador.
        surge(entre(t, 1.0, 1.4), () => {
          const w = 92;
          pin.placa(s.x + s.w - w - 8, s.y + 190, w, 28, { fundo: '#7B4DFF', luz: '#9B7BFF', sombra: '#5A32D6' });
          pin.texto(EX.codigo, s.x + s.w - 8 - w / 2, s.y + 204, 18, display, '#FFFFFF');
        }, 14);
        surge(entre(t, 1.6, 2.0), () => pin.texto('Enviada · pela sua conta', s.x + s.w - 10, s.y + 226, 8, texto, '#8A8A8A', { alinhar: 'right', peso: 600 }), 0);
      });
      legenda('mande pela sua própria conta', 432, 1.2);
      break;
    }
    case 'PRONTO': {
      titulo('4. Já mandei');
      surge(entre(t, 0.2, 0.6), () => {
        const c = site([['codigo', 0], ['vinculado', 1.5]]);
        dedo(c.em(...ALVO.jaMandei), 1.0);
        // Selo de vinculado por cima da tela, com confete.
        surge(entre(t, 1.8, 2.2), () => {
          pin.placa(c.x + 14, c.y + c.h - 64, c.w - 28, 46, { fundo: '#7FB069', luz: '#A7D28F', sombra: '#4E8A3A' });
          pin.texto('Personagem vinculado!', c.x + c.w / 2, c.y + c.h - 41, pin.caber('Personagem vinculado!', c.w - 40, 16, display), display, '#FFFFFF', { contorno: COR.contorno });
          for (let k = 0; k < 14; k++) {
            const x = c.x + 10 + ((k * 37) % (c.w - 20));
            const y = c.y + 20 + ((t * 70 + k * 29) % (c.h - 90));
            pin.r(x, y, 3, 3, [COR.amarelo, '#E4572E', '#7FB069', '#7B4DFF'][k % 4]!);
          }
        }, 6);
      });
      break;
    }
    case 'PEDIR': {
      titulo('5. Peça a transferência');
      surge(entre(t, 0.2, 0.6), () => {
        const c = site([['vinculado', 0], ['pedido', 1.7], ['feito', 2.9]]);
        dedo(c.em(...ALVO.time), 1.0);
        dedo(c.em(...ALVO.posicao), 1.7);
        dedo(c.em(...ALVO.pedir), 2.5);
      });
      legenda('vale do próximo jogo em diante', 432, 3.0);
      break;
    }
    case 'COMENTARIO': {
      titulo('Ou por comentário');
      const comando = 'TRANSFERIR PREGUIÇA ZAGUEIRO';
      surge(entre(t, 0.2, 0.5), () => {
        pin.placa(14, 82, 242, 62, { fundo: '#FFFFFF', luz: '#FFFFFF', sombra: '#C9C9C9' });
        pin.r(24, 94, 18, 18, IDENTIDADE[EX.de].primaria);
        boneco(pin, 'FRENTE_PARADO', uniforme(EX.de, EX.posicao, `@${EX.username}`), 27, 93, 1);
        pin.texto(`@${EX.username}`, 50, 99, 9, texto, COR.tinta, { alinhar: 'left', peso: 700 });
        const letras = Math.floor(entre(t, 0.7, 2.6) * comando.length);
        const cursor = Math.floor(t * 3) % 2 === 0 && letras < comando.length ? '|' : '';
        pin.texto(comando.slice(0, letras) + cursor, 50, 124, pin.caber(comando, 196, 16, display), display, COR.tinta, { alinhar: 'left' });
      }, 0);
      surge(entre(t, 2.8, 3.3), () => {
        pin.tabua(14, 166, 242, 104);
        pin.texto('Time lotado não vale:', COLUNAS / 2, 188, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('a Liga mantém os times', COLUNAS / 2, 214, 12, texto, COR.placa, { peso: 700 });
        pin.texto('equilibrados', COLUNAS / 2, 232, 12, texto, COR.placa, { peso: 700 });
        pin.texto('⚖', COLUNAS / 2, 254, 14, texto, COR.amarelo);
      });
      surge(entre(t, 3.6, 4.1), () => {
        pin.texto('site: link na bio', COLUNAS / 2, 296, 12, texto, COR.placa, { peso: 700 });
        if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 374, 96);
      });
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
