/**
 * Desenho de um quadro do Reels: o campo da Timeline no instante que o Roteiro manda,
 * mais as cartelas de abertura e de fim e o escurecimento dos cortes.
 */
import { ocupanteDoDesempenho } from './substituicao.js';
import { FALA_DO_TIME, IDENTIDADE, NOME_DO_PERFIL_DO_JUIZ, TAMANHO_ESCALACAO, necessidadeNaBriga, situacoesNaBriga, textoDaNecessidade, type Aparencia, type BrigaPeloMataMata, type Estrelas, type Escalacao, type ItensEquipados, type MataMataDaPartida, type TimeId } from '@liga/shared';
import type { Lado, ResultadoPartida, SlotRef } from '@liga/sim';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, desenharQuadro, desenharTabuaDoPlacar, faixaDeTorcida, noCampo, plaquinha, rotulo, type Camera, type OpcoesDesenho } from './desenho.js';
import type { EstadoQuadro, Timeline } from './timeline.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste } from './pixel.js';
import { LARGURA_ESCUDO } from './escudos.js';
import type { OpcoesRoteiro, QuadroRoteiro, Roteiro, Segmento } from './roteiro.js';
import { aparencia, itensDe, sprite, vestir } from './sprites.js';
import { narradorDa } from './narradores.js';

export interface OpcoesVideo extends OpcoesDesenho {
  /** Linha de contexto na abertura, ex.: "Rodada 1, jogo das 12h". */
  subtitulo?: string;
  /** Escudo da Liga (já carregado), mostrado na abertura. */
  escudo?: CanvasImageSource;
  /** Partida do Mata-mata: o fim mostra quem foi pra Final ou o campeão (ADR-0048). */
  mataMata?: MataMataDaPartida | null;
}

/** Tudo que a página do vídeo precisa para gravar uma Partida (montado pelo worker a partir do banco). */
export interface PartidaParaVideo {
  resultado: ResultadoPartida;
  escalacoes: Record<Lado, Escalacao>;
  /** @ de cada lugar da Escalação; null = Jogador da Base. */
  nomes: Record<Lado, (string | null)[]>;
  /** Apelidos (ADR-0014); o que aparece escrito. Sem ele, o @. */
  apelidos?: Record<Lado, (string | null)[]>;
  /** Número da camisa de cada lugar (null = camisa lisa). Partidas antigas não têm. */
  numeros?: Record<Lado, (number | null)[]>;
  /** Itens equipados de cada lugar na hora da Escalação (ADR-0101). Partidas antigas não têm. */
  itens?: Record<Lado, (ItensEquipados | null)[]>;
  /** Itens de agora pelo @ (para quem não está na Escalação); o jogo usa `itens`. */
  itensAtuais?: Record<string, ItensEquipados>;
  subtitulo?: string;
  roteiro?: OpcoesRoteiro;
  /** Aparências escolhidas pelos donos (ADR-0013), pelo @. */
  aparencias?: Record<string, Aparencia>;
  /** Temporada 2: tamanho de cada Elenco, para a Arquibancada (ADR-0019). */
  torcida?: Record<Lado, number>;
  /** Estrelas de Título nos escudos (ADR-0060). */
  estrelas?: Partial<Record<TimeId, Estrelas>>;
  /** Partida do Mata-mata (ADR-0048): Semifinal ou Final, Temporada e Série. */
  mataMata?: MataMataDaPartida | null;
  /** Última Rodada da Fase de Liga (ADR-0053). */
  briga?: BrigaPeloMataMata | null;
}

