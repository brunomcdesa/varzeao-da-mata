/**
 * Roteiro do Reels de uma Partida: decide quais trechos da Timeline entram no vídeo e
 * converte tempo de vídeo (segundos de MP4) em tempo de jogo.
 *
 * O Ao Vivo mostra os 90 minutos em 4 min 30 s; o Reels mostra só os melhores momentos.
 * Assim como a Timeline, tudo é função pura do tempo: o quadro N do vídeo é sempre igual,
 * em qualquer máquina, e pode ser renderizado fora de ordem.
 */
import type { TipoLance } from '@liga/sim';
import { INTRO_PENALTIS } from './penaltis.js';
import { DURACAO_JOGO, type Timeline } from './timeline.js';

/** Segundos de vídeo da disputa de pênaltis: abertura, cada cobrança e o fim. */
export const VIDEO_PENALTIS = { intro: 2.4, cobranca: 3, fim: 3 };

export type TipoSegmento = 'ABERTURA' | 'LANCE' | 'PENALTIS' | 'FIM';

export interface Segmento {
  tipo: TipoSegmento;
  /** Início e fim no tempo de vídeo (s). */
  inicio: number;
  fim: number;
  /** Só em LANCE: trecho de jogo mostrado (s de jogo) e índice do lance. */
  jogoInicio?: number;
  jogoFim?: number;
  /** Só em LANCE: instante de jogo da resolução (chute chegando ou desarme). */
  jogoResolucao?: number;
  /** Só em LANCE: instante de vídeo da resolução. */
  resolucao?: number;
  lance?: number;
}

export interface QuadroRoteiro {
  segmento: Segmento;
  /** Instante de jogo a desenhar. Na ABERTURA é 0; no FIM, o apito final. */
  tJogo: number;
  /** 0 → 1 dentro do segmento. */
  progresso: number;
  /** 0 = imagem limpa; 1 = tela preta. Usado nos cortes entre segmentos. */
  escurecer: number;
}

export interface OpcoesRoteiro {
  /** Segundos de vídeo por tipo de lance; 0 tira o tipo do vídeo. */
  duracaoLance?: Partial<Record<TipoLance, number>>;
  duracaoAbertura?: number;
  duracaoFim?: number;
  /** Mostra todos os escanteios (Ao Vivo). No Reels, só os que viraram gol. */
  bolasParadas?: boolean;
  /** Teto do vídeo. Se passar, os lances menos importantes saem primeiro. */
  duracaoMaxima?: number;
  /** Duração do escurecimento em cada corte (s de vídeo, metade para cada lado). */
  corte?: number;
  /**
   * Durações mínimas por trecho (índice em `segmentos`), para a narração caber inteira.
   * Num LANCE: `antes` = até a resolução, `depois` = da resolução ao fim. Nas cartelas,
   * só `antes` (a duração toda). Calculadas por `exigenciasDaNarracao`.
   */
  minimos?: Record<number, { antes?: number; depois?: number }>;
}

const PADRAO: Required<Omit<OpcoesRoteiro, 'duracaoLance' | 'minimos' | 'bolasParadas'>> & { duracaoLance: Record<TipoLance, number> } = {
  duracaoLance: { GOL: 8, DEFESA: 5, BLOQUEIO: 5, FORA: 4, DESARME: 0 },
  duracaoAbertura: 3,
  duracaoFim: 4,
  duracaoMaxima: 75,
  corte: 0.3,
};

/**
 * Fração do trecho de vídeo usada até a resolução. O resto é para o gol, a defesa ou o
 * desarme respirarem: a comemoração e o letreiro ficam mais tempo na tela.
 */
const PIVO: Record<TipoLance, number> = { GOL: 0.55, DEFESA: 0.62, BLOQUEIO: 0.62, FORA: 0.65, DESARME: 0.6 };

/** Ordem de corte quando o vídeo passa do teto: primeiro some o menos importante. */
const PRIORIDADE: TipoLance[] = ['DESARME', 'FORA', 'BLOQUEIO', 'DEFESA', 'GOL'];

