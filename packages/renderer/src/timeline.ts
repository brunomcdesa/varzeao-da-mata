/**
 * Linha do tempo de uma Partida: transforma os lances da sim em posições de bola e
 * Jogadores para qualquer instante t (segundos de jogo, 0–5400).
 *
 * Tudo aqui é função pura de t. Por isso o mesmo código serve ao vídeo (quadro a quadro)
 * e ao site (Ao Vivo e Replay), e qualquer instante pode ser desenhado sem "tocar" o anterior.
 *
 * A coreografia de cada lance (quem passa para quem, de onde sai o chute) fica em jogada.ts.
 */
import type { Escalacao, Posicao } from '@liga/shared';
import type { Lado, Lance, ResultadoPartida, SlotRef } from '@liga/sim';
import {
  F_RESOLUCAO_CHUTE,
  F_RESOLUCAO_DESARME,
  MEIO,
  montarPlano,
  sentido,
  type AcaoJogador,
  type Alvo,
  type EstiloJogada,
  type Plano,
  type Ponto,
  type QuadroAtor,
} from './jogada.js';

export type { Ponto, AcaoJogador, EstiloJogada } from './jogada.js';
import { F_RESOLUCAO_PENALTI, estadoDaDisputa, instanteDaCobranca, montarDisputa, quadroDaDisputa, resultadoDaCobranca, type Disputa, type EstadoPenaltis } from './penaltis.js';
export type { Disputa, EstadoPenaltis, MarcaDePenalti } from './penaltis.js';

export const DURACAO_JOGO = 90 * 60;
/** Velocidade do Ao Vivo: 90 minutos de jogo em 4 min 30 s (ADR-0005; era 15×, 6 min). */
export const VELOCIDADE_AO_VIVO = 20;

export type TipoDestaque = 'GOL' | 'DEFESA' | 'BLOQUEIO' | 'DESARME' | 'FORA';

export interface Destaque {
  tipo: TipoDestaque;
  lado: Lado;
  /** Quem protagonizou: autor do gol, goleiro da defesa, zagueiro do desarme, finalizador do chute fora. */
  protagonista: SlotRef;
  /** 0 → 1 enquanto o destaque está na tela. */
  progresso: number;
  /** Letreiro de cobrança de pênalti (menor que o de gol de jogo). */
  penalti?: boolean;
}

export interface JogadorNoQuadro {
  slot: SlotRef;
  posicao: Posicao;
  pos: Ponto;
  /** Deslocamento por segundo de jogo (para escolher o sprite e a direção). */
  vel: Ponto;
  /** Para onde o Jogador olha quando está parado (normalmente a bola). */
  olhar: Ponto;
  acao: AcaoJogador;
}

export interface EstadoQuadro {
  t: number;
  minuto: number;
  placar: Record<Lado, number>;
  bola: Ponto;
  /** Altura da bola, 0 (no chão) a 1 (bem alta). */
  bolaAltura: number;
  jogadores: JogadorNoQuadro[];
  destaque: Destaque | null;
  /** Lance em andamento (índice em `lances`), ou -1. */
  lanceAtual: number;
  /** Estilo da jogada em andamento, se houver. */
  estilo: EstiloJogada | null;
  encerrada: boolean;
  /** Durante e depois da disputa de pênaltis (só quando ela existe e já começou). */
  penaltis: EstadoPenaltis | null;
}

interface Janela {
  lance: Lance;
  inicio: number;
  fim: number;
  /** Instante em que a jogada se resolve (chute ou desarme). */
  resolucao: number;
}

/** Por quantos segundos de jogo um destaque fica na tela. */
const DURACAO_DESTAQUE: Record<TipoDestaque, number> = { GOL: 75, DEFESA: 40, BLOQUEIO: 35, DESARME: 25, FORA: 30 };
/** Intervalo (s de jogo) usado para medir a velocidade de cada Jogador. */
const DT_VEL = 0.6;