export function desenharQuadroVideo(ctx: CanvasRenderingContext2D, roteiro: Roteiro, tVideo: number, o: OpcoesVideo): QuadroRoteiro {
  const q = roteiro.quadroEm(tVideo);
  const pin = new Pincel(ctx);
  const tipo = q.segmento.tipo;
  // Nas cartelas o fundo é o cenário vazio; no jogo, o quadro completo.
  if (tipo === 'LANCE') {
    // Cartão (ADR-0074): o lance quase para, a câmera fecha no juiz e o cartão gigante aparece.
    const cartao = momentoDoCartao(roteiro, q.segmento);
    const tJogo = cartao ? tempoComPausa(q.segmento, cartao, tVideo, q.tJogo) : q.tJogo;
    const estado = roteiro.timeline.estado(tJogo);
    const camera = daCamera(roteiro, q, tVideo, estado);
    const noClose = cartao && tVideo >= cartao.inicio - 0.1 && tVideo < cartao.fim + 0.15;
    // Durante o cartão gigante, o letreiro de sempre ("Amarelo!") sai da tela: o gigante já diz isso.
    const gigante = cartao && tVideo >= cartao.inicio && tVideo < cartao.fim;
    desenharQuadro(ctx, estado, { ...o, ...camera, ...(noClose ? { camera: closeNoJuiz(estado, camera.camera!), rastro: [] } : {}), ...(gigante ? { semLetreiro: true } : {}) });
    if (gigante) desenharCartaoGigante(pin, cartao, (tVideo - cartao.inicio) / (cartao.fim - cartao.inicio), o);
  } else if (tipo === 'TROCA' || tipo === 'PENALTIS') desenharQuadro(ctx, roteiro.timeline.estado(q.tJogo), o);
  else {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  }
  if (tipo === 'ABERTURA') desenharAbertura(pin, roteiro.timeline.resultado, q.progresso, tVideo, o);
  if (tipo === 'FIM') desenharFim(pin, roteiro.timeline.resultado, q.progresso, tVideo, o, !!roteiro.timeline.t2);

  if (q.escurecer > 0) {
    ctx.save();
    ctx.globalAlpha = q.escurecer;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  return q;
}

/** O momento do cartão no Reels (ADR-0074): s de vídeo em que o lance quase para e o cartão gigante aparece. */
export interface MomentoDoCartao {
  inicio: number;
  fim: number;
  /** s de jogo em que o juiz já está com o cartão no ar: o lance fica perto daqui durante a pausa. */
  tJogo: number;
  cartao: 'AMARELO' | 'VERMELHO';
  lado: Lado;
  ocupante: number;
}

/** Duração do cartão gigante (s de vídeo). */
export const DURACAO_DO_CARTAO = 1.4;
/** Velocidade do lance durante a pausa do cartão, em relação à de antes. */
const LENTO_NO_CARTAO = 0.1;

/**
 * Quando o cartão aparece no trecho de uma falta com cartão (ADR-0074): no instante em que o
 * juiz já levantou o cartão, se ainda couber a pausa inteira antes do fim do trecho. null nos
 * outros lances.
 */
export function momentoDoCartao(roteiro: Roteiro, s: Segmento): MomentoDoCartao | null {
  if (s.tipo !== 'LANCE' || s.resolucao === undefined) return null;
  const tl = roteiro.timeline;
  const j = tl.janelas[s.lance!]!;
  if (!j.lance.falta?.cartao) return null;
  // O cartão desta falta: o primeiro mostrado depois da resolução dela.
  const c = tl.cartoes.find((x) => x.t >= j.resolucao);
  if (!c) return null;
  const k = (s.jogoFim! - s.jogoResolucao!) / (s.fim - s.resolucao);
  const inicio = s.resolucao + (c.t - s.jogoResolucao!) / k;
  const fim = inicio + DURACAO_DO_CARTAO;
  // Precisa sobrar trecho depois da pausa para o lance seguir até o fim no tempo certo.
  if (inicio < s.resolucao || fim > s.fim - 0.4) return null;
  return { inicio, fim, tJogo: c.t, cartao: c.cartao, lado: c.lado, ocupante: c.ocupante };
}

/**
 * Tempo de jogo com a pausa do cartão: igual até o cartão, quase parado durante ele e um pouco
 * mais rápido depois, para chegar ao fim do trecho no mesmo instante de sempre.
 */
export function tempoComPausa(s: Segmento, m: MomentoDoCartao, tVideo: number, tJogo: number): number {
  if (tVideo < m.inicio) return tJogo;
  const k = (s.jogoFim! - s.jogoResolucao!) / (s.fim - s.resolucao!);
  const durante = Math.min(tVideo, m.fim) - m.inicio;
  const naPausa = m.tJogo + durante * k * LENTO_NO_CARTAO;
  if (tVideo < m.fim) return naPausa;
  const depois = (tVideo - m.fim) / (s.fim - m.fim);
  return naPausa + depois * (s.jogoFim! - naPausa);
}

/** Zoom do close no juiz com o cartão: 1 pixel lógico vira 2 (8 px no vídeo de 1080). */
export const ZOOM_DO_CARTAO = 2;

export function closeNoJuiz(e: EstadoQuadro, normal: Camera): Camera {
  const alvo = e.juiz ? noCampo(e.juiz.pos) : { x: normal.cx, y: normal.cy };
  const z = ZOOM_DO_CARTAO;
  const meiaL = COLUNAS / 2 / z;
  const meiaA = LINHAS / 2 / z;
  return { cx: Math.min(COLUNAS - meiaL, Math.max(meiaL, alvo.x)), cy: Math.min(LINHAS - meiaA, Math.max(meiaA, alvo.y - 55)), zoom: z };
}

/**
 * Cartão gigante (ADR-0074): entra como um carimbo (grande e inclinado, assenta no lugar), fica
 * no meio da tela com o @ de quem levou embaixo e some no fim.
 */
export function desenharCartaoGigante(pin: Pincel, m: MomentoDoCartao, f: number, o: OpcoesDesenho): void {
  const ctx = pin.ctx;
  const entra = Math.min(1, f / 0.12);
  const sai = f > 0.85 ? (f - 0.85) / 0.15 : 0;
  const escala = 1 + 0.7 * (1 - suave(entra));
  const giro = (-12 + 6 * suave(entra)) * (Math.PI / 180);
  const w = 44;
  const h = 62;
  const cx = COLUNAS / 2;
  // Na parte de cima da tela: o close deixa o juiz e quem levou o cartão embaixo.
  const cy = 152;
  ctx.save();
  ctx.globalAlpha = 1 - sai;
  ctx.translate(cx * pin.px, cy * pin.px);
  ctx.rotate(giro);
  ctx.scale(escala, escala);
  ctx.translate(-cx * pin.px, -cy * pin.px);
  pin.r(cx - w / 2 + 3, cy - h / 2 + 4, w, h, 'rgba(0,0,0,0.35)');
  pin.r(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, COR.contorno);
  pin.r(cx - w / 2, cy - h / 2, w, h, m.cartao === 'VERMELHO' ? '#D7263D' : '#F6D02F');
  pin.r(cx - w / 2, cy - h / 2, w, 4, 'rgba(255,255,255,0.45)');
  pin.r(cx - w / 2, cy + h / 2 - 4, w, 4, 'rgba(0,0,0,0.18)');
  ctx.restore();
  if (f < 0.1) return;
  ctx.save();
  ctx.globalAlpha = 1 - sai;
  const titulo = m.cartao === 'VERMELHO' ? 'Expulso!' : 'Amarelo!';
  const nome = rotulo(o, m.lado, m.ocupante) ?? 'Base';
  pin.texto(titulo, cx, cy + h / 2 + 18, 24, FONTE_DISPLAY, m.cartao === 'VERMELHO' ? '#FF5A6B' : COR.amarelo, { contorno: COR.contorno });
  pin.ctx.font = `700 ${11 * pin.px}px ${FONTE_TEXTO}`;
  const largura = Math.min(200, pin.ctx.measureText(nome).width / pin.px + 24);
  pin.tabua(cx - largura / 2, cy + h / 2 + 32, largura, 20);
  pin.texto(nome, cx, cy + h / 2 + 42, pin.caber(nome, largura - 12, 11, FONTE_TEXTO, 700), FONTE_TEXTO, COR.placa, { peso: 700 });
  ctx.restore();
}

/** Zoom da câmera do Reels: 1 pixel lógico vira 1,5 (6 px no vídeo de 1080, sem borrar o pixel). */
export const ZOOM_DO_REELS = 1.5;

/**
 * Câmera e rastro de um quadro de LANCE no Reels (ADR-0072). Tudo sai do tempo de vídeo,
 * então o quadro N continua igual em qualquer ordem de gravação.
 *
 * - A câmera segue a média da bola em ±1,2 s de vídeo (dentro do mesmo trecho), sem sair do cenário.
 * - No gol, a imagem treme e clareia por um instante.
 */
export function daCamera(roteiro: Roteiro, q: QuadroRoteiro, tVideo: number, estado: EstadoQuadro): Pick<OpcoesDesenho, 'camera' | 'rastro'> {
  const tl = roteiro.timeline;
  const s = q.segmento;
  const jogoEm = (tv: number) => roteiro.quadroEm(Math.min(s.fim - 1e-6, Math.max(s.inicio, tv))).tJogo;
  const camera = cameraQueSegue(tl, (d) => jogoEm(tVideo + d));
  const lance = tl.resultado.lances[s.lance!]!;
  if (lance.tipo === 'GOL' && s.resolucao !== undefined) {
    const dt = tVideo - s.resolucao;
    if (dt >= 0 && dt < 0.5) camera.tremor = { x: Math.sin(dt * 70) * 2.5 * (1 - dt / 0.5), y: Math.cos(dt * 55) * 1.5 * (1 - dt / 0.5) };
    if (dt >= 0 && dt < 0.3) camera.flash = 1 - dt / 0.3;
  }
  // Rastro: a bola nos últimos 0,2 s de vídeo.
  const rastro = [0.2, 0.15, 0.1, 0.05, 0].map((d) => tl.bolaNoInstante(jogoEm(tVideo - d)));
  return { camera, rastro };
}

/**
 * Câmera do Reels que segue a bola (ADR-0072): média da posição dela em ±1,2 s de vídeo, um
 * pouco acima por causa do placar, sem sair do cenário. `jogoEm(d)` dá o s de jogo d s de
 * vídeo à frente (ou atrás) do quadro atual. Também usada nos trechos dos Reels de novidades.
 */
export function cameraQueSegue(tl: Timeline, jogoEm: (d: number) => number): Camera {
  let sx = 0;
  let sy = 0;
  let peso = 0;
  for (let k = -12; k <= 12; k++) {
    const w = 13 - Math.abs(k);
    const b = noCampo(tl.bolaNoInstante(jogoEm(k * 0.1)).pos);
    sx += b.x * w;
    sy += b.y * w;
    peso += w;
  }
  const z = ZOOM_DO_REELS;
  const meiaL = COLUNAS / 2 / z;
  const meiaA = LINHAS / 2 / z;
  return {
    cx: Math.min(COLUNAS - meiaL, Math.max(meiaL, sx / peso)),
    cy: Math.min(LINHAS - meiaA, Math.max(meiaA, sy / peso - 12)),
    zoom: z,
  };
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
  // Selo no topo: o Reels mostra só os melhores momentos; o jogo inteiro é no site (ADR-0052).
  pin.ctx.globalAlpha = alpha * entre(p, 0, 0.1);
  pin.placa(COLUNAS / 2 - 66, 6, 132, 20, { fundo: COR.amarelo, sombra: '#C99500' });
  pin.texto('Melhores momentos', COLUNAS / 2, 16, pin.caber('Melhores momentos', 120, 15, display), display, COR.tinta);
  pin.ctx.globalAlpha = alpha;
  if (o.subtitulo) pin.texto(o.subtitulo, COLUNAS / 2, 138, 9, texto, COR.placa, { peso: 600 });
  if (r.classico) {
    const w = 84;
    pin.ctx.globalAlpha = alpha * entre(p, 0.12, 0.22);
    pin.placa(COLUNAS / 2 - w / 2, 152, w, 22, { fundo: COR.amarelo, sombra: '#C99500' });
    pin.texto('Clássico', COLUNAS / 2, 164, 18, display, COR.tinta);
    pin.ctx.globalAlpha = alpha;
  }
  // Última Rodada (ADR-0053): o que vale a Partida e do que cada Time precisa.
  const b = o.briga;
  if (b) {
    const vale = `Vale vaga no Mata-mata${b.serie ? ` da Série ${b.serie}` : ''}`;
    const y = r.classico ? 178 : 150;
    pin.ctx.globalAlpha = alpha * entre(p, 0.12, 0.22);
    if (r.classico) pin.texto(vale, COLUNAS / 2, y, 9, texto, COR.amarelo, { peso: 700 });
    else {
      pin.placa(COLUNAS / 2 - 80, y, 160, 22, { fundo: COR.amarelo, sombra: '#C99500' });
      pin.texto(vale, COLUNAS / 2, y + 12, pin.caber(vale, 150, 16, display), display, COR.tinta);
    }
    // Garantidos que não jogam esta Partida (os daqui aparecem na plaquinha de cada Time).
    const fora = [...situacoesNaBriga(b, r.times, null)].filter(([t, s]) => s === 'GARANTIDO' && t !== r.times.mandante && t !== r.times.visitante).map(([t]) => FALA_DO_TIME[t].curto);
    if (fora.length) {
      const linha = `Já garantid${fora.length > 1 ? 'os' : 'o'}: ${fora.join(', ')}`;
      pin.texto(linha, COLUNAS / 2, r.classico ? 187 : 182, pin.caber(linha, 230, r.classico ? 7 : 8, texto, 700), texto, '#9FE08A', { peso: 700 });
    }
    (['mandante', 'visitante'] as const).forEach((lado, i) => {
      const a = entre(p, 0.3 + i * 0.12, 0.42 + i * 0.12);
      if (a <= 0) return;
      const antes = situacoesNaBriga(b, r.times, null).get(r.times[lado])!;
      const txt = antes === 'GARANTIDO' ? 'Já garantido' : antes === 'ELIMINADO' ? 'Já eliminado' : textoDaNecessidade(necessidadeNaBriga(b, r.times, lado));
      const fundo = antes === 'GARANTIDO' ? '#3E9B3A' : antes === 'ELIMINADO' ? '#B8442F' : COR.amarelo;
      const sombra = antes === 'GARANTIDO' ? '#2A6E27' : antes === 'ELIMINADO' ? '#82301F' : '#C99500';
      const tinta = antes === 'DEPENDE' ? COR.tinta : '#FFFFFF';
      const cw = 96;
      const cx = i === 0 ? 14 : COLUNAS - 14 - cw;
      const cy = i === 0 ? 254 : 352;
      pin.ctx.globalAlpha = alpha * a;
      pin.placa(cx, cy, cw, 14, { fundo, sombra, degrau: 1 });
      pin.texto(txt, cx + cw / 2, cy + 6.5, pin.caber(txt, cw - 8, 8, texto, 700), texto, tinta, { peso: 700 });
    });
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
    // T3 (ADR-0094): o Perfil do Juiz da Partida, como na Escalação.
    if (r.juiz) pin.texto(`Juiz: ${NOME_DO_PERFIL_DO_JUIZ[r.juiz]}`, COLUNAS / 2, 386, 10, texto, r.juiz === 'RIGOROSO' ? '#FF6B5B' : r.juiz === 'DEIXA_JOGAR' ? '#3DDC64' : COR.placa, { peso: 600 });
  }
  pin.ctx.restore();
}

/** Fim do Reels na última Rodada (ADR-0053): "Onça no Mata-mata", "Tatu fora", "Tatu depende das 18h". */
function desfechoDaBrigaNaTela(b: BrigaPeloMataMata, r: ResultadoPartida): string[] {
  const antes = situacoesNaBriga(b, r.times, null);
  const fim = situacoesNaBriga(b, r.times, r.gols);
  const dep = b.depois.length === 1 ? `depende das ${b.depois[0]!.hora}h` : 'depende dos outros jogos';
  return (['mandante', 'visitante'] as const)
    .filter((l) => antes.get(r.times[l]) === 'DEPENDE')
    .map((l) => {
      const t = FALA_DO_TIME[r.times[l]].curto;
      const s = fim.get(r.times[l]);
      return s === 'GARANTIDO' ? `${t} no Mata-mata!` : s === 'ELIMINADO' ? `${t} fora` : `${t} ${dep}`;
    });
}

function desenharFim(pin: Pincel, r: ResultadoPartida, p: number, tVideo: number, o: OpcoesVideo, roteiroT2 = false): void {
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  pin.ctx.save();
  pin.ctx.globalAlpha = entre(p, 0, 0.15);
  veu(pin, 0.86);

  // Mata-mata (ADR-0048): a Semifinal diz quem foi pra Final; a Final mostra o campeão.
  const mm = o.mataMata && r.vencedor ? o.mataMata : null;
  const vencedor = r.vencedor ? r.times[r.vencedor] : null;
  if (mm?.etapa === 'FINAL' && vencedor) confete(pin, vencedor, tVideo);

  desenharTabuaDoPlacar(pin, COLUNAS / 2, 22, 1.12, r.times, r.gols, display);
  const titulo = mm && vencedor ? (mm.etapa === 'FINAL' ? (mm.copa ? 'Campeão da Copa!' : 'Campeão!') : mm.copa && mm.copa !== 'SEMIFINAL' ? `${FALA_DO_TIME[vencedor].curto} avança!` : `${FALA_DO_TIME[vencedor].curto} na Final!`) : 'Fim de jogo';
  pin.texto(titulo, COLUNAS / 2, mm?.etapa === 'FINAL' ? 82 : 78, pin.caber(titulo, 240, mm?.etapa === 'FINAL' ? 32 : 22, display), display, COR.amarelo, { contorno: COR.mata });
  const detalhes = [
    ...(o.briga ? desfechoDaBrigaNaTela(o.briga, r) : []),
    ...(mm?.serie && mm.etapa === 'SEMIFINAL' ? [`Final da Série ${mm.serie}`] : []),
    ...(mm?.copa && mm.copa !== 'FINAL' ? [mm.copa === 'SEMIFINAL' ? 'Final da Copa' : 'Copa do Varzeão'] : []),
    ...(r.penaltis ? [`${mm ? 'nos' : 'Nos'} pênaltis, ${r.penaltis.placar.mandante} a ${r.penaltis.placar.visitante}`] : []),
  ];
  const linha = detalhes.join(' · ');
  if (linha) pin.texto(linha.charAt(0).toUpperCase() + linha.slice(1), COLUNAS / 2, mm?.etapa === 'FINAL' ? 104 : 96, pin.caber(linha, 250, 9, texto, 600), texto, COR.placa, { peso: 600 });

  if (mm?.etapa === 'FINAL' && vencedor) {
    // Na Final, o campeão toma o lugar do Melhor em campo: escudo grande, nome e Temporada.
    const a = entre(p, 0.12, 0.3);
    pin.ctx.globalAlpha = a;
    const escala = 4;
    desenharEscudo(pin, vencedor, COLUNAS / 2 - (LARGURA_ESCUDO * escala) / 2, 116 - (1 - a) * 16, escala);
    const nome = IDENTIDADE[vencedor].nome;
    pin.texto(nome, COLUNAS / 2, 236, pin.caber(nome, 230, 30, display), display, COR.placa, { contorno: COR.contorno });
    pin.texto(mm.copa ? `Campeão da Copa da Temporada ${mm.temporada}` : `Campeão${mm.serie ? ` da Série ${mm.serie}` : ''} da Temporada ${mm.temporada}`, COLUNAS / 2, 260, 10, texto, COR.amarelo, { peso: 700 });
  }

  // Melhor em campo: maior Nota da Partida, com o boneco grande.
  const melhor = mm?.etapa === 'FINAL' ? undefined : [...r.desempenhos].sort((a, b) => b.nota - a.nota)[0];
  if (melhor) {
    pin.ctx.globalAlpha = entre(p, 0.15, 0.32);
    const x = 30;
    const y = 120;
    const w = 210;
    const h = 150;
    pin.tabua(x, y, w, h);
    pin.texto('Melhor em campo', COLUNAS / 2, y + 16, 20, display, COR.amarelo, { contorno: COR.contorno });
    const id = IDENTIDADE[r.times[melhor.slot.lado]];
    // Substituição (ADR-0061): o reserva que entrou tem o nome dele, não o do titular do lugar.
    const quem = ocupanteDoDesempenho(r, TAMANHO_ESCALACAO, melhor);
    const arroba = o.nomes[melhor.slot.lado][quem] ?? 'Jogador da Base';
    const nome = rotulo(o, melhor.slot.lado, quem) ?? 'Jogador da Base';
    const goleiro = melhor.posicao === 'GOL';
    const visual = {
      camisa: goleiro ? id.secundaria : id.primaria,
      detalhe: goleiro ? id.primaria : id.secundaria,
      calcao: goleiro ? '#2B2B2B' : id.secundaria,
      meiao: goleiro ? id.secundaria : id.primaria,
      ...aparencia(arroba),
      // Itens da Escalação (ADR-0101): o Craque aparece como jogou.
      ...(o.itens ? vestir(o.itens[melhor.slot.lado][quem], goleiro) : itensDe(arroba, goleiro)),
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

  // Chamada para o jogo completo (ADR-0052): no lugar do escudo, que já aparece na abertura.
  pin.ctx.globalAlpha = entre(p, 0.5, 0.65);
  const onde = roteiroT2 ? 'no site e no app' : 'no site';
  pin.placa(36, 386, 198, 40, { fundo: COR.amarelo, sombra: '#C99500' });
  pin.texto(`Jogo completo ${onde}`, COLUNAS / 2, 399, pin.caber(`Jogo completo ${onde}`, 184, 16, display), display, COR.tinta);
  pin.texto('Ao Vivo e Replay · link na bio', COLUNAS / 2, 416, 8, texto, COR.tinta, { peso: 700 });
  pin.ctx.restore();
}

/** Confete nas cores do campeão, caindo devagar (determinístico pelo tempo), como no Resumo. */
function confete(pin: Pincel, t: TimeId, tVideo: number): void {
  const id = IDENTIDADE[t];
  for (let k = 0; k < 60; k++) {
    const x = (k * 97) % COLUNAS;
    const y = ((k * 53 + tVideo * (30 + (k % 5) * 8)) % (LINHAS + 20)) - 10;
    pin.r(x, y, 3, 3, k % 3 === 0 ? COR.amarelo : k % 3 === 1 ? id.primaria : id.secundaria);
  }
}

function nomePosicao(p: string): string {
  return ({ GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' } as Record<string, string>)[p] ?? p;
}
