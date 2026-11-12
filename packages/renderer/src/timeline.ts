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
import { criarRng, type Lado, type Lance, type ResultadoPartida, type SlotRef } from '@liga/sim';
import {
  FISICA,
  F_RESOLUCAO_CHUTE,
  F_RESOLUCAO_DESARME,
  MEIO,
  golAlvo,
  montarPlano,
  COBRANCAS_DE_FALTA,
  pontoDaFalta,
  cobradorDaBolaParada,
  pontoDoCobrador,
  pontoDoEscanteio,
  pontoDoLateral,
  sentido,
  type AcaoJogador,
  type Alvo,
  type EstiloJogada,
  type Plano,
  type Ponto,
  type QuadroAtor,
  type TrechoBola,
} from './jogada.js';

export type { Ponto, AcaoJogador, EstiloJogada } from './jogada.js';
import { climaDaPartida, ehT2, quemUsaSegundoUniforme, type Clima } from './clima.js';
import { JUIZ_NO_APITO_INICIAL, RITMO_DO_JUIZ, acaoNaFalta, alvoDoJuiz, type JuizNoQuadro, type MomentoDoJuiz } from './juiz.js';
import { F_RESOLUCAO_PENALTI, estadoDaDisputa, instanteDaCobranca, montarDisputa, quadroDaDisputa, resultadoDaCobranca, type Disputa, type EstadoPenaltis } from './penaltis.js';
export type { Disputa, EstadoPenaltis, MarcaDePenalti } from './penaltis.js';

export const DURACAO_JOGO = 90 * 60;
/** Velocidade do Ao Vivo: 90 minutos de jogo em 4 min 30 s (ADR-0005; era 15×, 6 min). */
export const VELOCIDADE_AO_VIVO = 20;

/**
 * Ritmo novo (ADR-0045, VERSAO_SIM 12+): a jogada tem duração fixa, no ritmo do Reels, e o resto
 * do tempo entre os lances (e até o apito) é toque de bola. Partidas antigas ficam como eram.
 */
export const ritmoNovo = (r: Pick<ResultadoPartida, 'versaoSim'>): boolean => r.versaoSim >= 12;
/** Duração de uma jogada no ritmo novo (s de jogo): ~7,5 s no Ao Vivo, como no Reels. */
export const DURACAO_JOGADA = 150;
/** Depois de gol (e no Apito Inicial), tempo mínimo para a comemoração e a saída de bola. */
const RESERVA_SAIDA = 70;
/** Velocidade da bola no toque de bola (campo por s de jogo) e limites de cada passe (s). */
const VEL_PASSE = 0.025;
const PASSE_MIN = 3;
const PASSE_MAX = 12;

export type TipoDestaque = 'GOL' | 'DEFESA' | 'BLOQUEIO' | 'DESARME' | 'FORA' | 'FALTA';

export interface Destaque {
  tipo: TipoDestaque;
  lado: Lado;
  /** Quem protagonizou: autor do gol, goleiro da defesa, zagueiro do desarme, finalizador do chute fora. */
  protagonista: SlotRef;
  /** 0 → 1 enquanto o destaque está na tela. */
  progresso: number;
  /** Letreiro de cobrança de pênalti (menor que o de gol de jogo). */
  penalti?: boolean;
  /** T2: cartão na falta (o letreiro vira "Cartão amarelo!" ou "Expulso!"). */
  cartao?: 'AMARELO' | 'VERMELHO';
  /** T2: o lance era uma cobrança de falta ou pênalti (muda o letreiro). */
  bolaParada?: Lance['bolaParada'];
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
  /** Temporada 2: Clima, segundo uniforme e Arquibancada (null nas Partidas da T1). */
  t2: InfoT2 | null;
  /** Temporada 2 (ADR-0041): o juiz em campo, só visual (null nas Partidas da T1). */
  juiz: JuizNoQuadro | null;
}

/** Temporada 2 (ADR-0019): o que só aparece nas Partidas com as regras da T2. */
export interface InfoT2 {
  clima: Clima;
  /** Lado que joga com o segundo uniforme (as camisas se confundiam), ou null. */
  segundoUniforme: Lado | null;
  /** Tamanho de cada torcida na Arquibancada (cresce com o Elenco). */
  torcida: Record<Lado, number>;
}

interface Janela {
  lance: Lance;
  inicio: number;
  fim: number;
  /** Instante em que a jogada se resolve (chute ou desarme). */
  resolucao: number;
}

/**
 * Trecho contínuo da Timeline com um Plano: a jogada de um lance ou um intervalo de toque de bola
 * (só no ritmo novo). Nas partidas antigas, as faixas são as próprias janelas dos lances.
 */
interface Faixa {
  inicio: number;
  fim: number;
  plano: Plano;
  trilhas: Map<string, QuadroAtor[]>;
  /** Índice do lance (em `lances`), ou -1 no toque de bola. */
  indiceLance: number;
  lance?: Lance;
  proximo?: Lance;
  /** Toque de bola: quem está com a bola (o Time que ataca no lance seguinte). */
  toque?: { posse: Lado };
}

/** Intervalo de toque de bola antes do lance `antes` (ou depois do último, se `antes` = nº de lances). */
interface Intervalo {
  inicio: number;
  fim: number;
  antes: number;
}

/** Por quantos segundos de jogo um destaque fica na tela. */
const DURACAO_DESTAQUE: Record<TipoDestaque, number> = { GOL: 75, DEFESA: 40, BLOQUEIO: 35, DESARME: 25, FORA: 30, FALTA: 45 };
/** Intervalo (s de jogo) usado para medir a velocidade de cada Jogador. */
const DT_VEL = 0.6;

