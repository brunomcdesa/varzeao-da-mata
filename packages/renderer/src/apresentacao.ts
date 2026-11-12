/**
 * Reels de apresentação da Liga: o primeiro post do perfil, que explica o jogo e chama os
 * seguidores para se inscrever. Mesmo estilo de cartelas do Resumo (tábuas de várzea sobre o
 * campo), narrado pelo Locutor; cada cartela estica até a fala caber inteira.
 */
import { FALA_DO_TIME, IDENTIDADE, NOME_DA_HABILIDADE, TIMES, type HabilidadeId, type Posicao, type TimeId } from '@liga/shared';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, plaquinha } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste } from './pixel.js';
import type { Segmento } from './roteiro.js';
import { aparencia, sprite, type Pose, type Visual } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDaApresentacao {
  temporada: number;
  /** Dia da Rodada 1, AAAA-MM-DD. */
  estreia: string;
  /** Horários dos jogos de cada Rodada (12, 14, 16, 18). */
  horarios: number[];
  /** Hora do Resumo com a votação do Craque. */
  horaDoResumo: number;
  /** Exemplo de inscrição mostrado no vídeo. */
  exemplo: { time: TimeId; posicao: Posicao; username: string };
}

export const DADOS_PADRAO: Omit<DadosDaApresentacao, 'estreia'> = {
  temporada: 1,
  horarios: [12, 14, 16, 18],
  horaDoResumo: 19,
  exemplo: { time: 'ONC', posicao: 'ATA', username: 'voce' },
};

export type CartelaApresentacao = 'ABERTURA' | 'TIMES' | 'PARTIDA' | 'ENTRAR' | 'POSICOES' | 'EVOLUCAO' | 'AGENDA' | 'CHAMADA';

export type SegmentoApresentacao = Segmento & { cartela: CartelaApresentacao };

