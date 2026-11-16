/**
 * Reels de Novidades da Temporada 2 (ADR-0062): quatro Reels curtos, um por tema, na quarta antes
 * da estreia. Dentro de campo, Capitão, Seu Jogador e Site e App. As novidades de dentro de campo
 * e as Jogadas da Formação aparecem no próprio jogo (trechos de Partidas de exemplo, com a
 * legenda embaixo); o resto em cartelas, no estilo dos outros Reels de anúncio. Cada Reels tem o
 * seu Narrador; no de dentro de campo, os cinco Narradores se apresentam com a própria voz.
 */
import { ESPECIALIZACOES, NOME_DA_ESPECIALIZACAO, NOME_DA_HABILIDADE, type Posicao, type TimeId } from '@liga/shared';
import { boneco, uniforme } from './apresentacao.js';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, desenharQuadro } from './desenho.js';
import type { EventoSonoro, Fala } from './narracao.js';
import { NARRADORES } from './narradores.js';
import { COLUNAS, COR, LINHAS, Pincel } from './pixel.js';
import type { Segmento } from './roteiro.js';
import type { Pose } from './sprites.js';
import { Timeline } from './timeline.js';
import { desenharEscudoDaLiga, veu, type PartidaParaVideo } from './video.js';

export type ReelsDeNovidades = 'CAMPO' | 'CAPITAO' | 'JOGADOR' | 'SITE';
export const REELS_DE_NOVIDADES: readonly ReelsDeNovidades[] = ['CAMPO', 'CAPITAO', 'JOGADOR', 'SITE'];
/** O id do Reels Programado (e do vídeo) de cada um. */
export const ID_DAS_NOVIDADES: Record<ReelsDeNovidades, string> = { CAMPO: 'novidades-campo', CAPITAO: 'novidades-capitao', JOGADOR: 'novidades-jogador', SITE: 'novidades-site' };
/** Narrador de cada Reels. */
export const NARRADOR_DAS_NOVIDADES: Record<ReelsDeNovidades, string> = { CAMPO: 'RITA', CAPITAO: 'TURBO', JOGADOR: 'BETO', SITE: 'ZE' };
/** Hora (Brasília) de cada um, nos horários dos jogos da T1; o Reels anterior chama o seguinte. */
export const HORA_DAS_NOVIDADES: Record<ReelsDeNovidades, number> = { CAMPO: 12, CAPITAO: 14, JOGADOR: 16, SITE: 18 };

/** Os trechos de jogo que os Reels usam (achados nas Partidas de exemplo pelo script de gravação). */
export type ClipeId =
  | 'FALTA_CARTAO' | 'PENALTI' | 'BARREIRA' | 'ESCANTEIO' | 'GOL_TORCIDA' | 'CLIMA' | 'TROCA'
  | 'TABELA' | 'COBERTURA' | 'LIGACAO_DIRETA';

/** Um trecho de jogo: de `de` até `ate` (s de jogo), com o momento principal em `chave`. */
export interface ClipeDeJogo {
  partida: number;
  de: number;
  chave: number;
  ate: number;
  /** Sons do trecho, em s de jogo. */
  sons: EventoSonoro[];
}

export interface DadosDasNovidades {
  reels: ReelsDeNovidades;
  /** Dia da estreia (Rodada 1), AAAA-MM-DD, e o dia do post. */
  estreia: string;
  publicadoEm: string;
  /** Partidas de exemplo (T2) e os trechos achados nelas. Sem o trecho, a cena sai do Reels. */
  partidas: PartidaParaVideo[];
  clipes: Partial<Record<ClipeId, ClipeDeJogo>>;
}

type CartelaId =
  | 'ABERTURA' | 'NARRADORES' | 'NARRADOR' | 'CHAMADA'
  | 'CAPITAO' | 'POSTURA' | 'FORMACAO'
  | 'VINCULO' | 'APELIDO' | 'ESPECIALIZACAO' | 'TREINO' | 'PRESENCA' | 'RESENHA' | 'SELECAO'
  | 'APP' | 'AVISOS' | 'AO_VIVO' | 'CARREIRA';

export interface CenaNovidade {
  id: string;
  /** Duração mínima (s); a narração estica. */
  base: number;
  fala: string;
  tom: 'normal' | 'animado';
  /** Outro Narrador nesta fala (a apresentação de cada um). */
  narrador?: string;
  visual: { clipe: ClipeId; legenda: string } | { cartela: CartelaId; k?: number };
}

const TITULO: Record<ReelsDeNovidades, string> = { CAMPO: 'Dentro de campo', CAPITAO: 'O Capitão', JOGADOR: 'Seu Jogador', SITE: 'Site e App' };
const HORA_FALADA: Record<number, string> = { 12: 'ao meio-dia', 14: 'às duas da tarde', 16: 'às quatro da tarde', 18: 'às seis da tarde' };
const DIA_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NUMERO: Record<number, string> = { 1: 'um', 19: 'dezenove', 20: 'vinte', 21: 'vinte e um' };

/** "amanhã" ou "na quinta, dia dezenove". */
export function quandoEstreia(d: Pick<DadosDasNovidades, 'estreia' | 'publicadoEm'>): { falado: string; escrito: string } {
  const [a, m, dia] = d.estreia.split('-').map(Number) as [number, number, number];
  const estreia = Date.UTC(a, m - 1, dia, 12);
  const post = new Date(Date.parse(d.publicadoEm) - 3 * 3600_000);
  const hoje = Date.UTC(post.getUTCFullYear(), post.getUTCMonth(), post.getUTCDate(), 12);
  const semana = DIA_DA_SEMANA[new Date(estreia).getUTCDay()]!;
  const data = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  if (estreia - hoje === 86_400_000) return { falado: 'amanhã', escrito: `Amanhã, ${semana} ${data}` };
  return { falado: `${semana === 'sábado' || semana === 'domingo' ? 'no' : 'na'} ${semana}, dia ${NUMERO[dia] ?? dia}`, escrito: `${semana[0]!.toUpperCase()}${semana.slice(1)}, ${data}` };
}