/** Posições-base (lado mandante, que ataca para y = 0). O visitante é espelhado. */
const BASE_POR_POSICAO: Record<Posicao, Ponto[]> = {
  GOL: [{ x: 0.5, y: 0.93 }],
  ZAG: [{ x: 0.32, y: 0.79 }, { x: 0.68, y: 0.79 }],
  MEI: [{ x: 0.36, y: 0.62 }, { x: 0.64, y: 0.62 }],
  ATA: [{ x: 0.4, y: 0.44 }, { x: 0.6, y: 0.44 }],
};
/**
 * Formação (ADR-0044): com um ou três numa linha, o desenho muda. Um fica no meio; três abrem,
 * e o do meio fica um pouco atrás (o zagueiro da sobra, o volante do 2-3-1).
 */
const BASE_POR_QUANTIDADE: Partial<Record<Posicao, Record<number, Ponto[]>>> = {
  ZAG: { 3: [{ x: 0.24, y: 0.78 }, { x: 0.5, y: 0.82 }, { x: 0.76, y: 0.78 }] },
  MEI: { 1: [{ x: 0.5, y: 0.62 }], 3: [{ x: 0.24, y: 0.6 }, { x: 0.5, y: 0.65 }, { x: 0.76, y: 0.6 }] },
  ATA: { 1: [{ x: 0.5, y: 0.42 }] },
};

const espelhar = (p: Ponto, lado: Lado): Ponto => (lado === 'mandante' ? p : { x: 1 - p.x, y: 1 - p.y });
const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
const lerpP = (a: Ponto, b: Ponto, f: number): Ponto => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
const suave = (f: number): number => f * f * (3 - 2 * f);
const limitar = (x: number, min = 0, max = 1): number => Math.min(max, Math.max(min, x));
/** 0 fora de [a, d]; sobe de a até b; 1 de b até c; desce de c até d. */
const trapezio = (f: number, a: number, b: number, c: number, d: number): number =>
  f <= a || f >= d ? 0 : f < b ? suave((f - a) / (b - a)) : f <= c ? 1 : suave((d - f) / (d - c));
/** Onde o juiz fica na disputa de pênaltis: ao lado da área, fora da roda. */
const JUIZ_NOS_PENALTIS: Ponto = { x: 0.74, y: 0.2 };
const chave = (s: SlotRef) => `${s.lado}:${s.indice}`;


export class Timeline {
  readonly janelas: Janela[];
  readonly planos: Plano[];
  /** Disputa de pênaltis depois dos 90 minutos, se houve. */
  readonly disputa: Disputa | null;
  private readonly bases: Record<Lado, Ponto[]>;
  private readonly trilhas: Map<string, QuadroAtor[]>[];
  /** Jogadas e intervalos de toque de bola, em ordem (ADR-0045). */
  private readonly faixas: Faixa[];
  /** Ritmo novo (ADR-0045): jogada de duração fixa e toque de bola entre os lances. */
  readonly novo: boolean;
  /** Posições depois da física, a cada FISICA.dt (x, y intercalados), por slot. */
  private readonly corridas: Map<string, Float32Array>;

  /** Temporada 2: Clima, uniformes e Arquibancada; null nas Partidas da T1. */
  readonly t2: InfoT2 | null;
  /** Temporada 2: instante (s de jogo) em que cada expulso deixa o campo. */
  private readonly saidas: Map<string, number>;
  /** Temporada 2: corrida do juiz (x, y intercalados a cada FISICA.dt); null na T1. */
  private readonly corridaDoJuiz: Float32Array | null;

  constructor(
    readonly resultado: ResultadoPartida,
    readonly escalacoes: Record<Lado, Escalacao>,
    extras: { torcida?: Record<Lado, number> } = {},
  ) {
    this.bases = {
      mandante: posicoesBase(escalacoes.mandante, 'mandante'),
      visitante: posicoesBase(escalacoes.visitante, 'visitante'),
    };
    this.novo = ritmoNovo(resultado);
    const lances = resultado.lances;
    const cheias = montarJanelas(lances);
    const encaixe = this.novo ? encaixarJogadas(cheias, lances) : { janelas: cheias, intervalos: [] as Intervalo[] };
    this.janelas = encaixe.janelas;
    // O expulso sai do campo depois que o cartão aparece.
    this.saidas = new Map(
      this.janelas.flatMap((j) => (j.lance.falta?.cartao === 'VERMELHO' ? [[chave(j.lance.falta.autor), j.resolucao + DURACAO_DESTAQUE.FALTA * 0.7] as [string, number]] : [])),
    );
    /** Antes destes lances há toque de bola (ritmo novo): a jogada começa com a bola no criador. */
    const comToqueAntes = new Set(encaixe.intervalos.map((x) => x.antes));
    // Jogo contínuo: a bola só volta ao meio depois de gol. Nos outros lances ela termina
    // com quem começa o próximo ataque (passe ou chutão recuperado) e o próximo sai dali.
    // Bola parada: antes de um escanteio a bola sai pela linha de fundo; antes de um lateral,
    // pela linha lateral, onde o próximo lance é cobrado.
    const saida = (i: number): Ponto => {
      const proximo = lances[i + 1];
      if (!proximo || lances[i]!.tipo === 'GOL') return MEIO;
      if (proximo.bolaParada === 'ESCANTEIO') return pontoDoEscanteio(proximo);
      if (proximo.bolaParada === 'LATERAL') return pontoDoLateral(proximo, this.bases);
      if (proximo.bolaParada && COBRANCAS_DE_FALTA.has(proximo.bolaParada)) return pontoDaFalta(proximo);
      return this.bases[proximo.criador.lado][proximo.criador.indice]!;
    };
    this.planos = lances.map((l, i) => {
      const proximo = lances[i + 1];
      const plano = montarPlano(l, this.bases, escalacoes, resultado.seed, {
        duracao: this.janelas[i]!.fim - this.janelas[i]!.inicio,
        entrada: i === 0 ? MEIO : saida(i - 1),
        saida: saida(i),
        ...(proximo?.bolaParada === 'ESCANTEIO' ? { escanteio: pontoDoEscanteio(proximo) } : {}),
        ...(proximo?.bolaParada && l.tipo !== 'GOL'
          ? { cobrancaSeguinte: { slot: cobradorDaBolaParada(proximo, this.bases, escalacoes), ponto: pontoDoCobrador(proximo, this.bases) } }
          : {}),
        // Ritmo novo: depois do gol a bola fica na rede; quem sofreu vai buscá-la no toque de bola.
        ...(this.novo && l.tipo === 'GOL' ? { golFicaNaRede: true } : {}),
      });
      // Ritmo novo: depois do toque de bola, a jogada começa com a bola já no pé do criador.
      return this.novo && comToqueAntes.has(i) ? comecaNoCriador(plano, l.criador) : plano;
    });
    this.trilhas = this.planos.map((p) => new Map(p.atores.map((a) => [chave(a.slot), a.quadros])));
    const faixasDosLances: Faixa[] = this.janelas.map((j, i) => ({
      inicio: j.inicio,
      fim: j.fim,
      plano: this.planos[i]!,
      trilhas: this.trilhas[i]!,
      indiceLance: i,
      lance: j.lance,
      ...(this.janelas[i + 1] ? { proximo: this.janelas[i + 1]!.lance } : {}),
    }));
    const faixasDoToque: Faixa[] = encaixe.intervalos.map((iv) => {
      const plano = this.planoDoToque(iv, lances, resultado.seed);
      return {
        inicio: iv.inicio,
        fim: iv.fim,
        plano,
        trilhas: new Map(plano.atores.map((a) => [chave(a.slot), a.quadros])),
        indiceLance: -1,
        toque: { posse: this.posseNoToque(iv, lances) },
      };
    });
    this.faixas = [...faixasDosLances, ...faixasDoToque].sort((x, y) => x.inicio - y.inicio);
    this.disputa = montarDisputa(resultado, DURACAO_JOGO);
    this.corridas = this.simularCorridas();
    const torcidaPadrao = (lado: Lado) => 4 + 2 * escalacoes[lado].jogadores.filter((j) => j.jogadorId !== null).length;
    this.t2 = ehT2(resultado)
      ? {
          clima: climaDaPartida(resultado.seed),
          segundoUniforme: quemUsaSegundoUniforme(resultado.times),
          torcida: extras.torcida ?? { mandante: torcidaPadrao('mandante'), visitante: torcidaPadrao('visitante') },
        }
      : null;
    this.corridaDoJuiz = this.t2 ? this.simularJuiz() : null;
  }

