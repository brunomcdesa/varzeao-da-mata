/**
 * Coreografia de cada lance: transforma "quem criou, quem finalizou, quem defendeu" (da sim)
 * numa jogada animável, com trajetória de cada envolvido e da bola.
 *
 * O estilo (tabela, chute de longe, lançamento, cruzamento, individual) é sorteado com o
 * seed da Partida e o número do lance. Não muda o resultado da sim, só a forma de mostrar,
 * e é sempre o mesmo para a mesma Partida: Ao Vivo, Replay e Reels mostram a mesma jogada.
 *
 * Tempo: `f` vai de 0 a 1 dentro da janela do lance. Espaço: coordenadas do campo (0–1),
 * mas os planos são escritos em "profundidade", a distância até o gol atacado.
 */
import { criarRng, type Lado, type Lance, type SlotRef } from '@liga/sim';
import type { Escalacao } from '@liga/shared';

export interface Ponto {
  x: number;
  y: number;
}

export type EstiloJogada = 'TABELA' | 'CHUTE_DE_LONGE' | 'LANCAMENTO' | 'CRUZAMENTO' | 'INDIVIDUAL' | 'DESARME';

export type AcaoJogador = 'PARADO' | 'CORRENDO' | 'PASSE' | 'CHUTE' | 'CABECEIO' | 'MERGULHO' | 'CARRINHO' | 'COMEMORANDO';

/** Onde a bola sai ou chega: um ponto fixo ou um Jogador (na posição dele naquele instante). */
export type Alvo = { ponto: Ponto } | { ator: SlotRef };

export type TrechoBola =
  | { de: number; ate: number; tipo: 'POSSE'; ator: SlotRef }
  | { de: number; ate: number; tipo: 'VOO'; origem: Alvo; destino: Alvo; altura: number; chute?: boolean }
  | { de: number; ate: number; tipo: 'PARADA'; ponto: Ponto };

/** Quadro-chave de um Jogador; `null` = a posição normal dele na formação naquele instante. */
export type QuadroAtor = [f: number, pos: Ponto | null];

export interface Plano {
  estilo: EstiloJogada;
  atores: { slot: SlotRef; quadros: QuadroAtor[] }[];
  bola: TrechoBola[];
  acoes: { slot: SlotRef; de: number; ate: number; acao: AcaoJogador }[];
}

/** Fração da janela em que a jogada se resolve (bola chega ao gol, ou desarme). */
export const F_RESOLUCAO_CHUTE = 0.78;
export const F_RESOLUCAO_DESARME = 0.6;

export const MEIO: Ponto = { x: 0.5, y: 0.5 };
export const sentido = (lado: Lado): number => (lado === 'mandante' ? -1 : 1);
export const golAlvo = (ataque: Lado): number => (ataque === 'mandante' ? 0.02 : 0.98);

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

const PESOS: [EstiloJogada, number][] = [
  ['TABELA', 0.24],
  ['CHUTE_DE_LONGE', 0.2],
  ['LANCAMENTO', 0.16],
  ['CRUZAMENTO', 0.2],
  ['INDIVIDUAL', 0.2],
];

/**
 * Continuidade entre lances: de onde a bola vem (`entrada`) e para onde ela vai no fim
 * (`saida`). Só depois de gol a bola volta ao meio; senão quem ficou com ela entrega para
 * quem começa o próximo ataque (ou dá o chutão e o outro time recupera).
 */
export interface Continuidade {
  entrada?: Ponto;
  saida?: Ponto;
}

