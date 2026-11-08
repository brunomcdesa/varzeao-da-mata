/**
 * Desenho de um quadro do Reels: o campo da Timeline no instante que o Roteiro manda,
 * mais as cartelas de abertura e de fim e o escurecimento dos cortes.
 */
import { IDENTIDADE, type Aparencia, type Escalacao } from '@liga/shared';
import type { Lado, ResultadoPartida } from '@liga/sim';
import { CAMPO, cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, desenharQuadro, desenharTabuaDoPlacar, faixaDeTorcida, plaquinha, type OpcoesDesenho } from './desenho.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste } from './pixel.js';
import type { OpcoesRoteiro, QuadroRoteiro, Roteiro } from './roteiro.js';
import { aparencia, sprite } from './sprites.js';
import { narradorDa } from './narradores.js';

export interface OpcoesVideo extends OpcoesDesenho {
  /** Linha de contexto na abertura, ex.: "Rodada 1, jogo das 12h". */
  subtitulo?: string;
  /** Escudo da Liga (já carregado), mostrado na abertura. */
  escudo?: CanvasImageSource;
}

/** Tudo que a página do vídeo precisa para gravar uma Partida (montado pelo worker a partir do banco). */
export interface PartidaParaVideo {
  resultado: ResultadoPartida;
  escalacoes: Record<Lado, Escalacao>;
  /** @ de cada lugar da Escalação; null = Jogador da Base. */
  nomes: Record<Lado, (string | null)[]>;
  subtitulo?: string;
  roteiro?: OpcoesRoteiro;
  /** Aparências escolhidas pelos donos (ADR-0013), pelo @. */
  aparencias?: Record<string, Aparencia>;
}

export function desenharQuadroVideo(ctx: CanvasRenderingContext2D, roteiro: Roteiro, tVideo: number, o: OpcoesVideo): QuadroRoteiro {
  const q = roteiro.quadroEm(tVideo);
  const pin = new Pincel(ctx);
  const tipo = q.segmento.tipo;
  // Nas cartelas o fundo é o cenário vazio; no jogo, o quadro completo.
  if (tipo === 'LANCE' || tipo === 'PENALTIS') desenharQuadro(ctx, roteiro.timeline.estado(q.tJogo), o);
  else {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  }
  if (tipo === 'ABERTURA') desenharAbertura(pin, roteiro.timeline.resultado, q.progresso, tVideo, o);
  if (tipo === 'FIM') desenharFim(pin, roteiro.timeline.resultado, q.progresso, tVideo, o);

  if (q.escurecer > 0) {
    ctx.save();
    ctx.globalAlpha = q.escurecer;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  return q;
}

const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

/** O escudo é redondo: recorta em círculo para não aparecer o fundo quadrado da imagem. */
export function desenharEscudoDaLiga(pin: Pincel, img: CanvasImageSource, cx: number, cy: number, t: number): void {
  const c = pin.ctx;
  c.save();
  c.beginPath();
  c.arc(cx * pin.px, cy * pin.px, (t / 2) * 0.945 * pin.px, 0, Math.PI * 2);
  c.clip();
  c.imageSmoothingEnabled = true;
  c.drawImage(img, (cx - t / 2) * pin.px, (cy - t / 2) * pin.px, t * pin.px, t * pin.px);
  c.restore();
  c.imageSmoothingEnabled = false;
}

export function veu(pin: Pincel, alpha: number): void {
  pin.ctx.save();
  pin.ctx.globalAlpha = alpha;
  pin.r(0, 0, COLUNAS, LINHAS, COR.mata);
  pin.ctx.restore();
}

/** Texto acompanhando a onda da faixa, letra por letra. */
export function textoNaFaixa(pin: Pincel, txt: string, y: number, tamanho: number, fonte: string, cor: string, onda: (x: number) => number, centro = COLUNAS / 2): void {
  pin.ctx.font = `400 ${tamanho * pin.px}px ${fonte}`;
  const larguras = [...txt].map((ch) => pin.ctx.measureText(ch).width / pin.px);
  let x = centro - larguras.reduce((s, w) => s + w, 0) / 2;
  [...txt].forEach((ch, i) => {
    const cx = x + larguras[i]! / 2;
    pin.texto(ch, cx, y + onda(Math.round(cx)), tamanho, fonte, cor);
    x += larguras[i]!;
  });
}

/**
 * Capa do Reels (cover_url): a abertura completa, parada, "Time A x Time B" com os
 * escudos, descida para o centro da tela para caber no recorte 3:4 da grade do perfil.
 */
export function desenharCapa(ctx: CanvasRenderingContext2D, r: ResultadoPartida, o: OpcoesVideo): void {
  const pin = new Pincel(ctx);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);
  ctx.save();
  ctx.translate(0, 50 * pin.px);
  desenharAbertura(pin, r, 0.6, 0, o, false);
  ctx.restore();
}

