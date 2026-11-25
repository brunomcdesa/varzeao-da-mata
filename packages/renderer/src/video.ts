/**
 * Desenho de um quadro do Reels: o campo da Timeline no instante que o Roteiro manda,
 * mais as cartelas de abertura e de fim e o escurecimento dos cortes.
 */
import { ocupanteDoDesempenho } from './substituicao.js';
import { FALA_DO_TIME, IDENTIDADE, NOME_DO_GRUPO, NOME_DO_PERFIL_DO_JUIZ, TAMANHO_ESCALACAO, brigaDoTime, concordar, situacoesNaBriga, situacoesNoRebaixamento, valeAPermanencia, type Aparencia, type BrigaPeloMataMata, type Estrelas, type Escalacao, type Grupo, type ItensEquipados, type MataMataDaPartida, type TimeId } from '@liga/shared';
import type { Lado, ResultadoPartida, SlotRef } from '@liga/sim';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, desenharQuadro, desenharTabuaDoPlacar, noCampo, plaquinha, plaquinhasDaBriga, rotulo, type Camera, type OpcoesDesenho } from './desenho.js';
import type { EstadoQuadro, Timeline } from './timeline.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import { ALTURA_ESCUDO, LARGURA_ESCUDO } from './escudos.js';
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
  /** Grupo da Partida na Fase de Liga (T2 em diante), mostrado na capa. */
  grupo?: Grupo | null;
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
  /** Grito da Temporada de cada lado (ADR-0112). */
  gritos?: Partial<Record<Lado, string>>;
  /** Técnico de cada lado (ADR-0111) e o lugar do Capitão (ADR-0112), a partir da T3. */
  tecnicos?: Partial<Record<Lado, { nome: string; apelido?: string | null; itens?: ItensEquipados | null }>>;
  capitaes?: Partial<Record<Lado, number>>;
  /** Marcação individual (ADR-0112), pelos lugares: só para a fala do Narrador. */
  marcacoes?: Partial<Record<Lado, { marcador: number; alvo: number }>>;
  /** Estrelas de Título nos escudos (ADR-0060). */
  estrelas?: Partial<Record<TimeId, Estrelas>>;
  /** Partida do Mata-mata (ADR-0048): Semifinal ou Final, Temporada e Série. */
  mataMata?: MataMataDaPartida | null;
  /** Última Rodada da Fase de Liga (ADR-0053). */
  briga?: BrigaPeloMataMata | null;
  /** Grupo da Partida (Fase de Liga com Grupos), para a capa. */
  grupo?: Grupo | null;
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

/**
 * Capa do Reels (cover_url), sem placar (ADR-0106): os dois escudos grandes frente a frente, com
 * Rodada e horário, Grupo e os selos (Clássico, jogo decisivo). Tudo o que importa fica no recorte
 * 3:4 da grade do perfil (linhas 60 a 420), fora do canto do contador de visualizações.
 */
export function desenharCapa(ctx: CanvasRenderingContext2D, r: ResultadoPartida, o: OpcoesVideo): void {
  const pin = new Pincel(ctx);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.86);
  desenharConfronto(pin, r, o, PARADO);
}

/** Quanto de cada parte do Confronto já entrou (0 a 1). A capa usa tudo em 1. */
interface EntradaDoConfronto {
  topo: number;
  mandante: number;
  visitante: number;
  /** Batida dos escudos: 1 no instante do encontro, caindo até 0 (tremor da tela). */
  impacto: number;
  nomes: number;
  selos: number;
  briga: number;
}
const PARADO: EntradaDoConfronto = { topo: 1, mandante: 1, visitante: 1, impacto: 0, nomes: 1, selos: 1, briga: 1 };

/**
 * Abertura do Reels (ADR-0107): a capa ganha vida. Os escudos entram cada um do seu lado, batem
 * no "x" com um tremor e depois vêm nomes, selos e, na última Rodada, do que cada Time precisa.
 * Os tempos são em segundos de vídeo, para a abertura curta (3 s) também mostrar tudo.
 */
export function entradaDoConfronto(t: number): EntradaDoConfronto {
  const batida = 1.1;
  return {
    topo: entre(t, 0, 0.4),
    mandante: entre(t, 0.3, 0.8),
    visitante: entre(t, 0.6, batida),
    impacto: t < batida ? 0 : Math.max(0, 1 - (t - batida) / 0.35),
    nomes: entre(t, batida, batida + 0.3),
    selos: entre(t, 1.4, 1.7),
    briga: entre(t, 1.7, 2.2),
  };
}

