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

export type EstiloJogada = 'TABELA' | 'CHUTE_DE_LONGE' | 'LANCAMENTO' | 'CRUZAMENTO' | 'INDIVIDUAL' | 'DESARME' | 'ESCANTEIO' | 'FALTA' | 'PENALTI' | 'FALTA_DIRETA' | 'FALTA_CURTA';

export type AcaoJogador = 'PARADO' | 'CORRENDO' | 'PASSE' | 'CHUTE' | 'CABECEIO' | 'MERGULHO' | 'CARRINHO' | 'COMEMORANDO' | 'ARREMESSO';

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
  /** O próximo lance é escanteio: a defesa ou o bloqueio manda a bola para a linha de fundo, aqui. */
  escanteio?: Ponto;
}

/** Bandeirinha do escanteio do lance (o lado sai do número do lance: sempre o mesmo). */
export function pontoDoEscanteio(lance: Lance): Ponto {
  const y = lance.ataque === 'mandante' ? 0.012 : 0.988;
  return { x: lance.numero % 2 === 0 ? 0.015 : 0.985, y };
}

/** Bolas paradas de falta (Temporada 2, ADR-0024). */
export const COBRANCAS_DE_FALTA: ReadonlySet<string> = new Set(['PENALTI', 'FALTA_DIRETA', 'FALTA_CRUZADA', 'FALTA_CURTA']);

/**
 * Onde a falta foi (e é cobrada), a partir do lance da cobrança: marca do pênalti, entrada da
 * área ou mais longe. O lado sai do número do lance, então é sempre o mesmo.
 */
export function pontoDaFalta(cobranca: Lance): Ponto {
  const alvo = golAlvo(cobranca.ataque);
  const dir = sentido(cobranca.ataque);
  const lado = cobranca.numero % 3 === 0 ? 0.5 : cobranca.numero % 2 === 0 ? 0.36 : 0.64;
  if (cobranca.bolaParada === 'PENALTI') return { x: 0.5, y: alvo - dir * 0.11 };
  if (cobranca.bolaParada === 'FALTA_DIRETA') return { x: lado, y: alvo - dir * 0.21 };
  return { x: lado < 0.5 ? 0.24 : lado > 0.5 ? 0.76 : 0.3, y: alvo - dir * 0.33 };
}

/** Onde o lateral é cobrado: na linha lateral do lado do criador, na altura dele. */
export function pontoDoLateral(lance: Lance, bases: Record<Lado, Ponto[]>): Ponto {
  const b = bases[lance.criador.lado][lance.criador.indice]!;
  return { x: b.x < 0.5 ? 0.012 : 0.988, y: Math.min(0.85, Math.max(0.15, b.y)) };
}

export function montarPlano(lance: Lance, bases: Record<Lado, Ponto[]>, escalacoes: Record<Lado, Escalacao>, seed: number, cont: Continuidade = {}): Plano {
  const plano = montarJogada(lance, bases, escalacoes, seed, cont);
  // Lateral: um companheiro vai até a linha lateral, com calma, e cobra com as duas mãos para o
  // criador. A jogada toda é empurrada para depois da cobrança (a resolução fica onde estava).
  if (lance.bolaParada !== 'LATERAL' || !lance.cobrador) return plano;
  const linha = cont.entrada ?? MEIO;
  const L = lance.cobrador;
  const T = 0.16;
  const R = lance.tipo === 'DESARME' ? F_RESOLUCAO_DESARME : F_RESOLUCAO_CHUTE;
  const g = (f: number) => (f <= R ? T + (f * (R - T)) / R : f);
  const [primeiro, ...resto] = plano.bola;
  const chegada = g(primeiro?.ate ?? 0.08);
  const mover = (b: TrechoBola): TrechoBola => ({ ...b, de: g(b.de), ate: g(b.ate) });
  // Quem já estava perto da linha espera ali; os outros esperam na posição normal.
  const perto: Ponto = { x: linha.x + (linha.x < 0.5 ? 0.015 : -0.015), y: linha.y };
  // Se o cobrador também tem papel na jogada (tabela, por exemplo), ele cobra e depois segue o papel.
  const papel = plano.atores.find((x) => x.slot.lado === L.lado && x.slot.indice === L.indice);
  const depois = (papel?.quadros ?? []).map(([f, pos]): QuadroAtor => [f === 0 ? 0 : g(f), pos]).filter(([f]) => f > T + 0.04);
  const quadrosL: QuadroAtor[] = [[0, null], [T * 0.7, perto], [T + 0.01, perto], ...(depois.length ? depois : [[T + 0.16, null] as QuadroAtor])];
  return {
    ...plano,
    bola: [
      { de: 0, ate: T, tipo: 'PARADA', ponto: linha },
      { de: T, ate: chegada, tipo: 'VOO', origem: { ponto: perto }, destino: { ator: lance.criador }, altura: 0.3 },
      ...resto.map(mover),
    ],
    atores: [
      ...plano.atores
        .filter((x) => !(x.slot.lado === L.lado && x.slot.indice === L.indice))
        .map((x) => ({ ...x, quadros: x.quadros.map(([f, pos]): QuadroAtor => [f === 0 ? 0 : g(f), pos]) })),
      { slot: L, quadros: quadrosL },
    ],
    acoes: [...plano.acoes.map((x) => ({ ...x, de: g(x.de), ate: g(x.ate) })), { slot: L, de: T * 0.72, ate: T + 0.005, acao: 'ARREMESSO' }],
  };
}