function desenharAbertura(pin: Pincel, r: ResultadoPartida, p: number, tVideo: number, o: OpcoesVideo, comVeu = true): void {
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const alpha = 1 - entre(p, 0.78, 1);
  pin.ctx.save();
  pin.ctx.globalAlpha = alpha;
  if (comVeu) veu(pin, 0.84);

  if (o.escudo) {
    const t = 92;
    const e = entre(p, 0, 0.15);
    pin.ctx.globalAlpha = alpha * e;
    desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 76 - (1 - e) * 10, t);
    pin.ctx.globalAlpha = alpha;
  }
  if (o.subtitulo) pin.texto(o.subtitulo, COLUNAS / 2, 138, 9, texto, COR.placa, { peso: 600 });
  if (r.classico) {
    const w = 84;
    pin.ctx.globalAlpha = alpha * entre(p, 0.12, 0.22);
    pin.placa(COLUNAS / 2 - w / 2, 152, w, 22, { fundo: COR.amarelo, sombra: '#C99500' });
    pin.texto('Clássico', COLUNAS / 2, 164, 18, display, COR.tinta);
    pin.ctx.globalAlpha = alpha;
  }

  const lados: Lado[] = ['mandante', 'visitante'];
  lados.forEach((lado, i) => {
    const id = IDENTIDADE[r.times[lado]];
    const abre = entre(p, 0.08 + i * 0.12, 0.3 + i * 0.12);
    if (abre <= 0) return;
    const y = i === 0 ? 192 : 290;
    const onda = faixaDeTorcida(pin, y, 58, id, tVideo * 2.2 + i * 1.7, abre);
    // Escudo grande na ponta da faixa (mandante à esquerda, visitante à direita), nome no resto.
    const esq = i === 0;
    if (abre > 0.7) {
      const centro = esq ? 158 : 112;
      const tam = pin.caber(id.nome, 172, 30, display);
      textoNaFaixa(pin, id.nome, y + 30, tam, display, contraste(id.primaria), onda, centro);
    }
    const ee = entre(p, 0.2 + i * 0.12, 0.32 + i * 0.12);
    if (ee > 0) {
      const ex = esq ? 12 : COLUNAS - 12 - 50;
      desenharEscudo(pin, r.times[lado], ex, y - 2 + onda(ex + 25) - (1 - ee) * 30, 2.5);
    }
  });

  const ex = entre(p, 0.32, 0.42);
  if (ex > 0) {
    pin.ctx.globalAlpha = alpha * ex;
    pin.placa(COLUNAS / 2 - 15, 262, 30, 24, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
    pin.texto('x', COLUNAS / 2, 273, 20, display, COR.tinta);
    // Quem narra esta Partida (sorteado pela semente).
    pin.texto(`Narração: ${narradorDa(r.seed).nome}`, COLUNAS / 2, 372, 10, texto, COR.placa, { peso: 600 });
  }
  pin.ctx.restore();
}

