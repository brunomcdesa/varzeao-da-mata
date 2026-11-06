/**
 * Locução do Reels: o que o Locutor da Liga fala e quando, e os eventos de som
 * (apitos, chutes, torcida). Tudo derivado do Roteiro, então é determinístico.
 *
 * Regra do glossário: o Locutor fala dos Jogadores pela Posição e pelo Time, nunca pelo @.
 */
import { FALA_DO_TIME, doTime, nomeDoClassico, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, type Lado, type Lance } from '@liga/sim';
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

  // Abertura
  const classico = nomeDoClassico(r.times.mandante, r.times.visitante);
  falas.push({
    id: 'abertura',
    texto: classico
      ? `É o ${classico}! ${curto('mandante')} contra ${curto('visitante')}!`
      : `Bola rolando no Varzeão da Mata! ${curto('mandante')} contra ${curto('visitante')}!`,
    inicio: 0.25,
    limite: primeiroLance ? primeiroLance.inicio + 1.2 : segs[0]!.fim,
    tom: 'animado',
  });

  for (const s of segs) {
    if (s.tipo !== 'LANCE') continue;
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
    falas.push({
      id: `lance-${s.lance}-a`,
      texto: escolher(rng, construcao[plano.estilo]!),
      inicio: s.inicio + 0.25,
      limite: s.resolucao! - 0.05,
      tom: 'normal',
      opcional: lance.tipo !== 'GOL',
    });

    // Resolução
    const def = quem(lance, 'defensor');
    const resolucao: Record<string, [string, Tom][]> = {
      GOL: [
        [`Gooooool ${doTime(time(atq))}!`, 'grito'],
        [`É gooool! Gol ${doTime(time(atq))}!`, 'grito'],
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
      DESARME: [
        [`Desarmou! ${cap(def)} chega firme.`, 'normal'],
        [`Roubou a bola ${def.replace(/^o /, 'o ')}!`, 'normal'],
      ],
    };
    const [texto, tom] = escolher(rng, resolucao[lance.tipo]!);
    falas.push({ id: `lance-${s.lance}-b`, texto, inicio: s.resolucao! - 0.1, limite: s.fim - 0.1, tom });

    if (lance.tipo === 'GOL') {
      const placar = tl.placarEm(tl.janelas[s.lance!]!.resolucao + 1);
      const extras = [
        FALA_DO_TIME[time(atq)].bordao,
        `${cap(f)} não perdoa!`,
        `${curto('mandante')} ${placar.mandante}, ${curto('visitante')} ${placar.visitante}.`,
      ];
      falas.push({ id: `lance-${s.lance}-c`, texto: escolher(rng, extras), inicio: s.resolucao! + 1.3, limite: s.fim - 0.05, tom: 'animado', opcional: true });
    }
  }

  // Fim
  const fim = segs[segs.length - 1]!;
  const g = r.gols;
  const placar = `${curto('mandante')} ${g.mandante}, ${curto('visitante')} ${g.visitante}`;
  const vencedor = r.vencedor ? `Vitória ${doTime(time(r.vencedor))}!` : 'Tudo igual no Varzeão!';
  falas.push({ id: 'fim', texto: `Fim de jogo! ${placar}. ${vencedor}`, inicio: fim.inicio + 0.35, limite: fim.fim + 1.5, tom: 'animado' });
  return falas;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const fim = segs[segs.length - 1]!;
  eventos.push({ tipo: 'APITO_FINAL', t: fim.inicio + 0.05 });
  return eventos.sort((a, b) => a.t - b.t);
}
