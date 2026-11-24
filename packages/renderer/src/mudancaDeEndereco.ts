/**
 * Reels da Mudança de Endereço (ADR-0104): o site e o App saíram do varzeao-da-mata.pages.dev para
 * o varzeaodamata.com.br. Avisa o endereço novo, o que quem já tinha o App precisa refazer
 * (instalar de novo, Vínculo e Avisos), que Jogador, Time e Carreira continuam iguais e a
 * repaginada do App (ADR-0103: Abas do App, barra de cima com o sino e Subabas).
 * Narrado pelo Seu Dito, no estilo de cartelas dos outros anúncios.
 */
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, plaquinha } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import { desenharEscudoDaLiga, veu } from './video.js';

/** O Narrador do Reels da Mudança de Endereço: Seu Dito, como nos outros anúncios. */
export const NARRADOR_DA_MUDANCA_DE_ENDERECO = 'DITO';

export const ENDERECO_NOVO = 'varzeaodamata.com.br';
export const ENDERECO_ANTIGO = 'varzeao-da-mata.pages.dev';

// ---------------------------------------------------------------- roteiro

export type CartelaMudancaDeEndereco = 'ABERTURA' | 'ENDERECO' | 'APP' | 'CONTINUA' | 'CARA_NOVA' | 'CHAMADA';
export type SegmentoMudancaDeEndereco = Segmento & { cartela: CartelaMudancaDeEndereco };

