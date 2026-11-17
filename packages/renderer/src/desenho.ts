/**
 * Desenha um EstadoQuadro num canvas 9:16 (1080×1920 no vídeo; qualquer tamanho no site,
 * pois tudo é medido na grade lógica de 270 colunas de pixel.ts).
 *
 * Linguagem visual: várzea em pixel art. Placar de tábua com plaquinhas penduradas,
 * campo com terrão e cal, mata em volta e faixa de torcida no gol.
 */
import { FALA_DO_TIME, IDENTIDADE, NOME_DO_GRUPO, necessidadeNaBriga, situacoesNaBriga, textoDaNecessidade, type BrigaPeloMataMata, type Posicao, type SituacaoNaBriga, type TimeId } from '@liga/shared';
import type { Lado } from '@liga/sim';
import { CAMPO, cenario } from './cenario.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste, ruido } from './pixel.js';
import { ALTURA_DAS_ESTRELAS, ALTURA_ESCUDO, LARGURA_ESCUDO, escudo, estrelasDoEscudo } from './escudos.js';
import { ALTURA_SPRITE, LARGURA_SPRITE, MAO_DO_APITO, aparencia, escolherPose, sprite, type Pose, type Visual } from './sprites.js';
import type { CartaoNoJogo, EstadoQuadro, JogadorNoQuadro, Ponto } from './timeline.js';
import { visualDoJuiz, type JuizNoQuadro } from './juiz.js';
import { desenharArquibancada, desenharCartao, desenharClimaNoAr, desenharClimaNoChao, desenharCloseDaTorcida } from './arquibancada.js';
import { segundoUniforme } from './clima.js';

export interface OpcoesDesenho {
  times: Record<Lado, TimeId>;
  /** @ de cada lugar da Escalação; null = Jogador da Base. */
  nomes: Record<Lado, (string | null)[]>;
  /** Apelido de cada lugar (ADR-0014): o que aparece escrito. Sem ele, o @. O boneco segue pelo @. */
  apelidos?: Record<Lado, (string | null)[]>;
  /** Fonte dos números e letreiros (precisa estar carregada na página). Padrão: Jersey 10. */
  fonteDisplay?: string;
  /** Fonte dos nomes. Padrão: Pixelify Sans. */
  fonteTexto?: string;
  /** Última Rodada da Fase de Liga (ADR-0053): faixa "Última Rodada" e situação de cada Time. */
  briga?: BrigaPeloMataMata | null;
  /** Reels (ADR-0072): câmera que segue a jogada. Sem ela, o campo inteiro (site). */
  camera?: Camera;
  /** Reels (ADR-0072): posições anteriores da bola (da mais antiga à mais nova), para o rastro. */
  rastro?: { pos: Ponto; altura: number }[];
  /** Reels (ADR-0074): sem o letreiro do lance (o cartão gigante já está na tela). */
  semLetreiro?: boolean;
}

/**
 * Câmera do Reels (ADR-0072): centro (grade lógica) e zoom. `tremor` desloca a imagem no gol
 * (grade lógica) e `flash` (0 a 1) clareia a tela no instante do gol.
 */
export interface Camera {
  cx: number;
  cy: number;
  zoom: number;
  tremor?: Ponto;
  flash?: number;
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
  // Câmera (Reels, ADR-0072): o campo e tudo que está nele passam pela câmera; placar e letreiros não.
  const cam = o.camera;
  const naTela = (p: Ponto): Ponto => (cam ? { x: (p.x - cam.cx) * cam.zoom + COLUNAS / 2 + (cam.tremor?.x ?? 0), y: (p.y - cam.cy) * cam.zoom + LINHAS / 2 + (cam.tremor?.y ?? 0) } : p);
  ctx.save();
  if (cam) {
    // Fundo da mata atrás de tudo, para o tremor não mostrar borda vazia.
    pin.r(0, 0, COLUNAS, LINHAS, COR.mata);
    const origem = naTela({ x: 0, y: 0 });
    ctx.translate(Math.round(origem.x * pin.px), Math.round(origem.y * pin.px));
    ctx.scale(cam.zoom, cam.zoom);
  }
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  if (cam) desenharRedeBalancando(pin, estado);
  // Temporada 2 (ADR-0019): Arquibancada nas laterais e lama ou poças no gramado.
  if (estado.t2) {
    desenharArquibancada(pin, estado, o.times);
    desenharClimaNoChao(pin, estado);
  }

