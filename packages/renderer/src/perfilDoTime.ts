/**
 * Reels do Perfil do Time (ADR-0100): incentiva os Times a criar um Instagram próprio. Mostra
 * os Perfis do Time que já existem (os Times autorizaram), as regras para virar oficial, como
 * pedir (DM para a Liga, vale o primeiro) e o que o perfil oficial ganha. Narrado pelo Seu Dito,
 * no estilo de cartelas do Rebalanceamento. O Narrador nunca fala o @: fala o Time.
 */
import { FALA_DO_TIME, type TimeId } from '@liga/shared';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, plaquinha } from './desenho.js';
import { ALTURA_ESCUDO, LARGURA_ESCUDO, escudo as escudoDoTime } from './escudos.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDoPerfilDoTime {
  /** Os Perfis do Time oficiais, na ordem em que aparecem (no máximo 4 cabem na cartela). */
  perfis: readonly { time: TimeId; usuario: string }[];
  /** Os Times da Liga que ainda não têm Perfil do Time. */
  semPerfil: readonly TimeId[];
}

/** O Narrador do Reels do Perfil do Time: Seu Dito, como nos outros anúncios. */
export const NARRADOR_DO_PERFIL_DO_TIME = 'DITO';

/** Quantos Perfis cabem na cartela de exemplos. */
export const MAX_PERFIS_NA_CARTELA = 4;

// ---------------------------------------------------------------- roteiro

export type CartelaPerfilDoTime = 'ABERTURA' | 'EXEMPLOS' | 'REGRAS' | 'PEDIDO' | 'GANHA' | 'CHAMADA';
export type SegmentoPerfilDoTime = Segmento & { cartela: CartelaPerfilDoTime };