const ORDEM: CartelaApresentacao[] = ['ABERTURA', 'TIMES', 'PARTIDA', 'ENTRAR', 'POSICOES', 'EVOLUCAO', 'AGENDA', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaApresentacao, number> = { ABERTURA: 4, TIMES: 6, PARTIDA: 6, ENTRAR: 8, POSICOES: 5.5, EVOLUCAO: 7, AGENDA: 6.5, CHAMADA: 6.5 };
const CORTE = 0.3;

export class RoteiroApresentacao {
  readonly segmentos: SegmentoApresentacao[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDaApresentacao,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    let cursor = 0;
    this.segmentos = ORDEM.map((cartela, i) => {
      const inicio = cursor;
      // Uma folga depois da fala, para a imagem respirar antes do corte.
      cursor += Math.max(DURACAO_BASE[cartela], (minimos[i]?.antes ?? 0) + 0.6);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoApresentacao; indice: number; progresso: number; tempo: number; escurecer: number } {
    const t = Math.min(Math.max(tBruto, 0), this.duracao - 1e-9);
    const indice = Math.max(0, this.segmentos.findIndex((s) => t < s.fim));
    const segmento = this.segmentos[indice]!;
    const tempo = t - segmento.inicio;
    const progresso = tempo / (segmento.fim - segmento.inicio);
    const meio = CORTE / 2;
    const entrada = indice === 0 ? 1 : Math.min(1, tempo / meio);
    const saida = indice === this.segmentos.length - 1 ? 1 : Math.min(1, (segmento.fim - t) / meio);
    return { segmento, indice, progresso, tempo, escurecer: 1 - Math.min(entrada, saida) };
  }
}

// ---------------------------------------------------------------- narração

export const POSICAO_FALADA: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };
export const POSICAO_ESCRITA: Record<Posicao, string> = { GOL: 'GOLEIRO', ZAG: 'ZAGUEIRO', MEI: 'MEIA', ATA: 'ATACANTE' };
const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const NUMERO_FALADO: Record<number, string> = { 1: 'primeiro', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'catorze', 15: 'quinze', 16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove', 20: 'vinte', 21: 'vinte e um', 22: 'vinte e dois', 23: 'vinte e três', 24: 'vinte e quatro', 25: 'vinte e cinco', 26: 'vinte e seis', 27: 'vinte e sete', 28: 'vinte e oito', 29: 'vinte e nove', 30: 'trinta', 31: 'trinta e um' };

export function dataDa(d: { estreia: string }): { dia: number; mes: string; semana: string } {
  const [a, m, dia] = d.estreia.split('-').map(Number) as [number, number, number];
  const semana = DIAS[new Date(Date.UTC(a, m - 1, dia, 12)).getUTCDay()]!;
  return { dia, mes: MESES[m - 1]!, semana };
}

/** "duas", "quatro", "seis da tarde": o período só vai no último horário da lista. */
export function horaFalada(h: number, comPeriodo: boolean): string {
  const t = h > 12 ? h - 12 : h;
  return `${t === 1 ? 'uma' : t === 2 ? 'duas' : NUMERO_FALADO[t]}${comPeriodo ? (h >= 19 ? ' da noite' : h > 12 ? ' da tarde' : '') : ''}`;
}

export function lista(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : (itens[0] ?? '');
}

export function narracaoDaApresentacao(roteiro: RoteiroApresentacao): Fala[] {
  const d = roteiro.dados;
  const { dia, semana } = dataDa(d);
  const ex = d.exemplo;
  return roteiro.segmentos.map((s, i): Fala => {
    const texto: Record<CartelaApresentacao, string> = {
      ABERTURA: 'Chegou o Varzeão da Mata: a liga de futebol dos seguidores!',
      TIMES: `São oito times: ${lista(TIMES.map(curto))}.`,
      PARTIDA: 'Cada partida é simulada lance a lance, com narração, e vira Reels aqui no perfil.',
      ENTRAR: `Quer jogar? Comenta ENTRO, o time e a posição. Tipo: ENTRO ${curto(ex.time)} ${POSICAO_FALADA[ex.posicao]}. Pronto: você vira jogador, com boneco e tudo!`,
      POSICOES: 'Pode ser goleiro, zagueiro, meia ou atacante. São sete em campo por time.',
      EVOLUCAO: 'Cada lance mexe nas suas habilidades. E no fim de cada rodada, a torcida vota no Craque.',
      AGENDA: `A estreia é ${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO_FALADO[dia] ?? dia}. Jogos ${lista(d.horarios.map((h, k) => (h === 12 ? (k === 0 ? 'ao meio-dia' : 'meio-dia') : `às ${horaFalada(h, k === d.horarios.length - 1)}`)))}.`,
      CHAMADA: 'As inscrições estão abertas. Comenta aí e garante a sua vaga!',
    };
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA' || s.cartela === 'ENTRAR';
    return { id: `apresentacao-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesApresentacao {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

export const suave = (f: number) => f * f * (3 - 2 * f);
export const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function uniforme(time: TimeId, posicao: Posicao, nome: string): Visual {
  const id = IDENTIDADE[time];
  const goleiro = posicao === 'GOL';
  return {
    camisa: goleiro ? id.secundaria : id.primaria,
    detalhe: goleiro ? id.primaria : id.secundaria,
    calcao: goleiro ? '#2B2B2B' : id.secundaria,
    meiao: goleiro ? id.secundaria : id.primaria,
    ...aparencia(nome),
  };
}

export function boneco(pin: Pincel, pose: Pose, v: Visual, x: number, y: number, escala: number): void {
  pin.ctx.imageSmoothingEnabled = false;
  pin.ctx.drawImage(sprite(pose, v), Math.round(x * pin.px), Math.round(y * pin.px), 12 * escala * pin.px, 16 * escala * pin.px);
}

/** Barra de Habilidade em gomos de 10, como no site. */
export function barra(pin: Pincel, x: number, y: number, w: number, valor: number, cor: string): void {
  pin.r(x - 1, y - 1, w + 2, 7, COR.contorno);
  pin.r(x, y, w, 5, COR.placaSombra);
  pin.r(x, y, Math.round((w * valor) / 100), 5, cor);
  for (let k = 1; k < 10; k++) pin.r(x + Math.round((w * k) / 10), y, 1, 5, COR.placa);
}

export function desenharQuadroApresentacao(ctx: CanvasRenderingContext2D, roteiro: RoteiroApresentacao, tVideo: number, o: OpcoesApresentacao = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const passo = Math.floor(tVideo * 4); // 4 trocas de pose por segundo
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

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      const a = entre(t, 0, 0.7);
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 150 - (1 - a) * 30, 130 * (0.7 + 0.3 * a));
      surge(entre(t, 0.5, 1.0), () => {
        pin.texto('Varzeão', COLUNAS / 2, 262, 46, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('da Mata', COLUNAS / 2, 300, 34, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 1.1, 1.6), () => {
        pin.tabua(36, 330, 198, 30);
        pin.texto('a liga de futebol dos seguidores', COLUNAS / 2, 345, pin.caber('a liga de futebol dos seguidores', 180, 11, texto, 700), texto, COR.placa, { peso: 700 });
      });
      // Os 8 escudos passando no pé da tela.
      surge(entre(t, 1.5, 2.1), () => {
        TIMES.forEach((time, k) => desenharEscudo(pin, time, 15 + k * 31, 400 + (k % 2) * 6, 1.1));
      });
      break;
    }
    case 'TIMES': {
      titulo('Os 8 Times');
      TIMES.forEach((time, k) => {
        const col = k % 2;
        const lin = Math.floor(k / 2);
        const x = 14 + col * 124;
        const y = 82 + lin * 86;
        surge(entre(t, 0.4 + k * 0.28, 0.75 + k * 0.28), () => {
          pin.tabua(x, y, 118, 78);
          desenharEscudo(pin, time, x + 6, y + 10, 2.4);
          const nome = curto(time);
          pin.texto(nome, x + 86, y + 32, pin.caber(nome, 58, 16, display), display, COR.placa, { contorno: COR.contorno });
          const id = IDENTIDADE[time];
          pin.r(x + 62, y + 46, 24, 6, id.primaria);
          pin.r(x + 86, y + 46, 24, 6, id.secundaria);
          pin.r(x + 62, y + 45, 48, 1, COR.contorno);
          pin.r(x + 62, y + 52, 48, 1, COR.contorno);
        }, 14);
      });
      break;
    }
    case 'PARTIDA': {
      titulo('Jogo de verdade');
      // Campinho com dois times correndo atrás da bola.
      const cx = 20;
      const cy = 86;
      const cw = 230;
      const ch = 190;
      pin.placa(cx - 4, cy - 4, cw + 8, ch + 8, { fundo: COR.madeira, luz: COR.madeiraLuz, sombra: COR.madeiraEscura, degrau: 2 });
      for (let k = 0; k < 6; k++) pin.r(cx, cy + k * (ch / 6), cw, ch / 6, k % 2 ? COR.grama : COR.gramaFaixa);
      pin.r(cx, cy + ch / 2, cw, 1, COR.cal);
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        pin.r(cx + cw / 2 + Math.cos(ang) * 22, cy + ch / 2 + Math.sin(ang) * 22, 1, 1, COR.cal);
      }
      pin.r(cx + cw / 2 - 30, cy, 1, 26, COR.cal);
      pin.r(cx + cw / 2 + 30, cy, 1, 26, COR.cal);
      pin.r(cx + cw / 2 - 30, cy + 26, 61, 1, COR.cal);
      pin.r(cx + cw / 2 - 14, cy - 3, 29, 3, '#FFFFFF');
      // A jogada: o atacante da Onça arranca, passa pelos zagueiros do Tatu e chuta no canto.
      const CHUTE = 3;
      const GOL = 3.5;
      const lerp = (x: number, y: number, f: number) => x + (y - x) * f;
      const corrida = Math.min(1, t / CHUTE);
      const ata = { x: lerp(cx + 60, cx + 96, corrida), y: lerp(cy + 160, cy + 52, corrida) };
      const corre = (k: number) => ((passo + k) % 2 ? 'COSTAS_CORRE_A' : 'COSTAS_CORRE_B') as Pose;
      const desce = (k: number) => ((passo + k) % 2 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B') as Pose;
      const parado = t >= CHUTE;
      // zagueiros: começam na frente e ficam para trás quando ele passa
      boneco(pin, parado ? 'FRENTE_PARADO' : desce(1), uniforme('TAT', 'ZAG', 'z1'), lerp(cx + 112, cx + 84, corrida), lerp(cy + 70, cy + 118, corrida), 2);
      boneco(pin, parado ? 'FRENTE_PARADO' : desce(0), uniforme('TAT', 'ZAG', 'z2'), lerp(cx + 150, cx + 128, corrida), lerp(cy + 92, cy + 104, corrida), 2);
      boneco(pin, parado ? 'COSTAS_PARADO' : corre(1), uniforme('ONC', 'MEI', 'm1'), lerp(cx + 150, cx + 160, corrida), lerp(cy + 178, cy + 92, corrida), 2);
      const goleiroX = cx + cw / 2 - 12 + (t > CHUTE + 0.15 ? 14 : 0);
      boneco(pin, t > CHUTE + 0.15 ? 'MERGULHO' : 'FRENTE_PARADO', uniforme('TAT', 'GOL', 'g1'), goleiroX, cy + 2, 2);
      boneco(pin, parado ? 'COSTAS_PARADO' : corre(0), uniforme('ONC', 'ATA', 'a1'), ata.x, ata.y, 2);
      // a bola: no pé até o chute, depois voa para o canto esquerdo da trave
      const pe = { x: ata.x + 9, y: ata.y + 30 };
      const canto = { x: cx + cw / 2 - 11, y: cy + 1 };
      const voo = entre(t, CHUTE, GOL);
      const bola = t < CHUTE ? pe : { x: lerp(pe.x, canto.x, voo), y: lerp(pe.y, canto.y, voo) - Math.sin(voo * Math.PI) * 6 };
      pin.r(bola.x - 1, bola.y - 1, 5, 5, COR.contorno);
      pin.r(bola.x, bola.y, 3, 3, '#FFFFFF');
      // O placar e a promessa.
      surge(entre(t, 1.0, 1.4), () => {
        pin.tabua(36, 296, 198, 50);
        desenharEscudo(pin, 'ONC', 46, 302, 1.5);
        desenharEscudo(pin, 'TAT', 194, 302, 1.5);
        const gol = t > GOL ? 1 : 0;
        plaquinha(pin, 113, 306, 22, 28, String(gol), display);
        plaquinha(pin, 157, 306, 22, 28, '0', display);
        pin.texto('x', COLUNAS / 2, 321, 12, display, COR.placa);
      });
      if (t > GOL) {
        const b = entre(t, GOL, GOL + 0.3);
        pin.ctx.globalAlpha = b;
        pin.texto('Gooool!', COLUNAS / 2, cy + 150, 40 * (0.8 + 0.2 * b), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.ctx.globalAlpha = 1;
      }
      surge(entre(t, 1.6, 2.0), () => {
        pin.texto('Cada partida vira Reels', COLUNAS / 2, 372, 18, display, COR.placa, { contorno: COR.contorno });
        pin.texto('aqui no perfil, com narração', COLUNAS / 2, 394, 10, texto, COR.placaSombra, { peso: 600 });
      });
      break;
    }
    case 'ENTRAR': {
      titulo('Como entrar');
      const ex = d.exemplo;
      const comando = `ENTRO ${curto(ex.time).toUpperCase()} ${POSICAO_ESCRITA[ex.posicao]}`;
      // O comentário, sendo digitado.
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
      // Seta e a figurinha do novo Jogador.
      surge(entre(t, 2.5, 2.8), () => {
        for (let k = 0; k < 4; k++) pin.r(COLUNAS / 2 - 1, 148 + k * 5, 3, 3, COR.amarelo);
        pin.r(COLUNAS / 2 - 6, 168, 13, 2, COR.amarelo);
        pin.r(COLUNAS / 2 - 4, 170, 9, 2, COR.amarelo);
        pin.r(COLUNAS / 2 - 2, 172, 5, 2, COR.amarelo);
      }, 0);
      const a = entre(t, 2.8, 3.4);
      surge(a, () => {
        const id = IDENTIDADE[ex.time];
        const x = 50;
        const y = 182;
        pin.placa(x, y, 170, 236, { fundo: id.primaria, sombra: COR.contorno });
        const cor = contraste(id.primaria);
        pin.texto('Novo contratado!', COLUNAS / 2, y + 12, 9, texto, cor, { peso: 700 });
        pin.placa(x + 8, y + 22, 154, 112, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.r(x + 11, y + 104, 148, 27, '#7FB069');
        const pose: Pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        boneco(pin, pose, uniforme(ex.time, ex.posicao, `@${ex.username}`), x + 55, y + 30, 5);
        desenharEscudo(pin, ex.time, x + 136, y + 26, 1);
        plaquinha(pin, x + 30, y + 30, 32, 28, '65', display);
        pin.texto('OVR', x + 30, y + 64, 7, texto, COR.tinta, { peso: 700 });
        pin.texto(`@${ex.username}`, COLUNAS / 2, y + 148, 18, display, cor);
        pin.texto(`${POSICAO_FALADA[ex.posicao]} da ${curto(ex.time)}`, COLUNAS / 2, y + 166, 8, texto, cor, { peso: 600 });
        const habs: [HabilidadeId, number][] = [['FIN', 69], ['DRI', 65], ['PAS', 59], ['DEF', 47]];
        pin.placa(x + 8, y + 176, 154, 54, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        habs.forEach(([h, v], k) => {
          const yy = y + 183 + k * 12;
          pin.texto(NOME_DA_HABILIDADE[h], x + 14, yy + 3, 7, texto, COR.tinta, { alinhar: 'left', peso: 700 });
          barra(pin, x + 66, yy, 70, v * entre(t, 3.2 + k * 0.15, 3.8 + k * 0.15), id.primaria === '#F2B705' ? '#C98A00' : id.primaria);
          pin.texto(String(v), x + 154, yy + 3, 9, display, COR.tinta, { alinhar: 'right' });
        });
      }, 16);
      break;
    }
    case 'POSICOES': {
      titulo('Escolha a posição');
      const posicoes: [Posicao, TimeId, string, number][] = [
        ['GOL', 'TUC', 'Goleiro', 1],
        ['ZAG', 'CAP', 'Zagueiro', 2],
        ['MEI', 'ARA', 'Meia', 2],
        ['ATA', 'SAG', 'Atacante', 2],
      ];
      posicoes.forEach(([pos, time, nome, n], k) => {
        const col = k % 2;
        const lin = Math.floor(k / 2);
        const x = 14 + col * 124;
        const y = 84 + lin * 150;
        surge(entre(t, 0.3 + k * 0.3, 0.7 + k * 0.3), () => {
          pin.tabua(x, y, 118, 140);
          pin.placa(x + 8, y + 8, 102, 92, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
          pin.r(x + 11, y + 76, 96, 21, '#7FB069');
          const pose: Pose = pos === 'GOL' ? (Math.floor(tVideo * 2) % 2 ? 'MERGULHO' : 'FRENTE_PARADO') : ((passo + k) % 2 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B');
          boneco(pin, pose, uniforme(time, pos, `pos-${k}`), x + 35, y + 14, 4);
          pin.texto(nome, x + 59, y + 116, pin.caber(nome, 100, 20, display), display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(n === 1 ? '1 por time' : `${n} por time`, x + 59, y + 132, 7, texto, COR.placa, { peso: 600 });
        }, 14);
      });
      surge(entre(t, 1.8, 2.3), () => {
        pin.texto('7 em campo por jogo', COLUNAS / 2, 404, 22, display, COR.placa, { contorno: COR.contorno });
      });
      break;
    }
    case 'EVOLUCAO': {
      titulo('Evolua jogando');
      const id = IDENTIDADE[d.exemplo.time];
      const linhas: [HabilidadeId, number, number, string][] = [
        ['FIN', 69, 70.6, 'Gol!'],
        ['DRI', 65, 66.4, 'Drible!'],
        ['PAS', 59, 60.2, 'Assistência!'],
        ['DEF', 47, 47.5, 'Desarme!'],
      ];
      surge(entre(t, 0.2, 0.6), () => {
        pin.tabua(14, 82, 242, 158);
        linhas.forEach(([h, de, ate, evento], k) => {
          const y = 98 + k * 34;
          const cresce = entre(t, 0.9 + k * 0.7, 1.4 + k * 0.7);
          const v = de + (ate - de) * cresce;
          pin.texto(NOME_DA_HABILIDADE[h], 26, y + 4, 11, texto, COR.placa, { alinhar: 'left', peso: 700 });
          barra(pin, 104, y + 1, 110, v, '#7FB069');
          pin.texto(String(Math.round(v)), 244, y + 4, 16, display, COR.amarelo, { alinhar: 'right', contorno: COR.contorno });
          if (cresce > 0 && cresce < 1) {
            pin.ctx.globalAlpha = Math.min(1, cresce * 3) * (1 - cresce * 0.5);
            pin.texto(`${evento} +${(ate - de).toFixed(1).replace('.', ',')}`, 160, y + 18 - cresce * 6, 10, display, '#FFFFFF', { contorno: COR.contorno });
            pin.ctx.globalAlpha = 1;
          }
        });
      });
      // Craque da Rodada: a figurinha que a torcida escolhe.
      surge(entre(t, 3.6, 4.2), () => {
        pin.tabua(14, 256, 242, 150);
        pin.texto('Craque da Rodada', COLUNAS / 2, 276, 22, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('a torcida vota todo dia às 19h', COLUNAS / 2, 296, 9, texto, COR.placa, { peso: 600 });
        for (let k = 0; k < 3; k++) {
          const x = 36 + k * 68;
          const ganhador = k === 1;
          pin.placa(x, 310, 60, 80, { fundo: ganhador ? COR.amarelo : COR.placa, luz: '#FFF8E6', sombra: ganhador ? '#B88600' : COR.placaSombra });
          pin.r(x + 3, 366, 54, 21, '#7FB069');
          const time = (['TAM', 'ONC', 'PRE'] as TimeId[])[k]!;
          const pose: Pose = ganhador && Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
          boneco(pin, pose, uniforme(time, (['MEI', 'ATA', 'GOL'] as Posicao[])[k]!, `c${k}`), x + 12, 318, 3);
          pin.placa(x - 4, 306, 18, 20, { fundo: COR.amarelo, luz: '#FFE07A', sombra: '#B88600' });
          pin.texto(String(k + 1), x + 5, 316, 16, display, COR.tinta);
        }
        if (t > 4.8) {
          const b = entre(t, 4.8, 5.2);
          pin.ctx.globalAlpha = b;
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
            pin.r(COLUNAS / 2 + Math.cos(ang) * 40 - 1, 345 + Math.sin(ang) * 40 - 1, 3, 3, COR.amarelo);
          }
          pin.ctx.globalAlpha = 1;
        }
      });
      // a faixa com a cor do Time do exemplo, embaixo da tábua de habilidades
      surge(entre(t, 0.2, 0.6), () => pin.r(18, 237, 234, 2, contraste(id.primaria) === '#FFFFFF' ? id.primaria : id.secundaria));
      break;
    }
    case 'AGENDA': {
      titulo(`Temporada ${d.temporada}`);
      const { dia, mes, semana } = dataDa(d);
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(22, 84, 226, 108);
        pin.texto('Estreia', COLUNAS / 2, 104, 14, texto, COR.placa, { peso: 700 });
        pin.texto(`${semana}, ${dia} de ${mes}`, COLUNAS / 2, 134, pin.caber(`${semana}, ${dia} de ${mes}`, 206, 28, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('uma rodada por dia', COLUNAS / 2, 166, 10, texto, COR.placaSombra, { peso: 600 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.tabua(22, 206, 226, 84);
        pin.texto('Jogos todo dia', COLUNAS / 2, 224, 12, texto, COR.placa, { peso: 700 });
        d.horarios.forEach((h, k) => {
          const x = 44 + k * 61;
          plaquinha(pin, x, 242, 40, 30, `${h}h`, display);
        });
      });
      surge(entre(t, 2.2, 2.6), () => {
        pin.tabua(22, 304, 226, 52);
        pin.texto(`${d.horaDoResumo}h: Resumo e votação`, COLUNAS / 2, 330, pin.caber(`${d.horaDoResumo}h: Resumo e votação`, 206, 18, display), display, COR.placa, { contorno: COR.contorno });
      });
      surge(entre(t, 3.0, 3.4), () => {
        pin.tabua(22, 370, 226, 52);
        pin.texto('7 rodadas, semifinal e final', COLUNAS / 2, 396, pin.caber('7 rodadas, semifinal e final', 206, 18, display), display, COR.amarelo, { contorno: COR.contorno });
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
        // pulsa de leve para chamar o olho
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