  // Sombras primeiro, depois Jogadores de cima para baixo (quem está mais embaixo fica na frente).
  const fase = Math.floor(estado.t / 1.1);
  const ordem = [...estado.jogadores].sort((a, b) => a.pos.y - b.pos.y);
  // O juiz (T2, ADR-0054) entra na mesma ordem de profundidade, com a sua sombra.
  const juiz = estado.juiz;
  for (const p of [...ordem.map((j) => noCampo(j.pos)), ...(juiz ? [noCampo(juiz.pos)] : [])]) {
    pin.r(p.x - 6, p.y - 1, 12, 3, 'rgba(0,0,0,0.28)');
  }
  const bolaChao = noCampo(estado.bola);
  pin.r(bolaChao.x - 3, bolaChao.y, 6, 2, 'rgba(0,0,0,0.35)');
  if (cam) for (const j of ordem) if (j.acao === 'CARRINHO') desenharPoeira(pin, j, estado.t);
  if (o.rastro) desenharRastro(pin, o.rastro);

  const bolaAlta = estado.bolaAltura > 0.08;
  if (!bolaAlta) desenharBola(pin, bolaChao, 0);
  let juizDesenhado = !juiz;
  for (const j of ordem) {
    if (!juizDesenhado && juiz!.pos.y < j.pos.y) {
      desenharJuiz(pin, juiz!, o, fase, estado);
      juizDesenhado = true;
    }
    desenharJogador(pin, j, o, fase, estado);
  }
  if (!juizDesenhado) desenharJuiz(pin, juiz!, o, fase, estado);
  // Sem câmera, os @ vão junto com o campo. Com câmera (Reels), saem depois, no tamanho de sempre.
  // Na disputa de pênaltis, só o nome de quem está na área (cobrador e goleiro): a roda fica limpa.
  const comNome = ordem.filter((j) => !estado.penaltis || j.pos.y < 0.3);
  if (!cam) for (const j of comNome) desenharNome(pin, j, o, texto, noCampo(j.pos), 6, estado.cartoes);
  if (bolaAlta) desenharBola(pin, bolaChao, estado.bolaAltura);
  if (juiz) desenharCartaoDoJuiz(pin, juiz);
  if (estado.t2) desenharCartao(pin, estado, noCampo);
  ctx.restore();
  // Reels (ADR-0073): o @ de todos, no tamanho de sempre, logo abaixo do boneco já com zoom.
  if (cam) for (const j of comNome) desenharNome(pin, j, o, texto, naTela(noCampo(j.pos)), 4 + 2 * cam.zoom, estado.cartoes);
  if (estado.t2) desenharClimaNoAr(pin, estado);
  if (cam?.flash) pin.r(0, 0, COLUNAS, LINHAS, `rgba(255,250,235,${(0.45 * cam.flash).toFixed(3)})`);

  desenharPlacar(pin, estado, o, display, texto);
  if (estado.penaltis) desenharFaixaDosPenaltis(pin, estado, o, display, texto);
  if (estado.destaque && !o.semLetreiro) desenharDestaque(pin, estado, o, display, texto);
  else if (estado.trocas) desenharLetreiroDaTroca(pin, estado, o, display, texto);
  if (estado.t2) desenharCloseDaTorcida(pin, estado, o.times, texto);
}