  /** O que o juiz está fazendo em t: acompanhando a bola, indo à falta ou voltando depois do gol. */
  private momentoDoJuiz(t: number, bola: Ponto): MomentoDoJuiz {
    for (let i = this.janelas.length - 1; i >= 0; i--) {
      const j = this.janelas[i]!;
      if (t < j.resolucao) continue;
      const tipo = j.lance.tipo;
      if (tipo === 'FALTA' && j.lance.falta && t < j.resolucao + DURACAO_DESTAQUE.FALTA) return { tipo: 'FALTA', autor: this.corridaEm(j.lance.falta.autor, t) };
      if (tipo === 'GOL' && t < j.resolucao + DURACAO_DESTAQUE.GOL) return { tipo: 'GOL' };
      break;
    }
    return { tipo: 'JOGO', bola };
  }

  /** Integra a corrida do juiz com a mesma física dos Jogadores, um pouco mais lento. */
  private simularJuiz(): Float32Array {
    const n = Math.ceil(DURACAO_JOGO / FISICA.dt) + 1;
    const saida = new Float32Array(n * 2);
    const p = { ...JUIZ_NO_APITO_INICIAL };
    const v = { x: 0, y: 0 };
    for (let k = 0; k < n; k++) {
      const t = Math.min(k * FISICA.dt, DURACAO_JOGO);
      if (k > 0) {
        const alvo = alvoDoJuiz(this.momentoDoJuiz(t, this.bolaEm(t, this.faixaEm(t)).pos));
        const dx = alvo.pos.x - p.x;
        const dy = alvo.pos.y - p.y;
        const dist = Math.hypot(dx, dy);
        // Longe do lance, o juiz dispara para alcançar; perto, acompanha trotando.
        const teto = (alvo.naJogada || dist > 0.2 ? FISICA.sprint : FISICA.trote) * RITMO_DO_JUIZ;
        const rapidez = Math.min(teto, dist / FISICA.chegada);
        const desejada = dist > 1e-6 ? { x: (dx / dist) * rapidez, y: (dy / dist) * rapidez } : { x: 0, y: 0 };
        let ax = desejada.x - v.x;
        let ay = desejada.y - v.y;
        const a = Math.hypot(ax, ay);
        const amax = FISICA.aceleracao * FISICA.dt;
        if (a > amax) {
          ax *= amax / a;
          ay *= amax / a;
        }
        v.x += ax;
        v.y += ay;
        p.x += v.x * FISICA.dt;
        p.y += v.y * FISICA.dt;
      }
      saida[k * 2] = p.x;
      saida[k * 2 + 1] = p.y;
    }
    return saida;
  }

  /** Posição do juiz em t (interpolada entre os passos). */
  private juizEm(t: number): Ponto {
    const arr = this.corridaDoJuiz!;
    const u = limitar(t, 0, DURACAO_JOGO) / FISICA.dt;
    const k = Math.min(Math.floor(u), arr.length / 2 - 2);
    const r = u - k;
    return { x: limitar(lerp(arr[k * 2]!, arr[k * 2 + 2]!, r), 0.03, 0.97), y: limitar(lerp(arr[k * 2 + 1]!, arr[k * 2 + 3]!, r), 0.02, 0.98) };
  }