const CARTELAS: readonly CartelaPerfilDoTime[] = ['ABERTURA', 'EXEMPLOS', 'REGRAS', 'PEDIDO', 'GANHA', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaPerfilDoTime, number> = { ABERTURA: 5, EXEMPLOS: 7.5, REGRAS: 10, PEDIDO: 7.5, GANHA: 9.5, CHAMADA: 7 };
const CORTE = 0.3;

export class RoteiroPerfilDoTime {
  readonly segmentos: SegmentoPerfilDoTime[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDoPerfilDoTime,
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

  em(tBruto: number): { segmento: SegmentoPerfilDoTime; indice: number; tempo: number; escurecer: number } {
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

const NUMERO_FALADO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte', 'vinte e um', 'vinte e dois', 'vinte e três', 'vinte e quatro'];

/** "o Jacaré, o Tamanduá e a Capivara" */
export function timesFalados(times: readonly TimeId[]): string {
  const nomes = times.map((t) => `${FALA_DO_TIME[t].artigo} ${FALA_DO_TIME[t].curto}`);
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function narracaoDoPerfilDoTime(roteiro: RoteiroPerfilDoTime): Fala[] {
  const d = roteiro.dados;
  const naCartela = d.perfis.slice(0, MAX_PERFIS_NA_CARTELA).map((p) => p.time);
  const um = naCartela.length === 1;
  const faltam = d.semPerfil.length;
  const texto: Record<CartelaPerfilDoTime, string> = {
    ABERTURA: 'Agora o seu time pode ter perfil oficial no Instagram!',
    EXEMPLOS: `${capitalizar(timesFalados(naCartela))} já ${um ? 'tem o dele' : 'têm o deles'}, criado pelos próprios jogadores.`,
    REGRAS: 'Pra ser oficial: marca a Liga na bio, usa o nome e o bicho do seu time, e o escudo pode ser o seu. Não vale se passar pela Liga, e respeita os rivais. Provocação de clássico pode!',
    PEDIDO: 'Criou? Manda uma mensagem direta pra Liga. É um perfil por time, e vale o primeiro que pedir.',
    GANHA: 'O perfil oficial ganha link na página do time no site, a Liga segue, pode aparecer nos stories, e entra de colaborador nos reels dos jogos do time.',
    CHAMADA: faltam ? `Ainda ${faltam === 1 ? 'falta um time' : `faltam ${NUMERO_FALADO[faltam] ?? faltam} times`}. Junta a galera do seu e cria o perfil!` : 'Todos os times já têm perfil. Segue o do seu!',
  };
  return roteiro.segmentos.map((s, i): Fala => {
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA';
    return { id: `perfil-do-time-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesPerfilDoTime {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const VERDE = '#A5CF8E';
const ROSA = '#E1306C';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

/** Ícone do Instagram em pixel art (quadrado arredondado, lente e flash), `l` de lado. */
function iconeInstagram(pin: Pincel, x: number, y: number, l: number, cor: string): void {
  const e = Math.max(1, Math.round(l / 9));
  pin.r(x + e, y, l - 2 * e, e, cor);
  pin.r(x + e, y + l - e, l - 2 * e, e, cor);
  pin.r(x, y + e, e, l - 2 * e, cor);
  pin.r(x + l - e, y + e, e, l - 2 * e, cor);
  const c = Math.max(3 * e, Math.round(l * 0.42));
  const cx = x + Math.round((l - c) / 2);
  const cy = y + Math.round((l - c) / 2);
  pin.r(cx + e, cy, c - 2 * e, e, cor);
  pin.r(cx + e, cy + c - e, c - 2 * e, e, cor);
  pin.r(cx, cy + e, e, c - 2 * e, cor);
  pin.r(cx + c - e, cy + e, e, c - 2 * e, cor);
  pin.r(x + l - 3 * e, y + 2 * e, e, e, cor);
}

export function desenharQuadroPerfilDoTime(ctx: CanvasRenderingContext2D, roteiro: RoteiroPerfilDoTime, tVideo: number, o: OpcoesPerfilDoTime = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
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
  const escudoDe = (time: TimeId, cx: number, y: number, escala: number) => {
    pin.ctx.imageSmoothingEnabled = false;
    pin.ctx.drawImage(escudoDoTime(time), Math.round((cx - (LARGURA_ESCUDO * escala) / 2) * pin.px), Math.round(y * pin.px), LARGURA_ESCUDO * escala * pin.px, ALTURA_ESCUDO * escala * pin.px);
  };
  /** Lista numerada de tábuas, uma depois da outra. */
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
        pin.texto('Perfil do Time', COLUNAS / 2, 190, pin.caber('Perfil do Time', 240, 38, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.2, 1.7), () => {
        pin.tabua(24, 226, 222, 52);
        iconeInstagram(pin, 40, 240, 24, '#FFFFFF');
        pin.texto('o seu Time no Instagram', 150, 253, pin.caber('o seu Time no Instagram', 170, 17, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      break;
    }
    case 'EXEMPLOS': {
      titulo('Já tem Time com perfil!');
      const lista = d.perfis.slice(0, MAX_PERFIS_NA_CARTELA);
      const passo = lista.length > 3 ? 80 : 100;
      lista.forEach((p, k) => {
        const y = 92 + k * passo;
        surge(entre(t, 0.5 + k * 0.6, 0.9 + k * 0.6), () => {
          pin.tabua(14, y, 242, passo - 10);
          escudoDe(p.time, 46, y + (passo - 10) / 2 - (ALTURA_ESCUDO * 1.8) / 2, 1.8);
          const nome = FALA_DO_TIME[p.time].curto;
          pin.texto(nome, 84, y + (passo - 10) / 2 - 8, pin.caber(nome, 162, 24, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          iconeInstagram(pin, 84, y + (passo - 10) / 2 + 6, 14, COR.placa);
          const arroba = `@${p.usuario}`;
          pin.texto(arroba, 103, y + (passo - 10) / 2 + 13, pin.caber(arroba, 145, 13, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
        }, 8);
      });
      const fimDaLista = 92 + lista.length * passo;
      surge(entre(t, 0.9 + lista.length * 0.6, 1.3 + lista.length * 0.6), () => {
        pin.placa(32, fimDaLista + 6, 206, 30, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('criados pelos Jogadores', COLUNAS / 2, fimDaLista + 22, pin.caber('criados pelos Jogadores', 190, 13, display), display, COR.tinta);
      });
      break;
    }
    case 'REGRAS': {
      titulo('Pra ser oficial');
      itens(
        [
          ['@varzeao_da_mata na bio', 'marca a Liga no perfil'],
          ['Nome e bicho do Time', 'o escudo pode ser o seu'],
          ['Não se passar pela Liga', 'sem selo de verificado falso'],
          ['Respeito aos rivais', 'provocação de Clássico pode!'],
        ],
        92,
        82,
        0.6,
        1.6,
      );
      break;
    }
    case 'PEDIDO': {
      titulo('Como pedir');
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Manda DM pra Liga', COLUNAS / 2, 100, pin.caber('Manda DM pra Liga', 236, 28, display), display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('@varzeao_da_mata', COLUNAS / 2, 124, pin.caber('@varzeao_da_mata', 220, 14, texto, 700), texto, COR.placa, { peso: 700 });
      });
      // Balão de mensagem direta, como no app.
      surge(entre(t, 1.2, 1.6), () => {
        const ex = d.perfis[0] ?? { time: 'JAC' as TimeId, usuario: 'perfil_do_time' };
        pin.placa(30, 150, 216, 64, { fundo: ROSA, luz: '#F26A96', sombra: '#A61F4F' });
        pin.r(232, 210, 8, 8, ROSA);
        const linha1 = `Criamos o perfil ${FALA_DO_TIME[ex.time].artigo === 'a' ? 'da' : 'do'} ${FALA_DO_TIME[ex.time].curto}:`;
        pin.texto(linha1, 42, 172, pin.caber(linha1, 194, 13, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
        pin.texto(`@${ex.usuario}`, 42, 196, pin.caber(`@${ex.usuario}`, 194, 16, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
      }, 6);
      surge(entre(t, 3.2, 3.6), () => {
        pin.tabua(14, 250, 242, 96);
        pin.texto('Um perfil por Time', COLUNAS / 2, 282, pin.caber('Um perfil por Time', 222, 22, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('vale o primeiro que pedir', COLUNAS / 2, 314, pin.caber('vale o primeiro que pedir', 222, 16, display), display, VERDE, { contorno: COR.contorno });
      });
      break;
    }
    case 'GANHA': {
      titulo('O que ganha');
      itens(
        [
          ['Link na página do Time', 'no site e no App'],
          ['A Liga segue', 'o @varzeao_da_mata segue o perfil'],
          ['Aparece nos Stories', 'repost das artes do Time'],
          ['Colaborador nos Reels', 'em todo jogo do Time'],
        ],
        92,
        82,
        0.6,
        1.7,
      );
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Cria o do seu Time!', COLUNAS / 2, 64, pin.caber('Cria o do seu Time!', 240, 30, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      const falta = d.semPerfil.length;
      const sub = falta ? `${falta === 1 ? 'falta 1 Time' : `faltam ${falta} Times`}` : 'todos os Times já têm';
      pin.texto(sub, COLUNAS / 2, 94, 16, display, COR.placa, { contorno: COR.contorno });
      pin.ctx.globalAlpha = 1;
      // Os escudos dos Times sem perfil, em grade de 5.
      const porLinha = 5;
      d.semPerfil.forEach((time, k) => {
        const col = k % porLinha;
        const lin = Math.floor(k / porLinha);
        const naLinha = Math.min(porLinha, d.semPerfil.length - lin * porLinha);
        const cx = COLUNAS / 2 + (col - (naLinha - 1) / 2) * 46;
        surge(entre(t, 0.6 + k * 0.12, 0.9 + k * 0.12), () => escudoDe(time, cx, 116 + lin * 54, 1.35), 6);
      });
      const linhas = Math.ceil(d.semPerfil.length / porLinha);
      surge(entre(t, 2.6, 3.0), () => {
        const y = 124 + linhas * 54;
        pin.tabua(24, y, 222, 44);
        pin.texto('DM pra @varzeao_da_mata', COLUNAS / 2, y + 23, pin.caber('DM pra @varzeao_da_mata', 200, 15, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      if (o.escudo) surge(entre(t, 3.4, 4.0), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 412, 70));
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