/** Posições-base (lado mandante, que ataca para y = 0). O visitante é espelhado. */
const BASE_POR_POSICAO: Record<Posicao, Ponto[]> = {
  GOL: [{ x: 0.5, y: 0.93 }],
  ZAG: [{ x: 0.32, y: 0.79 }, { x: 0.68, y: 0.79 }],
  MEI: [{ x: 0.36, y: 0.62 }, { x: 0.64, y: 0.62 }],
  ATA: [{ x: 0.4, y: 0.44 }, { x: 0.6, y: 0.44 }],
};

const espelhar = (p: Ponto, lado: Lado): Ponto => (lado === 'mandante' ? p : { x: 1 - p.x, y: 1 - p.y });
const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
const lerpP = (a: Ponto, b: Ponto, f: number): Ponto => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
const suave = (f: number): number => f * f * (3 - 2 * f);
const limitar = (x: number, min = 0, max = 1): number => Math.min(max, Math.max(min, x));
/** 0 fora de [a, d]; sobe de a até b; 1 de b até c; desce de c até d. */
const trapezio = (f: number, a: number, b: number, c: number, d: number): number =>
  f <= a || f >= d ? 0 : f < b ? suave((f - a) / (b - a)) : f <= c ? 1 : suave((d - f) / (d - c));
const chave = (s: SlotRef) => `${s.lado}:${s.indice}`;

export class Timeline {
  readonly janelas: Janela[];
  readonly planos: Plano[];
  /** Disputa de pênaltis depois dos 90 minutos, se houve. */
  readonly disputa: Disputa | null;
  private readonly bases: Record<Lado, Ponto[]>;
  private readonly trilhas: Map<string, QuadroAtor[]>[];

  constructor(
    readonly resultado: ResultadoPartida,
    readonly escalacoes: Record<Lado, Escalacao>,
  ) {
    this.bases = {
      mandante: posicoesBase(escalacoes.mandante, 'mandante'),
      visitante: posicoesBase(escalacoes.visitante, 'visitante'),
    };
    this.janelas = montarJanelas(resultado.lances);
    // Jogo contínuo: a bola só volta ao meio depois de gol. Nos outros lances ela termina
    // com quem começa o próximo ataque (passe ou chutão recuperado) e o próximo sai dali.
    const lances = resultado.lances;
    const saida = (i: number): Ponto => {
      const proximo = lances[i + 1];
      if (!proximo || lances[i]!.tipo === 'GOL') return MEIO;
      return this.bases[proximo.criador.lado][proximo.criador.indice]!;
    };
    this.planos = lances.map((l, i) =>
      montarPlano(l, this.bases, escalacoes, resultado.seed, { entrada: i === 0 ? MEIO : saida(i - 1), saida: saida(i) }),
    );
    this.trilhas = this.planos.map((p) => new Map(p.atores.map((a) => [chave(a.slot), a.quadros])));
    this.disputa = montarDisputa(resultado, DURACAO_JOGO);
  }

  /** Fim da Partida: 90 minutos, ou o fim da disputa de pênaltis. */
  get duracao(): number {
    return this.disputa?.fim ?? DURACAO_JOGO;
  }

  /** Instante (s de jogo) em que a cobrança k se resolve. */
  instanteDaCobranca(k: number): number {
    return this.disputa ? instanteDaCobranca(this.disputa, k) : DURACAO_JOGO;
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
    if (this.disputa && tBruto > DURACAO_JOGO) return this.estadoDaDisputa(Math.min(tBruto, this.disputa.fim));
    const t = limitar(tBruto, 0, DURACAO_JOGO);
    const indice = this.indiceEm(t);
    const { pos: bola, altura } = this.bolaEm(t, indice);
    const agora = this.posicoesEm(t, indice, bola);
    const tAntes = Math.max(0, t - DT_VEL);
    const iAntes = this.indiceEm(tAntes);
    const antes = this.posicoesEm(tAntes, iAntes, this.bolaEm(tAntes, iAntes).pos);
    const plano = indice >= 0 ? this.planos[indice]! : null;
    const f = indice >= 0 ? this.fracao(indice, t) : 0;

    const jogadores: JogadorNoQuadro[] = agora.map((j, k) => {
      const a = antes[k]!.pos;
      const vel = { x: (j.pos.x - a.x) / DT_VEL, y: (j.pos.y - a.y) / DT_VEL };
      const especial = plano?.acoes.find((x) => x.slot.lado === j.slot.lado && x.slot.indice === j.slot.indice && f >= x.de && f < x.ate);
      const correndo = Math.hypot(vel.x, vel.y) > 0.0016;
      return { ...j, vel, olhar: bola, acao: especial?.acao ?? (correndo ? 'CORRENDO' : 'PARADO') };
    });

    return {
      t,
      minuto: Math.min(90, Math.floor(t / 60) + 1),
      placar: this.placarEm(t),
      bola,
      bolaAltura: altura,
      jogadores,
      destaque: this.destaqueEm(t),
      lanceAtual: indice,
      estilo: plano?.estilo ?? null,
      encerrada: t >= DURACAO_JOGO && !this.disputa,
      penaltis: null,
    };
  }