const CARTELAS: readonly CartelaMudancaDeEndereco[] = ['ABERTURA', 'ENDERECO', 'APP', 'CONTINUA', 'CARA_NOVA', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaMudancaDeEndereco, number> = { ABERTURA: 4.5, ENDERECO: 7, APP: 9.5, CONTINUA: 7, CARA_NOVA: 10, CHAMADA: 6 };
const CORTE = 0.3;

export class RoteiroMudancaDeEndereco {
  readonly segmentos: SegmentoMudancaDeEndereco[];
  readonly duracao: number;

  constructor(minimos: Record<number, { antes?: number }> = {}) {
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

  em(tBruto: number): { segmento: SegmentoMudancaDeEndereco; indice: number; tempo: number; escurecer: number } {
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

/** O endereço falado: o Narrador soletra o fim ("ponto com ponto bê érre"). */
export const ENDERECO_FALADO = 'varzeão da mata, ponto com, ponto bê érre';

const TEXTO: Record<CartelaMudancaDeEndereco, string> = {
  ABERTURA: 'O Varzeão da Mata tem endereço novo, e o app está de cara nova!',
  ENDERECO: `O site e o app agora ficam em ${ENDERECO_FALADO}.`,
  APP: 'Já tinha instalado o app? Abre o endereço novo, instala de novo, refaz o vínculo com o seu jogador e reativa os avisos.',
  CONTINUA: 'Seu jogador, seu time e a sua carreira continuam do mesmo jeito. Só mudou o endereço.',
  CARA_NOVA: 'No celular, o app agora tem abas embaixo, o sininho dos avisos lá em cima, e as telas do time, do jogador e da partida divididas em partes, pra não precisar rolar tanto.',
  CHAMADA: 'O link novo já está na bio. Te vejo lá!',
};

export function narracaoDaMudancaDeEndereco(roteiro: RoteiroMudancaDeEndereco): Fala[] {
  return roteiro.segmentos.map((s, i): Fala => {
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA';
    return { id: `mudanca-de-endereco-${i}`, texto: TEXTO[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesMudancaDeEndereco {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const VERDE = '#A5CF8E';
const VERMELHO = '#E0533D';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function desenharQuadroMudancaDeEndereco(ctx: CanvasRenderingContext2D, roteiro: RoteiroMudancaDeEndereco, tVideo: number, o: OpcoesMudancaDeEndereco = {}): void {
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
  /** A placa clara com o endereço novo, como a do site. */
  const placaDoEndereco = (y: number, alto = 40) => {
    pin.placa(14, y, 242, alto, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
    pin.texto(ENDERECO_NOVO, COLUNAS / 2, y + alto / 2 + 1, pin.caber(ENDERECO_NOVO, 222, 22, display), display, COR.tinta);
  };
  const itens = (lista: readonly [string, string][], y0: number, passo: number, de: number, intervalo: number) =>
    lista.forEach(([a, b], k) => {
      const y = y0 + k * passo;
      surge(entre(t, de + k * intervalo, de + 0.4 + k * intervalo), () => {
        pin.tabua(14, y, 242, passo - 8);
        plaquinha(pin, 36, y + (passo - 8) / 2 - 15, 28, 30, String(k + 1), display);
        pin.texto(a, 58, y + (passo - 8) / 2 - 4, pin.caber(a, 190, 19, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
        pin.texto(b, 58, y + (passo - 8) / 2 + 17, pin.caber(b, 190, 11.5, texto, 700), texto, COR.placaSombra, { alinhar: 'left', peso: 700 });
      }, 8);
    });

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      if (o.escudo) surge(entre(t, 0, 0.5), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 96, 88));
      surge(entre(t, 0.4, 0.9), () => {
        pin.texto('Endereço novo!', COLUNAS / 2, 190, pin.caber('Endereço novo!', 240, 38, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.2, 1.7), () => {
        pin.tabua(24, 226, 222, 52);
        pin.texto('e o App de cara nova', COLUNAS / 2, 253, pin.caber('e o App de cara nova', 196, 17, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      break;
    }
    case 'ENDERECO': {
      titulo('O site mudou');
      // O endereço antigo aparece e é riscado.
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('antes', COLUNAS / 2, 104, 13, display, COR.placa, { contorno: COR.contorno });
        const tam = pin.caber(ENDERECO_ANTIGO, 222, 16, texto, 700);
        pin.texto(ENDERECO_ANTIGO, COLUNAS / 2, 126, tam, texto, '#CFC6B4', { peso: 700 });
        const risco = entre(t, 1.2, 1.7);
        if (risco > 0) pin.r(COLUNAS / 2 - 112, 125, Math.round(224 * risco), 3, VERMELHO);
      });
      surge(entre(t, 1.9, 2.4), () => {
        pin.texto('agora', COLUNAS / 2, 176, 15, display, VERDE, { contorno: COR.contorno });
        placaDoEndereco(192, 48);
      });
      surge(entre(t, 3.0, 3.4), () => {
        pin.tabua(24, 270, 222, 44);
        pin.texto('mesmo site, endereço próprio', COLUNAS / 2, 293, pin.caber('mesmo site, endereço próprio', 200, 14, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      break;
    }
    case 'APP': {
      titulo('Já tinha o App?');
      itens(
        [
          ['Abre o endereço novo', ENDERECO_NOVO],
          ['Instala o App de novo', 'menu ⋮ → Instalar app'],
          ['Refaz o Vínculo', 'com o código da DM da Liga'],
          ['Reativa os Avisos', 'no sininho, lá em cima'],
        ],
        92,
        82,
        0.6,
        1.6,
      );
      break;
    }
    case 'CONTINUA': {
      titulo('Nada se perde');
      const lista: readonly string[] = ['Seu Jogador', 'Seu Time', 'Sua Carreira'];
      lista.forEach((nome, k) => {
        const y = 96 + k * 62;
        surge(entre(t, 0.5 + k * 0.5, 0.9 + k * 0.5), () => {
          pin.tabua(34, y, 202, 50);
          pin.texto('✓', 62, y + 26, 22, display, VERDE, { contorno: COR.contorno });
          pin.texto(nome, 86, y + 26, pin.caber(nome, 140, 22, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
        }, 8);
      });
      surge(entre(t, 2.4, 2.8), () => {
        pin.placa(32, 300, 206, 32, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('só mudou o endereço', COLUNAS / 2, 317, pin.caber('só mudou o endereço', 190, 15, display), display, COR.tinta);
      });
      break;
    }
    case 'CARA_NOVA': {
      titulo('App de cara nova');
      // Um celular com a tela da Onça (aba Times): barra de cima com o Voltar e o sino, Subabas e as Abas do App embaixo.
      const x = 66;
      const y = 82;
      const w = 138;
      const h = 236;
      surge(entre(t, 0.3, 0.7), () => {
        pin.placa(x - 6, y - 6, w + 12, h + 12, { fundo: '#151515', luz: '#3A3A3A', sombra: '#000000' });
        pin.r(x, y, w, h, COR.mata);
        // Cartões do conteúdo.
        for (let k = 0; k < 3; k++) {
          const cy = y + 56 + k * 48;
          pin.placa(x + 8, cy, w - 16, 40, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
          pin.r(x + 16, cy + 10, 60, 6, COR.placaSombra);
          pin.r(x + 16, cy + 22, 92, 5, COR.placaSombra);
        }
      });
      /** Cada parte do App aparece quando o Narrador fala dela. */
      const destaque = (de: number, desenhar: () => void) => surge(entre(t, de, de + 0.4), desenhar, 0);
      // Barra de cima: escudo, título e o sino.
      destaque(3.6, () => {
        pin.r(x, y, w, 24, COR.madeira);
        pin.r(x, y + 23, w, 1, COR.madeiraEscura);
        // Tela de detalhe (o Time): Voltar no lugar do escudo.
        const vx = x + 8;
        const vy = y + 12;
        for (let k = 0; k < 5; k++) {
          pin.r(vx + k, vy - k, 2, 1, COR.placa);
          pin.r(vx + k, vy + k, 2, 1, COR.placa);
        }
        pin.texto('Onça', x + w / 2, y + 13, 12, display, COR.placa, { contorno: COR.contorno });
        // Sino em pixel.
        const bx = x + w - 18;
        const by = y + 6;
        pin.r(bx + 3, by, 2, 1, COR.placa);
        pin.r(bx + 2, by + 1, 4, 2, COR.placa);
        pin.r(bx + 1, by + 3, 6, 4, COR.placa);
        pin.r(bx, by + 7, 8, 2, COR.placa);
        pin.r(bx + 3, by + 9, 2, 2, COR.placa);
      });
      // Subabas, presas logo abaixo da barra de cima.
      destaque(5.2, () => {
        const nomes = ['Escalação', 'Elenco', 'Jogos'];
        nomes.forEach((n, k) => {
          const px = x + 6 + k * 43;
          const ativa = k === 0;
          pin.placa(px, y + 30, 40, 16, { fundo: ativa ? COR.amarelo : COR.mataClara, sombra: ativa ? '#B98A00' : COR.mataMedia });
          pin.texto(n, px + 20, y + 38.5, pin.caber(n, 36, 8, texto, 700), texto, ativa ? COR.tinta : COR.placa, { peso: 700 });
        });
      });
      // Abas do App, fixas embaixo.
      destaque(1.4, () => {
        pin.r(x, y + h - 26, w, 26, COR.madeira);
        pin.r(x, y + h - 26, w, 1, COR.madeiraLuz);
        const abas = ['Rodada', 'Jogos', 'Tabela', 'Times', 'Mais'];
        abas.forEach((n, k) => {
          const cx = x + 14 + k * 27.5;
          pin.r(Math.round(cx - 4), y + h - 21, 8, 8, k === 3 ? COR.amarelo : COR.placaSombra);
          pin.texto(n, cx, y + h - 7, pin.caber(n, 26, 7, texto, 700), texto, k === 3 ? COR.amarelo : COR.placa, { peso: 700 });
        });
      });
      // As três novidades, uma a uma, embaixo do celular.
      const linhas: readonly [string, number][] = [
        ['Abas embaixo, como app', 1.4],
        ['Sino dos Avisos em cima', 3.6],
        ['Subabas: menos rolagem', 5.2],
      ];
      linhas.forEach(([txt, de], k) => {
        surge(entre(t, de, de + 0.4), () => {
          pin.tabua(24, 334 + k * 34, 222, 28);
          pin.texto(txt, COLUNAS / 2, 349 + k * 34, pin.caber(txt, 200, 14, display), display, '#FFFFFF', { contorno: COR.contorno });
        }, 6);
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Link novo na bio!', COLUNAS / 2, 64, pin.caber('Link novo na bio!', 240, 30, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.5, 0.9), () => placaDoEndereco(96, 48));
      surge(entre(t, 1.2, 1.6), () => {
        pin.tabua(24, 170, 222, 44);
        pin.texto('@varzeao_da_mata', COLUNAS / 2, 193, pin.caber('@varzeao_da_mata', 200, 16, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      if (o.escudo) surge(entre(t, 1.8, 2.4), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 300, 90));
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
