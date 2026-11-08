/**
 * Locução do Reels: o que o Locutor da Liga fala e quando, e os eventos de som
 * (apitos, chutes, torcida). Tudo derivado do Roteiro, então é determinístico.
 *
 * Regra do glossário: o Locutor fala dos Jogadores pela Posição e pelo Time, nunca pelo @.
 */
import { FALA_DO_TIME, doTime, nomeDoClassico, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, type Lado, type Lance } from '@liga/sim';
import { narradorDa } from './narradores.js';
import { F_CHUTE_PENALTI, instanteDaCobranca, resultadoDaCobranca } from './penaltis.js';
import type { Roteiro, Segmento } from './roteiro.js';

export type Tom = 'normal' | 'animado' | 'grito';

export interface Fala {
  id: string;
  texto: string;
  /** Quando a fala deveria começar (s de vídeo). */
  inicio: number;
  /** Até quando ela pode ir; se não couber, é acelerada ou, se for opcional, sai. */
  limite: number;
  tom: Tom;
  opcional?: boolean;
  /** Trecho do Roteiro (índice em `segmentos`) e parte dele em que a fala acontece. */
  segmento: number;
  parte: 'antes' | 'depois';
}

export type TipoEvento = 'APITO_INICIAL' | 'APITO_FINAL' | 'CHUTE' | 'PASSE' | 'GOL' | 'QUASE' | 'DESARME';

export interface EventoSonoro {
  tipo: TipoEvento;
  t: number;
}

const POSICAO: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };

/** Tempo de vídeo de um instante de jogo dentro de um trecho LANCE (inverso do Roteiro). */
function videoDoJogo(s: Segmento, tJogo: number): number | null {
  const ji = s.jogoInicio!;
  const jr = s.jogoResolucao!;
  const jf = s.jogoFim!;
  if (tJogo < ji || tJogo > jf) return null;
  const r = s.resolucao!;
  return tJogo <= jr ? s.inicio + ((tJogo - ji) / (jr - ji)) * (r - s.inicio) : r + ((tJogo - jr) / (jf - jr)) * (s.fim - r);
}