  private estadoDaDisputa(t: number): EstadoQuadro {
    const d = this.disputa!;
    const seed = this.resultado.seed;
    const agora = quadroDaDisputa(d, t, seed, this.escalacoes);
    const antes = quadroDaDisputa(d, Math.max(DURACAO_JOGO, t - DT_VEL), seed, this.escalacoes);
    const pen = estadoDaDisputa(d, t, seed);
    const jogadores: JogadorNoQuadro[] = agora.posicoes.map((j, k) => {
      const a = antes.posicoes[k]!.pos;
      const vel = { x: (j.pos.x - a.x) / DT_VEL, y: (j.pos.y - a.y) / DT_VEL };
      const posicao = this.escalacoes[j.slot.lado].jogadores[j.slot.indice]!.posicao;
      const correndo = Math.hypot(vel.x, vel.y) > 0.0016;
      return { slot: j.slot, posicao, pos: j.pos, vel, olhar: j.olhar, acao: j.acao === 'PARADO' && correndo ? 'CORRENDO' : j.acao };
    });
    // Letreiro de cada cobrança, logo depois da batida.
    let destaque: Destaque | null = null;
    if (pen.fase === 'COBRANCA' && pen.progresso >= F_RESOLUCAO_PENALTI) {
      const c = d.cobrancas[pen.atual]!;
      const res = resultadoDaCobranca(d, pen.atual, seed);
      destaque = {
        tipo: res,
        lado: res === 'DEFESA' ? c.goleiro.lado : c.lado,
        protagonista: res === 'DEFESA' ? c.goleiro : c.cobrador,
        progresso: (pen.progresso - F_RESOLUCAO_PENALTI) / (1 - F_RESOLUCAO_PENALTI),
        penalti: true,
      };
    }
    return {
      t,
      minuto: 90,
      placar: this.placarEm(DURACAO_JOGO),
      bola: agora.bola,
      bolaAltura: agora.bolaAltura,
      jogadores,
      destaque,
      lanceAtual: -1,
      estilo: null,
      encerrada: t >= d.fim,
      penaltis: pen,
    };
  }

  private indiceEm(t: number): number {
    return this.janelas.findIndex((j) => t >= j.inicio && t < j.fim);
  }

  private fracao(indice: number, t: number): number {
    const j = this.janelas[indice]!;
    return (t - j.inicio) / (j.fim - j.inicio);
  }

  /** Posição normal na formação: bloco sobe ao atacar, recua ao defender, com leve balanço. */
  private posicaoNormal(slot: SlotRef, t: number, lance: Lance | undefined, f: number, bola: Ponto | null): Ponto {
    const base = this.bases[slot.lado][slot.indice]!;
    const posicao = this.escalacoes[slot.lado].jogadores[slot.indice]!.posicao;
    const avanco = lance ? trapezio(f, 0.05, 0.3, 0.8, 0.98) : 0;
    const deslocamento = !lance ? 0 : lance.ataque === slot.lado ? 0.1 * avanco : -0.05 * avanco;
    const balanco = Math.sin(t / 9 + slot.indice * 1.7 + (slot.lado === 'mandante' ? 0 : 3)) * 0.012;
    let pos: Ponto = {
      x: base.x + balanco,
      y: base.y + sentido(slot.lado) * deslocamento + Math.cos(t / 11 + slot.indice) * 0.008,
    };
    if (bola && lance) {
      if (posicao === 'GOL' && lance.ataque !== slot.lado) pos = { x: lerp(base.x, bola.x, 0.55), y: pos.y };
      // Quem defende fecha um pouco na direção da bola.
      else if (lance.ataque !== slot.lado && posicao !== 'GOL') pos = lerpP(pos, bola, 0.12 * avanco);
    }
    return pos;
  }

