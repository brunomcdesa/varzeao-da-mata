/**
 * Reels do Resumo da Rodada (19h): placares, tabela, Novos Contratados, Candidatos a Craque
 * e a chamada para votar e jogar. Sequência de cartelas no mesmo estilo de várzea dos lances,
 * narrada pelo Locutor da Liga; cada cartela estica até a sua fala caber inteira.
 */
import { desenharCompartilhe } from './anuncio.js';
import { FALA_DO_TIME, IDENTIDADE, doTime, nomeDaRodada, type Posicao, type TimeId, type Aparencia } from '@liga/shared';
import { cenario } from './cenario.js';
import { FONTE_DISPLAY, FONTE_TEXTO, desenharEscudo, plaquinha } from './desenho.js';
import { apelidoFalavel, type Fala } from './narracao.js';
import { COLUNAS, COR, LINHAS, Pincel, contraste } from './pixel.js';
import type { Segmento } from './roteiro.js';
import { aparencia, sprite } from './sprites.js';
import { desenharEscudoDaLiga, veu } from './video.js';

export interface DadosDoResumo {
  temporada: number;
  rodada: number;
  fase: 'LIGA' | 'MATA_MATA';
  placares: { mandante: TimeId; visitante: TimeId; golsMandante: number; golsVisitante: number; penaltis: { mandante: number; visitante: number } | null; hora: number }[];
  tabela: { time: TimeId; jogos: number; pontos: number; vitorias: number; saldo: number }[];
  novosContratados: { username: string; time: TimeId; posicao: Posicao }[];
  totalNovos: number;
  /** `numero`: o que se comenta para votar (ADR-0011). */
  candidatos: { numero?: number; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number; gols: number }[];
  /** Resumo da Final: o Time campeão ganha uma cartela própria. */
  campeao?: TimeId;
  /** Na Final os Candidatos são da Temporada inteira (nota = nota média). */
  votacao?: 'RODADA' | 'TEMPORADA';
  /**
   * Resumo da Temporada (o dia seguinte à Final): campeão, Craque eleito, artilheiro, melhor
   * goleiro e quando começa a próxima. Junto com `craqueDaTemporada`.
   */
  fimDaTemporada?: {
    artilheiro?: { username: string; apelido?: string | null; time: TimeId; posicao: Posicao; gols: number };
    goleiro?: { username: string; time: TimeId; notaMedia: number };
    proxima?: { numero: number; inicio: string };
  };
  /** Anúncio do Craque da Temporada (o dia seguinte à Final): só essa cartela e a chamada. */
  craqueDaTemporada?: { username: string; apelido?: string | null; time: TimeId; posicao: Posicao; notaMedia: number; gols: number; jogos: number; votos: number };
  /** Craque da Rodada anterior: a votação fechou no Corte do primeiro jogo e o anúncio abre o Resumo. */
  craqueDaRodada?: { rodada: number; fase: 'LIGA' | 'MATA_MATA'; username: string; apelido?: string | null; time: TimeId; posicao: Posicao; nota: number; gols: number; votos: number };
  /** Aparências escolhidas pelos donos (ADR-0013), pelo @. */
  aparencias?: Record<string, Aparencia>;
}

export type Cartela = 'ABERTURA' | 'PLACARES' | 'CAMPEAO' | 'TABELA' | 'NOVOS' | 'CANDIDATOS' | 'CRAQUE' | 'DESTAQUES' | 'CHAMADA' | 'COMPARTILHE';

/** Segmento do Roteiro com a cartela que ele mostra (tipo 'ABERTURA' = trilha cheia na mixagem). */
export type SegmentoResumo = Segmento & { cartela: Cartela };

const DURACAO_BASE: Record<Cartela, number> = { ABERTURA: 3, PLACARES: 5, CAMPEAO: 6, TABELA: 6, NOVOS: 4, CANDIDATOS: 7, CRAQUE: 7, DESTAQUES: 6, CHAMADA: 5, COMPARTILHE: 6 };
const CORTE = 0.3;

export class RoteiroResumo {
  readonly segmentos: SegmentoResumo[];
  readonly duracao: number;

