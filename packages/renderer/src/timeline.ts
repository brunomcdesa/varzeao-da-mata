/**
 * Linha do tempo de uma Partida: transforma os lances da sim em posições de bola e
 * Jogadores para qualquer instante t (segundos de jogo, 0–5400).
 *
 * Tudo aqui é função pura de t. Por isso o mesmo código serve ao vídeo (quadro a quadro)
 * e ao site (Ao Vivo e Replay), e qualquer instante pode ser desenhado sem "tocar" o anterior.
 */
import type { Escalacao, Posicao } from '@liga/shared';
import type { Lado, Lance, ResultadoPartida, SlotRef } from '@liga/sim';

export const DURACAO_JOGO = 90 * 60;
/** Velocidade do Ao Vivo: 90 minutos de jogo em cerca de 6 minutos (ADR-0005). */
export const VELOCIDADE_AO_VIVO = 15;

export interface Ponto {
  x: number;
  y: number;
}

export type TipoDestaque = 'GOL' | 'DEFESA' | 'DESARME' | 'FORA';

export interface Destaque {
  tipo: TipoDestaque;
  lado: Lado;
  /** Quem protagonizou: autor do gol, goleiro da defesa, zagueiro do desarme, finalizador do chute fora. */
  protagonista: SlotRef;
  /** 0 → 1 enquanto o destaque está na tela. */
  progresso: number;
}

export interface EstadoQuadro {
  t: number;
  minuto: number;
  placar: Record<Lado, number>;
  bola: Ponto;
  jogadores: { slot: SlotRef; posicao: Posicao; pos: Ponto }[];
  destaque: Destaque | null;
  /** Lance em andamento (índice em `lances`), ou -1. */
  lanceAtual: number;
  encerrada: boolean;
}

interface Janela {
  lance: Lance;
  inicio: number;
  fim: number;
  /** Instante em que a jogada se resolve (chute ou desarme). */
  resolucao: number;
}

/** Fração da janela em que a jogada se resolve. */
const F_RESOLUCAO_CHUTE = 0.78;
const F_RESOLUCAO_DESARME = 0.6;
/** Por quantos segundos de jogo um destaque fica na tela. */
const DURACAO_DESTAQUE: Record<TipoDestaque, number> = { GOL: 75, DEFESA: 40, DESARME: 25, FORA: 30 };

/** Posições-base (lado mandante, que ataca para y = 0). O visitante é espelhado. */
const BASE_POR_POSICAO: Record<Posicao, Ponto[]> = {
  GOL: [{ x: 0.5, y: 0.93 }],
  ZAG: [{ x: 0.32, y: 0.79 }, { x: 0.68, y: 0.79 }],
  MEI: [{ x: 0.36, y: 0.62 }, { x: 0.64, y: 0.62 }],
  ATA: [{ x: 0.4, y: 0.44 }, { x: 0.6, y: 0.44 }],
};

const sentido = (lado: Lado): number => (lado === 'mandante' ? -1 : 1);
const golAlvo = (ataque: Lado): number => (ataque === 'mandante' ? 0.02 : 0.98);
const espelhar = (p: Ponto, lado: Lado): Ponto => (lado === 'mandante' ? p : { x: 1 - p.x, y: 1 - p.y });

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
const lerpP = (a: Ponto, b: Ponto, f: number): Ponto => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
const suave = (f: number): number => f * f * (3 - 2 * f);
const limitar = (x: number, min = 0, max = 1): number => Math.min(max, Math.max(min, x));
/** 0 fora de [a, d]; sobe de a até b; 1 de b até c; desce de c até d. */
const trapezio = (f: number, a: number, b: number, c: number, d: number): number =>
  f <= a || f >= d ? 0 : f < b ? suave((f - a) / (b - a)) : f <= c ? 1 : suave((d - f) / (d - c));

export class Timeline {
  readonly janelas: Janela[];
  private readonly bases: Record<Lado, Ponto[]>;

  constructor(
    readonly resultado: ResultadoPartida,
    readonly escalacoes: Record<Lado, Escalacao>,
  ) {
    this.bases = {
      mandante: posicoesBase(escalacoes.mandante, 'mandante'),
      visitante: posicoesBase(escalacoes.visitante, 'visitante'),
    };
    this.janelas = montarJanelas(resultado.lances);
  }