function desenharConfronto(pin: Pincel, r: ResultadoPartida, o: OpcoesVideo, e: EntradaDoConfronto): void {
  const ctx = pin.ctx;
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const base = ctx.globalAlpha;
  const cx = COLUNAS / 2;
  const tremor = e.impacto > 0 ? Math.round(Math.sin(e.impacto * 40) * 3 * e.impacto) : 0;
  // O bloco todo desce para ficar no meio do recorte 3:4 (centro na linha 240).
  ctx.save();
  ctx.translate(tremor * pin.px, 28 * pin.px);

  ctx.globalAlpha = base * e.topo;
  pin.placa(cx - 66, 66, 132, 20, { fundo: COR.amarelo, sombra: '#C99500' });
  pin.texto('Melhores momentos', cx, 76, pin.caber('Melhores momentos', 120, 15, display), display, COR.tinta);
  if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, cx, 114 - (1 - e.topo) * 8, 36);
  const linha = linhaDaCapa(o.subtitulo);
  if (linha) pin.texto(linha, cx, 148, pin.caber(linha, 240, 26, display), display, COR.amarelo, { contorno: COR.mata });
  if (o.grupo) pin.texto(NOME_DO_GRUPO[o.grupo], cx, 170, 11, texto, COR.placa, { peso: 700 });

  const escala = 4;
  const w = LARGURA_ESCUDO * escala;
  const topo = 188;
  const fimDosEscudos = topo + ALTURA_ESCUDO * escala;
  const lados = ['mandante', 'visitante'] as const;
  lados.forEach((lado, i) => {
    const entrou = i === 0 ? e.mandante : e.visitante;
    if (entrou <= 0) return;
    const alvo = i === 0 ? 24 : COLUNAS - 24 - w;
    const fora = i === 0 ? -w - 10 : COLUNAS + 10;
    ctx.globalAlpha = base;
    desenharEscudo(pin, r.times[lado], Math.round(fora + (alvo - fora) * entrou), topo, escala);
    if (e.nomes > 0) {
      ctx.globalAlpha = base * e.nomes;
      const nome = FALA_DO_TIME[r.times[lado]].curto;
      pin.texto(nome, alvo + w / 2, fimDosEscudos + 14, pin.caber(nome, 112, 22, display), display, '#FFFFFF', { contorno: COR.mata });
    }
  });
  if (e.visitante >= 1) {
    // O "x" aparece na batida, um pouco maior, e assenta.
    const meio = topo + (ALTURA_ESCUDO * escala) / 2;
    const k = 1 + e.impacto * 0.35;
    ctx.globalAlpha = base;
    pin.placa(cx - 15 * k, meio - 12 * k, 30 * k, 24 * k, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
    pin.texto('x', cx, meio - 1, 20 * k, display, COR.tinta);
  }

  // Última Rodada (ADR-0053): do que cada Time precisa, embaixo do nome dele.
  const b = o.briga;
  const comBriga = !!b && e.briga > 0;
  if (b && comBriga) {
    lados.forEach((lado, i) => {
      // A mesma plaquinha do começo do jogo (Mata-mata ou, para quem já está fora, o Rebaixamento).
      const { texto: txt, tipo: antes } = plaquinhasDaBriga(b, r.times, { mandante: 0, visitante: 0 }, false, true)[lado];
      const fundo = antes === 'GARANTIDO' ? '#3E9B3A' : antes === 'ELIMINADO' ? '#B8442F' : COR.amarelo;
      const sombra = antes === 'GARANTIDO' ? '#2A6E27' : antes === 'ELIMINADO' ? '#82301F' : '#C99500';
      const tinta = antes === 'DEPENDE' ? COR.tinta : '#FFFFFF';
      const cw = 104;
      const x = (i === 0 ? 24 + w / 2 : COLUNAS - 24 - w / 2) - cw / 2;
      ctx.globalAlpha = base * e.briga;
      pin.placa(x, fimDosEscudos + 26, cw, 14, { fundo, sombra, degrau: 1 });
      pin.texto(txt, x + cw / 2, fimDosEscudos + 32.5, pin.caber(txt, cw - 8, 8, texto, 700), texto, tinta, { peso: 700 });
    });
  }

  const selos = selosDaCapa(r, o);
  const ySelos = b ? 352 : 322;
  if (selos.length && e.selos > 0) {
    const tam = 15;
    ctx.font = `400 ${tam * pin.px}px ${display}`;
    const ws = selos.map((s) => Math.min(250 / selos.length - 4, Math.ceil(ctx.measureText(s).width / pin.px) + 16));
    let x = cx - (ws.reduce((a, c) => a + c, 0) + (ws.length - 1) * 8) / 2;
    ctx.globalAlpha = base * e.selos;
    selos.forEach((s, k) => {
      pin.placa(x, ySelos + (1 - e.selos) * 6, ws[k]!, 22, { fundo: COR.amarelo, sombra: '#C99500' });
      pin.texto(s, x + ws[k]! / 2, ySelos + 11 + (1 - e.selos) * 6, pin.caber(s, ws[k]! - 10, tam, display), display, COR.tinta);
      x += ws[k]! + 8;
    });
  }
  if (b && comBriga) {
    // Garantidos que não jogam esta Partida (os daqui aparecem na plaquinha de cada Time). No jogo
    // que só vale a permanência (ADR-0115), os já rebaixados.
    const queda = valeAPermanencia(b, r.times);
    const quem = queda ? situacoesNoRebaixamento(b, r.times, null)! : situacoesNaBriga(b, r.times, null);
    const alvo = queda ? 'ELIMINADO' : 'GARANTIDO';
    const fora = [...quem].filter(([t, s]) => s === alvo && t !== r.times.mandante && t !== r.times.visitante).map(([t]) => FALA_DO_TIME[t].curto);
    if (fora.length) {
      const l = `Já ${queda ? 'rebaixad' : 'garantid'}${fora.length > 1 ? 'os' : 'o'}: ${fora.join(', ')}`;
      ctx.globalAlpha = base * e.briga;
      pin.texto(l, cx, ySelos + 34, pin.caber(l, 240, 9, texto, 700), texto, queda ? '#FF8A75' : '#9FE08A', { peso: 700 });
    }
  }
  ctx.restore();

  // Fora do recorte da grade: aparece só na capa inteira e no fim da abertura.
  ctx.globalAlpha = base * e.selos;
  pin.texto(`Narração: ${narradorDa(r.seed).nome}`, cx, 438, 10, texto, COR.placa, { peso: 600 });
  if (r.juiz) pin.texto(`Juiz: ${NOME_DO_PERFIL_DO_JUIZ[r.juiz]}`, cx, 452, 10, texto, r.juiz === 'RIGOROSO' ? '#FF6B5B' : r.juiz === 'DEIXA_JOGAR' ? '#3DDC64' : COR.placa, { peso: 600 });
  ctx.globalAlpha = base;
}