  /** O juiz no quadro: posição, para onde corre e o gesto (apito ou cartão) na falta. */
  private juizNoQuadro(t: number, bola: Ponto, destaque: Destaque | null, jogadores: JogadorNoQuadro[]): JuizNoQuadro | null {
    if (!this.corridaDoJuiz) return null;
    const pos = this.juizEm(t);
    const antes = this.juizEm(Math.max(0, t - DT_VEL));
    const vel = { x: (pos.x - antes.x) / DT_VEL, y: (pos.y - antes.y) / DT_VEL };
    const correndo = Math.hypot(vel.x, vel.y) > 0.0016;
    if (destaque?.tipo === 'FALTA') {
      const autor = jogadores.find((j) => j.slot.lado === destaque.protagonista.lado && j.slot.indice === destaque.protagonista.indice);
      const dist = autor ? Math.hypot(autor.pos.x - pos.x, autor.pos.y - pos.y) : 0;
      const gesto = acaoNaFalta(destaque.progresso, destaque.cartao, dist);
      if (gesto) return { pos, vel, seed: this.resultado.seed, olhar: autor?.pos ?? bola, acao: gesto, ...(gesto === 'CARTAO' && destaque.cartao ? { cartao: destaque.cartao } : {}) };
    }
    return { pos, vel, seed: this.resultado.seed, olhar: bola, acao: correndo ? 'CORRENDO' : 'PARADO' };
  }

  /** Integra as corridas do jogo todo (uma vez, na criação): alvo = coreografia, passo = física. */
  private simularCorridas(): Map<string, Float32Array> {
    const n = Math.ceil(DURACAO_JOGO / FISICA.dt) + 1;
    const slots: SlotRef[] = (['mandante', 'visitante'] as const).flatMap((lado) => this.escalacoes[lado].jogadores.map((_, indice) => ({ lado, indice })));
    const saida = new Map(slots.map((s) => [chave(s), new Float32Array(n * 2)]));
    const pos = slots.map((s) => ({ ...this.alvoDe(s, 0, this.faixaEm(0), 0, MEIO).pos }));
    const vel = slots.map(() => ({ x: 0, y: 0 }));
    for (let k = 0; k < n; k++) {
      const t = Math.min(k * FISICA.dt, DURACAO_JOGO);
      const indice = this.faixaEm(t);
      const f = indice >= 0 ? this.fracao(indice, t) : 0;
      const bola = this.bolaEm(t, indice, true).pos;
      slots.forEach((s, i) => {
        const p = pos[i]!;
        const v = vel[i]!;
        if (k > 0) {
          const alvo = this.alvoDe(s, t, indice, f, bola);
          const dx = alvo.pos.x - p.x;
          const dy = alvo.pos.y - p.y;
          const dist = Math.hypot(dx, dy);
          const teto = alvo.naJogada ? FISICA.sprint : FISICA.trote;
          const rapidez = Math.min(teto, dist / FISICA.chegada);
          const desejada = dist > 1e-6 ? { x: (dx / dist) * rapidez, y: (dy / dist) * rapidez } : { x: 0, y: 0 };
          let ax = desejada.x - v.x;
          let ay = desejada.y - v.y;
          const a = Math.hypot(ax, ay);
          const amax = FISICA.aceleracao * FISICA.dt;
          if (a > amax) {
            ax *= amax / a;
            ay *= amax / a;
          }
          v.x += ax;
          v.y += ay;
          p.x += v.x * FISICA.dt;
          p.y += v.y * FISICA.dt;
        }
        const arr = saida.get(chave(s))!;
        arr[k * 2] = p.x;
        arr[k * 2 + 1] = p.y;
      });
    }
    return saida;
  }

  /** Posição depois da física (interpolada entre os passos). */
  private corridaEm(slot: SlotRef, t: number): Ponto {
    const arr = this.corridas.get(chave(slot))!;
    const u = limitar(t, 0, DURACAO_JOGO) / FISICA.dt;
    const k = Math.min(Math.floor(u), arr.length / 2 - 2);
    const r = u - k;
    return { x: lerp(arr[k * 2]!, arr[k * 2 + 2]!, r), y: lerp(arr[k * 2 + 1]!, arr[k * 2 + 3]!, r) };
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
    const k = this.faixaEm(t);
    const indice = k >= 0 ? this.faixas[k]!.indiceLance : -1;
    const { pos: bola, altura } = this.bolaEm(t, k);
    const agora = this.posicoesEm(t);
    const antes = this.posicoesEm(Math.max(0, t - DT_VEL));
    const plano = k >= 0 ? this.faixas[k]!.plano : null;
    const f = k >= 0 ? this.fracao(k, t) : 0;

    const jogadores: JogadorNoQuadro[] = agora
      .map((j, k) => {
        const a = antes[k]!.pos;
        const vel = { x: (j.pos.x - a.x) / DT_VEL, y: (j.pos.y - a.y) / DT_VEL };
        const especial = plano?.acoes.find((x) => x.slot.lado === j.slot.lado && x.slot.indice === j.slot.indice && f >= x.de && f < x.ate);
        const correndo = Math.hypot(vel.x, vel.y) > 0.0016;
        return { ...j, vel, olhar: bola, acao: especial?.acao ?? (correndo ? 'CORRENDO' : 'PARADO') };
      })
      // T2: o expulso não volta mais ao campo.
      .filter((j) => t < (this.saidas.get(chave(j.slot)) ?? Infinity));

    const destaque = this.destaqueEm(t);
    return {
      t,
      minuto: Math.min(90, Math.floor(t / 60) + 1),
      placar: this.placarEm(t),
      bola,
      bolaAltura: altura,
      jogadores,
      destaque,
      lanceAtual: indice,
      estilo: indice >= 0 ? this.planos[indice]!.estilo : null,
      encerrada: t >= DURACAO_JOGO && !this.disputa,
      penaltis: null,
      t2: this.t2,
      juiz: this.juizNoQuadro(t, bola, destaque, jogadores),
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
      t2: this.t2,
      // Na disputa de pênaltis, o juiz fica parado ao lado da área, olhando a cobrança.
      juiz: this.t2 ? { pos: JUIZ_NOS_PENALTIS, vel: { x: 0, y: 0 }, seed, olhar: agora.bola, acao: 'PARADO' } : null,
    };
  }