export function montarNarracao(roteiro: Roteiro): Fala[] {
  const tl = roteiro.timeline;
  const r = tl.resultado;
  const esc = tl.escalacoes;
  const time = (lado: Lado): TimeId => r.times[lado];
  const quem = (lance: Lance, papel: 'criador' | 'finalizador' | 'defensor') => {
    const s = lance[papel]!;
    return `o ${POSICAO[esc[s.lado].jogadores[s.indice]!.posicao]} ${doTime(time(s.lado))}`;
  };
  /** Só a posição, quando o Time já foi dito na mesma frase: "o atacante". */
  const posicao = (lance: Lance, papel: 'criador' | 'finalizador' | 'defensor') => {
    const s = lance[papel]!;
    return `o ${POSICAO[esc[s.lado].jogadores[s.indice]!.posicao]}`;
  };
  const curto = (lado: Lado) => FALA_DO_TIME[time(lado)].curto;
  /** Escolhe uma variação evitando repetir frases já ditas neste vídeo. */
  const ditas = new Set<string>();
  const escolher = <T extends string | [string, Tom]>(rng: ReturnType<typeof criarRng>, opcoes: T[]): T => {
    const texto = (o: T) => (typeof o === 'string' ? o : o[0]);
    const novas = opcoes.filter((o) => !ditas.has(texto(o)));
    const escolhida = rng.pick(novas.length ? novas : opcoes);
    ditas.add(texto(escolhida));
    return escolhida;
  };
  const falas: Fala[] = [];
  const segs = roteiro.segmentos;
  const primeiroLance = segs.find((s) => s.tipo === 'LANCE');

  // Abertura: o Narrador da Partida se apresenta.
  const narrador = narradorDa(r.seed);
  const classico = nomeDoClassico(r.times.mandante, r.times.visitante);
  falas.push({
    id: 'abertura',
    texto: `${narrador.apresentacao} ${
      classico ? `É o ${classico}! ${curto('mandante')} contra ${curto('visitante')}!` : `Bola rolando no Varzeão da Mata! ${curto('mandante')} contra ${curto('visitante')}!`
    }`,
    inicio: 0.25,
    limite: segs[0]!.fim,
    tom: 'animado',
    segmento: 0,
    parte: 'antes',
  });

  segs.forEach((s, indice) => {
    if (s.tipo !== 'LANCE') return;
    const lance = r.lances[s.lance!]!;
    const plano = tl.planos[s.lance!]!;
    const rng = criarRng(((r.seed >>> 0) ^ (lance.numero * 2654435761)) >>> 0);
    const atq = lance.ataque;

    // Construção da jogada, de acordo com o estilo.
    const c = quem(lance, 'criador');
    const f = lance.finalizador ? quem(lance, 'finalizador') : '';
    const pc = posicao(lance, 'criador');
    const pf = lance.finalizador ? posicao(lance, 'finalizador') : '';
    const pro = (p: string) => p.replace(/^o /, 'pro ');
    const construcao: Record<string, string[]> = {
      TABELA: [`Tabela ${doTime(time(atq))}! ${cap(pc)} toca e recebe de volta...`, `${cap(c)} faz a parede com ${pf}...`, `Toque de primeira ${doTime(time(atq))}...`],
      CHUTE_DE_LONGE: [`${cap(f)} ajeita... vai arriscar de longe!`, `Olha ${f}, de fora da área!`, `Espaço ${pro(f)} bater...`],
      LANCAMENTO: [`Lançamento longo ${doTime(time(atq))}!`, `${cap(c)} vira o jogo, bola longa ${pro(pf)}!`, `Bola esticada ${doTime(time(atq))}...`],
      CRUZAMENTO: [`${cap(c)} vai pela ponta... cruzou!`, `Cruzamento ${doTime(time(atq))}, ${pf} sobe!`, `Bola na área ${doTime(time(atq))}...`],
      INDIVIDUAL: [`${cap(f)} parte pra cima do zagueiro...`, `${cap(f)} limpa a marcação...`, `${cap(f)} vai no drible...`],
      DESARME: [`${cap(c)} conduz ${doTime(time(atq))}...`, `Vem ${doTime(time(atq))} pelo meio...`, `${cap(c)} tenta a jogada...`],
    };
    // O finalizador foi no drible e perdeu a bola: a construção fala dele.
    if (lance.tipo === 'DESARME' && lance.drible && lance.finalizador) {
      construcao.DESARME = [`${cap(c)} acha ${f}... vai pra cima!`, `${cap(f)} recebe e tenta o drible...`, `${cap(f)} parte pra cima do marcador...`];
    }
    falas.push({
      id: `lance-${s.lance}-a`,
      texto: escolher(rng, construcao[plano.estilo]!),
      inicio: s.inicio + 0.25,
      limite: s.resolucao! - 0.05,
      tom: 'normal',
      segmento: indice,
      parte: 'antes',
    });

    // Resolução
    const def = quem(lance, 'defensor');
    const resolucao: Record<string, [string, Tom][]> = {
      GOL: [
        [`Gooooool ${doTime(time(atq))}!`, 'grito'],
        [`É gooool! Gol ${doTime(time(atq))}!`, 'grito'],
        [narrador.gol.replace('{time}', doTime(time(atq))), 'grito'],
      ],
      DEFESA: [
        [`Que defesa ${def.replace(/^o /, 'do ')}!`, 'animado'],
        [`Defesaça! ${cap(def)} fecha o gol!`, 'animado'],
        [`Pegou! ${cap(def)} tá atento!`, 'animado'],
        [`Espalmou ${def}!`, 'animado'],
      ],
      FORA: [
        [`Pra fora! Passou perto!`, 'animado'],
        [`Uuuh! Tirou tinta da trave!`, 'animado'],
        [`Isolou! Lá pro mato!`, 'animado'],
      ],
      BLOQUEIO: [
        [`Bloqueou! ${cap(def)} se jogou na frente!`, 'animado'],
        [`Travou o chute! Que corte ${def.replace(/^o /, 'do ')}!`, 'animado'],
        [`Na zaga! ${cap(def)} bloqueia!`, 'animado'],
      ],
      DESARME: [
        [`Desarmou! ${cap(def)} chega firme.`, 'normal'],
        [`Roubou a bola ${def.replace(/^o /, 'o ')}!`, 'normal'],
      ],
    };
    const [texto, tom] = escolher(rng, resolucao[lance.tipo]!);
    falas.push({ id: `lance-${s.lance}-b`, texto, inicio: s.resolucao! - 0.1, limite: s.fim - 0.1, tom, segmento: indice, parte: 'depois' });

    if (lance.tipo === 'GOL') {
      const placar = tl.placarEm(tl.janelas[s.lance!]!.resolucao + 1);
      const extras = [
        FALA_DO_TIME[time(atq)].bordao,
        `${cap(f)} não perdoa!`,
        `${curto('mandante')} ${placar.mandante}, ${curto('visitante')} ${placar.visitante}.`,
      ];
      falas.push({ id: `lance-${s.lance}-c`, texto: escolher(rng, extras), inicio: s.resolucao! + 1.3, limite: s.fim - 0.05, tom: 'animado', segmento: indice, parte: 'depois' });
    }
  });

  // Pênaltis: abertura, cada cobrança e o vencedor.
  const iPen = segs.findIndex((s) => s.tipo === 'PENALTIS');
  if (iPen >= 0 && tl.disputa) {
    const s = segs[iPen]!;
    const d = tl.disputa;
    const rng = criarRng(((r.seed >>> 0) ^ 0x9e3779b9) >>> 0);
    falas.push({
      id: 'penaltis-abertura',
      texto: escolher(rng, [`Empate no tempo normal! Vai para os pênaltis!`, `Tudo igual! A decisão vai para os pênaltis!`]),
      inicio: s.inicio + 0.2,
      limite: s.fim,
      tom: 'animado',
      segmento: iPen,
      parte: 'antes',
    });
    d.cobrancas.forEach((c, k) => {
      const res = resultadoDaCobranca(d, k, r.seed);
      const opcoes: [string, Tom][] =
        res === 'GOL'
          ? [[`Converteu ${doTime(time(c.lado))}!`, 'animado'], [`Gol! Bateu bem!`, 'animado'], [`No canto! Gol ${doTime(time(c.lado))}!`, 'animado']]
          : res === 'DEFESA'
            ? [[`Pegou! O goleiro ${doTime(time(c.goleiro.lado))} defende!`, 'grito'], [`Defendeu!`, 'grito']]
            : [[`Pra fora! Desperdiçou!`, 'animado'], [`Mandou longe!`, 'animado']];
      const [texto, tom] = escolher(rng, opcoes);
      falas.push({ id: `penalti-${k}`, texto, inicio: roteiro.videoDosPenaltis(s, instanteDaCobranca(d, k)) - 0.05, limite: s.fim, tom, segmento: iPen, parte: 'antes' });
    });
    const v = d.vencedor;
    const perdedor = v === 'mandante' ? 'visitante' : 'mandante';
    falas.push({
      id: 'penaltis-fim',
      texto: `${cap(artigoDe(time(v)))} ${curto(v)} vence nos pênaltis, ${d.placar[v]} a ${d.placar[perdedor]}!`,
      inicio: roteiro.videoDosPenaltis(s, instanteDaCobranca(d, d.cobrancas.length - 1)) + 0.9,
      limite: s.fim,
      tom: 'grito',
      segmento: iPen,
      parte: 'antes',
    });
  }

  // Fim
  const fim = segs[segs.length - 1]!;
  const g = r.gols;
  const placar = `${curto('mandante')} ${g.mandante}, ${curto('visitante')} ${g.visitante}`;
  const vencedor = r.penaltis && r.vencedor
    ? `${cap(artigoDe(time(r.vencedor)))} ${curto(r.vencedor)} venceu nos pênaltis!`
    : r.vencedor ? `Vitória ${doTime(time(r.vencedor))}!` : 'Tudo igual no Varzeão!';
  falas.push({ id: 'fim', texto: `Fim de jogo! ${placar}. ${vencedor} Curtiu? Compartilha com a galera! ${narrador.despedida}`, inicio: fim.inicio + 0.35, limite: fim.fim, tom: 'animado', segmento: segs.length - 1, parte: 'antes' });
  return falas;
}