function montarJogada(lance: Lance, bases: Record<Lado, Ponto[]>, escalacoes: Record<Lado, Escalacao>, seed: number, cont: Continuidade): Plano {
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

  if (lance.tipo === 'DESARME' && lance.bolaParada !== 'ESCANTEIO' && lance.bolaParada !== 'FALTA_CRUZADA') {
    return lance.drible && lance.finalizador ? planoDesarmeNoDrible(lance, P, cx, bases, rng.next()) : planoDesarme(lance, P, cx, rng.next());
  }
  // Temporada 2: a falta (a jogada para, a bola fica no lugar da cobrança) e as cobranças.
  if (lance.tipo === 'FALTA') return planoFalta(lance, planoDoBote(lance, P, cx, bases, rng.next()), saida);
  if (lance.bolaParada === 'PENALTI' || lance.bolaParada === 'FALTA_DIRETA' || lance.bolaParada === 'FALTA_CURTA') {
    return planoCobranca(lance, bases, escalacoes, entrada, saida, rng.next(), cont);
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
  // A falta de longe cruzada é coreografada como o escanteio, só que do lugar da falta.
  if (lance.bolaParada === 'ESCANTEIO' || lance.bolaParada === 'FALTA_CRUZADA') return planoEscanteio();

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
      if (cont.escanteio) {
        // Desviou para a linha de fundo: escanteio.
        bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.9, tipo: 'VOO', origem: { ator: M }, destino: { ponto: cont.escanteio }, altura: 0.3 });
        bola.push({ de: 0.9, ate: 1, tipo: 'PARADA', ponto: cont.escanteio });
        return fechar();
      }
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
  acao(F, inicioChute - 0.015, inicioChute + 0.03, estilo === 'CRUZAMENTO' || estilo === 'ESCANTEIO' ? 'CABECEIO' : 'CHUTE');

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
  } else if (lance.tipo === 'DEFESA' && cont.escanteio) {
    // Espalmou para a linha de fundo: escanteio.
    bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.9, tipo: 'VOO', origem: { ponto: destino }, destino: { ponto: cont.escanteio }, altura: 0.35 });
    bola.push({ de: 0.9, ate: 1, tipo: 'PARADA', ponto: cont.escanteio });
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

  /**
   * Escanteio: o criador vai até a bandeirinha e cruza; o finalizador (atacante ou zagueiro que
   * subiu) cabeceia contra o goleiro, ou o zagueiro marcador chega antes e afasta (DESARME).
   */
  function planoEscanteio(): Plano {
    const canto = entrada;
    const lado = canto.x < 0.5 ? -1 : 1;
    const Fe = lance.finalizador!;
    const Z = lance.marcador ?? lance.defensor;
    const Ge = goleiroDe(escalacoes[def], def);
    const cobranca: Ponto = { x: canto.x - lado * 0.01, y: canto.y + dir * 0.008 };
    const cabeca = P(0.5 + lado * (0.05 + rng.next() * 0.06), 0.09);
    const fx0 = bases[Fe.lado][Fe.indice]!.x;
    ator(C, [[0, null], [0.18, cobranca], [0.32, cobranca], [0.5, null]]);
    // Todo mundo vai para a área enquanto a bola espera na bandeirinha: os atacantes, um
    // zagueiro que sobe e um meia na entrada da área; quem defende marca de perto e os
    // atacantes do outro time ficam na meia-lua. Depois voltam devagar às posições.
    const usados = new Set([C, Fe, Z, Ge].map((x) => `${x.lado}:${x.indice}`));
    const ida = 0.06;
    const pronto = 0.24;
    const volta = 0.86;
    const vagas = [0.36, 0.64, 0.46, 0.56, 0.3, 0.7];
    let k = 0;
    let zagueiroQueSobe = escalacoes[atq].jogadores.some((j, i) => j.posicao === 'ZAG' && Fe.indice === i) ? 1 : 0;
    const marcas: Ponto[] = [];
    escalacoes[atq].jogadores.forEach((j, i) => {
      if (usados.has(`${atq}:${i}`) || j.posicao === 'GOL') return;
      if (j.posicao === 'ZAG' && zagueiroQueSobe++ > 0) return; // um zagueiro fica atrás
      const ponto = j.posicao === 'MEI' ? P(0.5 - lado * 0.08, 0.24) : P(vagas[k++ % vagas.length]!, 0.11 + (k % 2) * 0.03);
      if (j.posicao !== 'MEI') marcas.push(ponto);
      ator({ lado: atq, indice: i }, [[0, null], [ida, null], [pronto, ponto], [volta - 0.08, ponto], [1, null]]);
    });
    marcas.push(cabeca);
    let m = 0;
    escalacoes[def].jogadores.forEach((j, i) => {
      if (usados.has(`${def}:${i}`) || j.posicao === 'GOL') return;
      const ponto =
        j.posicao === 'ATA'
          ? P(0.5 + (m++ % 2 === 0 ? -0.1 : 0.1), 0.27)
          : (() => {
              const alvoM = marcas.shift() ?? P(0.5, 0.08);
              return { x: alvoM.x + lado * 0.015, y: alvoM.y + dir * 0.022 };
            })();
      ator({ lado: def, indice: i }, [[0, null], [ida, null], [pronto, ponto], [volta - 0.08, ponto], [1, null]]);
    });
    ator(Fe, [[0, null], [0.2, P(lerp(fx0, 0.5, 0.5), 0.17)], [0.45, P(cabeca.x - lado * 0.05, 0.15)], [0.68, cabeca], [0.82, cabeca], [0.95, P(cabeca.x, 0.13)], [1, null]]);
    acao(C, 0.29, 0.33, 'PASSE');
    bola.push({ de: 0, ate: 0.3, tipo: 'PARADA', ponto: canto });
    if (lance.tipo === 'DESARME') {
      // A zaga chega antes e afasta de cabeça.
      const corte: Ponto = { x: cabeca.x, y: cabeca.y + dir * 0.025 };
      ator(Z, [[0, null], [0.2, P(cabeca.x + lado * 0.03, 0.12)], [F_RESOLUCAO_DESARME, corte], [0.8, corte], [1, null]]);
      bola.push({ de: 0.3, ate: F_RESOLUCAO_DESARME, tipo: 'VOO', origem: { ponto: canto }, destino: { ator: Z }, altura: 0.55 });
      bola.push({ de: F_RESOLUCAO_DESARME, ate: 0.85, tipo: 'VOO', origem: { ator: Z }, destino: { ponto: saida }, altura: 0.6 });
      bola.push({ de: 0.85, ate: 1, tipo: 'PARADA', ponto: saida });
      acao(Z, F_RESOLUCAO_DESARME - 0.03, F_RESOLUCAO_DESARME + 0.03, 'CABECEIO');
      acao(Fe, F_RESOLUCAO_DESARME - 0.03, F_RESOLUCAO_DESARME + 0.02, 'CABECEIO');
      estilo = 'ESCANTEIO';
      return fecharEscanteio();
    }
    // O cruzamento chega na cabeça do finalizador; o marcador sobe junto, sem alcançar.
    ator(Z, [[0, null], [0.2, P(cabeca.x + lado * 0.03, 0.12)], [0.68, { x: cabeca.x + lado * 0.015, y: cabeca.y + dir * 0.02 }], [0.85, P(cabeca.x, 0.12)], [1, null]]);
    acao(Z, 0.66, 0.71, 'CABECEIO');
    bola.push({ de: 0.3, ate: 0.7, tipo: 'VOO', origem: { ponto: canto }, destino: { ator: Fe }, altura: 0.55 });
    const r2 = rng.next();
    const alvoCabeceio: Ponto =
      lance.tipo === 'GOL' ? P(0.5 + (r2 * 2 - 1) * 0.08, -0.012) : lance.tipo === 'DEFESA' ? P(0.5 + (r2 * 2 - 1) * 0.07, 0.035) : P(0.5 + (r2 < 0.5 ? -1 : 1) * 0.12, -0.01);
    bola.push({ de: 0.7, ate: F_RESOLUCAO_CHUTE, tipo: 'VOO', origem: { ator: Fe }, destino: { ponto: alvoCabeceio }, altura: lance.tipo === 'FORA' ? 0.35 : 0.08, chute: true });
    acao(Fe, 0.68, 0.74, 'CABECEIO');
    const linhaG = P(0.5, 0.03);
    const mergulho: Ponto = lance.tipo === 'DEFESA' ? alvoCabeceio : { x: lerp(linhaG.x, alvoCabeceio.x, lance.tipo === 'GOL' ? 0.5 : 0.35), y: linhaG.y };
    ator(Ge, [[0, null], [0.68, null], [F_RESOLUCAO_CHUTE, mergulho], [0.9, lance.tipo === 'DEFESA' ? P(0.5, 0.06) : mergulho], [1, null]]);
    acao(Ge, 0.72, F_RESOLUCAO_CHUTE + 0.06, 'MERGULHO');
    if (lance.tipo === 'GOL') {
      bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.9, tipo: 'PARADA', ponto: alvoCabeceio });
      bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ponto: alvoCabeceio }, destino: { ponto: MEIO }, altura: 0.3 });
      acao(Fe, F_RESOLUCAO_CHUTE + 0.01, 0.97, 'COMEMORANDO');
      acao(C, F_RESOLUCAO_CHUTE + 0.04, 0.95, 'COMEMORANDO');
    } else if (lance.tipo === 'DEFESA') {
      bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.9, tipo: 'POSSE', ator: Ge });
      bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ator: Ge }, destino: { ponto: saida }, altura: 0.6 });
      acao(Ge, 0.88, 0.92, 'PASSE');
    } else {
      bola.push({ de: F_RESOLUCAO_CHUTE, ate: 0.86, tipo: 'PARADA', ponto: alvoCabeceio });
      bola.push({ de: 0.86, ate: 0.9, tipo: 'VOO', origem: { ponto: alvoCabeceio }, destino: { ator: Ge }, altura: 0 });
      bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ator: Ge }, destino: { ponto: saida }, altura: 0.6 });
      acao(Ge, 0.88, 0.92, 'PASSE');
    }
    estilo = 'ESCANTEIO';
    return fecharEscanteio();
  }

  function fecharEscanteio(): Plano {
    return {
      estilo: 'ESCANTEIO',
      atores: [...atores].map(([k, quadros]) => {
        const [lado, i] = k.split(':');
        return { slot: { lado: lado as Lado, indice: Number(i) }, quadros };
      }),
      bola,
      acoes,
    };
  }

  /**
   * O bote da falta (T2): acontece onde o simulador marcou a falta (na área, na entrada da
   * área ou longe), para o pênalti e a cobrança saírem de onde o lance foi parado.
   */
  function planoDoBote(l: Lance, Pt: typeof P, x: number, b: Record<Lado, Ponto[]>, sorte: number): Plano {
    const local = l.falta?.local ?? 'LONGE';
    const prof = local === 'AREA' ? 0.12 : local === 'ENTRADA' ? 0.23 : 0.34;
    const V = l.finalizador ?? l.criador;
    const D = l.defensor;
    const vx = b[V.lado][V.indice]!.x;
    const bote = Pt(lerp(vx, 0.5, local === 'AREA' ? 0.55 : 0.3) + (sorte - 0.5) * 0.1, prof);
    const lat = vx < 0.5 ? -1 : 1;
    const passe = l.finalizador !== null && l.finalizador !== undefined;
    const atores: Plano['atores'] = [
      { slot: V, quadros: [[0, null], [passe ? 0.3 : 0.08, Pt(vx, passe ? prof + 0.12 : 0.5)], [F_RESOLUCAO_DESARME, Pt(bote.x - lat * 0.02, prof - 0.01)], [0.75, Pt(bote.x - lat * 0.03, prof)], [0.9, null]] },
      { slot: D, quadros: [[0, null], [0.36, null], [F_RESOLUCAO_DESARME, bote], [0.75, Pt(bote.x + lat * 0.02, prof + 0.02)], [1, null]] },
    ];
    if (passe) atores.unshift({ slot: l.criador, quadros: [[0, null], [0.08, Pt(x, 0.5)], [0.3, Pt(x, 0.42)], [0.6, null]] });
    return {
      estilo: 'DESARME',
      atores,
      bola: passe
        ? [
            { de: 0, ate: 0.08, tipo: 'VOO', origem: { ponto: entrada }, destino: { ator: l.criador }, altura: 0 },
            { de: 0.08, ate: 0.3, tipo: 'POSSE', ator: l.criador },
            { de: 0.3, ate: 0.36, tipo: 'VOO', origem: { ator: l.criador }, destino: { ator: V }, altura: 0 },
            { de: 0.36, ate: F_RESOLUCAO_DESARME, tipo: 'POSSE', ator: V },
          ]
        : [
            { de: 0, ate: 0.08, tipo: 'VOO', origem: { ponto: entrada }, destino: { ator: V }, altura: 0 },
            { de: 0.08, ate: F_RESOLUCAO_DESARME, tipo: 'POSSE', ator: V },
          ],
      acoes: [
        ...(passe ? [{ slot: l.criador, de: 0.29, ate: 0.315, acao: 'PASSE' as const }] : []),
        { slot: D, de: F_RESOLUCAO_DESARME - 0.05, ate: F_RESOLUCAO_DESARME + 0.04, acao: 'CARRINHO' },
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


/**
 * Falta (T2): a jogada até o bote é a do desarme; no bote, quem tinha a bola cai, o juiz apita e
 * a bola rola até o lugar da cobrança e para.
 */
function planoFalta(lance: Lance, desarme: Plano, saida: Ponto): Plano {
  const vitima = lance.finalizador ?? lance.criador;
  const R = F_RESOLUCAO_DESARME;
  return {
    estilo: 'FALTA',
    atores: desarme.atores,
    bola: [
      ...desarme.bola.filter((b) => b.ate <= R + 1e-9),
      { de: R, ate: 0.7, tipo: 'VOO', origem: { ator: vitima }, destino: { ponto: saida }, altura: 0 },
      { de: 0.7, ate: 1, tipo: 'PARADA', ponto: saida },
    ],
    acoes: [
      ...desarme.acoes.filter((a) => a.acao !== 'PASSE' || a.de < R),
      { slot: vitima, de: R - 0.01, ate: 0.84, acao: 'MERGULHO' },
    ],
  };
}

/**
 * Cobranças de falta da T2 (ADR-0024): pênalti (o Canto decide para onde vão a bola e o
 * goleiro), chute direto por cima da Barreira e toque curto para o chute de longe.
 */
function planoCobranca(lance: Lance, bases: Record<Lado, Ponto[]>, escalacoes: Record<Lado, Escalacao>, ponto: Ponto, saida: Ponto, sorte: number, cont: Continuidade): Plano {
  const atq = lance.ataque;
  const def: Lado = atq === 'mandante' ? 'visitante' : 'mandante';
  const alvo = golAlvo(atq);
  const dir = sentido(atq);
  const P = (x: number, prof: number): Ponto => ({ x: Math.min(0.96, Math.max(0.04, x)), y: alvo - dir * prof });
  const C = lance.criador;
  const F = lance.finalizador ?? C;
  const G = goleiroDe(escalacoes[def], def);
  const chave = (s: SlotRef) => `${s.lado}:${s.indice}`;
  const atores = new Map<string, QuadroAtor[]>();
  const acoes: Plano['acoes'] = [];
  const bola: TrechoBola[] = [];
  const ator = (s: SlotRef, q: QuadroAtor[]) => atores.set(chave(s), q);
  const acao = (slot: SlotRef, de: number, ate: number, a: AcaoJogador) => acoes.push({ slot, de, ate, acao: a });
  const R = F_RESOLUCAO_CHUTE;
  const lado = ponto.x < 0.5 ? -1 : 1;

  // Para onde vai o chute e para onde o goleiro pula.
  const xCanto = (c?: string) => (c === 'ESQUERDA' ? 0.43 : c === 'DIREITA' ? 0.57 : 0.5);
  let destino: Ponto;
  if (lance.bolaParada === 'PENALTI') {
    const x = xCanto(lance.canto?.cobrador);
    destino = lance.tipo === 'FORA' ? P(x + (x === 0.5 ? 0.09 : (x - 0.5) * 1.8), -0.012) : P(x, lance.tipo === 'DEFESA' ? 0.02 : -0.012);
  } else if (lance.tipo === 'GOL') destino = P(0.5 + (sorte < 0.5 ? -1 : 1) * (0.05 + sorte * 0.04), -0.012);
  else if (lance.tipo === 'DEFESA') destino = P(0.5 + (sorte * 2 - 1) * 0.06, 0.03);
  else destino = P(0.5 + (sorte < 0.5 ? -1 : 1) * 0.13, -0.01);
  const linhaG = P(0.5, 0.025);
  const mergulho: Ponto =
    lance.bolaParada === 'PENALTI' ? P(xCanto(lance.canto?.goleiro), 0.03) : lance.tipo === 'DEFESA' ? destino : { x: lerp(linhaG.x, destino.x, 0.45), y: linhaG.y };

  // Quem não cobra nem defende espera em volta da área e volta devagar no fim.
  const ida = 0.05;
  const pronto = 0.22;
  const volta = 0.88;
  const ocupados = new Set([chave(C), chave(F), chave(G), ...(lance.barreira ?? []).map(chave)]);
  const espera = (lado2: Lado, i: number, k: number): Ponto =>
    lance.bolaParada === 'PENALTI' ? P(0.32 + ((k * 0.09) % 0.36), 0.25 + (k % 2) * 0.03) : P(0.5 + (k % 2 ? 1 : -1) * (0.1 + (k % 3) * 0.06), lado2 === atq ? 0.12 + (k % 2) * 0.04 : 0.1 + (k % 3) * 0.02);
  let k = 0;
  for (const l of ['mandante', 'visitante'] as const) {
    escalacoes[l].jogadores.forEach((j, i) => {
      const s = { lado: l, indice: i };
      if (ocupados.has(chave(s)) || j.posicao === 'GOL') return;
      // Os zagueiros de quem cobra e os atacantes de quem defende ficam no meio do caminho.
      if ((l === atq && j.posicao === 'ZAG') || (l === def && j.posicao === 'ATA')) return;
      const e = espera(l, i, k++);
      ator(s, [[0, null], [ida, null], [pronto, e], [volta - 0.06, e], [1, null]]);
    });
  }

  const atras = { x: ponto.x - lado * 0.01, y: ponto.y + dir * 0.035 };
  const linhaDoChute = (p: Ponto) => ({ x: p.x, y: p.y + dir * 0.012 });
  if (lance.bolaParada === 'FALTA_CURTA') {
    // Toque curto para o lado e chute de longe.
    const chute = P(ponto.x - lado * 0.08, 0.3);
    ator(C, [[0, null], [0.18, atras], [0.42, atras], [0.48, linhaDoChute(ponto)], [0.62, null]]);
    ator(F, [[0, null], [0.2, P(chute.x, 0.36)], [0.5, P(chute.x, 0.34)], [0.6, chute], [R, chute], [0.92, P(chute.x, 0.28)], [1, null]]);
    bola.push({ de: 0, ate: 0.48, tipo: 'PARADA', ponto });
    bola.push({ de: 0.48, ate: 0.6, tipo: 'VOO', origem: { ponto }, destino: { ator: F }, altura: 0 });
    acao(C, 0.46, 0.5, 'PASSE');
    bola.push({ de: 0.6, ate: R, tipo: 'VOO', origem: { ator: F }, destino: { ponto: destino }, altura: lance.tipo === 'FORA' ? 0.6 : 0.25, chute: true });
    acao(F, 0.58, 0.63, 'CHUTE');
  } else {
    // Pênalti e chute direto: o cobrador ajeita a bola, toma distância e bate.
    ator(C, [[0, null], [0.2, atras], [0.52, atras], [0.6, linhaDoChute(ponto)], [R, linhaDoChute(ponto)], [0.9, linhaDoChute(ponto)], [1, null]]);
    bola.push({ de: 0, ate: 0.6, tipo: 'PARADA', ponto });
    const bloqueio = lance.tipo === 'BLOQUEIO' && lance.barreira?.length;
    if (bloqueio) {
      bola.push({ de: 0.6, ate: 0.68, tipo: 'VOO', origem: { ponto }, destino: { ator: lance.defensor }, altura: 0.15, chute: true });
      bola.push({ de: 0.68, ate: 0.9, tipo: 'VOO', origem: { ator: lance.defensor }, destino: { ponto: saida }, altura: 0.5 });
      bola.push({ de: 0.9, ate: 1, tipo: 'PARADA', ponto: saida });
    } else {
      bola.push({ de: 0.6, ate: R, tipo: 'VOO', origem: { ponto }, destino: { ponto: destino }, altura: lance.bolaParada === 'PENALTI' ? (lance.tipo === 'FORA' ? 0.3 : 0.05) : 0.55, chute: true });
    }
    acao(C, 0.58, 0.63, 'CHUTE');
    // Barreira: os defensores em fila entre a bola e o gol; pulam na hora do chute.
    (lance.barreira ?? []).forEach((b, i, todos) => {
      const meio = (todos.length - 1) / 2;
      const lugar = { x: lerp(ponto.x, 0.5, 0.35) + (i - meio) * 0.03, y: ponto.y - dir * 0.075 };
      ator(b, [[0, null], [ida, null], [pronto, lugar], [0.7, lugar], [volta, lugar], [1, null]]);
      acao(b, 0.6, 0.66, 'CABECEIO');
    });
    if (bloqueio) return fechar();
  }

  // Goleiro: no pênalti espera parado na linha e pula para o canto dele na batida.
  ator(G, [[0, null], [pronto, linhaG], [0.6, linhaG], [R, mergulho], [0.9, lance.tipo === 'DEFESA' ? P(0.5, 0.06) : mergulho], [1, null]]);
  if (lance.tipo !== 'FORA' || lance.bolaParada === 'PENALTI') acao(G, 0.62, R + 0.06, 'MERGULHO');
  if (lance.tipo === 'GOL') {
    bola.push({ de: R, ate: 0.9, tipo: 'PARADA', ponto: destino });
    bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ponto: destino }, destino: { ponto: MEIO }, altura: 0.3 });
    acao(F, R + 0.01, 0.97, 'COMEMORANDO');
  } else if (lance.tipo === 'DEFESA' && cont.escanteio) {
    bola.push({ de: R, ate: 0.9, tipo: 'VOO', origem: { ponto: destino }, destino: { ponto: cont.escanteio }, altura: 0.35 });
    bola.push({ de: 0.9, ate: 1, tipo: 'PARADA', ponto: cont.escanteio });
  } else if (lance.tipo === 'DEFESA') {
    bola.push({ de: R, ate: 0.9, tipo: 'POSSE', ator: G });
    bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ator: G }, destino: { ponto: saida }, altura: 0.6 });
    acao(G, 0.88, 0.92, 'PASSE');
  } else {
    bola.push({ de: R, ate: 0.86, tipo: 'PARADA', ponto: destino });
    bola.push({ de: 0.86, ate: 0.9, tipo: 'VOO', origem: { ponto: destino }, destino: { ator: G }, altura: 0 });
    bola.push({ de: 0.9, ate: 1, tipo: 'VOO', origem: { ator: G }, destino: { ponto: saida }, altura: 0.6 });
    acao(G, 0.88, 0.92, 'PASSE');
  }
  return fechar();

  function fechar(): Plano {
    const estilo: EstiloJogada = lance.bolaParada === 'PENALTI' ? 'PENALTI' : lance.bolaParada === 'FALTA_DIRETA' ? 'FALTA_DIRETA' : 'FALTA_CURTA';
    return {
      estilo,
      atores: [...atores].map(([kk, quadros]) => {
        const [l, i] = kk.split(':');
        return { slot: { lado: l as Lado, indice: Number(i) }, quadros };
      }),
      bola,
      acoes,
    };
  }
}