function desenharFim(pin: Pincel, r: ResultadoPartida, p: number, tVideo: number, o: OpcoesVideo): void {
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  pin.ctx.save();
  pin.ctx.globalAlpha = entre(p, 0, 0.15);
  veu(pin, 0.86);

  desenharTabuaDoPlacar(pin, COLUNAS / 2, 22, 1.12, r.times, r.gols, display);
  pin.texto('Fim de jogo', COLUNAS / 2, 78, 22, display, COR.amarelo, { contorno: COR.mata });
  if (r.penaltis) pin.texto(`Nos pênaltis, ${r.penaltis.placar.mandante} a ${r.penaltis.placar.visitante}`, COLUNAS / 2, 96, 9, texto, COR.placa, { peso: 600 });

  // Melhor em campo: maior Nota da Partida, com o boneco grande.
  const melhor = [...r.desempenhos].sort((a, b) => b.nota - a.nota)[0];
  if (melhor) {
    pin.ctx.globalAlpha = entre(p, 0.15, 0.32);
    const x = 30;
    const y = 120;
    const w = 210;
    const h = 150;
    pin.tabua(x, y, w, h);
    pin.texto('Melhor em campo', COLUNAS / 2, y + 16, 20, display, COR.amarelo, { contorno: COR.contorno });
    const id = IDENTIDADE[r.times[melhor.slot.lado]];
    const nome = o.nomes[melhor.slot.lado][melhor.slot.indice] ?? 'Jogador da Base';
    const goleiro = melhor.posicao === 'GOL';
    const visual = {
      camisa: goleiro ? id.secundaria : id.primaria,
      detalhe: goleiro ? id.primaria : id.secundaria,
      calcao: goleiro ? '#2B2B2B' : id.secundaria,
      meiao: goleiro ? id.secundaria : id.primaria,
      ...aparencia(nome),
    };
    const escala = 5;
    const pulo = Math.floor(tVideo * 4) % 2 === 0 ? 0 : 2;
    // Quadro claro atrás do boneco, como figurinha colada na tábua.
    pin.placa(x + 12, y + 30, 72, 106, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
    pin.r(x + 16, y + 112, 64, 20, '#7FB069');
    pin.r(x + 16, y + 112, 64, 1, '#5E8F4C');
    pin.ctx.drawImage(sprite('FRENTE_COMEMORA', visual), (x + 18) * pin.px, (y + 48 - pulo) * pin.px, 12 * escala * pin.px, 16 * escala * pin.px);

    const tx = x + 92;
    pin.texto(nome, tx, y + 46, pin.caber(nome, w - 100, 11, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
    pin.texto(`${id.nome}, ${nomePosicao(melhor.posicao)}`, tx, y + 60, pin.caber(`${id.nome}, ${nomePosicao(melhor.posicao)}`, w - 100, 7, texto, 500), texto, COR.placa, { alinhar: 'left', peso: 500 });
    plaquinha(pin, tx + 18, y + 76, 34, 30, melhor.nota.toFixed(1), display);
    pin.texto('nota', tx + 18, y + 115, 7, texto, COR.placa, { peso: 500 });
    const delta = melhor.deltaOvr > 0 ? `+${melhor.deltaOvr}` : String(melhor.deltaOvr);
    pin.texto(`${melhor.ovrDepois}`, tx + 76, y + 92, 30, display, '#FFFFFF');
    pin.texto(`OVR ${delta}`, tx + 76, y + 115, 7, texto, melhor.deltaOvr >= 0 ? '#9FE08A' : '#FF8A7A', { peso: 600 });
  }

  // Faixa curta: compartilhar e entrar na Liga (a tela completa fica no Resumo).
  pin.ctx.globalAlpha = entre(p, 0.35, 0.5);
  pin.tabua(36, 288, 198, 88);
  const coracao = ['.XX.XX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  const bate = Math.sin(tVideo * 5) > 0.6 ? 1 : 0;
  coracao.forEach((l, y) => [...l].forEach((c, x) => c === 'X' && pin.r(62 + x * 2 - bate, 299 + y * 2 - bate, 2 + bate, 2 + bate, '#E4572E')));
  pin.texto('Curte e compartilha!', COLUNAS / 2 + 8, 304, pin.caber('Curte e compartilha!', 150, 16, display), display, '#FFFFFF', { contorno: COR.contorno });
  pin.texto('Quer jogar? Comente', COLUNAS / 2, 324, 10, texto, COR.placa, { peso: 600 });
  pin.texto('ENTRO + time + posição', COLUNAS / 2, 346, pin.caber('ENTRO + time + posição', 180, 26, display), display, COR.amarelo, { contorno: COR.contorno });
  pin.texto('Ex.: ENTRO CAPIVARA ATA', COLUNAS / 2, 364, 7, texto, COR.placaSombra, { peso: 500 });

  if (o.escudo) {
    pin.ctx.globalAlpha = entre(p, 0.5, 0.65);
    desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, CAMPO.y + CAMPO.h - 38, 56);
  }
  pin.ctx.restore();
}

function nomePosicao(p: string): string {
  return ({ GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' } as Record<string, string>)[p] ?? p;
}
