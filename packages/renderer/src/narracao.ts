/**
 * Locução do Reels: o que o Locutor da Liga fala e quando, e os eventos de som
 * (apitos, chutes, torcida). Tudo derivado do Roteiro, então é determinístico.
 *
 * Regra do glossário: o Locutor fala dos Jogadores pela Posição e pelo Time, nunca pelo @.
 */
import { FALA_DO_TIME, doTime, ehGoleada, nomeDoClassico, type Posicao, type TimeId } from '@liga/shared';
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

/** APITO_FALTA e CORO só aparecem nas Partidas da Temporada 2 (falta e Grito de guerra). */
export type TipoEvento = 'APITO_INICIAL' | 'APITO_FINAL' | 'CHUTE' | 'PASSE' | 'GOL' | 'QUASE' | 'DESARME' | 'APITO_FALTA' | 'CORO';

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

/**
 * O narrador só fala o apelido (ADR-0014) se der para ler em voz alta: precisa de vogal e de
 * mais letras que números/símbolos. Senão, continua pela posição e pelo Time.
 */
export function apelidoFalavel(a: string | null | undefined): string | null {
  if (!a) return null;
  const letras = (a.match(/\p{L}/gu) ?? []).length;
  if (letras < 2 || !/[aeiouáéíóúâêôãõà]/i.test(a) || letras < a.replace(/\s/g, '').length / 2) return null;
  return a.replace(/[_.]+/g, ' ').trim();
}

/**
 * `apelidos`: o apelido de cada lugar na Escalação (ADR-0014). O narrador fala o nome só nos
 * gols; no resto, pela posição e pelo Time.
 */