  /** Faixa (jogada ou toque de bola) em andamento em t, ou -1 (antes do 1º lance ou depois do último, nas partidas antigas). */
  private faixaEm(t: number): number {
    const k = this.faixas.findIndex((j) => t >= j.inicio && t < j.fim);
    // Ritmo novo: no apito (t = 90 min) vale a última faixa, sem a bola pular para o meio.
    if (k < 0 && this.novo && this.faixas.length && t >= this.faixas[this.faixas.length - 1]!.fim) return this.faixas.length - 1;
    return k;
  }

  private fracao(faixa: number, t: number): number {
    const j = this.faixas[faixa]!;
    return (t - j.inicio) / (j.fim - j.inicio);
  }

  /** Quem fica com a bola no toque de bola: quem ataca no lance seguinte; no fim, quem defendeu o último. */
  private posseNoToque(iv: Intervalo, lances: readonly Lance[]): Lado {
    const proximo = lances[iv.antes];
    if (proximo) return proximo.ataque;
    const ultimo = lances[lances.length - 1];
    return ultimo ? outroLado(ultimo.ataque) : 'mandante';
  }

  /**
   * Toque de bola (ADR-0045): o Time com a bola troca passes até o lance seguinte (ou até o apito).
   * Depois de gol, e no Apito Inicial, vem antes a saída de bola: o goleiro tira a bola da rede e
   * devolve para o meio, e um Jogador do Time que sofreu corre até ela e toca; a bola só anda
   * depois desse toque. Termina com a bola no criador do lance seguinte.
   */
  private planoDoToque(iv: Intervalo, lances: readonly Lance[], seed: number): Plano {
    const dur = iv.fim - iv.inicio;
    const rng = criarRng(((seed >>> 0) ^ Math.imul(iv.antes + 1, 0x9e3779b1)) >>> 0);
    const anterior = lances[iv.antes - 1];
    const proximo = lances[iv.antes];
    const posse = this.posseNoToque(iv, lances);
    const alvoFinal = proximo ? proximo.criador : null;
    const emCampo = (s: SlotRef) => (this.saidas.get(chave(s)) ?? Infinity) > iv.inicio;
    const doTime = (lado: Lado, ...posicoes: Posicao[]): SlotRef[] =>
      this.escalacoes[lado].jogadores.flatMap((j, indice) => (posicoes.includes(j.posicao) && emCampo({ lado, indice }) ? [{ lado, indice }] : []));
    const base = (s: SlotRef) => this.bases[s.lado][s.indice]!;
    const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
    const tempoDoPasse = (a: Ponto, b: Ponto) => limitar(distancia(a, b) / VEL_PASSE, PASSE_MIN, PASSE_MAX);
    const F = (seg: number) => limitar(seg / dur);
    const bola: TrechoBola[] = [];
    const atores: Plano['atores'] = [];
    const acoes: Plano['acoes'] = [];
    const mesmo = (a: SlotRef, b: SlotRef) => a.lado === b.lado && a.indice === b.indice;
    const passe = (de: number, ate: number, a: SlotRef, b: SlotRef) => {
      bola.push({ de: F(de), ate: F(ate), tipo: 'VOO', origem: { ator: a }, destino: { ator: b }, altura: distancia(base(a), base(b)) > 0.3 ? 0.25 : 0 });
      acoes.push({ slot: a, de: F(de - 0.4), ate: F(de + 0.6), acao: 'PASSE' });
    };
    const posseDe = (de: number, ate: number, s: SlotRef) => {
      if (ate > de) bola.push({ de: F(de), ate: F(ate), tipo: 'POSSE', ator: s });
    };
    const fechar = (): Plano => {
      if (!bola.length) bola.push({ de: 0, ate: 1, tipo: 'PARADA', ponto: MEIO });
      return { estilo: 'TABELA', atores, bola, acoes };
    };
    let tau = 0;
    let X: SlotRef;

    if (!anterior || anterior.tipo === 'GOL') {
      // Saída de bola: quem sofreu o gol (no Apito Inicial, quem ataca primeiro).
      const time: Lado = anterior ? outroLado(anterior.ataque) : posse;
      let livre = 2; // instante (s) a partir do qual a saída pode ser cobrada
      if (anterior) {
        const janela = this.janelas[iv.antes - 1]!;
        const rede = fimDaBola(this.planos[iv.antes - 1]!) ?? { x: 0.5, y: golAlvo(anterior.ataque) };
        const fimDaFesta = Math.max(4, janela.resolucao + DURACAO_DESTAQUE.GOL * 0.8 - iv.inicio);
        // O goleiro que sofreu tira a bola da rede e manda para o meio.
        const G = anterior.defensor;
        const pegada: Ponto = { x: rede.x, y: rede.y + (rede.y < 0.5 ? 0.025 : -0.025) };
        const pega = Math.min(Math.max(3, fimDaFesta * 0.5), dur * 0.3);
        const voo = limitar(distancia(pegada, MEIO) / (VEL_PASSE * 1.6), 4, 10);
        atores.push({ slot: G, quadros: [[0, null], [F(Math.max(0, pega - 6)), null], [F(pega), pegada], [F(pega + 3), pegada], [F(pega + 12), null]] });
        bola.push({ de: 0, ate: F(pega + 1), tipo: 'PARADA', ponto: rede });
        posseDe(pega + 1, pega + 3, G);
        bola.push({ de: F(pega + 3), ate: F(pega + 3 + voo), tipo: 'VOO', origem: { ator: G }, destino: { ponto: MEIO }, altura: 0.55 });
        acoes.push({ slot: G, de: F(pega + 2.6), ate: F(pega + 3.6), acao: 'PASSE' });
        tau = pega + 3 + voo;
        livre = Math.max(tau + 2, fimDaFesta);
      }
      const atacantes = doTime(time, 'ATA');
      const candidatosK = atacantes.length ? atacantes : doTime(time, 'MEI', 'ZAG');
      const K = candidatosK.reduce((a, b) => (distancia(base(b), MEIO) < distancia(base(a), MEIO) ? b : a));
      const meias = doTime(time, 'MEI').filter((m) => !mesmo(m, K));
      const R = meias.length ? meias[Math.floor(rng.next() * meias.length)]! : (doTime(time, 'ZAG')[0] ?? K);
      const pR = tempoDoPasse(MEIO, base(R));
      // Só toca depois de chegar à bola (na velocidade da física), com folga.
      const chegada = distancia(base(K), MEIO) / (FISICA.sprint * 0.85) + 4;
      const tk = Math.max(tau + 1, Math.min(Math.max(livre, chegada), dur - pR - 2));
      const lugar: Ponto = { x: 0.5, y: 0.5 - sentido(time) * 0.016 };
      atores.push({ slot: K, quadros: [[0, null], [F(Math.max(0, tk - chegada - 1)), null], [F(tk - 0.5), lugar], [F(tk + 0.5), lugar], [F(tk + 8), null]] });
      bola.push({ de: F(tau), ate: F(tk), tipo: 'PARADA', ponto: MEIO });
      bola.push({ de: F(tk), ate: F(tk + pR), tipo: 'VOO', origem: { ponto: MEIO }, destino: { ator: R }, altura: 0 });
      acoes.push({ slot: K, de: F(tk - 0.4), ate: F(tk + 0.6), acao: 'PASSE' });
      tau = tk + pR;
      X = R;
      if (time !== posse) {
        // Quem marcou rouba a bola logo depois da saída.
        const S = alvoFinal ?? doTime(posse, 'MEI')[0] ?? doTime(posse, 'ZAG', 'ATA')[0]!;
        const perto = lerpP(base(R), base(S), 0.3);
        // O ladrão sai correndo quando a saída é cobrada e só rouba quando chega.
        const corrida = distancia(base(S), perto) / (FISICA.sprint * 0.85) + 3;
        const rouba = Math.min(Math.max(tau + 3, tk + corrida), dur - 6);
        posseDe(tau, rouba, R);
        atores.push({ slot: S, quadros: [[0, null], [F(tk), null], [F(rouba), perto], [F(rouba + 2.5), perto], [F(rouba + 12), null]] });
        bola.push({ de: F(rouba), ate: F(rouba + 2.5), tipo: 'VOO', origem: { ator: R }, destino: { ator: S }, altura: 0 });
        acoes.push({ slot: S, de: F(rouba - 0.5), ate: F(rouba + 1.5), acao: 'CARRINHO' });
        tau = rouba + 2.5;
        X = S;
      }
    } else {
      // A bola chega de onde o lance anterior a deixou (o goleiro repõe, o zagueiro afasta...).
      const entrada = fimDaBola(this.planos[iv.antes - 1]!) ?? MEIO;
      const perto = doTime(posse, 'ZAG', 'MEI');
      X = alvoFinal ?? (perto.length ? perto.reduce((a, b) => (distancia(base(b), entrada) < distancia(base(a), entrada) ? b : a)) : doTime(posse, 'GOL', 'ATA')[0]!);
      // Tempo de sobra: quem recebe pode estar longe da posição dele (acabou de atacar).
      const v = Math.max(Math.min(3, dur * 0.5), Math.min(12, dur * 0.3));
      bola.push({ de: 0, ate: F(v), tipo: 'VOO', origem: { ponto: entrada }, destino: { ator: X }, altura: 0 });
      tau = v;
    }

    // Troca de passes. Os meias e zagueiros tocam mais; o goleiro e os atacantes, às vezes.
    const peso: Record<Posicao, number> = { ZAG: 3, MEI: 3, ATA: 1, GOL: 0.5 };
    const candidatos = doTime(posse, 'ZAG', 'MEI', 'ATA', 'GOL');
    const posicaoDe = (s: SlotRef) => this.escalacoes[s.lado].jogadores[s.indice]!.posicao;
    const passeFinal = (de: SlotRef) => (alvoFinal && !mesmo(de, alvoFinal) ? tempoDoPasse(base(de), base(alvoFinal)) : 0);
    for (let guarda = 0; guarda < 300; guarda++) {
      const segura = 2 + rng.next() * 4;
      const restante = dur - tau;
      const opcoes = candidatos.filter((c) => !mesmo(c, X));
      let Y: SlotRef | null = null;
      if (opcoes.length) {
        const pesos = opcoes.map((c) => peso[posicaoDe(c)] / (0.06 + distancia(base(X), base(c))));
        let sorte = rng.next() * pesos.reduce((a, b) => a + b, 0);
        Y = opcoes[opcoes.length - 1]!;
        for (let k = 0; k < opcoes.length; k++) {
          sorte -= pesos[k]!;
          if (sorte <= 0) {
            Y = opcoes[k]!;
            break;
          }
        }
      }
      const pY = Y ? tempoDoPasse(base(X), base(Y)) : 0;
      if (!Y || restante < segura + pY + 2 + passeFinal(Y)) {
        const pf = passeFinal(X);
        if (pf > 0 && restante > pf + 0.5) {
          posseDe(tau, dur - pf, X);
          passe(dur - pf, dur, X, alvoFinal!);
        } else if (pf > 0) passe(tau, dur, X, alvoFinal!);
        else posseDe(tau, dur, X);
        break;
      }
      posseDe(tau, tau + segura, X);
      passe(tau + segura, tau + segura + pY, X, Y);
      tau += segura + pY;
      X = Y;
    }
    return fechar();
  }