/** As cenas de cada Reels, na ordem, com o texto falado. Cenas de jogo sem trecho saem. */
export function cenasDasNovidades(d: DadosDasNovidades): CenaNovidade[] {
  const proximo = REELS_DE_NOVIDADES[REELS_DE_NOVIDADES.indexOf(d.reels) + 1];
  const chamaProximo = proximo ? ` E ${HORA_FALADA[HORA_DAS_NOVIDADES[proximo]]}, tem mais: ${{ CAMPO: '', CAPITAO: 'o capitão', JOGADOR: 'o seu jogador', SITE: 'o site e o app' }[proximo]}!` : '';
  const estreia = quandoEstreia(d).falado;
  const c = (id: string, base: number, fala: string, visual: CenaNovidade['visual'], tom: CenaNovidade['tom'] = 'normal', narrador?: string): CenaNovidade => ({ id, base, fala, visual, tom, ...(narrador ? { narrador } : {}) });
  const jogo = (clipe: ClipeId, legenda: string, fala: string, base = 6.5) => c(clipe.toLowerCase(), base, fala, { clipe, legenda });
  let cenas: CenaNovidade[];
  switch (d.reels) {
    case 'CAMPO':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte um: dentro de campo!', { cartela: 'ABERTURA' }, 'animado'),
        jogo('FALTA_CARTAO', 'Falta e cartão', 'Agora tem juiz em campo! Ele apita a falta e mostra o cartão. O vermelho expulsa na hora. E dois amarelos na temporada dão suspensão.'),
        jogo('PENALTI', 'Pênalti', 'Falta dentro da área é pênalti!'),
        jogo('BARREIRA', 'Falta com barreira', 'Na entrada da área, é chute direto, com barreira. E de mais longe, jogada ensaiada.'),
        jogo('ESCANTEIO', 'Escanteio', 'E a bola parada também tem escanteio e lateral.'),
        jogo('GOL_TORCIDA', 'Arquibancada', 'Do lado do campo, a arquibancada, nas cores de cada time. Ela cresce com o elenco e, depois do gol, canta o grito de guerra!'),
        jogo('CLIMA', 'Sol, chuva ou lama', 'Cada jogo tem o seu clima: sol, chuva ou lama. E quando as camisas se confundem, o visitante joga com o segundo uniforme.'),
        jogo('TROCA', 'Substituição', 'No intervalo, quem está indo mal sai, e entra um reserva do banco, da mesma posição. Até duas trocas por time.'),
        c('narradores', 3, 'E agora são cinco narradores, cada um com a sua voz.', { cartela: 'NARRADORES' }),
        ...NARRADORES.map((n, k) => c(`narrador-${k}`, 1.6, n.apresentacao, { cartela: 'NARRADOR', k }, 'animado', n.id)),
        c('chamada', 5, `A estreia é ${estreia}!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'CAPITAO':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte dois: o capitão!', { cartela: 'ABERTURA' }, 'animado'),
        c('capitao', 7, 'Todo time tem um capitão: o jogador com mais partidas pelo time, que tem o vínculo no site.', { cartela: 'CAPITAO' }),
        c('postura', 8, 'Antes de cada jogo, até o corte, ele escolhe a postura, em segredo: ofensiva, equilibrada ou defensiva.', { cartela: 'POSTURA' }),
        c('formacao', 8.5, 'E escolhe a formação: dois, dois, dois; dois, três, um; três, dois, um; ou três, um, dois. As vagas da escalação seguem a formação.', { cartela: 'FORMACAO' }),
        jogo('TABELA', 'Tabela · 2-3-1', 'Cada formação tem a sua jogada. No dois, três, um: a tabela entre os meias.'),
        jogo('COBERTURA', 'Cobertura · 3-2-1', 'No três, dois, um: o terceiro zagueiro faz a cobertura.'),
        jogo('LIGACAO_DIRETA', 'Ligação direta · 3-1-2', 'E no três, um, dois: o zagueiro faz a ligação direta pro ataque.'),
        c('chamada', 5, `Capitão, escolhe pelo site até o corte! A estreia é ${estreia}.${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'JOGADOR':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte três: o seu jogador!', { cartela: 'ABERTURA' }, 'animado'),
        c('vinculo', 6.5, 'Tudo começa no vínculo: pega o código no site, manda na DM da liga, e cuida do seu jogador pelo celular.', { cartela: 'VINCULO' }),
        c('apelido', 6.5, 'Escolhe um apelido: ele aparece em cima do seu jogador, e o narrador fala o seu apelido nos lances.', { cartela: 'APELIDO' }),
        c('especializacao', 8, 'Escolhe a especialização: são três por posição, como artilheiro, volante, xerife ou paredão. Melhora uma coisa e piora outra.', { cartela: 'ESPECIALIZACAO' }),
        c('treino', 6, 'No treino, você escolhe a habilidade que sobe mais rápido.', { cartela: 'TREINO' }),
        c('presenca', 7, 'Vai jogar? Comenta CONFIRMO, ou confirma no site, até o corte, e você passa na frente no rodízio da escalação.', { cartela: 'PRESENCA' }),
        c('resenha', 7.5, 'Comentou no Reels do último jogo do seu time? As suas habilidades sobem mais rápido. E se o próximo jogo for o clássico, você ainda passa na frente.', { cartela: 'RESENHA' }),
        jogo('PENALTI', 'Seu canto', 'No pênalti, vale o canto que você escolheu: esquerda, meio ou direita. Batedor e goleiro.'),
        c('selecao', 8, 'E toda rodada sai a seleção da rodada: o muralha, o carrapato, o garçom e o matador. A maior nota de cada posição, que vira troféu na carreira.', { cartela: 'SELECAO' }),
        c('chamada', 5, `A estreia é ${estreia}!${chamaProximo}`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
    case 'SITE':
      cenas = [
        c('abertura', 4.5, 'Novidades da temporada dois, parte quatro: o site e o app!', { cartela: 'ABERTURA' }, 'animado'),
        c('app', 7, 'O site do Varzeão vira app: instala no celular, com ícone na tela inicial e tela cheia. Sem precisar de loja.', { cartela: 'APP' }),
        c('avisos', 7.5, 'Liga os avisos e escolhe os seus times: escalação, cinco minutos antes do apito inicial, gols e fim de jogo.', { cartela: 'AVISOS' }),
        c('ao-vivo', 7.5, 'No ao vivo, aparece quanta gente está assistindo. E dá pra mandar reação, que sobe na tela de todo mundo.', { cartela: 'AO_VIVO' }),
        c('carreira', 7.5, 'E na página de carreira, a história do seu jogador, temporada por temporada: time, números, OVR e troféus.', { cartela: 'CARREIRA' }),
        c('chamada', 5, `A temporada dois começa ${estreia}! Oito jogos por dia, um por hora, das onze da manhã às seis da tarde. Link na bio!`, { cartela: 'CHAMADA' }, 'animado'),
      ];
      break;
  }
  return cenas.filter((x) => !('clipe' in x.visual) || d.clipes[x.visual.clipe]);
}

// ---------------------------------------------------------------- roteiro

export type SegmentoNovidade = Segmento & { cena: CenaNovidade };
const CORTE = 0.3;

export class RoteiroNovidades {
  readonly cenas: CenaNovidade[];
  readonly segmentos: SegmentoNovidade[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDasNovidades,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    this.cenas = cenasDasNovidades(dados);
    let cursor = 0;
    this.segmentos = this.cenas.map((cena, i) => {
      const inicio = cursor;
      cursor += Math.max(cena.base, minimos[i]?.antes ?? 0);
      // Trecho de jogo: música baixa, como nos lances do Reels da Partida.
      return { tipo: 'clipe' in cena.visual ? 'TROCA' : 'ABERTURA', cena, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoNovidade; indice: number; tempo: number; progresso: number; escurecer: number } {
    const t = Math.min(Math.max(tBruto, 0), this.duracao - 1e-9);
    const indice = Math.max(0, this.segmentos.findIndex((s) => t < s.fim));
    const segmento = this.segmentos[indice]!;
    const tempo = t - segmento.inicio;
    const meio = CORTE / 2;
    // Os Narradores se apresentam em sequência, sem escurecer entre eles.
    const emSequencia = (i: number) => this.segmentos[i]?.cena.visual && 'cartela' in this.segmentos[i]!.cena.visual && ['NARRADORES', 'NARRADOR'].includes((this.segmentos[i]!.cena.visual as { cartela: string }).cartela);
    const juntaAntes = indice > 0 && emSequencia(indice) && emSequencia(indice - 1);
    const juntaDepois = emSequencia(indice) && emSequencia(indice + 1);
    const entrada = indice === 0 || juntaAntes ? 1 : Math.min(1, tempo / meio);
    const saida = indice === this.segmentos.length - 1 || juntaDepois ? 1 : Math.min(1, (segmento.fim - t) / meio);
    return { segmento, indice, tempo, progresso: tempo / (segmento.fim - segmento.inicio), escurecer: 1 - Math.min(entrada, saida) };
  }

  /** Instante de jogo de um trecho no progresso `p` (0–1): o momento principal cai em 55%. */
  static tJogo(c: ClipeDeJogo, p: number): number {
    const PIVO = 0.55;
    return p < PIVO ? c.de + (c.chave - c.de) * (p / PIVO) : c.chave + (c.ate - c.chave) * ((p - PIVO) / (1 - PIVO));
  }

  /** Sons dos trechos de jogo, já no tempo do vídeo. */
  eventos(): EventoSonoro[] {
    const out: EventoSonoro[] = [{ tipo: 'APITO_FINAL', t: 0.1 }];
    for (const s of this.segmentos) {
      if (!('clipe' in s.cena.visual)) continue;
      const c = this.dados.clipes[s.cena.visual.clipe]!;
      const dur = s.fim - s.inicio;
      for (const e of c.sons) {
        // Inverte o mapa de tJogo para achar o instante no vídeo.
        const p = e.t <= c.chave ? 0.55 * ((e.t - c.de) / Math.max(1e-6, c.chave - c.de)) : 0.55 + 0.45 * ((e.t - c.chave) / Math.max(1e-6, c.ate - c.chave));
        if (p >= 0 && p <= 1) out.push({ tipo: e.tipo, t: s.inicio + p * dur });
      }
    }
    out.push({ tipo: 'APITO_FINAL', t: this.duracao - 1.2 });
    return out;
  }
}

/** Uma fala por cena, com o Narrador dela (quando não é o do Reels). */
export function narracaoDasNovidades(roteiro: RoteiroNovidades): (Fala & { narrador: string })[] {
  const padrao = NARRADOR_DAS_NOVIDADES[roteiro.dados.reels];
  return roteiro.segmentos.map((s, i) => ({
    id: `novidades-${roteiro.dados.reels.toLowerCase()}-${i}`,
    texto: s.cena.fala,
    inicio: s.inicio + (s.cena.narrador ? 0.1 : 0.35),
    limite: s.fim,
    tom: s.cena.tom,
    segmento: i,
    parte: 'antes',
    narrador: s.cena.narrador ?? padrao,
  }));
}

// ---------------------------------------------------------------- desenho

export interface OpcoesNovidades {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
  /** Emojis das Reações (imagens), na ordem ⚽ 🔥 😱 👏. */
  emojis?: readonly CanvasImageSource[];
}

const VERDE = '#A5CF8E';
const DOURADO = '#F2C14E';
const TELA = '#F3E6C9';
const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

/** As Timelines das Partidas de exemplo, montadas uma vez por Roteiro. */
const timelines = new WeakMap<RoteiroNovidades, Timeline[]>();
function timelinesDe(r: RoteiroNovidades): Timeline[] {
  let t = timelines.get(r);
  if (!t) {
    t = r.dados.partidas.map((p) => new Timeline(p.resultado, p.escalacoes, p.torcida ? { torcida: p.torcida } : {}));
    timelines.set(r, t);
  }
  return t;
}

function opcoesDoJogo(p: PartidaParaVideo, o: OpcoesNovidades) {
  return {
    times: p.resultado.times,
    nomes: p.nomes,
    ...(p.apelidos ? { apelidos: p.apelidos } : {}),
    ...(o.fonteDisplay ? { fonteDisplay: o.fonteDisplay } : {}),
    ...(o.fonteTexto ? { fonteTexto: o.fonteTexto } : {}),
  };
}

export function desenharQuadroNovidades(ctx: CanvasRenderingContext2D, roteiro: RoteiroNovidades, tVideo: number, o: OpcoesNovidades = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  const t = q.tempo;
  const cena = q.segmento.cena;
  const passo = Math.floor(tVideo * 4);
  ctx.imageSmoothingEnabled = false;

  const surge = (a: number, desenhar: () => void, dy = 10) => {
    if (a <= 0) return;
    pin.ctx.save();
    pin.ctx.globalAlpha *= a;
    pin.ctx.translate(0, (1 - a) * dy * pin.px);
    desenhar();
    pin.ctx.restore();
  };
  const linha = (txt: string, y: number, tam = 13, cor: string = COR.placa, largura = 230) =>
    pin.texto(txt, COLUNAS / 2, y, pin.caber(txt, largura, tam, texto, 700), texto, cor, { peso: 700 });
  const titulo = (txt: string, y = 34) => {
    const a = entre(t, 0, 0.35);
    pin.ctx.globalAlpha = a;
    pin.tabua(COLUNAS / 2 - 118, y - (1 - a) * 8, 236, 34);
    pin.texto(txt, COLUNAS / 2, y + 17 - (1 - a) * 8, pin.caber(txt, 216, 24, display), display, COR.amarelo, { contorno: COR.contorno });
    pin.ctx.globalAlpha = 1;
  };
  const selo = () => {
    // "Novidades da T2 · 2/4" no canto de cima das cartelas.
    const k = REELS_DE_NOVIDADES.indexOf(d.reels) + 1;
    pin.texto(`Novidades da T2 · ${k}/4`, COLUNAS / 2, 14, 10, texto, VERDE, { peso: 700 });
  };
  const corre = (k: number): Pose => ((passo + k) % 2 ? 'FRENTE_CORRE_A' : 'FRENTE_CORRE_B');
  const cartao = (x: number, y: number, cor: string, esc = 1) => {
    pin.r(x - 1, y - 1, 10 * esc + 2, 14 * esc + 2, COR.contorno);
    pin.r(x, y, 10 * esc, 14 * esc, cor);
  };
  /** Tábua com um ícone à esquerda, nome e uma linha de apoio. */
  const item = (y: number, h: number, nome: string, apoio: string, icone?: (cx: number, cy: number) => void) => {
    pin.tabua(14, y, 242, h);
    const x0 = icone ? 62 : 28;
    if (icone) icone(38, y + h / 2);
    pin.texto(nome, x0, y + h / 2 - 9, pin.caber(nome, 256 - x0 - 10, 17, display), display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
    pin.texto(apoio, x0, y + h / 2 + 10, pin.caber(apoio, 256 - x0 - 10, 10.5, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
  };
  /** Celular: moldura escura e tela no tom do site. Devolve a área da tela. */
  const celular = (x: number, y: number, w: number, h: number) => {
    pin.placa(x, y, w, h, { fundo: '#1E1E1E', luz: '#3A3A3A', sombra: '#000000' });
    pin.r(x + 5, y + 12, w - 10, h - 22, TELA);
    pin.r(x + w / 2 - 10, y + 5, 20, 3, '#3A3A3A');
    return { x: x + 5, y: y + 12, w: w - 10, h: h - 22 };
  };
  const escudoLiga = (cx: number, cy: number, tam: number) => {
    if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, cx, cy, tam);
    else {
      pin.r(cx - tam / 2, cy - tam / 2, tam, tam, COR.madeira);
    }
  };

  // ------------------------------------------------ trecho de jogo
  if ('clipe' in cena.visual) {
    const c = d.clipes[cena.visual.clipe]!;
    const tl = timelinesDe(roteiro)[c.partida]!;
    desenharQuadro(ctx, tl.estado(RoteiroNovidades.tJogo(c, q.progresso)), opcoesDoJogo(d.partidas[c.partida]!, o));
    const leg = cena.visual.legenda;
    surge(entre(t, 0.15, 0.5), () => {
      pin.tabua(24, 446, 222, 30);
      pin.texto(leg, COLUNAS / 2, 461, pin.caber(leg, 200, 22, display), display, COR.amarelo, { contorno: COR.contorno });
    }, 8);
    escurecer(ctx, q.escurecer);
    return;
  }

  // ------------------------------------------------ cartelas
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);
  selo();
  const cartela = cena.visual.cartela;
  switch (cartela) {
    case 'ABERTURA': {
      surge(entre(t, 0, 0.5), () => escudoLiga(COLUNAS / 2, 104, 92));
      surge(entre(t, 0.35, 0.8), () => pin.texto('Novidades da', COLUNAS / 2, 184, 30, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 }));
      surge(entre(t, 0.55, 1.0), () => pin.texto('Temporada 2', COLUNAS / 2, 222, pin.caber('Temporada 2', 240, 44, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 }));
      surge(entre(t, 1.1, 1.6), () => {
        const nome = TITULO[d.reels];
        pin.tabua(30, 262, 210, 50);
        pin.texto(nome, COLUNAS / 2, 288, pin.caber(nome, 190, 32, display), display, '#FFFFFF', { contorno: COR.contorno });
      });
      surge(entre(t, 1.6, 2.0), () => {
        const k = REELS_DE_NOVIDADES.indexOf(d.reels);
        REELS_DE_NOVIDADES.forEach((r, i) => {
          const x = COLUNAS / 2 - 54 + i * 36;
          pin.r(x - 1, 335, 26, 14, COR.contorno);
          pin.r(x, 336, 24, 12, i === k ? COR.amarelo : i < k ? VERDE : '#55452F');
          pin.texto(String(i + 1), x + 12, 342, 10, display, COR.contorno);
          void r;
        });
      });
      // Um boneco de cada Posição, comemorando.
      surge(entre(t, 2.0, 2.5), () => {
        const fila: [TimeId, Posicao][] = [['ONC', 'ATA'], ['CAP', 'MEI'], ['JAC', 'ZAG'], ['TAT', 'GOL'], ['QUA', 'ATA']];
        fila.forEach(([time, pos], k) => {
          const salto = (passo + k) % 4 === 0 ? 2 : 0;
          boneco(pin, pos === 'GOL' ? 'FRENTE_PARADO' : corre(k), uniforme(time, pos, `novidade-${k}`), 22 + k * 48, 372 - salto, 2.3);
        });
      });
      break;
    }

    case 'NARRADORES':
    case 'NARRADOR': {
      titulo('Cinco Narradores');
      const ativo = cartela === 'NARRADOR' ? (cena.visual.k ?? 0) : -1;
      NARRADORES.forEach((n, k) => {
        const y = 82 + k * 64;
        const de = cartela === 'NARRADORES' ? 0.3 + k * 0.3 : 0;
        surge(cartela === 'NARRADORES' ? entre(t, de, de + 0.35) : 1, () => {
          const aceso = k === ativo;
          pin.ctx.globalAlpha *= ativo >= 0 && !aceso ? 0.45 : 1;
          pin.tabua(aceso ? 10 : 18, y, aceso ? 250 : 234, 56);
          // Microfone.
          const mx = aceso ? 34 : 40;
          pin.r(mx - 5, y + 12, 10, 16, COR.contorno);
          pin.r(mx - 4, y + 13, 8, 14, aceso ? COR.amarelo : '#9C9C9C');
          for (let g = 0; g < 3; g++) pin.r(mx - 4, y + 16 + g * 4, 8, 1, COR.contorno);
          pin.r(mx - 1, y + 29, 2, 8, COR.contorno);
          pin.r(mx - 6, y + 37, 12, 2, COR.contorno);
          pin.texto(n.nome, mx + 18, y + 20, pin.caber(n.nome, 170, 20, display), display, aceso ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          const fala = `"${n.apresentacao}"`;
          pin.texto(fala, mx + 18, y + 40, pin.caber(fala, 200 - (aceso ? 0 : 8), 10, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
          if (aceso) {
            // Ondas de som.
            for (let w = 0; w < 3; w++) {
              const on = (passo + w) % 3 !== 0;
              if (on) pin.r(238 + w * 5, y + 22 - w * 3, 2, 8 + w * 6, VERDE);
            }
          }
        });
      });
      surge(entre(t, 1.8, 2.2), () => linha('Sorteado a cada jogo', 412, 13, VERDE));
      break;
    }

    case 'CHAMADA': {
      const q2 = quandoEstreia(d);
      surge(entre(t, 0, 0.5), () => escudoLiga(COLUNAS / 2, 96, 80));
      surge(entre(t, 0.3, 0.8), () => {
        pin.texto('Estreia', COLUNAS / 2, 168, 30, display, COR.placa, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto(q2.escrito, COLUNAS / 2, 206, pin.caber(q2.escrito, 240, 36, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      });
      surge(entre(t, 0.9, 1.3), () => {
        pin.tabua(24, 236, 222, 64);
        // T2 em Grupos (ADR-0064): 8 jogos por dia, um por hora.
        linha('8 jogos por dia', 256, 14);
        linha('um por hora · 11h às 18h', 280, 14);
      });
      const proximo = REELS_DE_NOVIDADES[REELS_DE_NOVIDADES.indexOf(d.reels) + 1];
      surge(entre(t, 1.6, 2.0), () => {
        if (proximo) {
          pin.tabua(34, 318, 202, 58);
          linha(`Hoje, ${HORA_DAS_NOVIDADES[proximo]}h`, 336, 13, VERDE);
          pin.texto(TITULO[proximo], COLUNAS / 2, 358, pin.caber(TITULO[proximo], 180, 24, display), display, COR.amarelo, { contorno: COR.contorno });
        } else {
          const pulso = 1 + 0.04 * Math.sin(t * 6);
          pin.texto('Link na bio!', COLUNAS / 2, 346, 34 * pulso, display, '#FFFFFF', { contorno: COR.contorno, espessura: 1.5 });
        }
      });
      surge(entre(t, 2.0, 2.4), () => {
        boneco(pin, 'FRENTE_COMEMORA', uniforme('ONC', 'ATA', 'chamada-a'), 50, 396, 2.4);
        boneco(pin, (passo % 2 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO') as Pose, uniforme('JAC', 'MEI', 'chamada-b'), 192, 396, 2.4);
      });
      break;
    }

    // ------------------------------------------ Capitão
    case 'CAPITAO': {
      titulo('O Capitão');
      surge(entre(t, 0.3, 0.8), () => {
        boneco(pin, 'FRENTE_PARADO', uniforme('ONC', 'ZAG', 'capitao'), COLUNAS / 2 - 30, 84, 5);
        // Faixa de capitão no braço.
        pin.r(COLUNAS / 2 + 18, 84 + 7 * 5, 12, 9, COR.contorno);
        pin.r(COLUNAS / 2 + 19, 84 + 7 * 5 + 1, 10, 7, COR.amarelo);
        pin.texto('C', COLUNAS / 2 + 24, 84 + 7 * 5 + 5, 9, display, COR.contorno);
      });
      surge(entre(t, 1.2, 1.6), () => item(184, 52, 'Mais Partidas pelo Time', 'Quem jogou mais vezes leva a faixa', (cx, cy) => {
        pin.r(cx - 10, cy - 8, 20, 16, COR.contorno);
        pin.r(cx - 9, cy - 7, 18, 14, COR.amarelo);
        pin.texto('C', cx, cy, 14, display, COR.contorno);
      }));
      surge(entre(t, 2.6, 3.0), () => item(246, 52, 'Com Vínculo no site', 'Sem Vínculo ou suspenso, a faixa passa', (cx, cy) => {
        pin.r(cx - 7, cy - 12, 14, 24, COR.contorno);
        pin.r(cx - 6, cy - 11, 12, 20, '#8FD3FF');
      }));
      surge(entre(t, 4.0, 4.4), () => item(308, 52, 'Escolhe pelo site', 'Postura e Formação, até o Corte', (cx, cy) => {
        pin.r(cx - 9, cy - 9, 18, 18, COR.contorno);
        pin.r(cx - 8, cy - 8, 16, 16, VERDE);
        pin.r(cx - 5, cy - 1, 3, 3, COR.contorno);
        pin.r(cx - 2, cy + 1, 3, 3, COR.contorno);
        pin.r(cx + 1, cy - 2, 3, 3, COR.contorno);
        pin.r(cx + 4, cy - 5, 3, 3, COR.contorno);
      }));
      break;
    }
    case 'POSTURA': {
      titulo('Postura');
      const opcoes: [string, string, string][] = [
        ['Ofensiva', 'Ataca mais e se expõe mais', '#D9534F'],
        ['Equilibrada', 'Sem mudar nada (sem escolha, é ela)', DOURADO],
        ['Defensiva', 'Se fecha atrás e ataca menos', '#5B8FD9'],
      ];
      opcoes.forEach(([nome, apoio, cor], k) => surge(entre(t, 0.4 + k * 0.9, 0.8 + k * 0.9), () => item(86 + k * 78, 66, nome, apoio, (cx, cy) => {
        // Seta: para cima (ataca), dupla (equilíbrio), para baixo (defende).
        pin.r(cx - 12, cy - 12, 24, 24, COR.contorno);
        pin.r(cx - 11, cy - 11, 22, 22, cor);
        const dir = k === 0 ? -1 : k === 2 ? 1 : 0;
        if (dir === 0) {
          pin.r(cx - 7, cy - 4, 14, 3, COR.contorno);
          pin.r(cx - 7, cy + 2, 14, 3, COR.contorno);
        } else {
          // Ponta em cima (ataca) ou embaixo (defende).
          const ponta = dir < 0 ? cy - 8 : cy + 7;
          for (let s = 0; s < 5; s++) pin.r(cx - s, ponta - dir * s, 1 + 2 * s, 1, COR.contorno);
          pin.r(cx - 2, dir < 0 ? cy - 3 : cy - 5, 4, 8, COR.contorno);
        }
      })));
      surge(entre(t, 3.4, 3.8), () => {
        pin.r(70, 334, 130, 34, COR.contorno);
        pin.r(71, 335, 128, 32, '#2B2B2B');
        pin.texto('Em segredo', COLUNAS / 2, 351, 20, display, COR.amarelo);
      });
      surge(entre(t, 3.8, 4.2), () => linha('O rival só descobre no Apito Inicial', 392, 12, VERDE));
      break;
    }
    case 'FORMACAO': {
      titulo('Formação');
      const formacoes: [string, number[], string | null][] = [
        ['2-2-2', [2, 2, 2], null],
        ['2-3-1', [2, 3, 1], 'Tabela'],
        ['3-2-1', [3, 2, 1], 'Cobertura'],
        ['3-1-2', [3, 1, 2], 'Ligação direta'],
      ];
      formacoes.forEach(([nome, linhas, jogada], k) => {
        const x = 16 + (k % 2) * 122;
        const y = 76 + Math.floor(k / 2) * 158;
        surge(entre(t, 0.5 + k * 0.6, 0.9 + k * 0.6), () => {
          pin.tabua(x, y, 116, 150);
          // Mini campo: goleiro embaixo, ataque em cima.
          const cx = x + 58;
          pin.r(x + 10, y + 10, 96, 104, COR.contorno);
          pin.r(x + 11, y + 11, 94, 102, COR.grama);
          pin.r(x + 11, y + 61, 94, 1, COR.cal);
          pin.r(cx - 16, y + 102, 32, 11, COR.gramaFaixa);
          const ponto = (px: number, py: number, cor: string) => {
            pin.r(px - 4, py - 4, 8, 8, COR.contorno);
            pin.r(px - 3, py - 3, 6, 6, cor);
          };
          ponto(cx, y + 104, '#2B2B2B');
          const ys = [y + 86, y + 60, y + 32];
          const cores = ['#5B8FD9', VERDE, '#D9534F'];
          linhas.forEach((n, l) => {
            for (let i = 0; i < n; i++) ponto(cx + (i - (n - 1) / 2) * 26, ys[l]! + (n === 3 && i === 1 && l === 0 ? 5 : 0), cores[l]!);
          });
          pin.texto(nome, cx, y + 126, 22, display, COR.amarelo, { contorno: COR.contorno });
          pin.texto(jogada ?? 'Padrão', cx, y + 142, pin.caber(jogada ?? 'Padrão', 104, 11, texto, 700), texto, jogada ? VERDE : COR.placaSombra, { peso: 700 });
        }, 12);
      });
      surge(entre(t, 3.4, 3.8), () => linha('As vagas da Escalação seguem a Formação', 404, 12, VERDE));
      break;
    }

    // ------------------------------------------ Seu Jogador
    case 'VINCULO': {
      titulo('Vínculo');
      const s = celular(70, 82, 130, 220);
      surge(entre(t, 0.4, 0.8), () => {
        pin.texto('Seu código', s.x + s.w / 2, s.y + 26, 16, display, COR.tinta);
        pin.r(s.x + 14, s.y + 42, s.w - 28, 34, COR.contorno);
        pin.r(s.x + 15, s.y + 43, s.w - 30, 32, '#FFFFFF');
        pin.texto('7K2Q', s.x + s.w / 2, s.y + 60, 26, display, COR.tinta);
      });
      surge(entre(t, 1.4, 1.8), () => {
        pin.r(s.x + 10, s.y + 96, s.w - 20, 1, COR.placaSombra);
        pin.texto('Mande na DM', s.x + s.w / 2, s.y + 112, 13, texto, COR.tinta, { peso: 700 });
        pin.texto('da Liga', s.x + s.w / 2, s.y + 128, 13, texto, COR.tinta, { peso: 700 });
      });
      surge(entre(t, 2.6, 3.0), () => {
        pin.r(s.x + 14, s.y + 150, s.w - 28, 28, '#2E7D32');
        pin.texto('Vinculado', s.x + s.w / 2, s.y + 164, 13, texto, '#FFFFFF', { peso: 700 });
      });
      surge(entre(t, 3.2, 3.6), () => linha('Cuide do seu Jogador pelo celular', 338, 13, VERDE));
      break;
    }
    case 'APELIDO': {
      titulo('Apelido');
      surge(entre(t, 0.3, 0.8), () => {
        // O boneco com o apelido em cima, como no jogo.
        const nome = 'Bruninho';
        pin.texto(nome, COLUNAS / 2, 96, 20, texto, '#FFFFFF', { contorno: COR.contorno, peso: 700 });
        boneco(pin, corre(0), uniforme('ONC', 'ATA', 'apelido'), COLUNAS / 2 - 27, 110, 4.5);
      });
      surge(entre(t, 1.5, 1.9), () => {
        pin.tabua(20, 210, 230, 74);
        linha('"Bruninho, atacante da Onça,', 236, 13, COR.placa, 210);
        linha('arranca pela esquerda!"', 258, 13, COR.placa, 210);
      });
      surge(entre(t, 2.4, 2.8), () => linha('Em cima do boneco e na voz do Narrador', 312, 12, VERDE));
      break;
    }
    case 'ESPECIALIZACAO': {
      titulo('Especialização');
      const pos: [Posicao, string][] = [['ATA', 'Atacante'], ['MEI', 'Meia'], ['ZAG', 'Zagueiro'], ['GOL', 'Goleiro']];
      pos.forEach(([p, nome], k) => {
        const y = 80 + k * 76;
        surge(entre(t, 0.4 + k * 0.6, 0.8 + k * 0.6), () => {
          pin.tabua(14, y, 242, 68);
          boneco(pin, 'FRENTE_PARADO', uniforme('CAP', p, `esp-${k}`), 22, y + 12, 2.6);
          pin.texto(nome, 62, y + 16, 16, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          (ESPECIALIZACOES[p] as readonly string[]).forEach((e, i) => {
            const nomeE = NOME_DA_ESPECIALIZACAO[e as keyof typeof NOME_DA_ESPECIALIZACAO];
            pin.texto(nomeE, 62 + i * 64, y + 44, pin.caber(nomeE, 60, 11, texto, 700), texto, COR.placa, { alinhar: 'left', peso: 700 });
          });
        }, 12);
      });
      surge(entre(t, 3.4, 3.8), () => linha('Melhora uma coisa, piora outra', 404, 13, VERDE));
      break;
    }
    case 'TREINO': {
      titulo('Treino');
      const habs: [string, number, boolean][] = [[NOME_DA_HABILIDADE.FIN, 62, true], [NOME_DA_HABILIDADE.DRI, 55, false], [NOME_DA_HABILIDADE.PAS, 48, false]];
      habs.forEach(([nome, base, foco], k) => {
        const y = 96 + k * 64;
        surge(entre(t, 0.3 + k * 0.3, 0.7 + k * 0.3), () => {
          pin.tabua(14, y, 242, 54);
          pin.texto(nome, 28, y + 18, 16, display, foco ? COR.amarelo : COR.placa, { alinhar: 'left', contorno: COR.contorno });
          const sobe = foco ? 14 * entre(t, 1.6, 3.6) : 4 * entre(t, 1.6, 3.6);
          const v = Math.round(base + sobe);
          const w = 200;
          pin.r(27, y + 33, w + 2, 9, COR.contorno);
          pin.r(28, y + 34, w, 7, COR.placaSombra);
          pin.r(28, y + 34, Math.round((w * v) / 100), 7, foco ? VERDE : '#C9A46A');
          pin.texto(String(v), 238, y + 38, 13, display, '#FFFFFF', { contorno: COR.contorno });
          if (foco) {
            pin.r(204, y + 10, 40, 14, COR.amarelo);
            pin.texto('FOCO', 224, y + 17, 13, display, COR.contorno);
          }
        }, 10);
      });
      surge(entre(t, 2.4, 2.8), () => linha('O foco sobe mais rápido', 316, 14, VERDE));
      break;
    }
    case 'PRESENCA': {
      titulo('Presença');
      surge(entre(t, 0.3, 0.7), () => {
        // Comentário no post.
        pin.r(20, 88, 230, 50, COR.contorno);
        pin.r(21, 89, 228, 48, '#FFFFFF');
        pin.r(30, 99, 26, 26, '#C9A46A');
        pin.texto('seu_jogador', 64, 104, 11, texto, '#6B6B6B', { alinhar: 'left', peso: 700 });
        pin.texto('CONFIRMO', 64, 123, 18, display, COR.tinta, { alinhar: 'left' });
      });
      surge(entre(t, 1.4, 1.8), () => linha('ou "Confirmar presença" no site', 158, 12, COR.placa));
      // A fila do rodízio: o boneco que confirmou passa na frente.
      surge(entre(t, 2.2, 2.6), () => {
        pin.tabua(14, 184, 242, 128);
        linha('Rodízio da Escalação', 202, 13, COR.amarelo);
        const f = entre(t, 3.0, 4.2);
        for (let k = 0; k < 5; k++) {
          const eu = k === 4;
          const pos = eu ? 4 - 3 * f : k >= 1 ? k + (k >= 1 ? f : 0) : k;
          const x = 34 + pos * 42;
          boneco(pin, eu ? corre(0) : 'FRENTE_PARADO', uniforme('JAC', 'MEI', eu ? 'presenca-eu' : `presenca-${k}`), x, 230, 2.6);
          if (eu) {
            pin.r(x + 6, 220, 20, 8, '#2E7D32');
            for (let c = 0; c < 3; c++) pin.r(x + 11 + c, 223 + c, 1, 1, '#FFFFFF');
            for (let c = 0; c < 5; c++) pin.r(x + 14 + c, 225 - c, 1, 1, '#FFFFFF');
          }
        }
        linha('Logo depois do Craque', 296, 11, VERDE);
      });
      break;
    }
    case 'RESENHA': {
      titulo('Resenha');
      surge(entre(t, 0.3, 0.7), () => {
        pin.r(20, 88, 230, 50, COR.contorno);
        pin.r(21, 89, 228, 48, '#FFFFFF');
        pin.r(30, 99, 26, 26, '#C9A46A');
        pin.texto('seu_jogador', 64, 104, 11, texto, '#6B6B6B', { alinhar: 'left', peso: 700 });
        pin.texto('Semana que vem tem mais!', 64, 123, pin.caber('Semana que vem tem mais!', 176, 13, texto, 700), texto, COR.tinta, { alinhar: 'left', peso: 700 });
      });
      surge(entre(t, 1.0, 1.4), () => linha('no Reels do último jogo do seu Time', 158, 12, COR.placa));
      surge(entre(t, 2.0, 2.4), () => item(184, 60, 'Habilidades 50% mais rápido', 'na próxima Partida em que jogar', (cx, cy) => {
        for (let s = 0; s < 6; s++) pin.r(cx - s, cy - 8 + s, 1 + 2 * s, 1, VERDE);
        pin.r(cx - 3, cy - 2, 6, 10, VERDE);
      }));
      surge(entre(t, 3.6, 4.0), () => item(254, 60, 'No Clássico, passa na frente', 'no rodízio, junto com a Presença', (cx, cy) => {
        pin.r(cx - 10, cy - 8, 20, 16, COR.contorno);
        pin.r(cx - 9, cy - 7, 18, 14, '#D9534F');
        pin.texto('×', cx, cy, 14, display, '#FFFFFF');
      }));
      break;
    }
    case 'SELECAO': {
      titulo('Seleção da Rodada');
      const sel: [Posicao, string, string, TimeId, string][] = [
        ['GOL', 'Muralha', 'Goleiro', 'TAT', '8,9'],
        ['ZAG', 'Carrapato', 'Zagueiro', 'CAP', '8,4'],
        ['MEI', 'Garçom', 'Meia', 'JAC', '9,1'],
        ['ATA', 'Matador', 'Atacante', 'ONC', '9,6'],
      ];
      sel.forEach(([p, nome, posicao, time, nota], k) => {
        const y = 80 + k * 74;
        surge(entre(t, 0.4 + k * 0.6, 0.8 + k * 0.6), () => {
          pin.tabua(14, y, 242, 66);
          boneco(pin, 'FRENTE_COMEMORA', uniforme(time, p, `sel-${k}`), 24, y + 10, 2.7);
          pin.texto(nome, 64, y + 24, 22, display, COR.amarelo, { alinhar: 'left', contorno: COR.contorno });
          pin.texto(posicao, 64, y + 46, 12, texto, COR.placa, { alinhar: 'left', peso: 700 });
          desenharEscudo(pin, time, 168, y + 21, 1);
          pin.r(198, y + 20, 46, 26, COR.contorno);
          pin.texto(nota, 221, y + 33, 20, display, '#FFFFFF');
        }, 12);
      });
      surge(entre(t, 3.2, 3.6), () => linha('A maior Nota de cada Posição · vira troféu', 392, 12, VERDE));
      break;
    }

    // ------------------------------------------ Site e App
    case 'APP': {
      titulo('O App');
      const s = celular(60, 80, 150, 270);
      // Tela inicial do celular, com o ícone do Varzeão aparecendo.
      pin.r(s.x, s.y, s.w, s.h, '#2E4A6B');
      const icones = ['#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8', '#4DB6AC', '#FF8A65'];
      for (let k = 0; k < 8; k++) {
        const x = s.x + 12 + (k % 4) * 34;
        const y = s.y + 14 + Math.floor(k / 4) * 44;
        if (k === 5) {
          surge(entre(t, 1.0, 1.5), () => {
            const pulso = 1 + 0.08 * Math.sin(t * 6) * entre(t, 1.5, 2);
            escudoLiga(x + 12, y + 12, 24 * pulso);
            pin.texto('Varzeão', x + 12, y + 32, 8, texto, '#FFFFFF', { peso: 700 });
          }, 0);
        } else {
          pin.r(x, y, 24, 24, icones[k % icones.length]!);
        }
      }
      surge(entre(t, 2.0, 2.4), () => {
        pin.tabua(20, 362, 230, 60);
        linha('Ícone na tela inicial e tela cheia', 380, 12);
        linha('É o mesmo site, sem loja', 402, 12, VERDE);
      });
      break;
    }
    case 'AVISOS': {
      titulo('Avisos');
      const s = celular(50, 76, 170, 300);
      pin.r(s.x, s.y, s.w, s.h, '#2E4A6B');
      pin.texto('15:58', s.x + s.w / 2, s.y + 26, 26, display, '#FFFFFF');
      const avisos: [string, string, number][] = [
        ['Saiu a Escalação', 'Onça × Jacaré, às 16h. Veja quem entra.', 0.6],
        ['Daqui a 5 min: Onça × Jacaré', 'Abra o App para ver o Ao Vivo.', 1.6],
        ['GOL da Onça!', 'Onça 1 × 0 Jacaré', 2.6],
        ['Fim de jogo', 'Onça 2 × 1 Jacaré', 3.6],
      ];
      avisos.forEach(([tit, sub, de], k) => {
        surge(entre(t, de, de + 0.35), () => {
          const y = s.y + 50 + k * 56;
          pin.r(s.x + 6, y, s.w - 12, 48, 'rgba(255,255,255,0.92)');
          escudoLiga(s.x + 22, y + 24, 20);
          pin.texto(tit, s.x + 38, y + 17, pin.caber(tit, s.w - 50, 12, texto, 700), texto, COR.tinta, { alinhar: 'left', peso: 700 });
          pin.texto(sub, s.x + 38, y + 33, pin.caber(sub, s.w - 50, 10, texto, 500), texto, '#555555', { alinhar: 'left', peso: 500 });
        }, -10);
      });
      surge(entre(t, 4.4, 4.8), () => linha('Você escolhe os Times', 404, 14, VERDE));
      break;
    }
    case 'AO_VIVO': {
      titulo('Ao Vivo');
      const s = celular(45, 74, 180, 320);
      // O jogo de verdade, numa Partida de exemplo, dentro do celular.
      const tl = timelinesDe(roteiro)[0];
      if (tl && typeof OffscreenCanvas !== 'undefined') {
        const off = new OffscreenCanvas(COLUNAS * 2, LINHAS * 2);
        const octx = off.getContext('2d')!;
        desenharQuadro(octx as unknown as CanvasRenderingContext2D, tl.estado(30 * 60 + t * 20), opcoesDoJogo(d.partidas[0]!, o));
        const h = (s.w * LINHAS) / COLUNAS;
        pin.ctx.save();
        pin.ctx.beginPath();
        pin.ctx.rect(s.x * pin.px, s.y * pin.px, s.w * pin.px, s.h * pin.px);
        pin.ctx.clip();
        pin.ctx.imageSmoothingEnabled = true;
        pin.ctx.drawImage(off, s.x * pin.px, (s.y + 18) * pin.px, s.w * pin.px, h * pin.px);
        pin.ctx.restore();
        pin.ctx.imageSmoothingEnabled = false;
      }
      // Faixa do Público.
      pin.r(s.x, s.y, s.w, 18, '#1E1E1E');
      pin.r(s.x + 8, s.y + 6, 6, 6, '#E53935');
      const publico = Math.round(37 + 12 * entre(t, 0.5, 4));
      pin.texto(`AO VIVO · ${publico} assistindo`, s.x + 20, s.y + 9, 10, texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
      // Reações subindo.
      const emojis = o.emojis ?? [];
      for (let k = 0; k < 14; k++) {
        const nasce = 1.0 + k * 0.32;
        const vida = t - nasce;
        if (vida < 0 || vida > 2.2) continue;
        const img = emojis[k % Math.max(1, emojis.length)];
        const x = s.x + 20 + ((k * 53) % (s.w - 40));
        const y = s.y + s.h - 20 - vida * 90;
        pin.ctx.globalAlpha = Math.min(1, (2.2 - vida) / 0.5);
        if (img) {
          pin.ctx.imageSmoothingEnabled = true;
          pin.ctx.drawImage(img, (x - 9) * pin.px, (y - 9) * pin.px, 18 * pin.px, 18 * pin.px);
          pin.ctx.imageSmoothingEnabled = false;
        } else pin.r(x - 6, y - 6, 12, 12, COR.amarelo);
        pin.ctx.globalAlpha = 1;
      }
      surge(entre(t, 2.4, 2.8), () => {
        pin.tabua(20, 402, 230, 50);
        linha('Público e Reações', 418, 14, COR.amarelo);
        const nomes = ['Gol', 'Fogo', 'Susto', 'Palmas'];
        nomes.forEach((n, k) => {
          const x = 40 + k * 56;
          const img = emojis[k];
          if (img) {
            pin.ctx.imageSmoothingEnabled = true;
            pin.ctx.drawImage(img, x * pin.px, 431 * pin.px, 12 * pin.px, 12 * pin.px);
            pin.ctx.imageSmoothingEnabled = false;
          }
          pin.texto(n, x + 15, 438, 10, texto, COR.placa, { alinhar: 'left', peso: 700 });
        });
      });
      break;
    }
    case 'CARREIRA': {
      titulo('Carreira');
      const s = celular(40, 74, 190, 320);
      const cx = s.x + s.w / 2;
      surge(entre(t, 0.3, 0.7), () => {
        boneco(pin, 'FRENTE_PARADO', uniforme('ONC', 'ATA', 'carreira'), s.x + 10, s.y + 10, 3);
        pin.texto('Bruninho', s.x + 52, s.y + 22, 18, display, COR.tinta, { alinhar: 'left' });
        pin.texto('Atacante · Onça', s.x + 52, s.y + 40, 11, texto, '#6B5A3E', { alinhar: 'left', peso: 700 });
      });
      const temporadas: [string, string, string, string][] = [
        ['Temporada 1', 'Onça · 7 jogos · 5 gols', 'OVR 64 → 68', 'Selo T1'],
        ['Temporada 2', 'Onça · Série A', 'OVR 68 → ...', ''],
      ];
      temporadas.forEach(([nome, linha1, ovr, extra], k) => {
        surge(entre(t, 1.2 + k * 0.9, 1.6 + k * 0.9), () => {
          const y = s.y + 70 + k * 74;
          pin.r(s.x + 8, y, s.w - 16, 66, '#FFFFFF');
          pin.r(s.x + 8, y, 4, 66, COR.amarelo);
          pin.texto(nome, s.x + 20, y + 14, 15, display, COR.tinta, { alinhar: 'left' });
          pin.texto(linha1, s.x + 20, y + 32, pin.caber(linha1, s.w - 40, 10, texto, 700), texto, '#444444', { alinhar: 'left', peso: 700 });
          pin.texto(ovr, s.x + 20, y + 50, 10, texto, '#2E7D32', { alinhar: 'left', peso: 700 });
          if (extra) {
            pin.placa(s.x + s.w - 68, y + 40, 54, 18, { fundo: '#5B3A1E', luz: DOURADO, sombra: '#3A2410', degrau: 2 });
            pin.texto('Selo T1', s.x + s.w - 41, y + 49, 10, texto, DOURADO, { peso: 700 });
          }
        }, 8);
      });
      surge(entre(t, 3.2, 3.6), () => {
        const y = s.y + 226;
        pin.texto('Troféus', s.x + 14, y, 14, display, COR.tinta, { alinhar: 'left' });
        const trofeus = ['Matador', 'Craque', 'Fundador'];
        trofeus.forEach((tr, k) => {
          const x = s.x + 14 + k * 54;
          pin.r(x, y + 12, 48, 22, COR.contorno);
          pin.r(x + 1, y + 13, 46, 20, DOURADO);
          pin.texto(tr, x + 24, y + 23, pin.caber(tr, 42, 9, texto, 700), texto, COR.contorno, { peso: 700 });
        });
      });
      void cx;
      surge(entre(t, 4.2, 4.6), () => linha('Temporada por Temporada', 412, 14, VERDE));
      break;
    }
  }
  escurecer(ctx, q.escurecer);
}

function escurecer(ctx: CanvasRenderingContext2D, alfa: number): void {
  if (alfa <= 0) return;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