/**
 * Trecho de jogo que cada tipo de lance mostra, em frações da janela do lance
 * (0 = início da jogada, resolução ≈ 0,78 para chutes). O destaque do gol continua
 * depois da janela, por isso o GOL estende além de 1.
 */
const RECORTE: Record<TipoLance, { de: number; extraDepois: number }> = {
  GOL: { de: 0.18, extraDepois: 45 },
  DEFESA: { de: 0.22, extraDepois: 22 },
  BLOQUEIO: { de: 0.22, extraDepois: 20 },
  FORA: { de: 0.28, extraDepois: 14 },
  DESARME: { de: 0.25, extraDepois: 15 },
};

export class Roteiro {
  readonly segmentos: Segmento[];
  readonly duracao: number;
  private readonly corte: number;

  constructor(
    readonly timeline: Timeline,
    opcoes: OpcoesRoteiro = {},
  ) {
    const o = { ...PADRAO, ...opcoes, duracaoLance: { ...PADRAO.duracaoLance, ...opcoes.duracaoLance } };
    this.corte = o.corte;

    const lances = timeline.resultado.lances;
    // Escanteio que não virou gol fica só no Ao Vivo (bolasParadas); o de gol entra sempre.
    let escolhidos = lances
      .map((l, i) => i)
      .filter((i) => o.duracaoLance[lances[i]!.tipo] > 0 && (o.bolasParadas || lances[i]!.bolaParada !== 'ESCANTEIO' || lances[i]!.tipo === 'GOL'));
    const total = (lista: number[]) =>
      o.duracaoAbertura + o.duracaoFim + lista.reduce((s, i) => s + o.duracaoLance[lances[i]!.tipo], 0);

    // Acima do teto, corta do fim para o começo dentro de cada tipo, do menos importante ao mais.
    for (const tipo of PRIORIDADE) {
      if (tipo === 'GOL') break; // gol nunca sai do vídeo
      while (total(escolhidos) > o.duracaoMaxima) {
        const ultimo = [...escolhidos].reverse().find((i) => lances[i]!.tipo === tipo);
        if (ultimo === undefined) break;
        escolhidos = escolhidos.filter((i) => i !== ultimo);
      }
    }

    const minimo = (indice: number) => opcoes.minimos?.[indice] ?? {};
    const segmentos: Segmento[] = [];
    let cursor = 0;
    segmentos.push({ tipo: 'ABERTURA', inicio: 0, fim: (cursor += Math.max(o.duracaoAbertura, minimo(0).antes ?? 0)) });
    for (const i of escolhidos) {
      const lance = lances[i]!;
      const janela = timeline.janelas[i]!;
      const recorte = RECORTE[lance.tipo];
      // Gol de bola parada: o Reels mostra desde a cobrança (lateral ou escanteio).
      const de = lance.bolaParada === 'LATERAL' ? 0 : lance.bolaParada === 'ESCANTEIO' ? 0.2 : recorte.de;
      const jogoInicio = janela.inicio + (janela.fim - janela.inicio) * de;
      const jogoFim = Math.min(DURACAO_JOGO, janela.resolucao + recorte.extraDepois);
      const base = o.duracaoLance[lance.tipo];
      const m = minimo(segmentos.length);
      const antes = Math.max(base * PIVO[lance.tipo], m.antes ?? 0);
      const depois = Math.max(base * (1 - PIVO[lance.tipo]), m.depois ?? 0);
      const inicio = cursor;
      const resolucao = inicio + antes;
      const fim = (cursor = resolucao + depois);
      segmentos.push({ tipo: 'LANCE', inicio, fim, jogoInicio, jogoFim, jogoResolucao: janela.resolucao, resolucao, lance: i });
    }
    const d = timeline.disputa;
    if (d) {
      const base = VIDEO_PENALTIS.intro + d.cobrancas.length * VIDEO_PENALTIS.cobranca + VIDEO_PENALTIS.fim;
      const inicio = cursor;
      cursor += Math.max(base, minimo(segmentos.length).antes ?? 0);
      segmentos.push({ tipo: 'PENALTIS', inicio, fim: cursor, jogoInicio: d.inicio, jogoFim: d.fim });
    }
    segmentos.push({ tipo: 'FIM', inicio: cursor, fim: (cursor += Math.max(o.duracaoFim, minimo(segmentos.length).antes ?? 0)) });

    this.segmentos = segmentos;
    this.duracao = cursor;
  }