function visualDe(j: JogadorNoQuadro, o: OpcoesDesenho, e?: EstadoQuadro): Visual {
  const quem = j.ocupante ?? j.slot.indice;
  const nome = o.nomes[j.slot.lado][quem] ?? `base-${j.slot.lado}-${quem}`;
  const v = visualDoJogador(o.times[j.slot.lado], j.posicao, nome);
  // T2: o visitante usa o segundo uniforme quando as camisas se confundem (o goleiro não muda).
  if (e?.t2?.segundoUniforme === j.slot.lado && j.posicao !== 'GOL') {
    const rival = o.times[j.slot.lado === 'mandante' ? 'visitante' : 'mandante'];
    return { ...v, ...segundoUniforme(o.times[j.slot.lado], rival) };
  }
  return v;
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

function desenharJogador(pin: Pincel, j: JogadorNoQuadro, o: OpcoesDesenho, fase: number, e?: EstadoQuadro): void {
  const p = noCampo(j.pos);
  const olhar = { x: j.olhar.x - j.pos.x, y: j.olhar.y - j.pos.y };
  const { pose, espelhar, pulo } = escolherPose(j.acao, j.vel, olhar, fase + j.slot.indice);
  const img = sprite(pose, visualDe(j, o, e));
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

/** Canto superior esquerdo do boneco na grade lógica (o pé fica em `p`). */
function cantoDoBoneco(pin: Pincel, p: Ponto, pulo: number): { x: number; y: number; s: number } {
  const s = pin.px * ESCALA_BONECO;
  return { x: Math.round(p.x * pin.px - (LARGURA_SPRITE / 2) * s), y: Math.round((p.y + 1) * pin.px - ALTURA_SPRITE * s - pulo * s), s };
}

/** O juiz: corre como os Jogadores e, na falta, vira de frente com o braço levantado. */
function desenharJuiz(pin: Pincel, j: JuizNoQuadro, o: OpcoesDesenho, fase: number, e: EstadoQuadro): void {
  const p = noCampo(j.pos);
  const visual = visualDoJuiz(o.times, e.t2?.segundoUniforme ?? null, j.seed);
  const gesto = j.acao === 'APITO' || j.acao === 'CARTAO' || j.acao === 'PLACA';
  const olhar = { x: j.olhar.x - j.pos.x, y: j.olhar.y - j.pos.y };
  const { pose, espelhar, pulo } = gesto
    ? { pose: 'FRENTE_APITO' as Pose, espelhar: false, pulo: 0 }
    : escolherPose(j.acao === 'CORRENDO' ? 'CORRENDO' : 'PARADO', j.vel, olhar, fase + 3);
  const img = sprite(pose, visual);
  const { x, y, s } = cantoDoBoneco(pin, p, pulo);
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

/** Cartão na mão levantada do juiz, desenhado por cima de todos (não some atrás de ninguém). */
function desenharCartaoDoJuiz(pin: Pincel, j: JuizNoQuadro): void {
  if (j.acao === 'PLACA') return desenharPlacaDoJuiz(pin, j);
  if (j.acao !== 'CARTAO' || !j.cartao) return;
  const { x, y } = cantoDoBoneco(pin, noCampo(j.pos), 0);
  {
    const mx = x / pin.px + MAO_DO_APITO.x * ESCALA_BONECO - 1.5;
    const my = y / pin.px + MAO_DO_APITO.y * ESCALA_BONECO - 9;
    pin.r(mx - 1, my - 1, 7, 10, COR.contorno);
    pin.r(mx, my, 5, 8, j.cartao === 'VERMELHO' ? '#D7263D' : '#F6D02F');
    pin.r(mx, my, 5, 1, 'rgba(255,255,255,0.5)');
  }
}

/**
 * Placa de Substituição (ADR-0061) na mão levantada do juiz: preta, com a seta verde (entra)
 * em cima e a vermelha (sai) embaixo.
 */
function desenharPlacaDoJuiz(pin: Pincel, j: JuizNoQuadro): void {
  const { x, y } = cantoDoBoneco(pin, noCampo(j.pos), 0);
  const mx = x / pin.px + MAO_DO_APITO.x * ESCALA_BONECO - 5;
  const my = y / pin.px + MAO_DO_APITO.y * ESCALA_BONECO - 15;
  pin.r(mx - 1, my - 1, 14, 16, COR.contorno);
  pin.r(mx, my, 12, 14, '#1E1E1E');
  // Seta verde para cima (entra) e vermelha para baixo (sai).
  for (let k = 0; k < 3; k++) pin.r(mx + 6 - k, my + 1 + k, 1 + 2 * k, 1, '#3DDC64');
  pin.r(mx + 5, my + 4, 3, 2, '#3DDC64');
  pin.r(mx + 5, my + 8, 3, 2, '#FF4D4D');
  for (let k = 0; k < 3; k++) pin.r(mx + 6 - k, my + 12 - k, 1 + 2 * k, 1, '#FF4D4D');
}

/** O nome escrito na tela: o apelido, senão o @ (null = Jogador da Base). */
export function rotulo(o: Pick<OpcoesDesenho, 'nomes' | 'apelidos'>, lado: Lado, indice: number): string | null {
  return o.apelidos?.[lado]?.[indice] || o.nomes[lado][indice] || null;
}

/** O @ embaixo do boneco: `p` é o pé na tela (grade lógica) e `abaixo`, a distância até o texto. */
function desenharNome(pin: Pincel, j: JogadorNoQuadro, o: OpcoesDesenho, fonte: string, p: Ponto, abaixo: number, cartoes?: CartaoNoJogo[]): void {
  const quem = j.ocupante ?? j.slot.indice;
  const nome = rotulo(o, j.slot.lado, quem) ?? 'Base';
  pin.texto(nome, p.x, p.y + abaixo, 6.5, fonte, '#FFFFFF', { contorno: 'rgba(20,14,8,0.9)', peso: 600, espessura: 0.5 });
  // Quem levou cartão carrega um cartãozinho antes do @ até o fim do jogo (ADR-0074).
  const dele = cartoes?.filter((c) => c.lado === j.slot.lado && c.ocupante === quem);
  if (!dele?.length) return;
  const cor = dele.some((c) => c.cartao === 'VERMELHO') ? 'VERMELHO' : 'AMARELO';
  pin.ctx.font = `600 ${6.5 * pin.px}px ${fonte}`;
  const meia = pin.ctx.measureText(nome).width / pin.px / 2;
  desenharCartaozinho(pin, p.x - meia - 6, p.y + abaixo - 3, cor, 1.5);
}

/** Cartãozinho (3×4 na escala 1) com contorno, para o placar e o @ (ADR-0074). */
function desenharCartaozinho(pin: Pincel, x: number, y: number, cartao: 'AMARELO' | 'VERMELHO', escala: number): void {
  const w = 3 * escala;
  const h = 4 * escala;
  pin.r(x - 0.5, y - 0.5, w + 1, h + 1, COR.contorno);
  pin.r(x, y, w, h, cartao === 'VERMELHO' ? '#D7263D' : '#F6D02F');
  pin.r(x, y, w, Math.max(0.5, escala * 0.5), 'rgba(255,255,255,0.5)');
}

/** Os cartões de cada Time embaixo do placar, do lado do Time (ADR-0074). */
function desenharCartoesNoPlacar(pin: Pincel, e: EstadoQuadro): void {
  if (!e.cartoes?.length) return;
  for (const lado of ['mandante', 'visitante'] as Lado[]) {
    const lista = e.cartoes.filter((c) => c.lado === lado).slice(0, 6);
    if (!lista.length) continue;
    const centro = COLUNAS / 2 + (lado === 'mandante' ? -73 : 73);
    const passo = 9;
    const x0 = centro - ((lista.length - 1) * passo) / 2 - 2;
    lista.forEach((c, k) => desenharCartaozinho(pin, x0 + k * passo, 46, c.cartao, 2));
  }
}

/** Reels (ADR-0072): rastro curto da bola quando ela anda rápido (passe longo, chute). */
function desenharRastro(pin: Pincel, rastro: { pos: Ponto; altura: number }[]): void {
  for (let k = 1; k < rastro.length; k++) {
    const a = noCampo(rastro[k - 1]!.pos);
    const b = noCampo(rastro[k]!.pos);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 2.5) continue;
    const alpha = 0.12 + (0.3 * k) / rastro.length;
    const h = rastro[k]!.altura * 34;
    pin.r(b.x - 1.5, b.y - 4.5 - h, 3, 3, `rgba(255,255,255,${alpha.toFixed(2)})`);
  }
}

/** Reels (ADR-0072): poeira de terra no carrinho, saindo de trás de quem desliza. */
function desenharPoeira(pin: Pincel, j: JogadorNoQuadro, t: number): void {
  const p = noCampo(j.pos);
  const v = Math.hypot(j.vel.x, j.vel.y) || 1;
  const tras = { x: -j.vel.x / v, y: -j.vel.y / v };
  for (let k = 0; k < 7; k++) {
    const n = ruido(k, Math.floor(t * 2), j.slot.indice + (j.slot.lado === 'mandante' ? 0 : 7));
    const d = 3 + k * 1.6 + n * 2;
    const lado = (ruido(k, 3, Math.floor(t)) - 0.5) * 6;
    pin.r(p.x + tras.x * d - tras.y * lado, p.y - 1 + tras.y * d + tras.x * lado * 0.5, 2, 2, k % 2 ? 'rgba(168,93,55,0.55)' : 'rgba(214,170,120,0.5)');
  }
}

/** Reels (ADR-0072): a rede estufa e balança logo depois do gol. */
function desenharRedeBalancando(pin: Pincel, e: EstadoQuadro): void {
  const d = e.destaque;
  if (!d || d.tipo !== 'GOL' || d.progresso > 0.2) return;
  const f = 1 - d.progresso / 0.2;
  const estufa = Math.round(4 * f * (0.6 + 0.4 * Math.abs(Math.sin(d.progresso * 90))));
  if (estufa <= 0) return;
  const topo = e.bola.y < 0.5;
  const gw = Math.round(CAMPO.w * 0.24);
  const gx = CAMPO.x + Math.round((CAMPO.w - gw) / 2);
  // A rede estufa mais no meio que nos cantos (onde está presa na trave).
  for (let x = 0; x < gw; x++) {
    const meio = Math.sin((x / gw) * Math.PI);
    const extra = Math.round(estufa * meio);
    for (let y = 0; y < 6 + extra; y++) {
      const yy = topo ? CAMPO.y - 1 - y : CAMPO.y + CAMPO.h + y;
      pin.r(gx + x, yy, 1, 1, (x + y) % 2 === 0 ? '#DDE5D8' : COR.mataMedia);
    }
  }
  pin.r(gx - 1, topo ? CAMPO.y - 6 : CAMPO.y + CAMPO.h, 1, 6, '#FFFFFF');
  pin.r(gx + gw, topo ? CAMPO.y - 6 : CAMPO.y + CAMPO.h, 1, 6, '#FFFFFF');
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

/**
 * Escudo do Time em pixel art, com `escala` pixels lógicos por pixel do escudo. As estrelas de
 * Título vão por cima, fora da caixa do escudo; `estrelas: false` as tira (cartela que já tem
 * título logo acima do escudo, como a do Campeão).
 */
export function desenharEscudo(pin: Pincel, time: TimeId, x: number, y: number, escala = 1, o: { estrelas?: boolean } = {}): void {
  pin.ctx.imageSmoothingEnabled = false;
  pin.ctx.drawImage(escudo(time), Math.round(x * pin.px), Math.round(y * pin.px), LARGURA_ESCUDO * escala * pin.px, ALTURA_ESCUDO * escala * pin.px);
  if (o.estrelas !== false) desenharEstrelas(pin, time, x + (LARGURA_ESCUDO * escala) / 2, y, escala);
}

/**
 * Abaixo desta altura na tela (pixels do vídeo) o escudo é ícone de lista, como na Tabela:
 * a estrela viraria um ponto e invadiria a linha de cima. Equivale ao mínimo do site.
 */
export const ALTURA_MINIMA_COM_ESTRELAS = 72;

/** Estrelas de Título do Time centradas em `cx`, logo acima do topo do escudo (ADR-0060). */
export function desenharEstrelas(pin: Pincel, time: TimeId, cx: number, topoDoEscudo: number, escala = 1): void {
  if (ALTURA_ESCUDO * escala * pin.px < ALTURA_MINIMA_COM_ESTRELAS) return;
  const img = estrelasDoEscudo(time);
  if (!img) return;
  const w = img.width * escala;
  pin.ctx.imageSmoothingEnabled = false;
  pin.ctx.drawImage(img, Math.round((cx - w / 2) * pin.px), Math.round((topoDoEscudo - ALTURA_DAS_ESTRELAS * escala) * pin.px), w * pin.px, img.height * escala * pin.px);
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
  desenharCartoesNoPlacar(pin, e);
  if (e.penaltis) {
    desenharMarcasDePenalti(pin, e, display, texto);
    return;
  }
  const rotulo = e.encerrada ? 'Fim de jogo' : `${e.minuto}'`;
  pin.texto(rotulo, COLUNAS / 2, 52, 9, texto, COR.amarelo, { contorno: COR.mata, peso: 700 });
  if (o.briga) desenharBriga(pin, o.briga, e, o, texto);
}

export type TipoDaPlaquinhaDaBriga = 'GARANTIDO' | 'ELIMINADO' | 'DEPENDE';

/**
 * O que a plaquinha de cada Time diz na última Rodada (ADR-0053). Quem já estava decidido antes
 * do Apito Inicial fica "Já garantido" ou "Já eliminado"; os outros seguem o placar: "Assim:
 * classifica / fora / depende" durante o jogo e "Classificado / Eliminado / Depende…" no fim.
 */
export function plaquinhasDaBriga(
  b: BrigaPeloMataMata,
  times: Record<Lado, TimeId>,
  placar: Record<Lado, number>,
  encerrada: boolean,
  /** Começo de jogo (0 × 0 até os 10'): a plaquinha diz do que o Time precisa. */
  comeco = false,
): Record<Lado, { texto: string; tipo: TipoDaPlaquinhaDaBriga }> {
  const antes = situacoesNaBriga(b, times, null);
  const agora = situacoesNaBriga(b, times, placar);
  const depende = b.depois.length === 1 ? `Depende das ${b.depois[0]!.hora}h` : 'Depende dos outros';
  const uma = (lado: Lado) => {
    const a = antes.get(times[lado])!;
    if (a === 'GARANTIDO') return { texto: 'Já garantido', tipo: a };
    if (a === 'ELIMINADO') return { texto: 'Já eliminado', tipo: a };
    if (comeco) return { texto: textoDaNecessidade(necessidadeNaBriga(b, times, lado)), tipo: 'DEPENDE' as const };
    const s: SituacaoNaBriga = agora.get(times[lado])!;
    const t = encerrada
      ? { GARANTIDO: 'Classificado', ELIMINADO: 'Eliminado', DEPENDE: depende }[s]
      : { GARANTIDO: 'Assim: classifica', ELIMINADO: 'Assim: fora', DEPENDE: 'Assim: depende' }[s];
    return { texto: t, tipo: s };
  };
  return { mandante: uma('mandante'), visitante: uma('visitante') };
}

/** "Última Rodada · Garantidos: Arara" (só os já garantidos antes do Apito Inicial). */
export function faixaDaBriga(b: BrigaPeloMataMata, times: Record<Lado, TimeId>): string {
  const antes = situacoesNaBriga(b, times, null);
  const garantidos = [...antes].filter(([, s]) => s === 'GARANTIDO').map(([t]) => FALA_DO_TIME[t].curto);
  const serie = b.grupo ? ` · ${NOME_DO_GRUPO[b.grupo]}` : b.serie ? ` da Série ${b.serie}` : '';
  return garantidos.length ? `Última Rodada${serie} · Garantidos: ${garantidos.join(', ')}` : `Última Rodada${serie} · ${b.vagas ?? 4} primeiros vão pro Mata-mata`;
}

const COR_DA_BRIGA: Record<TipoDaPlaquinhaDaBriga, { fundo: string; sombra: string; tinta: string }> = {
  GARANTIDO: { fundo: '#3E9B3A', sombra: '#2A6E27', tinta: '#FFFFFF' },
  ELIMINADO: { fundo: '#B8442F', sombra: '#82301F', tinta: '#FFFFFF' },
  DEPENDE: { fundo: COR.amarelo, sombra: '#C99500', tinta: COR.tinta },
};

/** Viga no topo (de onde a tábua pende) com a faixa, e uma plaquinha embaixo de cada Time. */
function desenharBriga(pin: Pincel, b: BrigaPeloMataMata, e: EstadoQuadro, o: OpcoesDesenho, texto: string): void {
  pin.r(0, 0, COLUNAS, 9, COR.madeiraEscura);
  pin.r(0, 8, COLUNAS, 1, COR.contorno);
  const faixa = faixaDaBriga(b, o.times);
  pin.texto(faixa, COLUNAS / 2, 4.5, pin.caber(faixa, COLUNAS - 12, 6.5, texto, 700), texto, COR.amarelo, { peso: 700 });
  const p = plaquinhasDaBriga(b, o.times, e.placar, e.encerrada, e.placar.mandante + e.placar.visitante === 0 && e.minuto <= 10);
  const w = 78;
  for (const lado of ['mandante', 'visitante'] as const) {
    const x = lado === 'mandante' ? 29 : COLUNAS - 29 - w;
    const c = COR_DA_BRIGA[p[lado].tipo];
    pin.placa(x, 46, w, 12, { fundo: c.fundo, sombra: c.sombra, degrau: 1 });
    pin.texto(p[lado].texto, x + w / 2, 51.5, pin.caber(p[lado].texto, w - 6, 7, texto, 700), texto, c.tinta, { peso: 700 });
  }
}

/**
 * Placar dos pênaltis embaixo da tábua: uma bolinha por cobrança de cada Time (verde = gol,
 * vermelho = perdeu, vazia = falta bater), com o placar da disputa no meio.
 */
function desenharMarcasDePenalti(pin: Pincel, e: EstadoQuadro, display: string, texto: string): void {
  const p = e.penaltis!;
  // Embaixo do campo: a parte de cima é onde ficam o gol, o goleiro e o cobrador.
  const y = 448;
  pin.tabua(20, y, 230, 22);
  const lados: Lado[] = ['mandante', 'visitante'];
  for (const lado of lados) {
    const minhas = p.marcas.filter((m) => m.lado === lado);
    const vagas = Math.max(5, minhas.length + (p.vencedor ? 0 : 1));
    const visiveis = Math.min(vagas, 7);
    const marcas = minhas.slice(-visiveis);
    for (let k = 0; k < visiveis; k++) {
      const x = lado === 'mandante' ? 28 + k * 10 : COLUNAS - 28 - 7 - (visiveis - 1 - k) * 10;
      const m = marcas[k];
      const cor = !m ? null : m.resultado === 'GOL' ? '#5FD35A' : '#E5482F';
      pin.r(x, y + 7, 7, 7, COR.contorno);
      pin.r(x + 1, y + 8, 5, 5, cor ?? COR.madeiraEscura);
      if (cor) pin.r(x + 2, y + 9, 2, 2, 'rgba(255,255,255,0.45)');
    }
  }
  const rotulo = e.encerrada ? 'Fim' : 'Pênaltis';
  pin.texto(`${p.placar.mandante} x ${p.placar.visitante}`, COLUNAS / 2, y + 9, 13, display, COR.amarelo, { contorno: COR.contorno });
  pin.texto(rotulo, COLUNAS / 2, y + 19, 5.5, texto, COR.placa, { peso: 700 });
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

const TITULO = { GOL: 'Goooool!', DEFESA: 'Defesaça!', BLOQUEIO: 'Bloqueou!', DESARME: 'Desarme!', FORA: 'Pra fora!', FALTA: 'Falta!' } as const;
const TITULO_PENALTI = { GOL: 'Converteu!', DEFESA: 'Pegou!', BLOQUEIO: 'Bloqueou!', DESARME: 'Desarme!', FORA: 'Pra fora!', FALTA: 'Falta!' } as const;

/** Letreiro de um destaque menor (T2: falta, cartão, pênalti e barreira têm o seu). */
function tituloDoDestaque(d: NonNullable<EstadoQuadro['destaque']>): string {
  if (d.tipo === 'FALTA') return d.cartao === 'VERMELHO' ? 'Expulso!' : d.cartao === 'AMARELO' ? 'Amarelo!' : 'Falta!';
  if (d.bolaParada === 'PENALTI') return d.tipo === 'DEFESA' ? 'Pegou o pênalti!' : d.tipo === 'FORA' ? 'Pênalti pra fora!' : TITULO_PENALTI[d.tipo];
  if (d.bolaParada === 'FALTA_DIRETA' && d.tipo === 'BLOQUEIO') return 'Na barreira!';
  return (d.penalti ? TITULO_PENALTI : TITULO)[d.tipo];
}

/** Letreiros grandes da disputa: "Pênaltis!" na abertura e o vencedor no fim. */
function desenharFaixaDosPenaltis(pin: Pincel, e: EstadoQuadro, o: OpcoesDesenho, display: string, texto: string): void {
  const p = e.penaltis!;
  if (p.fase === 'COBRANCA') return;
  const vencedor = p.fase === 'FIM' ? p.vencedor : null;
  const cores = vencedor ? IDENTIDADE[o.times[vencedor]] : { primaria: COR.madeira, secundaria: COR.amarelo };
  const abre = Math.min(1, p.progresso / 0.18);
  const some = p.fase === 'INTRO' && p.progresso > 0.85 ? (p.progresso - 0.85) / 0.15 : 0;
  const y = 196 - Math.round(some * some * 260);
  const onda = faixaDeTorcida(pin, y, 66, cores, e.t / 9, abre);
  if (abre < 0.6) return;
  const titulo = vencedor ? FALA_CURTA(o.times[vencedor]) : 'Pênaltis!';
  const tam = pin.caber(titulo, 236, vencedor ? 40 : 56, display);
  const cor = vencedor ? contraste(cores.primaria) : COR.amarelo;
  pin.texto(titulo, COLUNAS / 2, y + 30 + onda(COLUNAS / 2), tam, display, cor, { contorno: COR.contorno });
  if (vencedor) {
    const sub = `vence nos pênaltis, ${p.placar[vencedor]} a ${p.placar[vencedor === 'mandante' ? 'visitante' : 'mandante']}`;
    pin.tabua(COLUNAS / 2 - 100, y + 74 + onda(COLUNAS / 2), 200, 24);
    pin.texto(sub, COLUNAS / 2, y + 86 + onda(COLUNAS / 2), pin.caber(sub, 186, 10, texto, 700), texto, COR.placa, { peso: 700 });
  }
}
const FALA_CURTA = (t: TimeId) => FALA_DO_TIME[t].curto;

/**
 * Letreiro da Substituição (ADR-0061): placa de madeira com o escudo, "Substituição" e, para
 * cada troca, quem sai (▼ vermelho) e quem entra (▲ verde), pelo nome escrito do jogo.
 */
function desenharLetreiroDaTroca(pin: Pincel, e: EstadoQuadro, o: OpcoesDesenho, display: string, texto: string): void {
  const { lista, progresso: p } = e.trocas!;
  const entra = Math.min(1, p / 0.12);
  const sai = p > 0.88 ? (p - 0.88) / 0.12 : 0;
  const desloc = (1 - suave(entra)) * -COLUNAS + suave(sai) * COLUNAS;
  const w = 210;
  const h = 30 + lista.length * 26;
  const x = (COLUNAS - w) / 2 + desloc;
  const y = e.bola.y < 0.5 ? 470 - h : 66;
  pin.tabua(x, y, w, h);
  pin.texto('Substituição', x + w / 2, y + 15, 22, display, COR.amarelo, { contorno: COR.contorno });
  lista.forEach((tr, k) => {
    const ly = y + 30 + k * 26;
    desenharEscudo(pin, o.times[tr.lado], x + 6, ly + 1, 0.8);
    const quemSai = rotulo(o, tr.lado, tr.saiu) ?? 'Base';
    const quemEntra = rotulo(o, tr.lado, tr.ocupante) ?? 'Base';
    pin.texto('▼', x + 30, ly + 6, 9, texto, '#FF6B5B', { peso: 700 });
    pin.texto(quemSai, x + 38, ly + 6, pin.caber(quemSai, w - 46, 9.5, texto, 700), texto, COR.placa, { peso: 700, alinhar: 'left' });
    pin.texto('▲', x + 30, ly + 18, 9, texto, '#3DDC64', { peso: 700 });
    pin.texto(quemEntra, x + 38, ly + 18, pin.caber(quemEntra, w - 46, 9.5, texto, 700), texto, COR.placa, { peso: 700, alinhar: 'left' });
  });
}

function desenharDestaque(pin: Pincel, e: EstadoQuadro, o: OpcoesDesenho, display: string, texto: string): void {
  const d = e.destaque!;
  const id = IDENTIDADE[o.times[d.lado]];
  const nome = rotulo(o, d.protagonista.lado, d.ocupante ?? d.protagonista.indice) ?? 'Jogador da Base';
  const p = d.progresso;

  if (d.tipo === 'GOL' && !d.penalti) {
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
  const embaixo = e.bola.y < 0.5 || !!d.penalti;
  const w = 176;
  const h = 46;
  const x = (COLUNAS - w) / 2 + desloc;
  // Nos pênaltis a tábua de marcas ocupa o pé da tela: o letreiro sobe um pouco.
  const y = d.penalti ? 392 : embaixo ? 404 : 70;
  pin.tabua(x, y, w, h);
  desenharEscudo(pin, o.times[d.lado], x + 8, y + 9, 1.15);
  pin.texto(tituloDoDestaque(d), x + w / 2 + 14, y + 17, 22, display, COR.amarelo, { contorno: COR.contorno });
  pin.texto(nome, x + w / 2 + 14, y + 34, pin.caber(nome, w - 50, 8, texto, 600), texto, COR.placa, { peso: 600 });
}

const suave = (f: number) => f * f * (3 - 2 * f);