  /** Posição no toque de bola: quem tem a bola sobe um pouco; quem defende fecha na bola e pressiona. */
  private posicaoNoToque(slot: SlotRef, t: number, posse: Lado, bola: Ponto | null): Ponto {
    const base = this.bases[slot.lado][slot.indice]!;
    const posicao = this.escalacoes[slot.lado].jogadores[slot.indice]!.posicao;
    const balanco = Math.sin(t / 9 + slot.indice * 1.7 + (slot.lado === 'mandante' ? 0 : 3)) * 0.012;
    let pos: Ponto = { x: base.x + balanco, y: base.y + Math.cos(t / 11 + slot.indice) * 0.008 };
    if (slot.lado === posse) return posicao === 'GOL' ? pos : { x: pos.x, y: pos.y + sentido(posse) * 0.03 };
    if (!bola) return pos;
    if (posicao === 'GOL') return { x: lerp(base.x, bola.x, 0.4), y: pos.y };
    pos = lerpP(pos, bola, posicao === 'ATA' ? 0.3 : posicao === 'MEI' ? 0.2 : 0.08);
    return pos;
  }

  /** Posição normal na formação: bloco sobe ao atacar, recua ao defender, com leve balanço. */
  private posicaoNormal(slot: SlotRef, t: number, lance: Lance | undefined, f: number, bola: Ponto | null, proximo?: Lance): Ponto {
    const base = this.bases[slot.lado][slot.indice]!;
    const posicao = this.escalacoes[slot.lado].jogadores[slot.indice]!.posicao;
    // Se o próximo lance é contra-ataque do rival, quem ataca não recua no fim: perde a bola
    // lá na frente e o bloco precisa voltar correndo no lance seguinte.
    const vemContra = Boolean(proximo?.contraAtaque && lance && proximo.ataque !== lance.ataque);
    const avanco = !lance ? 0 : vemContra ? trapezio(f, 0.05, 0.3, 2, 3) : trapezio(f, 0.05, 0.3, 0.8, 0.98);
    let deslocamento = !lance ? 0 : lance.ataque === slot.lado ? 0.1 * avanco : -0.05 * avanco;
    // No contra-ataque, o time que perdeu a bola começa adiantado e volta trotando (o buraco).
    if (lance?.contraAtaque && lance.ataque !== slot.lado && posicao !== 'GOL') {
      const adiantado = lance.contraAtaque.adiantados >= 5 ? 0.16 : 0.1;
      deslocamento = adiantado * (1 - suave(limitar(f / 0.6))) - 0.05 * trapezio(f, 0.4, 0.7, 0.8, 0.98);
    }
    const balanco = Math.sin(t / 9 + slot.indice * 1.7 + (slot.lado === 'mandante' ? 0 : 3)) * 0.012;
    let pos: Ponto = {
      x: base.x + balanco,
      y: base.y + sentido(slot.lado) * deslocamento + Math.cos(t / 11 + slot.indice) * 0.008,
    };
    if (bola && lance) {
      if (posicao === 'GOL' && lance.ataque !== slot.lado) pos = { x: lerp(base.x, bola.x, 0.55), y: pos.y };
      // Quem defende fecha um pouco na direção da bola.
      else if (lance.ataque !== slot.lado && posicao !== 'GOL') {
        pos = lerpP(pos, bola, 0.12 * avanco);
        // Ritmo novo (ADR-0045): o zagueiro que não está no lance faz a cobertura, entre a bola
        // e o gol, do lado dele, em vez de ficar parado olhando.
        if (this.novo && posicao === 'ZAG') {
          const cobertura = lerpP(bola, { x: 0.5, y: golAlvo(lance.ataque) }, 0.55);
          pos = lerpP(pos, { x: cobertura.x + (base.x < 0.5 ? -0.05 : 0.05), y: cobertura.y }, 0.45 * avanco);
        }
      }
    }
    return pos;
  }