/** Folgas (s de vídeo) em volta das falas para não ficarem coladas nos cortes. */
const FOLGA = { inicio: 0.25, entre: 0.15, fim: 0.3, fimDoVideo: 1.0 };

/**
 * Quanto tempo cada trecho do Roteiro precisa para todas as falas caberem inteiras,
 * sem acelerar nem cortar. O resultado vai em `OpcoesRoteiro.minimos`; como os textos
 * não dependem do tempo, a narração montada no Roteiro esticado é a mesma.
 */
export function exigenciasDaNarracao(roteiro: Pick<Roteiro, 'segmentos'>, falas: Fala[], duracao: (id: string) => number): Record<number, { antes?: number; depois?: number }> {
  const exige: Record<number, { antes?: number; depois?: number }> = {};
  const ultimo = roteiro.segmentos.length - 1;
  for (let indice = 0; indice <= ultimo; indice++) {
    const s = roteiro.segmentos[indice]!;
    const minhas = falas.filter((f) => f.segmento === indice);
    if (!minhas.length) continue;
    if (s.tipo !== 'LANCE') {
      // Cartela: as falas em sequência, desde o começo do trecho.
      let t = 0;
      for (const f of minhas) t = Math.max(t + (t > 0 ? FOLGA.entre : 0), f.inicio - s.inicio) + duracao(f.id);
      exige[indice] = { antes: t + (indice === ultimo ? FOLGA.fimDoVideo : FOLGA.fim) };
      continue;
    }
    const antes = minhas.filter((f) => f.parte === 'antes');
    const depois = minhas.filter((f) => f.parte === 'depois');
    const e: { antes?: number; depois?: number } = {};
    if (antes.length) {
      let t = FOLGA.inicio;
      for (const f of antes) t += duracao(f.id) + FOLGA.entre;
      e.antes = t;
    }
    if (depois.length) {
      // Relativo à resolução: a primeira fala começa um pouco antes; as seguintes, no seu
      // atraso desejado ou logo depois da anterior.
      let t = -Infinity;
      for (const f of depois) {
        const desejado = f.inicio - s.resolucao!;
        t = Math.max(desejado, t + FOLGA.entre) + duracao(f.id);
      }
      e.depois = t + FOLGA.fim;
    }
    exige[indice] = e;
  }
  return exige;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const artigoDe = (t: TimeId) => FALA_DO_TIME[t].artigo;

export function montarEventos(roteiro: Roteiro): EventoSonoro[] {
  const tl = roteiro.timeline;
  const eventos: EventoSonoro[] = [];
  const segs = roteiro.segmentos;
  const abertura = segs[0]!;
  eventos.push({ tipo: 'APITO_INICIAL', t: abertura.fim - 0.6 });

  for (const s of segs) {
    if (s.tipo !== 'LANCE') continue;
    const j = tl.janelas[s.lance!]!;
    const plano = tl.planos[s.lance!]!;
    const emJogo = (f: number) => j.inicio + f * (j.fim - j.inicio);
    for (const b of plano.bola) {
      if (b.tipo !== 'VOO' || !('ator' in b.origem)) continue;
      const tv = videoDoJogo(s, emJogo(b.de));
      if (tv !== null) eventos.push({ tipo: b.chute ? 'CHUTE' : 'PASSE', t: tv });
    }
    const tipo = j.lance.tipo;
    eventos.push({ tipo: tipo === 'GOL' ? 'GOL' : tipo === 'DESARME' ? 'DESARME' : 'QUASE', t: s.resolucao! });
  }
  const iPen = segs.findIndex((s) => s.tipo === 'PENALTIS');
  if (iPen >= 0 && tl.disputa) {
    const s = segs[iPen]!;
    const d = tl.disputa;
    d.cobrancas.forEach((_, k) => {
      eventos.push({ tipo: 'CHUTE', t: roteiro.videoDosPenaltis(s, instanteDaCobranca(d, k, F_CHUTE_PENALTI)) });
      eventos.push({ tipo: resultadoDaCobranca(d, k, tl.resultado.seed) === 'GOL' ? 'GOL' : 'QUASE', t: roteiro.videoDosPenaltis(s, instanteDaCobranca(d, k)) });
    });
  }
  const fim = segs[segs.length - 1]!;
  eventos.push({ tipo: 'APITO_FINAL', t: fim.inicio + 0.05 });
  return eventos.sort((a, b) => a.t - b.t);
}