/** "Rodada 5, jogo das 17h" vira "Rodada 5 · 17h" na capa; o Mata-mata fica como está. */
export function linhaDaCapa(subtitulo: string | undefined): string | null {
  if (!subtitulo) return null;
  return subtitulo.replace(/, jogo das (\d+h)$/, ' · $1');
}

/** Selos da capa: Clássico e, quando a Partida decide algo de verdade, o que ela vale. */
export function selosDaCapa(r: ResultadoPartida, o: Pick<OpcoesVideo, 'mataMata' | 'briga'>): string[] {
  const selos: string[] = [];
  if (r.classico) selos.push('Clássico');
  const mm = o.mataMata;
  if (mm) selos.push(mm.etapa === 'FINAL' ? 'Vale o título' : mm.copa ? 'Mata-mata' : 'Vale a Final');
  else if (o.briga) selos.push(valeAPermanencia(o.briga, r.times) ? 'Vale a permanência' : 'Vale a Semifinal');
  return selos;
}

function desenharAbertura(pin: Pincel, r: ResultadoPartida, p: number, tVideo: number, o: OpcoesVideo, comVeu = true): void {
  pin.ctx.save();
  pin.ctx.globalAlpha = 1 - entre(p, 0.85, 1);
  if (comVeu) veu(pin, 0.86);
  desenharConfronto(pin, r, o, entradaDoConfronto(tVideo));
  pin.ctx.restore();
}

/**
 * Fim do Reels na última Rodada (ADR-0053): "Onça no Mata-mata", "Tatu fora", "Tatu depende das 18h".
 * Quem passou a brigar contra o Rebaixamento (ADR-0115): "Tatu salvo!", "Tatu rebaixado", "Tatu ameaçado".
 */
function desfechoDaBrigaNaTela(b: BrigaPeloMataMata, r: ResultadoPartida): string[] {
  const antes = situacoesNaBriga(b, r.times, null);
  const fim = situacoesNaBriga(b, r.times, r.gols);
  const quedaAntes = situacoesNoRebaixamento(b, r.times, null);
  const quedaFim = situacoesNoRebaixamento(b, r.times, r.gols);
  const dep = b.depois.length === 1 ? `depende das ${b.depois[0]!.hora}h` : 'depende dos outros jogos';
  return (['mandante', 'visitante'] as const).flatMap((l) => {
    const id = r.times[l];
    const t = FALA_DO_TIME[id].curto;
    if (brigaDoTime(b, r.times, l, r.gols) === 'REBAIXAMENTO') {
      if (quedaAntes!.get(id) !== 'DEPENDE') return [];
      const s = quedaFim!.get(id);
      return [s === 'GARANTIDO' ? `${t} ${concordar([id], 'salv')}!` : s === 'ELIMINADO' ? `${t} ${concordar([id], 'rebaixad')}` : `${t} ${concordar([id], 'ameaçad')}`];
    }
    if (antes.get(id) !== 'DEPENDE') return [];
    const s = fim.get(id);
    return [s === 'GARANTIDO' ? `${t} no Mata-mata!` : s === 'ELIMINADO' ? `${t} fora` : `${t} ${dep}`];
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
