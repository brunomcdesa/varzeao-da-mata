/**
 * Reels explicativo da Escalação: por que alguém do Elenco fica fora de uma Partida.
 * Mesmo estilo de cartelas da apresentação (tábuas de várzea sobre o campo). A regra vem de
 * `worker/src/escalacao.ts`: rodízio por Posição, Craque da Rodada anterior garantido, quem
 * jogou menos na Temporada primeiro e Jogador da Base nas vagas sem inscrito. Os números dos
 * Elencos são uma foto do momento (`situacaoEm`) e aparecem com esse aviso no vídeo.
 */
import { FALA_DO_TIME, FORMACAO, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, plaquinha } from './desenho.js';
import type { Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export const POSICOES: readonly Posicao[] = ['GOL', 'ZAG', 'MEI', 'ATA'];
export type ElencoPorPosicao = Record<Posicao, number>;

export interface DadosDaExplicacao {
  temporada: number;
  /** Rodadas da Fase de Liga. */
  rodadas: number;
  /** Quando os números dos Elencos foram tirados (ISO). */
  situacaoEm: string;
  /** Inscritos de cada Time por Posição. */
  elencos: Partial<Record<TimeId, ElencoPorPosicao>>;
  /** Time usado no exemplo; se faltar, vale o de `exemploPadrao`. */
  exemplo?: TimeId;
}

// ---------------------------------------------------------------- números dos Elencos

/** Conta os inscritos de cada Time por Posição (a partir do jogadores.json do site). */
export function contarElencos(jogadores: readonly { time: TimeId; posicao: Posicao }[], times: readonly TimeId[]): Record<TimeId, ElencoPorPosicao> {
  const r = {} as Record<TimeId, ElencoPorPosicao>;
  for (const t of times) r[t] = { GOL: 0, ZAG: 0, MEI: 0, ATA: 0 };
  for (const j of jogadores) if (r[j.time]) r[j.time][j.posicao]++;
  return r;
}

const timesDe = (e: DadosDaExplicacao['elencos']) => Object.keys(e) as TimeId[];

/** Vagas que hoje vão para o Jogador da Base: menos inscritos que lugares na Formação. */
export function vagasDaBase(e: DadosDaExplicacao['elencos']): { time: TimeId; posicao: Posicao; faltam: number }[] {
  return timesDe(e).flatMap((time) =>
    POSICOES.filter((p) => e[time]![p] < FORMACAO[p]).map((posicao) => ({ time, posicao, faltam: FORMACAO[posicao] - e[time]![posicao] })),
  );
}

/** Posições com exatamente um inscrito por vaga: quem está ali joga todas as Partidas. */
export function titularesFixos(e: DadosDaExplicacao['elencos']): { time: TimeId; posicao: Posicao }[] {
  return timesDe(e).flatMap((time) => POSICOES.filter((p) => e[time]![p] === FORMACAO[p]).map((posicao) => ({ time, posicao })));
}

/** A Posição mais disputada de um Time (mais inscritos por vaga). */
export function maisDisputada(el: ElencoPorPosicao): { posicao: Posicao; inscritos: number; vagas: number } {
  const posicao = POSICOES.reduce((m, p) => (el[p] / FORMACAO[p] > el[m] / FORMACAO[m] ? p : m));
  return { posicao, inscritos: el[posicao], vagas: FORMACAO[posicao] };
}

/** O exemplo que melhor mostra as duas coisas: Posição lotada e vaga para a Base no mesmo Time. */
export function exemploPadrao(e: DadosDaExplicacao['elencos']): TimeId {
  const times = timesDe(e);
  const nota = (t: TimeId) => {
    const d = maisDisputada(e[t]!);
    const temBase = POSICOES.some((p) => e[t]![p] < FORMACAO[p]);
    return (temBase ? 100 : 0) + d.inscritos / d.vagas;
  };
  return times.reduce((m, t) => (nota(t) > nota(m) ? t : m), times[0]!);
}

/**
 * Quanto joga quem divide `vagas` lugares com `inscritos` colegas, em média pelo rodízio:
 * "joga 2 de cada 7 Rodadas". Sem inscrito, a vaga é do Jogador da Base.
 */
export function frequencia(inscritos: number, vagas: number): string {
  if (inscritos === 0) return 'vaga do Jogador da Base';
  if (inscritos <= vagas) return inscritos < vagas ? 'joga sempre (e entra Base)' : 'joga todas as Rodadas';
  const mdc = (a: number, b: number): number => (b ? mdc(b, a % b) : a);
  const m = mdc(vagas, inscritos);
  return `joga ${vagas / m} de cada ${inscritos / m} Rodadas`;
}

/** "10/11 às 19h51", no horário de Brasília. */
export function quandoEscrito(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month} às ${p.hour}h${p.minute}`;
}

// ---------------------------------------------------------------- roteiro

export type CartelaExplicacao = 'ABERTURA' | 'FORMACAO' | 'CORTE' | 'ORDEM' | 'EXEMPLO' | 'VAGAS' | 'AVISOS' | 'CHAMADA';
export type SegmentoExplicacao = Segmento & { cartela: CartelaExplicacao };

const ORDEM: CartelaExplicacao[] = ['ABERTURA', 'FORMACAO', 'CORTE', 'ORDEM', 'EXEMPLO', 'VAGAS', 'AVISOS', 'CHAMADA'];
const DURACAO_BASE: Record<CartelaExplicacao, number> = { ABERTURA: 4, FORMACAO: 6, CORTE: 6.5, ORDEM: 9, EXEMPLO: 9, VAGAS: 9, AVISOS: 8, CHAMADA: 6 };
const CORTE = 0.3;

export class RoteiroExplicacao {
  readonly segmentos: SegmentoExplicacao[];
  readonly duracao: number;
  readonly exemplo: TimeId;

  constructor(
    readonly dados: DadosDaExplicacao,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    this.exemplo = dados.exemplo ?? exemploPadrao(dados.elencos);
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

  em(tBruto: number): { segmento: SegmentoExplicacao; indice: number; tempo: number; escurecer: number } {
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

const POSICAO_FALADA: Record<Posicao, [string, string]> = { GOL: ['goleiro', 'goleiros'], ZAG: ['zagueiro', 'zagueiros'], MEI: ['meia', 'meias'], ATA: ['atacante', 'atacantes'] };
const POSICAO_ESCRITA: Record<Posicao, [string, string]> = { GOL: ['Goleiro', 'Goleiros'], ZAG: ['Zagueiro', 'Zagueiros'], MEI: ['Meia', 'Meias'], ATA: ['Atacante', 'Atacantes'] };
const NUMERO: Record<number, string> = { 0: 'nenhum', 1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez' };
const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
const plural = (p: Posicao, n: number) => POSICAO_FALADA[p][n === 1 ? 0 : 1];

export function narracaoDaExplicacao(roteiro: RoteiroExplicacao): Fala[] {
  const d = roteiro.dados;
  const ex = roteiro.exemplo;
  const el = d.elencos[ex]!;
  const disputa = maisDisputada(el);
  const base = vagasDaBase(d.elencos);
  const baseDoExemplo = base.filter((b) => b.time === ex);
  const vagasFaladas = [...new Set(base.map((b) => curto(b.time)))];
  return roteiro.segmentos.map((s, i): Fala => {
    const texto: Record<CartelaExplicacao, string> = {
      ABERTURA: 'Se inscreveu e ficou fora do jogo? Não é bug: é o rodízio!',
      FORMACAO: 'Cada time entra com sete: um goleiro, dois zagueiros, dois meias e dois atacantes. A briga por vaga é dentro da sua posição.',
      CORTE: 'Meia hora antes de cada jogo, a escalação fecha. Quem se inscreveu depois disso entra no próximo jogo do time.',
      ORDEM: 'Quem entra primeiro? O Craque da Rodada anterior tem vaga garantida. Depois, quem jogou menos na temporada. Empatou? Quem está há mais tempo sem jogar.',
      EXEMPLO:
        `Olha ${FALA_DO_TIME[ex].artigo} ${curto(ex)}: são ${NUMERO[disputa.inscritos] ?? disputa.inscritos} ${plural(disputa.posicao, disputa.inscritos)} para ${disputa.vagas === 1 ? 'uma vaga' : 'duas vagas'}. ` +
        (baseDoExemplo.length
          ? `E ${plural(baseDoExemplo[0]!.posicao, 2)}? ${el[baseDoExemplo[0]!.posicao] === 0 ? 'Nenhum inscrito' : 'Falta gente'}, então entra o jogador da base.`
          : 'Então cada um espera a sua vez.'),
      VAGAS: vagasFaladas.length
        ? `Agora, no momento deste vídeo, ainda tem vaga sobrando: ${vagasFaladas.length > 1 ? `${vagasFaladas.slice(0, -1).join(', ')} e ${vagasFaladas[vagasFaladas.length - 1]}` : vagasFaladas[0]} jogam com gente da base. Quem entra ali é titular em todo jogo.`
        : 'Agora, no momento deste vídeo, as posições com um inscrito por vaga jogam todas as rodadas.',
      AVISOS: 'Quem acabou de chegar tem zero jogos, então entra antes. Na transferência, os seus jogos vão junto. E confere no site se o seu nome está no elenco.',
      CHAMADA: 'Quer jogar mais? Comenta ENTRO, o time e uma posição com vaga!',
    };
    const animado = s.cartela === 'ABERTURA' || s.cartela === 'CHAMADA';
    return { id: `explicacao-${i}`, texto: texto[s.cartela], inicio: s.inicio + 0.35, limite: s.fim, tom: animado ? 'animado' : 'normal', segmento: i, parte: 'antes' };
  });
}

// ---------------------------------------------------------------- desenho

export interface OpcoesExplicacao {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function desenharQuadroExplicacao(ctx: CanvasRenderingContext2D, roteiro: RoteiroExplicacao, tVideo: number, o: OpcoesExplicacao = {}): void {
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
    pin.ctx.globalAlpha *= a;
    pin.ctx.translate(0, (1 - a) * dy * pin.px);
    desenhar();
    pin.ctx.restore();
  };
  const corre = (k: number): Pose => ((passo + k) % 2 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B');
  /** Jogador da Base: o uniforme do Time, apagado, com a etiqueta BASE. */
  const daBase = (time: TimeId, posicao: Posicao, x: number, y: number, escala: number, k: number) => {
    pin.ctx.save();
    pin.ctx.globalAlpha *= 0.5;
    boneco(pin, 'FRENTE_PARADO', uniforme(time, posicao, `base-${time}-${k}`), x, y, escala);
    pin.ctx.restore();
    const w = 22;
    pin.placa(x + 6 * escala - w / 2, y + 16 * escala - 2, w, 10, { fundo: COR.amarelo, sombra: '#B88600' });
    pin.texto('BASE', x + 6 * escala, y + 16 * escala + 3.5, 7, texto, COR.tinta, { peso: 700 });
  };
  const aviso = (y: number) => {
    const txt = `situação em ${quandoEscrito(d.situacaoEm)}`;
    pin.placa(COLUNAS / 2 - 72, y - 8, 144, 16, { fundo: COR.amarelo, luz: '#FFE07A', sombra: '#B88600' });
    pin.texto(txt, COLUNAS / 2, y + 0.5, pin.caber(txt, 134, 9, texto, 700), texto, COR.tinta, { peso: 700 });
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      const ex = roteiro.exemplo;
      surge(entre(t, 0, 0.5), () => {
        pin.texto('Ficou de', COLUNAS / 2, 96, 40, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('fora do jogo?', COLUNAS / 2, 134, 40, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      // O banco de reservas: três no banco, olhando o jogo.
      surge(entre(t, 0.6, 1.1), () => {
        pin.tabua(40, 238, 190, 14);
        pin.r(52, 252, 4, 18, COR.madeiraEscura);
        pin.r(214, 252, 4, 18, COR.madeiraEscura);
        (['ATA', 'ATA', 'MEI'] as Posicao[]).forEach((p, k) => boneco(pin, k === 1 && Math.floor(tVideo * 2) % 2 ? 'FRENTE_PARADO' : 'COSTAS_PARADO', uniforme(ex, p, `banco-${k}`), 62 + k * 52, 190, 3));
      });
      surge(entre(t, 1.3, 1.8), () => {
        pin.tabua(30, 300, 210, 64);
        pin.texto('Não é bug:', COLUNAS / 2, 320, 20, display, COR.placa, { contorno: COR.contorno });
        pin.texto('é o rodízio!', COLUNAS / 2, 346, 26, display, COR.amarelo, { contorno: COR.contorno });
      });
      if (o.escudo) surge(entre(t, 1.8, 2.3), () => desenharEscudoDaLiga(pin, o.escudo!, COLUNAS / 2, 418, 64));
      break;
    }
    case 'FORMACAO': {
      titulo('7 em campo');
      // Campinho com a formação society, desenhado de cima.
      const cx = 30;
      const cy = 82;
      const cw = 210;
      const ch = 240;
      surge(entre(t, 0.2, 0.6), () => {
        pin.placa(cx - 4, cy - 4, cw + 8, ch + 8, { fundo: COR.madeira, luz: COR.madeiraLuz, sombra: COR.madeiraEscura, degrau: 2 });
        for (let k = 0; k < 6; k++) pin.r(cx, cy + k * (ch / 6), cw, ch / 6, k % 2 ? COR.grama : COR.gramaFaixa);
        pin.r(cx, cy + ch / 2, cw, 1, COR.cal);
        pin.r(cx + cw / 2 - 30, cy + ch - 26, 1, 26, COR.cal);
        pin.r(cx + cw / 2 + 30, cy + ch - 26, 1, 26, COR.cal);
        pin.r(cx + cw / 2 - 30, cy + ch - 26, 61, 1, COR.cal);
      }, 0);
      const ex = roteiro.exemplo;
      const lugares: [Posicao, number, number][] = [
        ['GOL', 0.5, 0.86],
        ['ZAG', 0.3, 0.68], ['ZAG', 0.7, 0.68],
        ['MEI', 0.3, 0.46], ['MEI', 0.7, 0.46],
        ['ATA', 0.33, 0.2], ['ATA', 0.67, 0.2],
      ];
      lugares.forEach(([p, fx, fy], k) => {
        const linha = POSICOES.indexOf(p);
        surge(entre(t, 0.7 + linha * 0.5, 1.0 + linha * 0.5), () => {
          const x = cx + fx * cw - 9;
          const y = cy + fy * ch - 24;
          boneco(pin, p === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme(ex, p, `f-${k}`), x, y, 1.5);
          pin.texto(p, x + 9, y + 30, 9, display, COR.placa, { contorno: COR.contorno });
        }, 6);
      });
      surge(entre(t, 2.8, 3.2), () => {
        pin.tabua(14, 340, 242, 66);
        pin.texto('A disputa é dentro', COLUNAS / 2, 360, 20, display, COR.placa, { contorno: COR.contorno });
        pin.texto('da sua Posição', COLUNAS / 2, 386, 24, display, COR.amarelo, { contorno: COR.contorno });
      });
      break;
    }
    case 'CORTE': {
      titulo('O Corte');
      surge(entre(t, 0.3, 0.7), () => {
        pin.tabua(22, 84, 226, 100);
        pin.texto('A Escalação fecha', COLUNAS / 2, 104, 12, texto, COR.placa, { peso: 700 });
        pin.texto('30 min', COLUNAS / 2, 136, 40, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('antes do Apito Inicial', COLUNAS / 2, 166, 12, texto, COR.placa, { peso: 700 });
      });
      // Linha do tempo: 13h30 Corte, 14h Apito Inicial.
      surge(entre(t, 1.2, 1.6), () => {
        const y = 222;
        pin.r(36, y, 198, 3, COR.placa);
        plaquinha(pin, 70, y + 12, 52, 26, '13h30', display);
        pin.texto('Corte', 70, y + 50, 11, texto, COR.amarelo, { peso: 700 });
        plaquinha(pin, 200, y + 12, 52, 26, '14h', display);
        pin.texto('Apito Inicial', 200, y + 50, 11, texto, COR.placa, { peso: 700 });
        pin.r(69, y - 6, 3, 15, COR.amarelo);
        pin.r(199, y - 6, 3, 15, COR.placa);
      });
      surge(entre(t, 2.2, 2.6), () => {
        pin.placa(22, 296, 226, 40, { fundo: '#7FB069', luz: '#A5CF8E', sombra: '#5E8A4B' });
        pin.texto('Inscrito até o Corte', COLUNAS / 2, 309, 11, texto, COR.tinta, { peso: 700 });
        pin.texto('entra nesta Escalação', COLUNAS / 2, 325, 14, display, COR.tinta);
      });
      surge(entre(t, 3.0, 3.4), () => {
        pin.placa(22, 346, 226, 40, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.texto('Inscrito depois do Corte', COLUNAS / 2, 359, 11, texto, COR.tinta, { peso: 700 });
        pin.texto('entra no próximo jogo do Time', COLUNAS / 2, 375, 14, display, COR.tinta);
      });
      break;
    }
    case 'ORDEM': {
      titulo('Quem entra primeiro');
      const linhas: [string, string][] = [
        ['Craque da Rodada', 'anterior: vaga garantida'],
        ['Quem jogou menos', 'na Temporada'],
        ['Empate? Mais tempo', 'sem jogar (ou nunca jogou)'],
        ['Empate de novo?', 'quem se inscreveu antes'],
      ];
      linhas.forEach(([a, b], k) => {
        const y = 84 + k * 76;
        surge(entre(t, 0.5 + k * 1.3, 0.9 + k * 1.3), () => {
          pin.tabua(14, y, 242, 66);
          plaquinha(pin, 40, y + 14, 34, 38, String(k + 1), display);
          pin.texto(a, 66, y + 26, pin.caber(a, 178, 20, display), display, k === 0 ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(b, 66, y + 48, pin.caber(b, 178, 10, texto, 600), texto, COR.placaSombra, { alinhar: 'left', peso: 600 });
        }, 12);
      });
      surge(entre(t, 6.0, 6.4), () => {
        pin.texto('tudo separado por Posição', COLUNAS / 2, 404, 12, texto, COR.placa, { peso: 700 });
      });
      break;
    }
    case 'EXEMPLO': {
      const ex = roteiro.exemplo;
      const el = d.elencos[ex]!;
      titulo(`Exemplo: ${curto(ex)}`);
      surge(entre(t, 0.2, 0.5), () => {
        desenharEscudo(pin, ex, COLUNAS / 2 - 15, 76, 1.6);
        aviso(122);
      });
      // Uma linha por Posição: quem entra (em campo) e quem espera (banco), ou a Base.
      POSICOES.forEach((p, k) => {
        const y = 138 + k * 62;
        surge(entre(t, 0.8 + k * 0.6, 1.2 + k * 0.6), () => {
          pin.tabua(10, y, 250, 56);
          const n = el[p];
          const vagas = FORMACAO[p];
          pin.texto(POSICAO_ESCRITA[p][vagas === 1 ? 0 : 1], 16, y + 12, 13, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(`${n} inscrito${n === 1 ? '' : 's'} · ${vagas} vaga${vagas === 1 ? '' : 's'}`, 16, y + 26, 8, texto, COR.placa, { alinhar: 'left', peso: 600 });
          pin.texto(frequencia(n, vagas), 16, y + 40, pin.caber(frequencia(n, vagas), 84, 8, texto, 700), texto, n > vagas ? COR.placaSombra : n === 0 ? COR.amarelo : '#A5CF8E', { alinhar: 'left', peso: 700 });
          // Até 7 bonecos; quem está nas vagas fica em pé e colorido, o resto no banco.
          const mostrar = Math.min(Math.max(n, vagas), 7);
          for (let j = 0; j < mostrar; j++) {
            const x = 104 + j * 21;
            if (j >= n) daBase(ex, p, x, y + 10, 1.5, j);
            else if (j < vagas) boneco(pin, corre(j + k), uniforme(ex, p, `ex-${p}-${j}`), x, y + 10, 1.5);
            else {
              pin.ctx.save();
              pin.ctx.globalAlpha *= 0.55;
              boneco(pin, 'COSTAS_PARADO', uniforme(ex, p, `ex-${p}-${j}`), x, y + 10, 1.5);
              pin.ctx.restore();
            }
          }
          if (n > vagas) pin.r(104 + vagas * 21 - 3, y + 6, 1, 44, COR.placaSombra);
        }, 8);
      });
      surge(entre(t, 3.6, 4.0), () => {
        pin.texto('em campo', 112, 400, 9, texto, '#A5CF8E', { peso: 700 });
        pin.texto('esperando a vez', 190, 400, 9, texto, COR.placaSombra, { peso: 700 });
      });
      break;
    }
    case 'VAGAS': {
      titulo('Onde falta gente');
      surge(entre(t, 0.2, 0.5), () => aviso(80));
      const base = vagasDaBase(d.elencos);
      const fixos = titularesFixos(d.elencos);
      surge(entre(t, 0.6, 1.0), () => {
        pin.texto('Vagas que hoje são da Base', COLUNAS / 2, 102, 11, texto, COR.placa, { peso: 700 });
      });
      const linhasBase = base.slice(0, 6);
      linhasBase.forEach((b, k) => {
        const col = k % 2;
        const lin = Math.floor(k / 2);
        const x = 14 + col * 124;
        const y = 112 + lin * 48;
        surge(entre(t, 1.0 + k * 0.35, 1.3 + k * 0.35), () => {
          pin.tabua(x, y, 118, 42);
          desenharEscudo(pin, b.time, x + 5, y + 7, 1);
          pin.texto(curto(b.time), x + 40, y + 13, pin.caber(curto(b.time), 74, 13, display), display, COR.placa, { alinhar: 'left', contorno: COR.contorno });
          const txt = `${b.faltam} ${POSICAO_ESCRITA[b.posicao][b.faltam === 1 ? 0 : 1]}`;
          pin.texto(txt, x + 40, y + 29, pin.caber(txt, 74, 13, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
        }, 8);
      });
      if (!base.length) surge(entre(t, 1.0, 1.4), () => pin.texto('nenhuma: todos completos!', COLUNAS / 2, 140, 16, display, COR.amarelo, { contorno: COR.contorno }));
      const y0 = 112 + Math.ceil(Math.max(linhasBase.length, 1) / 2) * 48 + 8;
      surge(entre(t, 3.6, 4.0), () => {
        pin.texto('Titular em todo jogo (1 por vaga)', COLUNAS / 2, y0 + 4, 11, texto, COR.placa, { peso: 700 });
      });
      fixos.slice(0, 8).forEach((f, k) => {
        const col = k % 4;
        const lin = Math.floor(k / 4);
        const x = 14 + col * 62;
        const y = y0 + 14 + lin * 40;
        surge(entre(t, 4.0 + k * 0.2, 4.3 + k * 0.2), () => {
          pin.placa(x, y, 56, 34, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
          desenharEscudo(pin, f.time, x + 4, y + 5, 0.75);
          pin.texto(f.posicao, x + 38, y + 18, 15, display, COR.tinta);
        }, 6);
      });
      break;
    }
    case 'AVISOS': {
      titulo('Fique de olho');
      const avisos: [string, string, string][] = [
        ['Chegou agora?', '0 jogos: você entra', 'antes de quem já jogou'],
        ['Transferiu?', 'seus jogos vão junto', 'para o Time novo'],
        ['Não aparece?', 'confira no site se o seu', 'nome está no Elenco'],
      ];
      avisos.forEach(([a, b, c], k) => {
        const y = 86 + k * 106;
        surge(entre(t, 0.5 + k * 1.6, 0.9 + k * 1.6), () => {
          pin.tabua(14, y, 242, 96);
          pin.texto(a, COLUNAS / 2, y + 24, 24, display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(b, COLUNAS / 2, y + 52, pin.caber(b, 220, 18, display), display, COR.placa, { contorno: COR.contorno });
          pin.texto(c, COLUNAS / 2, y + 74, pin.caber(c, 220, 18, display), display, COR.placa, { contorno: COR.contorno });
        }, 12);
      });
      break;
    }
    case 'CHAMADA': {
      const a = entre(t, 0, 0.5);
      pin.ctx.globalAlpha = a;
      pin.texto('Quer jogar', COLUNAS / 2, 66, 36, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
      pin.texto('mais?', COLUNAS / 2, 100, 44, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      pin.ctx.globalAlpha = 1;
      surge(entre(t, 0.5, 0.9), () => {
        pin.tabua(14, 130, 242, 132);
        pin.texto('Comente aqui embaixo', COLUNAS / 2, 150, 11, texto, COR.placa, { peso: 700 });
        const pulso = 1 + 0.04 * Math.sin(t * 6);
        pin.texto('ENTRO', COLUNAS / 2, 184, 34 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        pin.texto('+ TIME + POSIÇÃO', COLUNAS / 2, 216, pin.caber('+ TIME + POSIÇÃO', 220, 24, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('escolha uma Posição com vaga', COLUNAS / 2, 244, 10, texto, COR.placaSombra, { peso: 600 });
      });
      surge(entre(t, 1.2, 1.6), () => {
        pin.texto('Elencos e jogos de cada um', COLUNAS / 2, 284, 10, texto, COR.placa, { peso: 600 });
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