export function montarPlano(lance: Lance, bases: Record<Lado, Ponto[]>, escalacoes: Record<Lado, Escalacao>, seed: number, cont: Continuidade = {}): Plano {
  const entrada = cont.entrada ?? MEIO;
  const saida = cont.saida ?? MEIO;
  const rng = criarRng(((seed >>> 0) * 31 + lance.numero * 7919) >>> 0);
  const atq = lance.ataque;
  const def: Lado = atq === 'mandante' ? 'visitante' : 'mandante';
  const alvo = golAlvo(atq);
  const dir = sentido(atq);
  /** Ponto a `prof` do gol atacado (0 = linha do gol, 0,5 = meio-campo). */
  const P = (x: number, prof: number): Ponto => ({ x: Math.min(0.96, Math.max(0.04, x)), y: alvo - dir * prof });
  const C = lance.criador;
  const cx = bases[C.lado][C.indice]!.x;

  if (lance.tipo === 'DESARME') {
    return lance.drible && lance.finalizador ? planoDesarmeNoDrible(lance, P, cx, bases, rng.next()) : planoDesarme(lance, P, cx, rng.next());
  }

  const F = lance.finalizador!;
  const fx = bases[F.lado][F.indice]!.x;
  const bloqueio = lance.tipo === 'BLOQUEIO';
  // No BLOQUEIO quem para a jogada é o marcador; o goleiro só assiste.
  const G = bloqueio ? goleiroDe(escalacoes[def], def) : lance.defensor;
  let sorteio = rng.next();
  let estilo: EstiloJogada = 'INDIVIDUAL';
  for (const [e, p] of PESOS) {
    if (sorteio < p) {
      estilo = e;
      break;
    }
    sorteio -= p;
  }
  // Drible certo é sempre jogada individual; chute marcado nunca é (não passou pelo zagueiro).
  if (lance.drible === true) estilo = 'INDIVIDUAL';
  else if (lance.drible === false && estilo === 'INDIVIDUAL') estilo = 'TABELA';

  const atores = new Map<string, QuadroAtor[]>();
  const bola: TrechoBola[] = [];
  const acoes: Plano['acoes'] = [];
  const ator = (s: SlotRef, q: QuadroAtor[]) => atores.set(`${s.lado}:${s.indice}`, q);
  const acao = (slot: SlotRef, de: number, ate: number, a: AcaoJogador) => acoes.push({ slot, de, ate, acao: a });
  const passe = (de: number, ate: number, a: SlotRef, b: SlotRef, altura = 0) => {
    bola.push({ de, ate, tipo: 'VOO', origem: { ator: a }, destino: { ator: b }, altura });
    acao(a, de - 0.01, de + 0.025, 'PASSE');
  };
  const posse = (de: number, ate: number, s: SlotRef) => bola.push({ de, ate, tipo: 'POSSE', ator: s });

  // A bola chega ao criador de onde o lance anterior a deixou (do meio, só depois de gol).
  bola.push({ de: 0, ate: 0.08, tipo: 'VOO', origem: { ponto: entrada }, destino: { ator: C }, altura: 0 });

  // Destino do chute, que depende do resultado do lance.
  const r = rng.next();
  let destino: Ponto;
  let alturaChute: number;
  if (lance.tipo === 'GOL') destino = P(0.5 + (r * 2 - 1) * 0.085, -0.012);
  else if (lance.tipo === 'DEFESA') destino = P(0.5 + (r * 2 - 1) * 0.08, 0.035);
  else destino = r < 0.5 ? P(r < 0.25 ? 0.33 : 0.67, -0.01) : P(0.44 + r * 0.12, -0.01);
  const porCima = lance.tipo === 'FORA' && r >= 0.5;

  let inicioChute: number;
  let finalizacao: Ponto; // onde o finalizador está quando chuta
  const lateral = cx < 0.5 ? -1 : 1;

  switch (estilo) {
    case 'TABELA': {
      const cMeio = lerp(cx, 0.5, 0.5);
      const fArea = lerp(fx, 0.5, 0.5);
      finalizacao = P(fArea, 0.11);
      ator(C, [[0, null], [0.08, P(cx, 0.5)], [0.22, P(cx, 0.4)], [0.3, P(cx, 0.37)], [0.42, P(cMeio, 0.25)], [0.5, P(cMeio, 0.24)], [0.68, null]]);
      ator(F, [[0, null], [0.22, P(fx, 0.33)], [0.34, P(fx, 0.32)], [0.54, P(fArea, 0.12)], [0.68, finalizacao], [0.78, finalizacao], [0.95, P(fArea, 0.15)], [1, null]]);
      posse(0.08, 0.22, C);
      passe(0.22, 0.3, C, F);
      passe(0.3, 0.4, F, C); // de primeira
      posse(0.4, 0.44, C);
      passe(0.44, 0.54, C, F);
      posse(0.54, 0.68, F);
      inicioChute = 0.68;
      alturaChute = porCima ? 0.6 : 0.06;
      break;
    }
    case 'CHUTE_DE_LONGE': {
      const fLonge = lerp(fx, 0.5, 0.5);
      finalizacao = P(fLonge, 0.31);
      ator(C, [[0, null], [0.08, P(cx, 0.52)], [0.35, P(cx, 0.42)], [0.5, P(cx, 0.42)], [0.72, null]]);
      ator(F, [[0, null], [0.3, P(fx, 0.37)], [0.43, P(fLonge, 0.33)], [0.6, finalizacao], [0.78, finalizacao], [0.92, P(fLonge, 0.28)], [1, null]]);
      posse(0.08, 0.35, C);
      passe(0.35, 0.43, C, F);
      posse(0.43, 0.6, F);
      inicioChute = 0.6;
      alturaChute = porCima ? 0.7 : 0.22;
      break;
    }
    case 'LANCAMENTO': {
      const fArea = lerp(fx, 0.5, 0.5);
      finalizacao = P(fArea, 0.12);
      ator(C, [[0, null], [0.1, P(cx, 0.66)], [0.3, P(cx, 0.66)], [0.5, null]]);
      ator(F, [[0, null], [0.15, P(fx, 0.42)], [0.28, P(fx, 0.4)], [0.47, P(lerp(fx, 0.5, 0.3), 0.24)], [0.7, finalizacao], [0.78, finalizacao], [0.95, P(fArea, 0.15)], [1, null]]);
      posse(0.08, 0.28, C);
      passe(0.28, 0.47, C, F, 0.45); // bola longa por cima
      posse(0.47, 0.7, F);
      inicioChute = 0.7;
      alturaChute = porCima ? 0.6 : 0.06;
      break;
    }
    case 'CRUZAMENTO': {
      const ponta = lateral < 0 ? 0.08 : 0.92;
      const cabeca = 0.5 - lateral * 0.04;
      finalizacao = P(cabeca, 0.08);
      ator(C, [[0, null], [0.08, P(cx, 0.5)], [0.3, P(lerp(cx, ponta, 0.6), 0.34)], [0.54, P(ponta, 0.15)], [0.6, P(ponta, 0.14)], [0.78, null]]);
      ator(F, [[0, null], [0.3, P(fx, 0.3)], [0.56, P(lerp(fx, cabeca, 0.6), 0.2)], [0.7, finalizacao], [0.78, finalizacao], [0.95, P(cabeca, 0.12)], [1, null]]);
      posse(0.08, 0.56, C);
      passe(0.56, 0.7, C, F, 0.5); // cruzamento
      inicioChute = 0.7;
      alturaChute = porCima ? 0.5 : 0.04;
      break;
    }
    default: {
      // INDIVIDUAL: o finalizador recebe, passa pelo zagueiro e bate.
      const fArea = lerp(fx, 0.5, 0.42);
      finalizacao = P(fArea, 0.13);
      ator(C, [[0, null], [0.08, P(cx, 0.5)], [0.3, P(cx, 0.4)], [0.45, P(cx, 0.42)], [0.62, null]]);
      ator(F, [[0, null], [0.3, P(fx, 0.33)], [0.38, P(fx, 0.3)], [0.6, P(lerp(fx, 0.5, 0.25), 0.18)], [0.71, finalizacao], [0.78, finalizacao], [0.95, P(fArea, 0.16)], [1, null]]);
      posse(0.08, 0.3, C);
      passe(0.3, 0.38, C, F);
      posse(0.38, 0.71, F);
      inicioChute = 0.71;
      alturaChute = porCima ? 0.6 : 0.07;
      // O marcador (ou o zagueiro mais próximo) tenta o bote e fica para trás.
      const zag = lance.marcador ?? zagueiroMaisProximo(escalacoes[def], bases[def], def, fx);
      if (zag) {
        const bote = P(lerp(fx, 0.5, 0.25) + lateral * 0.05, 0.2);
        ator(zag, [[0, null], [0.4, null], [0.58, bote], [0.66, P(bote.x - lateral * 0.03, 0.22)], [0.8, P(bote.x, 0.16)], [1, null]]);
        acao(zag, 0.55, 0.64, 'CARRINHO');
      }
    }
  }

  // Chute marcado: o marcador fecha o espaço entre o finalizador e o gol.
  if (lance.marcador && lance.drible === false) {
    const M = lance.marcador;
    const frente: Ponto = { x: finalizacao.x + lateral * 0.012, y: finalizacao.y + dir * 0.045 };
    ator(M, [[0, null], [Math.max(0.1, inicioChute - 0.25), null], [inicioChute, frente], [0.86, frente], [1, null]]);
    if (bloqueio) {
      // Segura um instante e bate: a bola explode no marcador, que sai jogando.
      posse(inicioChute, F_RESOLUCAO_CHUTE - 0.045, F);
      const chute = F_RESOLUCAO_CHUTE - 0.045;
      bola.push({ de: chute, ate: F_RESOLUCAO_CHUTE, tipo: 'VOO', origem: { ator: F }, destino: { ator: M }, altura: 0.05, chute: true });
      acao(F, chute - 0.015, chute + 0.03, 'CHUTE');
      acao(M, chute - 0.01, F_RESOLUCAO_CHUTE + 0.05, 'CARRINHO');
      const sobra: Ponto = { x: frente.x - lateral * 0.04, y: frente.y - dir * 0.05 };
      bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.83, tipo: 'VOO', origem: { ator: M }, destino: { ponto: sobra }, altura: 0.25 });
      bola.push({ de: 0.83, ate: 0.88, tipo: 'VOO', origem: { ponto: sobra }, destino: { ator: M }, altura: 0 });
      bola.push({ de: 0.88, ate: 1, tipo: 'VOO', origem: { ator: M }, destino: { ponto: saida }, altura: 0.55 });
      acao(M, 0.87, 0.91, 'PASSE');
      return fechar();
    }
    acao(M, inicioChute - 0.03, inicioChute + 0.05, 'CARRINHO');
  }

  // O chute.
  bola.push({ de: inicioChute, ate: F_RESOLUCAO_CHUTE, tipo: 'VOO', origem: { ator: F }, destino: { ponto: destino }, altura: alturaChute, chute: true });
  acao(F, inicioChute - 0.015, inicioChute + 0.03, estilo === 'CRUZAMENTO' ? 'CABECEIO' : 'CHUTE');

  // O goleiro: acompanha a bola (posição normal) e, no chute, mergulha.
  const linha = P(0.5, 0.03);
  const mergulho: Ponto =
    lance.tipo === 'DEFESA'
      ? destino
      : lance.tipo === 'GOL'
        ? { x: lerp(linha.x, destino.x, r < 0.5 ? 0.55 : -0.6), y: linha.y } // às vezes cai para o lado errado
        : { x: lerp(linha.x, destino.x, 0.4), y: linha.y };
  ator(G, [[0, null], [inicioChute, null], [F_RESOLUCAO_CHUTE, mergulho], [0.9, lance.tipo === 'DEFESA' ? P(0.5, 0.06) : mergulho], [1, null]]);
  if (!porCima || lance.tipo !== 'FORA') acao(G, inicioChute + (F_RESOLUCAO_CHUTE - inicioChute) * 0.45, F_RESOLUCAO_CHUTE + 0.06, 'MERGULHO');

  // Depois da finalização.
  if (lance.tipo === 'GOL') {
    bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.9, tipo: 'PARADA', ponto: destino });
    bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ponto: destino }, destino: { ponto: MEIO }, altura: 0.3 });
    acao(F, F_RESOLUCAO_CHUTE + 0.01, 0.97, 'COMEMORANDO');
    acao(C, F_RESOLUCAO_CHUTE + 0.04, 0.95, 'COMEMORANDO');
  } else if (lance.tipo === 'DEFESA') {
    bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.9, tipo: 'POSSE', ator: G });
    bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ator: G }, destino: { ponto: saida }, altura: 0.6 });
    acao(G, 0.88, 0.92, 'PASSE');
  } else {
    bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.86, tipo: 'PARADA', ponto: destino });
    bola.push({ de: 0.86, ate: 0.9, tipo: 'VOO', origem: { ponto: destino }, destino: { ator: G }, altura: 0 });
    bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ator: G }, destino: { ponto: saida }, altura: 0.6 });
    acao(G, 0.88, 0.92, 'PASSE');
  }

  return fechar();

  function fechar(): Plano {
    return {
      estilo,
      atores: [...atores].map(([k, quadros]) => {
        const [lado, i] = k.split(':');
        return { slot: { lado: lado as Lado, indice: Number(i) }, quadros };
      }),
      bola,
      acoes,
    };
  }

  /** O meia passa para o finalizador, que parte para o drible e é desarmado pelo marcador. */
  function planoDesarmeNoDrible(l: Lance, Pt: typeof P, x: number, b: Record<Lado, Ponto[]>, sorte: number): Plano {
    const Fd = l.finalizador!;
    const D = l.defensor;
    const fxd = b[Fd.lado][Fd.indice]!.x;
    const lat = x < 0.5 ? -1 : 1;
    const bote = Pt(lerp(fxd, 0.5, 0.3) + (sorte - 0.5) * 0.1, 0.21);
    return {
      estilo: 'DESARME',
      atores: [
        { slot: l.criador, quadros: [[0, null], [0.08, Pt(x, 0.5)], [0.3, Pt(x, 0.42)], [0.6, null]] },
        { slot: Fd, quadros: [[0, null], [0.3, Pt(fxd, 0.33)], [0.36, Pt(fxd, 0.31)], [F_RESOLUCAO_DESARME, Pt(bote.x - lat * 0.02, 0.23)], [0.72, Pt(bote.x - lat * 0.04, 0.25)], [0.9, null]] },
        { slot: D, quadros: [[0, null], [0.36, null], [F_RESOLUCAO_DESARME, bote], [0.75, Pt(bote.x, 0.27)], [1, null]] },
      ],
      bola: [
        { de: 0, ate: 0.08, tipo: 'VOO', origem: { ponto: entrada }, destino: { ator: l.criador }, altura: 0 },
        { de: 0.08, ate: 0.3, tipo: 'POSSE', ator: l.criador },
        { de: 0.3, ate: 0.36, tipo: 'VOO', origem: { ator: l.criador }, destino: { ator: Fd }, altura: 0 },
        { de: 0.36, ate: F_RESOLUCAO_DESARME, tipo: 'POSSE', ator: Fd },
        { de: F_RESOLUCAO_DESARME, ate: 0.75, tipo: 'POSSE', ator: D },
        { de: 0.75, ate: 0.95, tipo: 'VOO', origem: { ator: D }, destino: { ponto: saida }, altura: 0.45 },
        { de: 0.95, ate: 1, tipo: 'PARADA', ponto: saida },
      ],
      acoes: [
        { slot: l.criador, de: 0.29, ate: 0.315, acao: 'PASSE' },
        { slot: D, de: F_RESOLUCAO_DESARME - 0.05, ate: F_RESOLUCAO_DESARME + 0.04, acao: 'CARRINHO' },
        { slot: D, de: 0.74, ate: 0.77, acao: 'PASSE' },
      ],
    };
  }

  function planoDesarme(l: Lance, Pt: typeof P, x: number, sorte: number): Plano {
    const D = l.defensor;
    const roubo = Pt(lerp(x, 0.5, 0.3) + (sorte - 0.5) * 0.12, 0.3);
    const longe = Pt(roubo.x, 0.4);
    return {
      estilo: 'DESARME',
      atores: [
        { slot: l.criador, quadros: [[0, null], [0.08, Pt(x, 0.5)], [0.58, Pt(roubo.x - 0.02, 0.31)], [0.7, Pt(roubo.x - 0.03, 0.29)], [0.85, null]] },
        { slot: D, quadros: [[0, null], [0.3, null], [F_RESOLUCAO_DESARME, roubo], [0.75, longe], [1, null]] },
      ],
      bola: [
        { de: 0, ate: 0.08, tipo: 'VOO', origem: { ponto: entrada }, destino: { ator: l.criador }, altura: 0 },
        { de: 0.08, ate: F_RESOLUCAO_DESARME, tipo: 'POSSE', ator: l.criador },
        { de: F_RESOLUCAO_DESARME, ate: 0.75, tipo: 'POSSE', ator: D },
        { de: 0.75, ate: 0.95, tipo: 'VOO', origem: { ator: D }, destino: { ponto: saida }, altura: 0.45 },
        { de: 0.95, ate: 1, tipo: 'PARADA', ponto: saida },
      ],
      acoes: [
        { slot: D, de: F_RESOLUCAO_DESARME - 0.05, ate: F_RESOLUCAO_DESARME + 0.04, acao: 'CARRINHO' },
        { slot: D, de: 0.74, ate: 0.77, acao: 'PASSE' },
      ],
    };
  }
}

function goleiroDe(esc: Escalacao, lado: Lado): SlotRef {
  return { lado, indice: Math.max(0, esc.jogadores.findIndex((j) => j.posicao === 'GOL')) };
}

function zagueiroMaisProximo(esc: Escalacao, bases: Ponto[], lado: Lado, x: number): SlotRef | null {
  let melhor: SlotRef | null = null;
  let dist = Infinity;
  esc.jogadores.forEach((j, indice) => {
    if (j.posicao !== 'ZAG') return;
    const d = Math.abs(bases[indice]!.x - (1 - x));
    if (d < dist) {
      dist = d;
      melhor = { lado, indice };
    }
  });
  return melhor;
}