export function montarNarracao(roteiro: Roteiro, apelidos?: Record<Lado, (string | null)[]>): Fala[] {
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
  /** Times que já ouviram a fala de Goleada neste vídeo. */
  const goleou = new Set<Lado>();

  // Abertura: o Narrador da Partida se apresenta.
  const narrador = narradorDa(r.seed);
  const classico = nomeDoClassico(r.times.mandante, r.times.visitante);
  falas.push({
    id: 'abertura',
    texto: `${narrador.apresentacao} ${
      classico ? `É o ${classico}! ${curto('mandante')} contra ${curto('visitante')}!` : `Bola rolando no Varzeão da Mata! ${curto('mandante')} contra ${curto('visitante')}!`
    }${tl.t2 ? ` ${FALA_DO_CLIMA[tl.t2.clima]}` : ''}`,
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
    // Contra-ataque: o rival perdeu a bola com gente na frente.
    if (lance.contraAtaque) {
      const linhas = lance.contraAtaque.recomposto
        ? [`Contra-ataque ${doTime(time(atq))}! A defesa volta correndo...`, `Puxou o contra-ataque! ${cap(pc)} sai em velocidade...`]
        : [`Contra-ataque ${doTime(time(atq))}! A defesa ficou lá na frente!`, `Olha o buraco na defesa! ${cap(pc)} sai sozinho...`, `Contra-ataque mortal! Ninguém voltou!`];
      for (const k of Object.keys(construcao)) construcao[k] = linhas;
    }
    // Bola parada: o escanteio e o lateral aparecem na tela, então o narrador fala deles.
    construcao.ESCANTEIO = [`Escanteio ${doTime(time(atq))}! ${cap(pc)} vai cobrar...`, `Bola na bandeirinha. Cobra ${pc} ${doTime(time(atq))}...`, `Escanteio! ${cap(c)} levanta na área...`];
    if (lance.bolaParada === 'LATERAL') {
      for (const k of Object.keys(construcao)) {
        if (k !== 'ESCANTEIO') construcao[k] = [`Lateral ${doTime(time(atq))}, cobrança rápida...`, `Cobrou o lateral, ${pc} recebe...`, `Lateral cobrado, ${c} domina...`];
      }
    }
    // Temporada 2: faltas e cobranças (ADR-0024).
    construcao.FALTA = construcao.DESARME!;
    if (lance.tipo === 'FALTA' && lance.finalizador) construcao.FALTA = [`${cap(f)} recebe e parte pra cima...`, `${cap(f)} vai no drible...`];
    construcao.PENALTI = [`Pênalti ${doTime(time(atq))}! ${cap(pc)} ajeita a bola...`, `${cap(pc)} vai bater o pênalti...`, `Bola na marca. Cobra ${pc} ${doTime(time(atq))}...`];
    construcao.FALTA_DIRETA = [`Falta perigosa! ${cap(pc)} na bola, barreira armada...`, `Falta na entrada da área. Vai bater ${pc} ${doTime(time(atq))}...`];
    construcao.FALTA_CURTA = [`Falta ${doTime(time(atq))}, jogada ensaiada...`, `${cap(pc)} rola curto pra ${pf}...`];
    if (lance.bolaParada === 'FALTA_CRUZADA') construcao.ESCANTEIO = [`Falta ${doTime(time(atq))}! ${cap(pc)} vai levantar na área...`, `Cobrança de falta, bola na área...`];
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
    if (lance.tipo === 'FALTA') {
      const carta = lance.falta?.cartao;
      const naArea = lance.falta?.local === 'AREA';
      resolucao.FALTA =
        carta === 'VERMELHO'
          ? [[`${naArea ? 'Pênalti! ' : 'Falta! '}E é vermelho! ${cap(def)} está expulso!`, 'grito'], [`Expulso! ${cap(def)} vai mais cedo pro chuveiro!`, 'grito']]
          : carta === 'AMARELO'
            ? [[`${naArea ? 'Pênalti! ' : 'Falta! '}Cartão amarelo para ${def}.`, 'animado'], [`${naArea ? 'Derrubou na área! Pênalti! ' : 'Falta dura! '}Amarelo para ${def}.`, 'animado']]
            : naArea
              ? [[`Derrubou na área! É pênalti!`, 'grito'], [`Pênalti! ${cap(def)} chegou atrasado!`, 'grito']]
              : [[`Falta ${def.replace(/^o /, 'do ')}! O juiz marca.`, 'normal'], [`Apita o juiz, falta!`, 'normal']];
    }
    if (lance.bolaParada === 'PENALTI') {
      resolucao.GOL = [[`Gol de pênalti ${doTime(time(atq))}!`, 'grito'], [`Bateu no canto! Gol ${doTime(time(atq))}!`, 'grito']];
      resolucao.DEFESA = [[`Pegou o pênalti! ${cap(def)} acertou o canto!`, 'grito'], [`Defendeu! Que pênalti pegou ${def}!`, 'grito']];
      resolucao.FORA = [[`Pra fora! Desperdiçou o pênalti!`, 'animado'], [`Isolou o pênalti!`, 'animado']];
    }
    if (lance.bolaParada === 'FALTA_DIRETA') {
      resolucao.BLOQUEIO = [[`Na barreira! ${cap(def)} trava a cobrança!`, 'animado'], [`Bateu na barreira!`, 'animado']];
      resolucao.GOL = [[`Gol de falta ${doTime(time(atq))}! Por cima da barreira!`, 'grito'], [`Que cobrança! Gol de falta!`, 'grito']];
      resolucao.DEFESA = [[`Passou da barreira... e o goleiro pega!`, 'animado'], [`Cobrança forte, ${def} espalma!`, 'animado']];
      resolucao.FORA = [[`Passou da barreira... e raspou a trave!`, 'animado'], [`Por cima do gol!`, 'animado']];
    }
    if (lance.bolaParada === 'FALTA_CURTA') resolucao.GOL = [[`Jogada ensaiada e gol ${doTime(time(atq))}!`, 'grito'], [`Ensaiou e marcou! Gooool!`, 'grito']];
    if (lance.bolaParada === 'ESCANTEIO' || lance.bolaParada === 'FALTA_CRUZADA') {
      resolucao.DESARME = [[`A zaga afasta! ${cap(def)} sobe mais alto.`, 'normal'], [`Cortou de cabeça ${def}!`, 'normal'], [`Afastou o perigo!`, 'normal']];
      resolucao.DEFESA = [[`Cabeceou! E o goleiro pega!`, 'animado'], [`Testada firme... defendeu!`, 'animado']];
      resolucao.FORA = [[`Cabeceou pra fora!`, 'animado'], [`Subiu sozinho... por cima!`, 'animado']];
      resolucao.GOL = [[`Gol de cabeça ${doTime(time(atq))}!`, 'grito'], [`Subiu e marcou! Gooool ${doTime(time(atq))}!`, 'grito']];
    }
    const [texto, tom] = escolher(rng, resolucao[lance.tipo]!);
    falas.push({ id: `lance-${s.lance}-b`, texto, inicio: s.resolucao! - 0.1, limite: s.fim - 0.1, tom, segmento: indice, parte: 'depois' });

    if (lance.tipo === 'GOL') {
      const placar = tl.placarEm(tl.janelas[s.lance!]!.resolucao + 1);
      const nome = lance.finalizador ? apelidoFalavel(apelidos?.[lance.finalizador.lado]?.[lance.finalizador.indice]) : null;
      const rival = atq === 'mandante' ? 'visitante' : 'mandante';
      // O gol que confirma a Goleada: a fala extra comemora o placar (que está na tela).
      // Só a primeira vez: se o rival diminuir e a Goleada voltar, não repete (4×1, 4×2, 5×2).
      const golDaGoleada = !goleou.has(atq) && ehGoleada(placar[atq], placar[rival]);
      if (golDaGoleada) goleou.add(atq);
      const extras = golDaGoleada
        ? nome
          ? [`${nome}! E é goleada ${doTime(time(atq))}!`, `${nome} de novo! Goleada ${doTime(time(atq))}!`]
          : [
              `É goleada! ${cap(artigoDe(time(atq)))} ${curto(atq)} não tem dó!`,
              `${curto(atq)} ${placar[atq]}, ${curto(rival)} ${placar[rival]}! É goleada no Varzeão!`,
              `Virou passeio! Goleada ${doTime(time(atq))}!`,
              `Chocolate ${doTime(time(atq))}! É goleada!`,
            ]
        : nome ? [`${nome} não perdoa!`, `É dele! ${nome}!`, `${nome} balança a rede!`] : [
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
  const rngFim = criarRng(((r.seed >>> 0) ^ 0x85ebca6b) >>> 0);
  /** No fim, a Goleada ganha frase própria no lugar do "Vitória do…". */
  const vitoria = (v: Lado) => {
    const perdedor = v === 'mandante' ? 'visitante' : 'mandante';
    if (!ehGoleada(g[v], g[perdedor])) return `Vitória ${doTime(time(v))}!`;
    return rngFim.pick([`Goleada ${doTime(time(v))}! Atropelou!`, `Foi um passeio! Goleada ${doTime(time(v))}!`, `Chocolate ${doTime(time(v))} no Varzeão!`]);
  };
  const vencedor = r.penaltis && r.vencedor
    ? `${cap(artigoDe(time(r.vencedor)))} ${curto(r.vencedor)} venceu nos pênaltis!`
    : r.vencedor ? vitoria(r.vencedor) : 'Tudo igual no Varzeão!';
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

/** Temporada 2: o Narrador comenta o Clima na abertura (o Clima aparece na tela). */
const FALA_DO_CLIMA = {
  SOL: 'Sol forte no Varzeão!',
  NUBLADO: 'Céu fechado no Varzeão.',
  CHUVA: 'Chove no Varzeão, campo pesado!',
  LAMA: 'Muita lama no gramado hoje!',
} as const;
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
    eventos.push({ tipo: tipo === 'GOL' ? 'GOL' : tipo === 'DESARME' ? 'DESARME' : tipo === 'FALTA' ? 'APITO_FALTA' : 'QUASE', t: s.resolucao! });
    // T2: depois do gol, a Arquibancada canta o Grito de guerra (coro sintetizado, sem voz).
    if (tipo === 'GOL' && tl.t2) eventos.push({ tipo: 'CORO', t: s.resolucao! + 2.6 });
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
