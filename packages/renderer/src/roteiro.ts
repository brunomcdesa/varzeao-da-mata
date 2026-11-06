/**
 * Roteiro do Reels de uma Partida: decide quais trechos da Timeline entram no vídeo e
 * converte tempo de vídeo (segundos de MP4) em tempo de jogo.
 *
 * O Ao Vivo mostra os 90 minutos em ~6 min; o Reels mostra só os melhores momentos.
 * Assim como a Timeline, tudo é função pura do tempo: o quadro N do vídeo é sempre igual,
 * em qualquer máquina, e pode ser renderizado fora de ordem.
 */
import type { TipoLance } from '@liga/sim';
import { DURACAO_JOGO, type Timeline } from './timeline.js';

export type TipoSegmento = 'ABERTURA' | 'LANCE' | 'FIM';

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
  /** Teto do vídeo. Se passar, os lances menos importantes saem primeiro. */
  duracaoMaxima?: number;
  /** Duração do escurecimento em cada corte (s de vídeo, metade para cada lado). */
  corte?: number;
}

const PADRAO: Required<Omit<OpcoesRoteiro, 'duracaoLance'>> & { duracaoLance: Record<TipoLance, number> } = {
  duracaoLance: { GOL: 8, DEFESA: 5, FORA: 4, DESARME: 0 },
  duracaoAbertura: 3,
  duracaoFim: 4,
  duracaoMaxima: 75,
  corte: 0.3,
};

/**
 * Fração do trecho de vídeo usada até a resolução. O resto é para o gol, a defesa ou o
 * desarme respirarem: a comemoração e o letreiro ficam mais tempo na tela.
 */
const PIVO: Record<TipoLance, number> = { GOL: 0.55, DEFESA: 0.62, FORA: 0.65, DESARME: 0.6 };

/** Ordem de corte quando o vídeo passa do teto: primeiro some o menos importante. */
const PRIORIDADE: TipoLance[] = ['DESARME', 'FORA', 'DEFESA', 'GOL'];

/**
 * Trecho de jogo que cada tipo de lance mostra, em frações da janela do lance
 * (0 = início da jogada, resolução ≈ 0,78 para chutes). O destaque do gol continua
 * depois da janela, por isso o GOL estende além de 1.
 */
const RECORTE: Record<TipoLance, { de: number; extraDepois: number }> = {
  GOL: { de: 0.18, extraDepois: 45 },
  DEFESA: { de: 0.22, extraDepois: 22 },
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
    let escolhidos = lances.map((l, i) => i).filter((i) => o.duracaoLance[lances[i]!.tipo] > 0);
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

    const segmentos: Segmento[] = [];
    let cursor = 0;
    segmentos.push({ tipo: 'ABERTURA', inicio: 0, fim: (cursor += o.duracaoAbertura) });
    for (const i of escolhidos) {
      const lance = lances[i]!;
      const janela = timeline.janelas[i]!;
      const recorte = RECORTE[lance.tipo];
      const jogoInicio = janela.inicio + (janela.fim - janela.inicio) * recorte.de;
      const jogoFim = Math.min(DURACAO_JOGO, janela.resolucao + recorte.extraDepois);
      const inicio = cursor;
      const fim = (cursor += o.duracaoLance[lance.tipo]);
      segmentos.push({
        tipo: 'LANCE',
        inicio,
        fim,
        jogoInicio,
        jogoFim,
        jogoResolucao: janela.resolucao,
        resolucao: inicio + (fim - inicio) * PIVO[lance.tipo],
        lance: i,
      });
    }
    segmentos.push({ tipo: 'FIM', inicio: cursor, fim: (cursor += o.duracaoFim) });

    this.segmentos = segmentos;
    this.duracao = cursor;
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
    else if (segmento.tipo === 'FIM') tJogo = DURACAO_JOGO;

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