  get duracao(): number {
    return DURACAO_JOGO;
  }

  /** Instante (segundos de jogo) em que cada lance se resolve; útil para pular direto ao lance. */
  instanteDoLance(indice: number): number {
    return this.janelas[indice]?.resolucao ?? 0;
  }

  placarEm(t: number): Record<Lado, number> {
    const placar: Record<Lado, number> = { mandante: 0, visitante: 0 };
    for (const j of this.janelas) {
      if (j.lance.tipo === 'GOL' && t >= j.resolucao) placar[j.lance.ataque]++;
    }
    return placar;
  }

  estado(tBruto: number): EstadoQuadro {
    const t = limitar(tBruto, 0, DURACAO_JOGO);
    const placar = this.placarEm(t);
    const indice = this.janelas.findIndex((j) => t >= j.inicio && t < j.fim);
    const janela = indice >= 0 ? this.janelas[indice]! : null;

    const bola = janela ? this.bolaNaJanela(janela, t) : { x: 0.5, y: 0.5 };
    const jogadores = this.jogadoresEm(janela, t, bola);

    return {
      t,
      minuto: Math.min(90, Math.floor(t / 60) + 1),
      placar,
      bola,
      jogadores,
      destaque: this.destaqueEm(t),
      lanceAtual: indice,
      encerrada: t >= DURACAO_JOGO,
    };
  }

  private posDe(slot: SlotRef): Ponto {
    return this.bases[slot.lado][slot.indice]!;
  }

  private bolaNaJanela(j: Janela, t: number): Ponto {
    const f = (t - j.inicio) / (j.fim - j.inicio);
    const { lance } = j;
    const dir = sentido(lance.ataque);
    const alvo = golAlvo(lance.ataque);
    const criador = this.posDe(lance.criador);
    const meio: Ponto = { x: 0.5, y: 0.5 };
    const conducao: Ponto = { x: criador.x, y: 0.5 + dir * 0.12 };
    const zona: Ponto = { x: lerp(criador.x, 0.5, 0.3), y: alvo - dir * 0.3 };

    const quadros: [number, Ponto][] = [
      [0, meio],
      [0.2, conducao],
      [0.45, zona],
    ];

    if (lance.tipo === 'DESARME') {
      quadros.push([F_RESOLUCAO_DESARME, zona], [0.85, { x: 0.5, y: 0.5 - dir * 0.08 }], [1, meio]);
    } else {
      const fin = lance.finalizador ? this.posDe(lance.finalizador) : criador;
      const recepcao: Ponto = { x: lerp(fin.x, 0.5, 0.4), y: alvo - dir * 0.17 };
      const destino: Ponto =
        lance.tipo === 'GOL'
          ? { x: 0.5 + (fin.x - 0.5) * 0.25, y: alvo + dir * 0.012 }
          : lance.tipo === 'DEFESA'
            ? { x: 0.5 + (fin.x - 0.5) * 0.15, y: alvo - dir * 0.045 }
            : { x: fin.x < 0.5 ? 0.33 : 0.67, y: alvo + dir * 0.01 };
      quadros.push([0.62, recepcao], [F_RESOLUCAO_CHUTE, destino], [0.9, destino], [1, meio]);
    }
    return interpolar(quadros, f);
  }

  private jogadoresEm(janela: Janela | null, t: number, bola: Ponto): EstadoQuadro['jogadores'] {
    const f = janela ? (t - janela.inicio) / (janela.fim - janela.inicio) : 0;
    const lance = janela?.lance;
    const avanco = lance ? trapezio(f, 0.05, 0.3, 0.8, 0.98) : 0;

    const lista: EstadoQuadro['jogadores'] = [];
    for (const lado of ['mandante', 'visitante'] as const) {
      this.escalacoes[lado].jogadores.forEach((jogador, indice) => {
        const slot = { lado, indice };
        const base = this.bases[lado][indice]!;
        // Bloco sobe quando ataca e recua quando defende.
        const deslocamento = !lance ? 0 : lance.ataque === lado ? 0.1 * avanco : -0.05 * avanco;
        // Respiração leve para o campo não parecer congelado (determinística em t).
        const balanco = Math.sin(t / 9 + indice * 1.7 + (lado === 'mandante' ? 0 : 3)) * 0.012;
        let pos: Ponto = {
          x: base.x + balanco,
          y: base.y + sentido(lado) * deslocamento + Math.cos(t / 11 + indice) * 0.008,
        };

        if (lance) {
          const peso = pesoDeAtracao(lance, slot, f);
          if (jogador.posicao === 'GOL' && lance.ataque !== lado) {
            // Goleiro acompanha a bola no eixo x, sem sair da área.
            pos = { x: lerp(base.x, bola.x, 0.55), y: pos.y };
          }
          if (peso > 0) {
            const encosto = jogador.posicao === 'GOL' ? 0 : lance.ataque === lado ? 0.025 : -0.025;
            pos = lerpP(pos, { x: bola.x + encosto * 0.6, y: bola.y - sentido(lado) * encosto }, peso);
          }
        }
        lista.push({ slot, posicao: jogador.posicao, pos: { x: limitar(pos.x, 0.03, 0.97), y: limitar(pos.y, 0.02, 0.98) } });
      });
    }
    return lista;
  }