  private posicaoDe(slot: SlotRef, t: number, indice: number, f: number, bola: Ponto | null): Ponto {
    const lance = indice >= 0 ? this.janelas[indice]!.lance : undefined;
    const normal = () => this.posicaoNormal(slot, t, lance, f, bola);
    const trilha = indice >= 0 ? this.trilhas[indice]!.get(chave(slot)) : undefined;
    if (!trilha) return normal();
    if (f <= trilha[0]![0] || f >= trilha[trilha.length - 1]![0]) return normal();
    for (let k = 1; k < trilha.length; k++) {
      const [fb, pb] = trilha[k]!;
      if (f <= fb) {
        const [fa, pa] = trilha[k - 1]!;
        const a = pa ?? normal();
        const b = pb ?? normal();
        return lerpP(a, b, suave((f - fa) / (fb - fa)));
      }
    }
    return normal();
  }

  private posicoesEm(t: number, indice: number, bola: Ponto): Omit<JogadorNoQuadro, 'vel' | 'olhar' | 'acao'>[] {
    const f = indice >= 0 ? this.fracao(indice, t) : 0;
    const lista: Omit<JogadorNoQuadro, 'vel' | 'olhar' | 'acao'>[] = [];
    for (const lado of ['mandante', 'visitante'] as const) {
      this.escalacoes[lado].jogadores.forEach((jogador, i) => {
        const slot = { lado, indice: i };
        const p = this.posicaoDe(slot, t, indice, f, bola);
        lista.push({ slot, posicao: jogador.posicao, pos: { x: limitar(p.x, 0.03, 0.97), y: limitar(p.y, 0.02, 0.98) } });
      });
    }
    return lista;
  }

  private bolaEm(t: number, indice: number): { pos: Ponto; altura: number } {
    if (indice < 0) return { pos: MEIO, altura: 0 };
    const f = this.fracao(indice, t);
    const plano = this.planos[indice]!;
    // O trecho em andamento; num intervalo sem trecho, vale o último que começou.
    const trecho = plano.bola.find((b) => f >= b.de && f < b.ate) ?? [...plano.bola].reverse().find((b) => f >= b.de) ?? plano.bola[0]!;
    const janela = this.janelas[indice]!;
    // Posição de um ator num instante f' da mesma janela (sem depender da bola, para não haver ciclo).
    const ator = (s: SlotRef, fx: number) => this.posicaoDe(s, janela.inicio + fx * (janela.fim - janela.inicio), indice, fx, null);
    const resolver = (a: Alvo, fx: number): Ponto => ('ponto' in a ? a.ponto : ator(a.ator, fx));
    const noChao = (p: Ponto) => ({ pos: { x: limitar(p.x), y: limitar(p.y) }, altura: 0 });

    if (trecho.tipo === 'PARADA') return noChao(trecho.ponto);
    if (trecho.tipo === 'POSSE') {
      const p = ator(trecho.ator, f);
      // A bola vai um pouco à frente, no sentido do gol atacado por quem conduz.
      return noChao({ x: p.x, y: p.y + sentido(trecho.ator.lado) * 0.014 });
    }
    const s = limitar((f - trecho.de) / (trecho.ate - trecho.de));
    const andamento = trecho.chute ? 1 - (1 - s) * (1 - s) : s;
    const p = lerpP(resolver(trecho.origem, trecho.de), resolver(trecho.destino, trecho.ate), andamento);
    return { pos: { x: limitar(p.x), y: limitar(p.y) }, altura: trecho.altura * 4 * s * (1 - s) };
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