  constructor(
    readonly dados: DadosDoResumo,
    minimos: Record<number, { antes?: number }> = {},
  ) {
    const cartelas: Cartela[] = ['ABERTURA'];
    if (dados.craqueDaTemporada || dados.fimDaTemporada) {
      // Resumo da Temporada: campeão, Craque eleito, artilheiro e goleiro.
      if (dados.fimDaTemporada && dados.campeao) cartelas.push('CAMPEAO');
      if (dados.craqueDaTemporada) cartelas.push('CRAQUE');
      if (dados.fimDaTemporada?.artilheiro || dados.fimDaTemporada?.goleiro) cartelas.push('DESTAQUES');
    }
    else {
      if (dados.craqueDaRodada) cartelas.push('CRAQUE');
      if (dados.placares.length) cartelas.push('PLACARES');
      if (dados.campeao) cartelas.push('CAMPEAO');
      if (dados.fase === 'LIGA') cartelas.push('TABELA');
      if (dados.totalNovos > 0) cartelas.push('NOVOS');
      if (dados.candidatos.length) cartelas.push('CANDIDATOS');
    }
    cartelas.push('CHAMADA', 'COMPARTILHE');
    let cursor = 0;
    this.segmentos = cartelas.map((cartela, i) => {
      const inicio = cursor;
      cursor += Math.max(DURACAO_BASE[cartela], minimos[i]?.antes ?? 0);
      return { tipo: 'ABERTURA', cartela, inicio, fim: cursor };
    });
    this.duracao = cursor;
  }

  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  em(tBruto: number): { segmento: SegmentoResumo; indice: number; progresso: number; tempo: number; escurecer: number } {
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

const POSICAO_FALADA: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };
const curto = (t: TimeId) => FALA_DO_TIME[t].curto;
/** "da Rodada 3", "das Semifinais". */
const daRodada = (r: { fase: 'LIGA' | 'MATA_MATA'; rodada: number }) => {
  const n = nomeDaRodada(r.fase, r.rodada);
  return n.startsWith('Rodada') ? `da ${n}` : n === 'Semifinais' ? 'das Semifinais' : `da ${n}`;
};

export function narracaoDoResumo(roteiro: RoteiroResumo): Fala[] {
  const d = roteiro.dados;
  const falas: Fala[] = [];
  roteiro.segmentos.forEach((s, i) => {
    let texto = '';
    switch (s.cartela) {
      case 'ABERTURA':
        texto = d.fimDaTemporada
          ? `Acabou a Temporada ${d.temporada} do Varzeão da Mata! Bora pro resumo!`
          : d.craqueDaTemporada
          ? `Chegou a hora! Quem é o Craque da Temporada ${d.temporada} do Varzeão da Mata?`
          : d.campeao
            ? 'Acabou a Final do Varzeão da Mata!'
            : d.fase === 'LIGA'
              ? `Fim da Rodada ${d.rodada} no Varzeão da Mata! Bora pro resumo!`
              : 'Fim do dia de mata-mata no Varzeão da Mata!';
        break;
      case 'CAMPEAO':
        texto = `${artigo(d.campeao!, true)} ${curto(d.campeao!)} é campeão da Temporada ${d.temporada}! ${FALA_DO_TIME[d.campeao!].bordao}`;
        break;
      case 'CRAQUE': {
        if (!d.craqueDaTemporada) {
          const c = d.craqueDaRodada!;
          const quem = apelidoFalavel(c.apelido) ? `${apelidoFalavel(c.apelido)}, ${POSICAO_FALADA[c.posicao]} ${doTime(c.time)}` : `o ${POSICAO_FALADA[c.posicao]} ${doTime(c.time)}`;
          texto = c.votos > 0
            ? `O Craque ${daRodada(c)}, eleito pela torcida com ${c.votos} ${c.votos === 1 ? 'voto' : 'votos'}, é ${quem}!`
            : `Ninguém votou, então o Craque ${daRodada(c)} ficou com a maior nota: ${quem}!`;
          break;
        }
        const c = d.craqueDaTemporada!;
        texto = `Com ${c.votos} ${c.votos === 1 ? 'voto' : 'votos'} da torcida, o Craque da Temporada é ${apelidoFalavel(c.apelido) ? `${apelidoFalavel(c.apelido)}, ${POSICAO_FALADA[c.posicao]} ${doTime(c.time)}` : `o ${POSICAO_FALADA[c.posicao]} ${doTime(c.time)}`}! Nota média ${c.notaMedia.toFixed(1).replace('.', ',')}.`;
        break;
      }
      case 'DESTAQUES': {
        const f = d.fimDaTemporada!;
        const partes: string[] = [];
        if (f.artilheiro) partes.push(`O artilheiro foi ${apelidoFalavel(f.artilheiro.apelido) ?? `o ${POSICAO_FALADA[f.artilheiro.posicao]} ${doTime(f.artilheiro.time)}`}, com ${f.artilheiro.gols} ${f.artilheiro.gols === 1 ? 'gol' : 'gols'}.`);
        if (f.goleiro) partes.push(`E o melhor goleiro foi o ${doTime(f.goleiro.time)}, nota média ${f.goleiro.notaMedia.toFixed(1).replace('.', ',')}.`);
        texto = partes.join(' ');
        break;
      }
      case 'PLACARES':
        texto =
          d.placares
            .map((p) => {
              const [a, b, ga, gb] = p.golsMandante >= p.golsVisitante ? [p.mandante, p.visitante, p.golsMandante, p.golsVisitante] : [p.visitante, p.mandante, p.golsVisitante, p.golsMandante];
              if (ga === gb) return p.penaltis ? `${curto(a)} e ${curto(b)} empataram, e a decisão foi nos pênaltis` : `${curto(a)} e ${curto(b)} empataram em ${ga} a ${gb}`;
              return `${curto(a)} venceu ${artigo(b)} ${curto(b)} por ${ga} a ${gb}`;
            })
            .join('. ') + '.';
        break;
      case 'TABELA': {
        const l1 = d.tabela[0]!;
        const ponta = d.tabela.filter((l) => l.pontos === l1.pontos).map((l) => curto(l.time));
        const lista = ponta.length > 1 ? `${ponta.slice(0, -1).join(', ')} e ${ponta[ponta.length - 1]}` : '';
        texto =
          ponta.length === d.tabela.length
            ? `Na tabela, tudo igual: todo mundo com ${l1.pontos} ${l1.pontos === 1 ? 'ponto' : 'pontos'}.`
            : ponta.length > 1
              ? `Na tabela, ${lista} dividem a ponta com ${l1.pontos} pontos.`
              : `Na tabela, ${artigo(l1.time)} ${curto(l1.time)} lidera com ${l1.pontos} ${l1.pontos === 1 ? 'ponto' : 'pontos'}.`;
        break;
      }
      case 'NOVOS':
        texto = d.totalNovos === 1 ? 'Chegou um novo contratado na Liga. Seja bem-vindo!' : `Chegaram ${d.totalNovos} novos contratados na Liga. Sejam bem-vindos!`;
        break;
      case 'CANDIDATOS': {
        const [melhor] = d.candidatos;
        texto = `Esses são os candidatos a Craque ${d.votacao === 'TEMPORADA' ? 'da Temporada, os melhores do campeonato' : 'da Rodada'}.${melhor ? ` A maior nota foi ${apelidoFalavel(melhor.apelido) ? `de ${apelidoFalavel(melhor.apelido)}` : `do ${POSICAO_FALADA[melhor.posicao]} ${doTime(melhor.time)}`}.` : ''}`;
        break;
      }
      case 'CHAMADA':
        texto = d.fimDaTemporada?.proxima
          ? `A Temporada ${d.fimDaTemporada.proxima.numero} começa ${diaFalado(d.fimDaTemporada.proxima.inicio)}. Quer jogar? Comente ENTRO, o time e a posição!`
          : d.candidatos.length
          ? `Vote no seu Craque${d.votacao === 'TEMPORADA' ? ' da Temporada' : ''} comentando só o número dele, ou pelo site.${d.votacao === 'TEMPORADA' ? ' O resultado sai amanhã às sete da noite!' : ''}`
          : 'A próxima Temporada vem aí. Quer jogar? Comente ENTRO, o time e a posição!';
        break;
      case 'COMPARTILHE':
        texto = 'Curtiu? Compartilha com a galera e chama mais gente pro Varzeão! Pra entrar, é só comentar ENTRO, o time e a posição.';
        break;
    }
    falas.push({ id: `resumo-${i}`, texto, inicio: s.inicio + 0.35, limite: s.fim, tom: s.cartela === 'ABERTURA' ? 'animado' : 'normal', segmento: i, parte: 'antes' });
  });
  return falas;
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "no domingo, dia 8" / "na segunda, dia 16". */
function diaFalado(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dia = DIAS_DA_SEMANA[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!;
  return `${dia === 'sábado' || dia === 'domingo' ? 'no' : 'na'} ${dia}, dia ${d}`;
}

/** "08/11". */
function diaCurto(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "a" / "o" (ou "A" / "O" no começo da frase). */
function artigo(t: TimeId, maiuscula = false): string {
  const a = FALA_DO_TIME[t].artigo;
  return maiuscula ? a.toUpperCase() : a;
}

// ---------------------------------------------------------------- desenho

export interface OpcoesResumo {
  fonteDisplay?: string;
  fonteTexto?: string;
  escudo?: CanvasImageSource;
}

const suave = (f: number) => f * f * (3 - 2 * f);
const entre = (f: number, a: number, b: number) => suave(Math.min(1, Math.max(0, (f - a) / (b - a))));

export function desenharQuadroResumo(ctx: CanvasRenderingContext2D, roteiro: RoteiroResumo, tVideo: number, o: OpcoesResumo = {}): void {
  const pin = new Pincel(ctx);
  const display = o.fonteDisplay ?? FONTE_DISPLAY;
  const texto = o.fonteTexto ?? FONTE_TEXTO;
  const q = roteiro.em(tVideo);
  const d = roteiro.dados;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cenario(), 0, 0, COLUNAS * pin.px, LINHAS * pin.px);
  veu(pin, 0.84);

  // Entrada escalonada dos itens: o item k aparece em `aparece(k)` segundos.
  const aparece = (k: number, passo = 0.35, atraso = 0.5) => entre(q.tempo, atraso + k * passo, atraso + k * passo + 0.35);
  const titulo = (t: string) => {
    pin.tabua(COLUNAS / 2 - 90, 34, 180, 34);
    pin.texto(t, COLUNAS / 2, 51, pin.caber(t, 160, 24, display), display, COR.amarelo, { contorno: COR.contorno });
  };

  switch (q.segmento.cartela) {
    case 'ABERTURA': {
      if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 150 - (1 - entre(q.tempo, 0, 0.6)) * 12, 120);
      pin.ctx.globalAlpha = entre(q.tempo, 0.3, 0.8);
      const [linha1, linha2] = d.fimDaTemporada ? ['Resumo da', `Temporada ${d.temporada}`] : d.craqueDaTemporada ? ['O Craque da', 'Temporada'] : ['Resumo da', nomeDaRodada(d.fase, d.rodada)];
      pin.texto(linha1, COLUNAS / 2, 245, 26, display, COR.placa, { contorno: COR.mata });
      pin.texto(linha2, COLUNAS / 2, 280, pin.caber(linha2, 230, 48, display), display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      if (!d.fimDaTemporada) pin.texto(`Temporada ${d.temporada}`, COLUNAS / 2, 314, 10, texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'PLACARES': {
      titulo('Placares');
      d.placares.forEach((p, k) => {
        const a = aparece(k);
        if (a <= 0) return;
        const y = 92 + k * 86;
        const dx = (1 - a) * -COLUNAS;
        pin.ctx.save();
        pin.ctx.translate(dx * pin.px, 0);
        pin.tabua(16, y, 238, 70);
        pin.texto(`${p.hora}h`, COLUNAS / 2, y + 12, 8, texto, COR.placaSombra, { peso: 600 });
        desenharEscudo(pin, p.mandante, 24, y + 20, 1.6);
        desenharEscudo(pin, p.visitante, 214, y + 20, 1.6);
        pin.texto(IDENTIDADE[p.mandante].sigla, 78, y + 40, 18, display, COR.placa);
        pin.texto(IDENTIDADE[p.visitante].sigla, 192, y + 40, 18, display, COR.placa);
        plaquinha(pin, 113, y + 24, 22, 28, String(p.golsMandante), display);
        plaquinha(pin, 157, y + 24, 22, 28, String(p.golsVisitante), display);
        pin.texto('x', COLUNAS / 2, y + 39, 12, display, COR.placa);
        if (p.penaltis) pin.texto(`pênaltis ${p.penaltis.mandante} x ${p.penaltis.visitante}`, COLUNAS / 2, y + 62, 7, texto, COR.amarelo, { peso: 600 });
        pin.ctx.restore();
      });
      break;
    }
    case 'TABELA': {
      titulo('Tabela');
      const x = 14;
      const w = 242;
      pin.tabua(x, 84, w, 360);
      const cab = 100;
      for (const [rotulo, cx] of [['P', 180], ['J', 204], ['V', 224], ['SG', 244]] as const) pin.texto(rotulo, cx, cab, 9, texto, COR.placaSombra, { peso: 700 });
      d.tabela.forEach((l, k) => {
        const a = aparece(k, 0.18, 0.4);
        if (a <= 0) return;
        const y = 112 + k * 40;
        pin.ctx.globalAlpha = a;
        const lider = k === 0;
        pin.placa(x + 6, y, w - 12, 34, { fundo: lider ? COR.amarelo : COR.madeiraEscura, sombra: lider ? '#C99500' : COR.contorno, degrau: 2 });
        const cor = lider ? COR.tinta : COR.placa;
        pin.texto(`${k + 1}`, x + 18, y + 18, 16, display, cor);
        desenharEscudo(pin, l.time, x + 30, y + 5, 1);
        pin.texto(curto(l.time), x + 56, y + 18, pin.caber(curto(l.time), 100, 16, display), display, cor, { alinhar: 'left' });
        pin.texto(String(l.pontos), 180, y + 18, 18, display, cor);
        pin.texto(String(l.jogos), 204, y + 18, 14, display, cor);
        pin.texto(String(l.vitorias), 224, y + 18, 14, display, cor);
        pin.texto(l.saldo > 0 ? `+${l.saldo}` : String(l.saldo), 244, y + 18, 14, display, cor);
        pin.ctx.globalAlpha = 1;
      });
      break;
    }
    case 'NOVOS': {
      titulo('Novos Contratados');
      pin.texto(d.totalNovos === 1 ? '1 jogador chegou à Liga' : `${d.totalNovos} jogadores chegaram à Liga`, COLUNAS / 2, 84, 10, texto, COR.placa, { peso: 600 });
      d.novosContratados.forEach((n, k) => {
        const a = aparece(k, 0.12, 0.4);
        if (a <= 0) return;
        const col = k % 2;
        const lin = Math.floor(k / 2);
        const x = 14 + col * 124;
        const y = 100 + lin * 46;
        pin.ctx.globalAlpha = a;
        pin.placa(x, y, 118, 38, { fundo: COR.madeira, luz: COR.madeiraLuz, sombra: COR.madeiraEscura, degrau: 2 });
        desenharEscudo(pin, n.time, x + 5, y + 7, 1);
        const nome = `@${n.username}`;
        pin.texto(nome, x + 30, y + 14, pin.caber(nome, 84, 8, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
        pin.texto(`${POSICAO_FALADA[n.posicao]}, ${curto(n.time)}`, x + 30, y + 27, 6.5, texto, COR.placaSombra, { alinhar: 'left', peso: 500 });
        pin.ctx.globalAlpha = 1;
      });
      if (d.totalNovos > d.novosContratados.length) {
        pin.texto(`e mais ${d.totalNovos - d.novosContratados.length}!`, COLUNAS / 2, 100 + Math.ceil(d.novosContratados.length / 2) * 46 + 10, 16, display, COR.amarelo, { contorno: COR.contorno });
      }
      break;
    }
    case 'CANDIDATOS': {
      titulo(d.votacao === 'TEMPORADA' ? 'Craque da Temporada?' : 'Candidatos a Craque');
      const fase = Math.floor(tVideo * 3);
      d.candidatos.forEach((c, k) => {
        const a = aparece(k, 0.45, 0.5);
        if (a <= 0) return;
        const y = 84 + k * 72;
        const dx = (1 - a) * COLUNAS;
        const id = IDENTIDADE[c.time];
        pin.ctx.save();
        pin.ctx.translate(dx * pin.px, 0);
        pin.tabua(12, y, 246, 64);
        // Figurinha: fundo claro, boneco do Jogador, escudo no canto.
        pin.placa(18, y + 6, 46, 52, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.r(21, y + 42, 40, 13, '#7FB069');
        const goleiro = c.posicao === 'GOL';
        const visual = {
          camisa: goleiro ? id.secundaria : id.primaria,
          detalhe: goleiro ? id.primaria : id.secundaria,
          calcao: goleiro ? '#2B2B2B' : id.secundaria,
          meiao: goleiro ? id.secundaria : id.primaria,
          ...aparencia(`@${c.username}`),
        };
        const pose = k === 0 && fase % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        pin.ctx.drawImage(sprite(pose, visual), 23 * pin.px, (y + 8) * pin.px, 36 * pin.px, 48 * pin.px);
        desenharEscudo(pin, c.time, 50, y + 4, 0.7);
        const nome = c.apelido || `@${c.username}`;
        pin.texto(nome, 72, y + 20, pin.caber(nome, 128, 11, texto, 700), texto, '#FFFFFF', { alinhar: 'left', peso: 700 });
        const info = `${POSICAO_FALADA[c.posicao]}, ${curto(c.time)}${c.gols ? `, ${c.gols} gol${c.gols > 1 ? 's' : ''}` : ''}`;
        pin.texto(info, 72, y + 38, pin.caber(info, 128, 7.5, texto, 500), texto, COR.placaSombra, { alinhar: 'left', peso: 500 });
        plaquinha(pin, 228, y + 14, 34, 30, c.nota.toFixed(1), display);
        // Número do voto, grande, no canto da figurinha: é o que se comenta.
        pin.placa(8, y - 2, 24, 26, { fundo: COR.amarelo, luz: '#FFE07A', sombra: '#B88600' });
        pin.texto(String(c.numero ?? k + 1), 20, y + 12, 22, display, COR.tinta);
        if (d.votacao === 'TEMPORADA' && k === 0) pin.texto('média', 245, y + 52, 6, texto, COR.placaSombra, { peso: 600 });
        pin.ctx.restore();
        // a cor do Time numa faixinha embaixo do card
        pin.r(12 + dx + 4, y + 61, 238, 2, contraste(id.primaria) === '#FFFFFF' ? id.primaria : id.secundaria);
      });
      break;
    }
    case 'CAMPEAO': {
      const t = d.campeao!;
      const id = IDENTIDADE[t];
      const a = entre(q.tempo, 0.2, 0.9);
      // Confete nas cores do Time, caindo devagar (determinístico pelo tempo).
      for (let k = 0; k < 60; k++) {
        const x = (k * 97) % COLUNAS;
        const y = ((k * 53 + q.tempo * (30 + (k % 5) * 8)) % (LINHAS + 20)) - 10;
        pin.r(x, y, 3, 3, k % 3 === 0 ? COR.amarelo : k % 3 === 1 ? id.primaria : id.secundaria);
      }
      pin.ctx.globalAlpha = a;
      pin.texto('Campeão!', COLUNAS / 2, 96, 44, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
      desenharEscudo(pin, t, COLUNAS / 2 - 50, 130 - (1 - a) * 20, 5);
      pin.texto(curto(t), COLUNAS / 2, 280, pin.caber(curto(t), 220, 40, display), display, COR.placa, { contorno: COR.contorno });
      pin.texto(`Temporada ${d.temporada}`, COLUNAS / 2, 312, 11, texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = entre(q.tempo, 1.2, 1.8);
      pin.tabua(30, 340, 210, 44);
      pin.texto(`“${FALA_DO_TIME[t].bordao}”`, COLUNAS / 2, 362, pin.caber(`“${FALA_DO_TIME[t].bordao}”`, 190, 12, texto, 600), texto, COR.placa, { peso: 600 });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'CRAQUE': {
      const t = d.craqueDaTemporada;
      const r = d.craqueDaRodada;
      const c = (t ?? r)!;
      const id = IDENTIDADE[c.time];
      const a = entre(q.tempo, 0.3, 1.1);
      // Figurinha grande do eleito sobre a grama.
      pin.ctx.globalAlpha = a;
      pin.placa(55, 70, 160, 196, { fundo: id.primaria, sombra: COR.contorno });
      pin.placa(63, 92, 144, 120, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
      pin.r(66, 176, 138, 33, '#7FB069');
      const visual = {
        camisa: c.posicao === 'GOL' ? id.secundaria : id.primaria,
        detalhe: c.posicao === 'GOL' ? id.primaria : id.secundaria,
        calcao: c.posicao === 'GOL' ? '#2B2B2B' : id.secundaria,
        meiao: c.posicao === 'GOL' ? id.secundaria : id.primaria,
        ...aparencia(`@${c.username}`),
      };
      const pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
      pin.ctx.drawImage(sprite(pose, visual), 105 * pin.px, (100 - (1 - a) * 10) * pin.px, 60 * pin.px, 80 * pin.px);
      desenharEscudo(pin, c.time, 182, 74, 1);
      const cor = contraste(id.primaria);
      pin.texto(t ? 'Craque da Temporada' : `Craque ${daRodada(r!)}`, COLUNAS / 2, 82, 9, texto, cor, { peso: 700 });
      const nome = c.apelido || `@${c.username}`;
      pin.texto(nome, COLUNAS / 2, 232, pin.caber(nome, 150, 18, display), display, cor);
      pin.texto(`${POSICAO_FALADA[c.posicao]}, ${curto(c.time)}`, COLUNAS / 2, 252, 8, texto, cor, { peso: 600 });
      pin.ctx.globalAlpha = entre(q.tempo, 1.4, 2.0);
      const numeros: [string, string][] = t
        ? [
            ['jogos', String(t.jogos)],
            ['gols', String(t.gols)],
            ['média', t.notaMedia.toFixed(1)],
            ['votos', String(t.votos)],
          ]
        : [
            ['gols', String(r!.gols)],
            ['nota', r!.nota.toFixed(1)],
            ['votos', String(r!.votos)],
          ];
      const x0 = (COLUNAS - (numeros.length * 58 - 6)) / 2;
      numeros.forEach(([rotulo, valor], k) => {
        const x = x0 + k * 58;
        pin.tabua(x, 290, 52, 56);
        pin.texto(valor, x + 26, 314, 20, display, COR.amarelo, { contorno: COR.contorno });
        pin.texto(rotulo, x + 26, 336, 7, texto, COR.placa, { peso: 600 });
      });
      pin.ctx.globalAlpha = 1;
      break;
    }
    case 'DESTAQUES': {
      titulo('Destaques');
      const f = d.fimDaTemporada!;
      const cartao = (k: number, rotulo: string, j: { username: string; time: TimeId; posicao: Posicao }, valor: string, legenda: string) => {
        const a = aparece(k, 0.8, 0.4);
        if (a <= 0) return;
        const y = 92 + k * 170;
        const id = IDENTIDADE[j.time];
        pin.ctx.save();
        pin.ctx.globalAlpha = a;
        pin.ctx.translate(0, (1 - a) * 12 * pin.px);
        pin.tabua(14, y, 242, 156);
        pin.texto(rotulo, COLUNAS / 2, y + 16, 18, display, COR.amarelo, { contorno: COR.contorno });
        pin.placa(26, y + 30, 92, 112, { fundo: COR.placa, luz: '#FFF8E6', sombra: COR.placaSombra });
        pin.r(29, y + 112, 86, 27, '#7FB069');
        const goleiro = j.posicao === 'GOL';
        const visual = {
          camisa: goleiro ? id.secundaria : id.primaria,
          detalhe: goleiro ? id.primaria : id.secundaria,
          calcao: goleiro ? '#2B2B2B' : id.secundaria,
          meiao: goleiro ? id.secundaria : id.primaria,
          ...aparencia(`@${j.username}`),
        };
        const pose = Math.floor(tVideo * 3) % 2 === 0 ? 'FRENTE_COMEMORA' : 'FRENTE_PARADO';
        pin.ctx.drawImage(sprite(pose, visual), 48 * pin.px, (y + 38) * pin.px, 48 * pin.px, 64 * pin.px);
        desenharEscudo(pin, j.time, 98, y + 32, 0.8);
        const nome = `@${j.username}`;
        pin.texto(nome, 186, y + 58, pin.caber(nome, 124, 14, display), display, '#FFFFFF', { contorno: COR.contorno });
        pin.texto(`${POSICAO_FALADA[j.posicao]}, ${curto(j.time)}`, 186, y + 76, 8, texto, COR.placaSombra, { peso: 600 });
        pin.texto(valor, 186, y + 108, 34, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.texto(legenda, 186, y + 132, 8, texto, COR.placa, { peso: 600 });
        pin.ctx.restore();
      };
      let k = 0;
      if (f.artilheiro) cartao(k++, 'Artilheiro', f.artilheiro, String(f.artilheiro.gols), f.artilheiro.gols === 1 ? 'gol' : 'gols');
      if (f.goleiro) cartao(k++, 'Melhor goleiro', { ...f.goleiro, posicao: 'GOL' }, f.goleiro.notaMedia.toFixed(1).replace('.', ','), 'nota média');
      break;
    }
    case 'COMPARTILHE':
      desenharCompartilhe(pin, q.tempo, tVideo, o);
      break;
    case 'CHAMADA': {
      const proxima = d.fimDaTemporada?.proxima;
      if (proxima) {
        pin.ctx.globalAlpha = entre(q.tempo, 0.1, 0.5);
        pin.tabua(22, 110, 226, 116);
        pin.texto(`Temporada ${proxima.numero}`, COLUNAS / 2, 134, 24, display, COR.placa, { contorno: COR.contorno });
        pin.texto('começa', COLUNAS / 2, 160, 10, texto, COR.placa, { peso: 600 });
        pin.texto(diaCurto(proxima.inicio), COLUNAS / 2, 196, 40, display, COR.amarelo, { contorno: COR.contorno, espessura: 1.5 });
        pin.ctx.globalAlpha = entre(q.tempo, 0.6, 1.0);
        pin.tabua(22, 240, 226, 96);
        pin.texto('Quer jogar? Comente', COLUNAS / 2, 260, 10, texto, COR.placa, { peso: 600 });
        pin.texto('ENTRO + time + posição', COLUNAS / 2, 286, pin.caber('ENTRO + time + posição', 200, 26, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('Ex.: ENTRO CAPIVARA ATA', COLUNAS / 2, 312, 7, texto, COR.placaSombra, { peso: 500 });
        if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 400, 70);
        pin.ctx.globalAlpha = 1;
        break;
      }
      if (!d.candidatos.length) {
        pin.ctx.globalAlpha = entre(q.tempo, 0.1, 0.5);
        pin.tabua(22, 150, 226, 120);
        pin.texto('A próxima Temporada', COLUNAS / 2, 172, 14, display, COR.placa, { contorno: COR.contorno });
        pin.texto('vem aí. Quer jogar?', COLUNAS / 2, 192, 14, display, COR.placa, { contorno: COR.contorno });
        pin.texto('ENTRO + time + posição', COLUNAS / 2, 228, pin.caber('ENTRO + time + posição', 200, 26, display), display, COR.amarelo, { contorno: COR.contorno });
        pin.texto('Ex.: ENTRO CAPIVARA ATA', COLUNAS / 2, 254, 7, texto, COR.placaSombra, { peso: 500 });
        if (o.escudo) desenharEscudoDaLiga(pin, o.escudo, COLUNAS / 2, 360, 80);
        pin.ctx.globalAlpha = 1;
        break;
      }
      pin.ctx.globalAlpha = entre(q.tempo, 0.1, 0.5);
      // Só o voto: entrar na Liga e compartilhar ficam na tela seguinte (COMPARTILHE).
      pin.tabua(22, 160, 226, 120);
      const chamada = d.votacao === 'TEMPORADA' ? 'Craque da Temporada' : 'Vote no Craque';
      pin.texto(chamada, COLUNAS / 2, 184, pin.caber(chamada, 200, 22, display), display, COR.amarelo, { contorno: COR.contorno });
      pin.texto('comente só o número', COLUNAS / 2, 208, 10, texto, COR.placa, { peso: 600 });
      const exemplo = `1 a ${d.candidatos.length}`;
      pin.texto(exemplo, COLUNAS / 2, 240, pin.caber(exemplo, 200, 34, display), display, '#FFFFFF', { contorno: COR.contorno });
      pin.texto('ou vote no site, link na bio', COLUNAS / 2, 266, 8, texto, COR.placaSombra, { peso: 500 });
      pin.ctx.globalAlpha = 1;
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