  private destaqueEm(t: number): Destaque | null {
    for (let i = this.janelas.length - 1; i >= 0; i--) {
      const j = this.janelas[i]!;
      const tipo = j.lance.tipo;
      const dur = DURACAO_DESTAQUE[tipo];
      if (t >= j.resolucao && t < j.resolucao + dur) {
        const protagonista =
          tipo === 'GOL' || tipo === 'FORA' ? (j.lance.finalizador ?? j.lance.criador) : j.lance.defensor;
        const lado = tipo === 'GOL' || tipo === 'FORA' ? j.lance.ataque : j.lance.defensor.lado;
        return { tipo, lado, protagonista, progresso: (t - j.resolucao) / dur };
      }
    }
    return null;
  }
}

/** Quanto cada envolvido no lance é puxado para a bola, por fase. */
function pesoDeAtracao(lance: Lance, slot: SlotRef, f: number): number {
  const igual = (a: SlotRef | undefined) => a !== undefined && a.lado === slot.lado && a.indice === slot.indice;
  if (igual(lance.criador)) return trapezio(f, 0.02, 0.15, 0.5, lance.tipo === 'DESARME' ? 0.62 : 0.66);
  if (igual(lance.finalizador)) return trapezio(f, 0.5, 0.62, 0.78, 0.92);
  if (igual(lance.defensor)) {
    return lance.tipo === 'DESARME' ? trapezio(f, 0.3, 0.45, 0.85, 0.95) : trapezio(f, 0.7, 0.78, 0.88, 0.95);
  }
  return 0;
}

function interpolar(quadros: [number, Ponto][], f: number): Ponto {
  if (f <= quadros[0]![0]) return quadros[0]![1];
  for (let i = 1; i < quadros.length; i++) {
    const [fb, b] = quadros[i]!;
    const [fa, a] = quadros[i - 1]!;
    if (f <= fb) return lerpP(a, b, suave((f - fa) / (fb - fa)));
  }
  return quadros[quadros.length - 1]![1];
}

function posicoesBase(escalacao: Escalacao, lado: Lado): Ponto[] {
  const usados: Record<Posicao, number> = { GOL: 0, ZAG: 0, MEI: 0, ATA: 0 };
  return escalacao.jogadores.map((j) => {
    const ponto = BASE_POR_POSICAO[j.posicao][usados[j.posicao]++] ?? BASE_POR_POSICAO[j.posicao][0]!;
    return espelhar(ponto, lado);
  });
}

/**
 * Cada lance ocupa o intervalo desde o fim do anterior até um pouco depois do seu minuto,
 * com duração mínima para a jogada caber na tela.
 */
function montarJanelas(lances: readonly Lance[]): Janela[] {
  const MINIMO = 120;
  const janelas: Janela[] = [];
  let cursor = 0;
  lances.forEach((lance, i) => {
    const restantes = lances.length - i;
    const alvoFim = Math.max(lance.minuto * 60 + 20, cursor + MINIMO);
    const fim = Math.min(alvoFim, DURACAO_JOGO - (restantes - 1) * MINIMO);
    const inicio = cursor;
    const fResolucao = lance.tipo === 'DESARME' ? F_RESOLUCAO_DESARME : F_RESOLUCAO_CHUTE;
    janelas.push({ lance, inicio, fim, resolucao: inicio + (fim - inicio) * fResolucao });
    cursor = fim;
  });
  return janelas;
}