  /**
   * Para onde o boneco quer ir (a coreografia do lance ou a posição na formação) e se ele está
   * na jogada (corre em disparada) ou só acompanhando (trota).
   */
  private alvoDe(slot: SlotRef, t: number, indice: number, f: number, bola: Ponto | null): { pos: Ponto; naJogada: boolean } {
    const faixa = indice >= 0 ? this.faixas[indice]! : undefined;
    const lance = faixa?.lance;
    const normal = () => (faixa?.toque ? this.posicaoNoToque(slot, t, faixa.toque.posse, bola) : this.posicaoNormal(slot, t, lance, f, bola, faixa?.proximo));
    const trilha = faixa?.trilhas.get(chave(slot));
    if (!trilha) return { pos: normal(), naJogada: false };
    if (f <= trilha[0]![0] || f >= trilha[trilha.length - 1]![0]) return { pos: normal(), naJogada: false };
    for (let k = 1; k < trilha.length; k++) {
      const [fb, pb] = trilha[k]!;
      if (f <= fb) {
        const [fa, pa] = trilha[k - 1]!;
        const a = pa ?? normal();
        const b = pb ?? normal();
        // Voltando para a formação (destino null) é trote; indo para um ponto marcado, disparada.
        return { pos: lerpP(a, b, suave((f - fa) / (fb - fa))), naJogada: pb !== null };
      }
    }
    return { pos: normal(), naJogada: false };
  }

  private posicaoDe(slot: SlotRef, t: number, indice: number, f: number, bola: Ponto | null): Ponto {
    return this.alvoDe(slot, t, indice, f, bola).pos;
  }

  private posicoesEm(t: number): Omit<JogadorNoQuadro, 'vel' | 'olhar' | 'acao'>[] {
    const lista: Omit<JogadorNoQuadro, 'vel' | 'olhar' | 'acao'>[] = [];
    for (const lado of ['mandante', 'visitante'] as const) {
      this.escalacoes[lado].jogadores.forEach((jogador, i) => {
        const slot = { lado, indice: i };
        const p = this.corridaEm(slot, t);
        lista.push({ slot, posicao: jogador.posicao, pos: { x: limitar(p.x, 0.03, 0.97), y: limitar(p.y, 0.02, 0.98) } });
      });
    }
    return lista;
  }

