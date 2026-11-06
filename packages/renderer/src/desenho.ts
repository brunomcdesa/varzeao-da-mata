/**
 * Desenha um EstadoQuadro num canvas 9:16 (1080×1920 no vídeo; qualquer tamanho no site,
 * pois tudo é medido na grade lógica de 270 colunas de pixel.ts).
 *
 * Linguagem visual: várzea em pixel art. Placar de tábua com plaquinhas penduradas,
 * campo com terrão e cal, mata em volta e faixa de torcida no gol.
 */
import { IDENTIDADE, type Posicao, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';
import { CAMPO, cenario } from './cenario.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste } from './pixel.js';
import { ALTURA_ESCUDO, LARGURA_ESCUDO, escudo } from './escudos.js';
import { ALTURA_SPRITE, LARGURA_SPRITE, aparencia, escolherPose, sprite, type Visual } from './sprites.js';
import type { EstadoQuadro, JogadorNoQuadro, Ponto } from './timeline.js';

export interface OpcoesDesenho {
  times: Record<Lado, TimeId>;
  /** @ de cada lugar da Escalação; null = Jogador da Base. */
  nomes: Record<Lado, (string | null)[]>;
  /** Fonte dos números e letreiros (precisa estar carregada na página). Padrão: Jersey 10. */
  fonteDisplay?: string;
  /** Fonte dos nomes. Padrão: Pixelify Sans. */
  fonteTexto?: string;
}

/** Tamanho do pixel do boneco em pixels lógicos. */
export const ESCALA_BONECO = 1.5;

export const FONTE_DISPLAY = '"Jersey 10", sans-serif';
export const FONTE_TEXTO = '"Pixelify Sans", sans-serif';

/** Ponto do campo (0–1) na grade lógica. */
export const noCampo = (p: Ponto): Ponto => ({ x: CAMPO.x + p.x * CAMPO.w, y: CAMPO.y + p.y * CAMPO.h });

export function desenharQuadro(ctx: CanvasRenderingContext2D, estado: EstadoQuadro, o: OpcoesDesenho): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);

  // Sombras primeiro, depois Jogadores de cima para baixo (quem está mais embaixo fica na frente).
  const fase = Math.floor(estado.t / 1.1);
  const ordem = [...estado.jogadores].sort((a, b) => a.pos.y - b.pos.y);
  for (const j of ordem) {
    const p = noCampo(j.pos);
    pin.r(p.x - 6, p.y - 1, 12, 3, 'rgba(0,0,0,0.28)');
  }
  const bolaChao = noCampo(estado.bola);
  pin.r(bolaChao.x - 3, bolaChao.y, 6, 2, 'rgba(0,0,0,0.35)');

  const bolaAlta = estado.bolaAltura > 0.08;
  if (!bolaAlta) desenharBola(pin, bolaChao, 0);
  for (const j of ordem) desenharJogador(pin, j, o, fase);
  for (const j of ordem) desenharNome(pin, j, o, texto);
  if (bolaAlta) desenharBola(pin, bolaChao, estado.bolaAltura);

  desenharPlacar(pin, estado, o, display, texto);
  if (estado.destaque) desenharDestaque(pin, estado, o, display, texto);
}

function visualDe(j: JogadorNoQuadro, o: OpcoesDesenho): Visual {
  const nome = o.nomes[j.slot.lado][j.slot.indice] ?? `base-${j.slot.lado}-${j.slot.indice}`;
  return visualDoJogador(o.times[j.slot.lado], j.posicao, nome);
}