  /**
   * Pontos (vídeo, jogo) da disputa: a abertura, o fim de cada cobrança e o fim, cada um na
   * sua velocidade; se o trecho foi esticado para a narração caber, tudo estica junto.
   */
  nosDosPenaltis(s: Segmento): [number, number][] {
    const d = this.timeline.disputa!;
    const base = VIDEO_PENALTIS.intro + d.cobrancas.length * VIDEO_PENALTIS.cobranca + VIDEO_PENALTIS.fim;
    const escala = (s.fim - s.inicio) / base;
    const nos: [number, number][] = [[s.inicio, d.inicio], [s.inicio + VIDEO_PENALTIS.intro * escala, d.inicio + INTRO_PENALTIS]];
    d.cobrancas.forEach((_, k) => nos.push([s.inicio + (VIDEO_PENALTIS.intro + (k + 1) * VIDEO_PENALTIS.cobranca) * escala, d.inicio + INTRO_PENALTIS + (k + 1) * d.passo]));
    nos.push([s.fim, d.fim]);
    return nos;
  }

  jogoDosPenaltis(s: Segmento, tVideo: number): number {
    const nos = this.nosDosPenaltis(s);
    for (let k = 1; k < nos.length; k++) {
      const [va, ja] = nos[k - 1]!;
      const [vb, jb] = nos[k]!;
      if (tVideo <= vb) return ja + ((jb - ja) * (tVideo - va)) / (vb - va || 1);
    }
    return nos[nos.length - 1]![1];
  }

  /** Inverso: instante de vídeo de um instante de jogo da disputa. */
  videoDosPenaltis(s: Segmento, tJogo: number): number {
    const nos = this.nosDosPenaltis(s);
    for (let k = 1; k < nos.length; k++) {
      const [va, ja] = nos[k - 1]!;
      const [vb, jb] = nos[k]!;
      if (tJogo <= jb) return va + ((vb - va) * (tJogo - ja)) / (jb - ja || 1);
    }
    return s.fim;
  }

  /** Quantos quadros o vídeo tem a `fps` quadros por segundo. */
  totalQuadros(fps: number): number {
    return Math.ceil(this.duracao * fps);
  }

  quadroEm(tVideoBruto: number): QuadroRoteiro {
    const tVideo = Math.min(Math.max(tVideoBruto, 0), this.duracao - 1e-9);
    const segmento = this.segmentos.find((s) => tVideo < s.fim) ?? this.segmentos[this.segmentos.length - 1]!;
    const progresso = (tVideo - segmento.inicio) / (segmento.fim - segmento.inicio);

    let tJogo = 0;
    if (segmento.tipo === 'LANCE') {
      // Duas velocidades: construção da jogada até a resolução, depois o lance "respira".
      const pivo = (segmento.resolucao! - segmento.inicio) / (segmento.fim - segmento.inicio);
      tJogo =
        progresso < pivo
          ? segmento.jogoInicio! + (segmento.jogoResolucao! - segmento.jogoInicio!) * (progresso / pivo)
          : segmento.jogoResolucao! + (segmento.jogoFim! - segmento.jogoResolucao!) * ((progresso - pivo) / (1 - pivo));
    }
    else if (segmento.tipo === 'PENALTIS') tJogo = this.jogoDosPenaltis(segmento, tVideo);
    else if (segmento.tipo === 'FIM') tJogo = this.timeline.duracao;

    // Escurece nas bordas de cada corte (não no começo nem no fim do vídeo).
    const meio = this.corte / 2;
    const ehPrimeiro = segmento.inicio === 0;
    const ehUltimo = segmento.fim >= this.duracao;
    const entrada = ehPrimeiro ? 1 : Math.min(1, (tVideo - segmento.inicio) / meio);
    const saida = ehUltimo ? 1 : Math.min(1, (segmento.fim - tVideo) / meio);
    const escurecer = 1 - Math.min(entrada, saida);

    return { segmento, tJogo, progresso, escurecer };
  }
}