  /** `bruta`: sem a física (só na integração das corridas, que precisa da bola antes). */
  private bolaEm(t: number, indice: number, bruta = false): { pos: Ponto; altura: number } {
    if (indice < 0) return { pos: MEIO, altura: 0 };
    const f = this.fracao(indice, t);
    const plano = this.faixas[indice]!.plano;
    // O trecho em andamento; num intervalo sem trecho, vale o último que começou.
    const trecho = plano.bola.find((b) => f >= b.de && f < b.ate) ?? [...plano.bola].reverse().find((b) => f >= b.de) ?? plano.bola[0]!;
    const janela = this.faixas[indice]!;
    // Posição de um ator num instante f' da mesma janela (sem depender da bola, para não haver ciclo).
    const ator = (s: SlotRef, fx: number) => {
      const tx = janela.inicio + fx * (janela.fim - janela.inicio);
      return bruta ? this.posicaoDe(s, tx, indice, fx, null) : this.corridaEm(s, tx);
    };
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
        const cartao = j.lance.falta?.cartao;
        const bp = j.lance.bolaParada;
        return {
          tipo,
          lado,
          protagonista,
          progresso: (t - j.resolucao) / dur,
          ...(cartao ? { cartao } : {}),
          ...(bp && bp !== 'LATERAL' && bp !== 'ESCANTEIO' ? { bolaParada: bp } : {}),
        };
      }
    }
    return null;
  }
}

const outroLado = (l: Lado): Lado => (l === 'mandante' ? 'visitante' : 'mandante');

/** Onde a bola termina num plano (ponto fixo), se termina parada ou voando para um ponto. */
function fimDaBola(plano: Plano): Ponto | null {
  const ultimo = plano.bola[plano.bola.length - 1];
  if (!ultimo) return null;
  if (ultimo.tipo === 'PARADA') return ultimo.ponto;
  if (ultimo.tipo === 'VOO' && 'ponto' in ultimo.destino) return ultimo.destino.ponto;
  return null;
}

/** Depois do toque de bola, a jogada começa com a bola já no pé do criador (e não voando de um ponto do campo). */
function comecaNoCriador(plano: Plano, criador: SlotRef): Plano {
  return {
    ...plano,
    bola: plano.bola.map((b): TrechoBola => (b.de === 0 && b.tipo === 'VOO' && 'ponto' in b.origem && 'ator' in b.destino && b.destino.ator.lado === criador.lado && b.destino.ator.indice === criador.indice ? { de: b.de, ate: b.ate, tipo: 'POSSE', ator: criador } : b)),
  };
}

/**
 * Ritmo novo (ADR-0045): dentro do tempo que a sim dá a cada lance, a jogada dura DURACAO_JOGADA e
 * fica no fim (resolve perto do minuto do lance); o que sobra antes vira toque de bola. Bola parada
 * e contra-ataque vêm colados no lance anterior (sem toque no meio): o grupo inteiro fica no fim.
 * Depois de gol (e no Apito Inicial) sobra pelo menos RESERVA_SAIDA para a saída de bola, e do
 * último lance até o apito é toque de bola.
 */
function encaixarJogadas(cheias: readonly Janela[], lances: readonly Lance[]): { janelas: Janela[]; intervalos: Intervalo[] } {
  const imediato = (l: Lance) => Boolean(l.bolaParada || l.contraAtaque);
  const janelas: Janela[] = [];
  const intervalos: Intervalo[] = [];
  let g0 = 0;
  while (g0 < lances.length) {
    let g1 = g0;
    while (g1 + 1 < lances.length && imediato(lances[g1 + 1]!)) g1++;
    const inicio = cheias[g0]!.inicio;
    const espaco = cheias[g1]!.fim - inicio;
    const n = g1 - g0 + 1;
    const reserva = g0 === 0 || lances[g0 - 1]!.tipo === 'GOL' ? RESERVA_SAIDA : 0;
    let dur = Math.min(DURACAO_JOGADA, Math.max((espaco - reserva) / n, Math.min(60, espaco / n)));
    let toque = espaco - n * dur;
    if (toque < 1) {
      toque = 0;
      dur = espaco / n;
    }
    if (toque > 0) intervalos.push({ inicio, fim: inicio + toque, antes: g0 });
    let cursor = inicio + toque;
    for (let i = g0; i <= g1; i++) {
      const lance = lances[i]!;
      const fRes = lance.tipo === 'DESARME' || lance.tipo === 'FALTA' ? F_RESOLUCAO_DESARME : F_RESOLUCAO_CHUTE;
      janelas.push({ lance, inicio: cursor, fim: cursor + dur, resolucao: cursor + dur * fRes });
      cursor += dur;
    }
    g0 = g1 + 1;
  }
  const fim = janelas[janelas.length - 1]?.fim ?? 0;
  if (fim < DURACAO_JOGO - 1) intervalos.push({ inicio: fim, fim: DURACAO_JOGO, antes: lances.length });
  return { janelas, intervalos };
}

export function posicoesBase(escalacao: Escalacao, lado: Lado): Ponto[] {
  const usados: Record<Posicao, number> = { GOL: 0, ZAG: 0, MEI: 0, ATA: 0 };
  const quantos = (p: Posicao) => escalacao.jogadores.filter((j) => j.posicao === p).length;
  return escalacao.jogadores.map((j) => {
    const linha = BASE_POR_QUANTIDADE[j.posicao]?.[quantos(j.posicao)] ?? BASE_POR_POSICAO[j.posicao];
    const ponto = linha[usados[j.posicao]++] ?? linha[0]!;
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
    const fResolucao = lance.tipo === 'DESARME' || lance.tipo === 'FALTA' ? F_RESOLUCAO_DESARME : F_RESOLUCAO_CHUTE;
    janelas.push({ lance, inicio, fim, resolucao: inicio + (fim - inicio) * fResolucao });
    cursor = fim;
  });
  return janelas;
}

export { FISICA };