/** Uniforme do Time (goleiro com as cores invertidas) e pele/cabelo fixos pelo @ ("@rafa"). */
export function visualDoJogador(time: TimeId, posicao: Posicao, nome: string): Visual {
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

function desenharJogador(pin: Pincel, j: JogadorNoQuadro, o: OpcoesDesenho, fase: number): void {
  const p = noCampo(j.pos);
  const olhar = { x: j.olhar.x - j.pos.x, y: j.olhar.y - j.pos.y };
  const { pose, espelhar, pulo } = escolherPose(j.acao, j.vel, olhar, fase + j.slot.indice);
  const img = sprite(pose, visualDe(j, o));
  // 1 pixel do boneco = 1,5 pixel lógico (6 px no vídeo de 1080).
  const s = pin.px * ESCALA_BONECO;
  const x = Math.round(p.x * pin.px - (LARGURA_SPRITE / 2) * s);
  const y = Math.round((p.y + 1) * pin.px - ALTURA_SPRITE * s - pulo * s);
  const c = pin.ctx;
  c.save();
  if (espelhar) {
    c.translate(x + LARGURA_SPRITE * s, y);
    c.scale(-1, 1);
    c.drawImage(img, 0, 0, LARGURA_SPRITE * s, ALTURA_SPRITE * s);
  } else {
    c.drawImage(img, x, y, LARGURA_SPRITE * s, ALTURA_SPRITE * s);
  }
  c.restore();
}

function desenharNome(pin: Pincel, j: JogadorNoQuadro, o: OpcoesDesenho, fonte: string): void {
  const p = noCampo(j.pos);
  const nome = o.nomes[j.slot.lado][j.slot.indice] ?? 'Base';
  pin.texto(nome, p.x, p.y + 6, 6.5, fonte, '#FFFFFF', { contorno: 'rgba(20,14,8,0.9)', peso: 600, espessura: 0.5 });
}

const BOLA = [' WW ', 'WKWW', 'WWKW', ' WW '];

function desenharBola(pin: Pincel, chao: Ponto, altura: number): void {
  const s = 1.5 * (1 + altura * 0.6);
  const x0 = chao.x - 2 * s;
  const y0 = chao.y - 3 * s - altura * 34;
  BOLA.forEach((linha, y) => {
    for (let x = 0; x < 4; x++) {
      const ch = linha[x];
      if (ch === ' ') continue;
      const cor = ch === 'K' ? COR.contorno : '#FFFFFF';
      const c = pin.ctx;
      c.fillStyle = cor;
      c.fillRect((x0 + x * s) * pin.px, (y0 + y * s) * pin.px, Math.ceil(s * pin.px), Math.ceil(s * pin.px));
    }
  });
}

/** Escudo do Time em pixel art, com `escala` pixels lógicos por pixel do escudo. */
export function desenharEscudo(pin: Pincel, time: TimeId, x: number, y: number, escala = 1): void {
  pin.ctx.imageSmoothingEnabled = false;
  pin.ctx.drawImage(escudo(time), Math.round(x * pin.px), Math.round(y * pin.px), LARGURA_ESCUDO * escala * pin.px, ALTURA_ESCUDO * escala * pin.px);
}

/** Plaquinha de número pendurada num prego, como nos placares de várzea. */
export function plaquinha(pin: Pincel, cx: number, topo: number, w: number, h: number, valor: string, fonte: string): void {
  pin.r(cx, topo - 3, 1, 3, COR.placaSombra); // prego
  pin.r(cx - 1, topo - 3, 3, 1, COR.contorno);
  pin.placa(cx - w / 2, topo, w, h, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
  pin.r(cx, topo + 2, 1, 1, COR.contorno); // furo
  pin.texto(valor, cx + 0.5, topo + h / 2 + 2, h - 4, fonte, COR.tinta);
}

/** Tábua do placar: siglas nas cores dos Times e os gols em plaquinhas. */
export function desenharTabuaDoPlacar(
  pin: Pincel,
  cx: number,
  y: number,
  escala: number,
  times: Record<Lado, TimeId>,
  placar: Record<Lado, number>,
  display: string,
): void {
  const w = 216 * escala;
  const h = 36 * escala;
  const x = cx - w / 2;
  // cordas
  for (const rx of [x + 24 * escala, x + w - 24 * escala]) {
    for (let yy = 0; yy < y + 2; yy++) pin.r(rx + (yy % 4 < 2 ? 0 : 1), yy, 1, 1, COR.corda);
  }
  pin.tabua(x, y, w, h);
  const lados: Lado[] = ['mandante', 'visitante'];
  lados.forEach((lado, i) => {
    const id = IDENTIDADE[times[lado]];
    const pw = 54 * escala;
    const ph = 24 * escala;
    const px = i === 0 ? x + 8 * escala : x + w - 8 * escala - pw;
    const py = y + 6 * escala;
    pin.placa(px, py, pw, ph, { fundo: id.primaria, sombra: id.secundaria, degrau: 2 });
    pin.r(px + 2, py + ph - 4 * escala, pw - 4, 2 * escala, id.secundaria);
    // Escudo na ponta de fora da plaquinha; a sigla ocupa o resto.
    const ew = LARGURA_ESCUDO * escala;
    const ex = i === 0 ? px - 4 * escala : px + pw - ew + 4 * escala;
    desenharEscudo(pin, times[lado], ex, py - 2 * escala, escala);
    const siglaX = i === 0 ? px + ew - 2 * escala + (pw - ew) / 2 : px + (pw - ew) / 2 + 2 * escala;
    pin.texto(id.sigla, siglaX, py + ph / 2 - 0.5 * escala, 18 * escala, display, contraste(id.primaria));
    // número
    const nx = cx + (i === 0 ? -17 : 17) * escala;
    plaquinha(pin, nx, y + 5 * escala, 22 * escala, 27 * escala, String(placar[lado]), display);
  });
  pin.texto('x', cx, y + 18 * escala, 12 * escala, display, COR.placa);
}

function desenharPlacar(pin: Pincel, e: EstadoQuadro, o: OpcoesDesenho, display: string, texto: string): void {
  desenharTabuaDoPlacar(pin, COLUNAS / 2, 8, 1, o.times, e.placar, display);
  const rotulo = e.encerrada ? 'Fim de jogo' : `${e.minuto}'`;
  pin.texto(rotulo, COLUNAS / 2, 52, 9, texto, COR.amarelo, { contorno: COR.mata, peso: 700 });
}

/**
 * Faixa de torcida tremulando: colunas de 1 pixel deslocadas por uma onda, listras nas
 * cores do Time e franja embaixo. `abertura` (0–1) desenrola da esquerda para a direita.
 */
export function faixaDeTorcida(
  pin: Pincel,
  y: number,
  h: number,
  cores: { primaria: string; secundaria: string },
  fase: number,
  abertura: number,
  x0 = 0,
  x1 = COLUNAS,
): (x: number) => number {
  const onda = (x: number) => Math.round(Math.sin(x * 0.075 + fase) * 3 + Math.sin(x * 0.021 + fase * 0.6) * 2);
  const ate = x0 + (x1 - x0) * abertura;
  for (let x = x0; x < ate; x++) {
    const dy = onda(x);
    const sombra = Math.sin(x * 0.075 + fase + 0.9) > 0.55; // dobra do tecido
    pin.r(x, y + dy - 1, 1, h + 2, COR.contorno);
    pin.r(x, y + dy, 1, h, sombra ? escurecer(cores.primaria) : cores.primaria);
    pin.r(x, y + dy + 2, 1, 3, cores.secundaria);
    pin.r(x, y + dy + h - 5, 1, 3, cores.secundaria);
    if (x % 4 < 2) pin.r(x, y + dy + h, 1, 3, cores.secundaria); // franja
  }
  return onda;
}

function escurecer(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.82).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

const TITULO = { GOL: 'Goooool!', DEFESA: 'Defesaça!', DESARME: 'Desarme!', FORA: 'Pra fora!' } as const;

function desenharDestaque(pin: Pincel, e: EstadoQuadro, o: OpcoesDesenho, display: string, texto: string): void {
  const d = e.destaque!;
  const id = IDENTIDADE[o.times[d.lado]];
  const nome = o.nomes[d.protagonista.lado][d.protagonista.indice] ?? 'Jogador da Base';
  const p = d.progresso;

  if (d.tipo === 'GOL') {
    const abre = Math.min(1, p / 0.12);
    const some = p > 0.86 ? (p - 0.86) / 0.14 : 0;
    const y = 196 - Math.round(some * some * 260);
    const fase = p * 38;
    const onda = faixaDeTorcida(pin, y, 66, id, fase, abre);
    if (abre >= 0.6) {
      const titulo = TITULO.GOL;
      const tam = pin.caber(titulo, 240, 58, display);
      pin.ctx.font = `400 ${tam * pin.px}px ${display}`;
      const larguras = [...titulo].map((ch) => pin.ctx.measureText(ch).width / pin.px);
      let x = COLUNAS / 2 - larguras.reduce((s, w) => s + w, 0) / 2;
      const cor = contraste(id.primaria);
      [...titulo].forEach((ch, i) => {
        const cx = x + larguras[i]! / 2;
        pin.texto(ch, cx, y + 33 + onda(Math.round(cx)), tam, display, cor, cor === '#FFFFFF' ? { contorno: COR.contorno } : {});
        x += larguras[i]!;
      });
    }
    // Tag de madeira com o autor, pendurada embaixo da faixa.
    if (p > 0.08) {
      pin.ctx.font = `700 ${11 * pin.px}px ${texto}`;
      const largura = Math.min(230, pin.ctx.measureText(nome).width / pin.px + 46);
      const ty = y + 76 + onda(COLUNAS / 2);
      pin.r(COLUNAS / 2 - 1, y + 70 + onda(COLUNAS / 2), 2, 6, COR.corda);
      pin.tabua(COLUNAS / 2 - largura / 2, ty, largura, 26);
      desenharEscudo(pin, o.times[d.lado], COLUNAS / 2 - largura / 2 + 6, ty + 3, 0.85);
      pin.texto(nome, COLUNAS / 2 + 11, ty + 13, pin.caber(nome, largura - 40, 11, texto, 700), texto, COR.placa, { peso: 700 });
    }
    return;
  }

  // Lances menores: placa de madeira que entra pelo lado, longe de onde a bola está.
  const entra = Math.min(1, p / 0.1);
  const sai = p > 0.85 ? (p - 0.85) / 0.15 : 0;
  const desloc = (1 - suave(entra)) * -COLUNAS + suave(sai) * COLUNAS;
  const embaixo = e.bola.y < 0.5;
  const w = 176;
  const h = 46;
  const x = (COLUNAS - w) / 2 + desloc;
  const y = embaixo ? 404 : 70;
  pin.tabua(x, y, w, h);
  desenharEscudo(pin, o.times[d.lado], x + 8, y + 9, 1.15);
  pin.texto(TITULO[d.tipo], x + w / 2 + 14, y + 17, 22, display, COR.amarelo, { contorno: COR.contorno });
  pin.texto(nome, x + w / 2 + 14, y + 34, pin.caber(nome, w - 50, 8, texto, 600), texto, COR.placa, { peso: 600 });
}

const suave = (f: number) => f * f * (3 - 2 * f);
