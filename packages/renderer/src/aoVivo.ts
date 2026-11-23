/**
 * Narração do Ao Vivo do site: o Locutor fala o jogo inteiro, sem parar.
 *
 * O Ao Vivo mostra 90 minutos em 4 min 30 s (VELOCIDADE_AO_VIVO). Os lances usam as mesmas falas do
 * Reels (montarNarracao num Roteiro com todos os lances); entre um lance e outro entram
 * falas de "jogo corrido" (posse, minuto, placar, torcida). A frase de posse só entra se a
 * tela mostrar aquilo enquanto ela é dita (ADR-0070).
 *
 * Tempo aqui é sempre "s de Ao Vivo" (s de jogo ÷ VELOCIDADE_AO_VIVO), que é também o
 * tempo do arquivo de áudio: o site toca o áudio em `tempoAoVivo / VELOCIDADE_AO_VIVO`.
 *
 * Três etapas, porque só se sabe quanto cada fala dura depois de sintetizar:
 *   1. ancorasAoVivo: as falas dos lances, que são sintetizadas primeiro;
 *   2. roteiroAoVivo: com a duração real das âncoras, escreve o enchimento de cada vão para
 *      a hora em que ele vai ser dito;
 *   3. agendarAoVivo: com as durações reais de tudo, encaixa sem sobreposição.
 */
import { FALA_DO_TIME, NOME_DO_GRUPO, doTime, type BrigaPeloMataMata, type MataMataDaPartida, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, type Lado } from '@liga/sim';
import { falaDosGarantidos, falasDaNecessidade, montarNarracao, seAcabarAssim, type EventoSonoro, type OpcoesNarracao, type Tom } from './narracao.js';
import { instanteDaCobranca } from './penaltis.js';
import { Roteiro } from './roteiro.js';
import { DURACAO_JOGO, VELOCIDADE_AO_VIVO, type BolaNoToque, type Timeline } from './timeline.js';

export interface FalaAoVivo {
  id: string;
  texto: string;
  tom: Tom;
  /** Âncora: fala de lance (tem hora certa). Enchimento: vai no vão entre âncoras, se couber. */
  tipo: 'ancora' | 'enchimento';
  /** Âncora: s de Ao Vivo em que a fala deve terminar ('ate') ou começar ('de'). Enchimento: a hora para que foi escrita. */
  em?: number;
  modo?: 'ate' | 'de';
  /** Âncora: não começar antes disto (o lance ainda não apareceu na tela). */
  naoAntes?: number;
  /** Enchimento: o vão (índice) a que pertence. */
  vao?: number;
}

export interface FalaAgendadaAoVivo {
  id: string;
  texto: string;
  inicio: number;
  /** Corte: a fala para aqui (com fade), porque o lance seguinte chegou. */
  fim?: number;
}

/** Caracteres por segundo da voz do Locutor (estimativa para escolher o enchimento). */
const LETRAS_POR_S = 13;
const RESPIRO = 0.25;
/** Silêncio entre a fala cortada e a que corta (s). */
const CORTE = 0.08;
/** Menos que isso de fala não vale: some em vez de virar um pedacinho cortado (s). */
const SOBRA_MINIMA = 0.9;
/** Comentário pós-lance pode esperar no máximo isso (s); depois perde o sentido. */
const ATRASO_MAXIMO_POS = 1.5;
/** Enchimento pode entrar no máximo isso depois da hora para que foi escrito (s). */
const ATRASO_MAXIMO_ENCHIMENTO = 1.0;
export const estimarDuracao = (texto: string) => texto.length / LETRAS_POR_S + 0.35;

const aoVivo = (tJogo: number) => tJogo / VELOCIDADE_AO_VIVO;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FALA_DO_CLIMA_AO_VIVO = {
  SOL: 'Sol forte no campinho hoje.',
  NUBLADO: 'Tempo fechado, mas a bola rola.',
  CHUVA: 'A chuva não para, e a bola escorrega.',
  LAMA: 'Campo enlameado, difícil conduzir.',
} as const;
const POSICAO: Record<Posicao, string> = { GOL: 'goleiro', ZAG: 'zagueiro', MEI: 'meia', ATA: 'atacante' };
const NUMERO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
const numero = (n: number) => NUMERO[n] ?? String(n);
/** Embaralha sem mexer na lista original (Fisher–Yates com o rng do sim). */
function embaralhar<T>(rng: ReturnType<typeof criarRng>, lista: readonly T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Duração do Ao Vivo (s), igual ao fim do relógio do site. */
export const duracaoAoVivo = (tl: Timeline) => aoVivo(tl.duracao);

/**
 * Falas do Ao Vivo: as âncoras dos lances e, nos vãos entre elas, o enchimento.
 *
 * O enchimento é escrito para o instante em que vai ser dito: os vãos saem do encaixe das
 * âncoras com `duracaoAncora` (a duração real, quando a voz delas já foi sintetizada), e cada
 * frase é conferida com o que a tela mostra durante ela (com quem está a bola, onde, se teve
 * passe). Minuto e placar também são os daquele instante.
 */
export function roteiroAoVivo(
  tl: Timeline,
  apelidos?: Record<Lado, (string | null)[]>,
  opcoes: OpcoesNarracao = {},
  duracaoAncora?: (id: string) => number,
): FalaAoVivo[] {
  const falas = ancorasAoVivo(tl, apelidos, opcoes);
  const durA = duracaoAncora ?? ((id: string) => estimarDuracao(falas.find((x) => x.id === id)!.texto));
  const agenda = agendarAoVivo(falas, durA);
  const fim = aoVivo(tl.duracao);
  /** Memória da Partida (ADR-0045): uma frase dita não volta até as outras se esgotarem. */
  const ditas = new Set<string>();
  let vao = 0;
  for (let i = 0; i <= agenda.length; i++) {
    const antes = agenda[i - 1];
    const de = antes ? (antes.fim ?? antes.inicio + durA(antes.id)) + RESPIRO : 0;
    const ate = (agenda[i]?.inicio ?? fim) - RESPIRO;
    if (ate - de < 1.6) continue;
    const textos = enchimento(tl, { vao, de, ate, ditas, mataMata: opcoes.mataMata ?? null, briga: opcoes.briga ?? null });
    textos.forEach(({ texto, em }, k) => falas.push({ id: `enche-${vao}-${k}`, texto, tom: 'normal', tipo: 'enchimento', em, vao }));
    vao++;
  }
  return falas;
}

/** Só as âncoras: falas dos lances, do intervalo, dos pênaltis e do fim, cada uma com a sua hora. */
export function ancorasAoVivo(tl: Timeline, apelidos?: Record<Lado, (string | null)[]>, opcoes: OpcoesNarracao = {}): FalaAoVivo[] {
  // Roteiro com todos os lances (inclusive desarmes), sem teto: uma fala por lance como no Reels.
  const roteiro = new Roteiro(tl, { duracaoLance: { DESARME: 4 }, duracaoMaxima: 1e9, bolasParadas: true });
  const segs = roteiro.segmentos;
  const falas: FalaAoVivo[] = [];

  for (const f of montarNarracao(roteiro, apelidos, { ...opcoes, aoVivo: true })) {
    const s = segs[f.segmento]!;
    const base = { id: f.id, texto: f.texto, tom: f.tom, tipo: 'ancora' as const };
    if (s.tipo === 'ABERTURA') falas.push({ ...base, em: 0.4, modo: 'de' });
    else if (s.tipo === 'LANCE') {
      const j = tl.janelas[s.lance!]!;
      const resolucao = aoVivo(j.resolucao);
      if (f.parte === 'antes') falas.push({ ...base, em: resolucao - 0.1, modo: 'ate', naoAntes: aoVivo(j.inicio) });
      else falas.push({ ...base, em: resolucao + (f.id.endsWith('-c') ? 0.8 : 0), modo: 'de' });
    } else if (s.tipo === 'PENALTIS' && tl.disputa) {
      const d = tl.disputa;
      const k = /^penalti-(\d+)$/.exec(f.id);
      if (k) falas.push({ ...base, em: aoVivo(instanteDaCobranca(d, Number(k[1]))), modo: 'de' });
      else if (f.id === 'penaltis-abertura') falas.push({ ...base, em: aoVivo(d.inicio) + 0.3, modo: 'de' });
      else falas.push({ ...base, em: aoVivo(instanteDaCobranca(d, d.cobrancas.length - 1)) + 1.5, modo: 'de' });
    } else if (s.tipo === 'TROCA') falas.push({ ...base, em: aoVivo(s.jogoInicio!) + 0.2, modo: 'de' });
    else if (s.tipo === 'FIM') falas.push({ ...base, em: aoVivo(tl.duracao) + 0.2, modo: 'de' });
  }
  // Intervalo: no meio do jogo o Locutor marca os 45 minutos.
  const meio = aoVivo(DURACAO_JOGO / 2);
  const p45 = tl.placarEm(DURACAO_JOGO / 2);
  falas.push({ id: 'meio', texto: `Quarenta e cinco minutos! ${placarFalado(tl, p45)}`, tom: 'normal', tipo: 'ancora', em: meio, modo: 'de' });
  return falas;
}

function placarFalado(tl: Timeline, p: Record<Lado, number>): string {
  const t = tl.resultado.times;
  if (p.mandante === p.visitante) return p.mandante === 0 ? 'Segue zero a zero.' : `Tudo igual, ${numero(p.mandante)} a ${numero(p.visitante)}.`;
  return `${FALA_DO_TIME[t.mandante].curto} ${p.mandante}, ${FALA_DO_TIME[t.visitante].curto} ${p.visitante}.`;
}

/** Folga na duração estimada ao conferir a tela: a voz real costuma sair mais lenta. */
const FOLGA_DA_TELA = 1.3;
/** Quantos instantes da fala são conferidos na tela. */
const AMOSTRAS = 5;

/** O que a tela mostra durante uma fala: a bola no toque de bola, em alguns instantes. */
interface Tela {
  /** Todos os instantes no toque de bola (sem jogada no meio) e com o mesmo Time na bola. */
  lado: Lado | null;
  amostras: (BolaNoToque | null)[];
}

function telaEntre(tl: Timeline, de: number, ate: number): Tela {
  const amostras = Array.from({ length: AMOSTRAS }, (_, k) => tl.bolaNoToque((de + ((ate - de) * k) / (AMOSTRAS - 1)) * VELOCIDADE_AO_VIVO));
  const lado = amostras.every((a) => a && a.lado === amostras[0]!.lado) ? amostras[0]!.lado : null;
  return { lado, amostras };
}

/** Uma frase de jogo corrido e o que precisa estar na tela para ela valer. */
type Frase = [texto: string, vale: (tela: Tela) => boolean];

/**
 * Frases sobre o toque de bola de quem está com ela (`l`) e de quem marca. Cada uma só vale
 * se a tela mostrar aquilo enquanto ela é dita (ADR-0070).
 */
function frasesDaTela(tl: Timeline, l: Lado): Frase[] {
  const r = tl.resultado;
  const o: Lado = l === 'mandante' ? 'visitante' : 'mandante';
  const de = (x: Lado) => doTime(r.times[x]);
  const curto = (x: Lado) => FALA_DO_TIME[r.times[x]].curto;
  const artigo = (x: Lado) => cap(FALA_DO_TIME[r.times[x]].artigo);
  const jog = (x: Lado, p: Posicao) => `o ${POSICAO[p]} ${de(x)}`;
  const bolas = (t: Tela) => t.amostras.filter((a): a is BolaNoToque => !!a);
  /** 0 perto do gol que defende, 1 perto do gol que ataca. */
  const avanco = (t: Tela) => bolas(t).map((a) => (l === 'mandante' ? 1 - a.bola.y : a.bola.y));
  const xs = (t: Tela) => bolas(t).map((a) => a.bola.x);
  const passes = (t: Tela) => bolas(t).flatMap((a) => (a.tipo === 'PASSE' ? [a] : []));
  const com = (t: Tela, k: number, ...p: Posicao[]) => {
    const a = t.amostras[k];
    return a?.tipo === 'POSSE' && p.includes(a.com.posicao);
  };
  const comAlguem = (t: Tela, p: Posicao) => bolas(t).some((a) => a.tipo === 'POSSE' && a.com.posicao === p);
  const todos = (v: number[], f: (n: number) => boolean) => v.length > 0 && v.every(f);
  const abertura = (t: Tela) => Math.max(...xs(t)) - Math.min(...xs(t));
  const teve = (t: Tela) => passes(t).length > 0;
  const meioCampo = (t: Tela) => todos(avanco(t), (a) => a > 0.33 && a < 0.67);
  const defesa = (t: Tela) => todos(avanco(t), (a) => a < 0.5);
  const ataque = (t: Tela) => todos(avanco(t), (a) => a > 0.5);
  return [
    [`Bola com ${artigo(l).toLowerCase()} ${curto(l)}.`, () => true],
    [`Toca de lado ${de(l)}, com paciência.`, teve],
    [`${curto(l)} roda a bola, procurando espaço.`, teve],
    [`${curto(l)} troca passes no meio-campo.`, (t) => teve(t) && meioCampo(t)],
    [`Troca de passes no campo de defesa ${de(l)}.`, (t) => teve(t) && defesa(t)],
    [`${cap(jog(l, 'ZAG'))} sai jogando.`, (t) => com(t, 0, 'ZAG') && teve(t)],
    [`${cap(jog(l, 'ZAG'))} recua pro goleiro.`, (t) => passes(t).some((p) => p.de?.posicao === 'ZAG' && p.para?.posicao === 'GOL')],
    [`${cap(jog(l, 'GOL'))} repõe a bola.`, (t) => comAlguem(t, 'GOL') && passes(t).some((p) => p.de?.posicao === 'GOL')],
    [`${cap(jog(l, 'GOL'))} segura e distribui.`, (t) => com(t, 0, 'GOL') && com(t, 1, 'GOL')],
    [`${cap(jog(l, 'MEI'))} pede a bola.`, (t) => passes(t).some((p) => p.para?.posicao === 'MEI')],
    [`Passe curto, ${jog(l, 'MEI')} domina.`, (t) => passes(t).some((p) => p.para?.posicao === 'MEI') && com(t, AMOSTRAS - 1, 'MEI')],
    [`${cap(jog(l, 'MEI'))} gira o jogo.`, (t) => comAlguem(t, 'MEI') && abertura(t) > 0.3],
    [`${cap(jog(l, 'MEI'))} olha, procura alguém livre...`, (t) => com(t, 0, 'MEI') && com(t, 1, 'MEI')],
    [`${cap(jog(l, 'ATA'))} se movimenta, pede profundidade.`, (t) => todos(avanco(t), (a) => a > 0.4)],
    [`${curto(l)} vai ganhando terreno.`, (t) => avanco(t)[avanco(t).length - 1]! - avanco(t)[0]! > 0.12],
    [`${curto(l)} chega pela direita.`, (t) => ataque(t) && todos(xs(t), (x) => x > 0.62)],
    [`${curto(l)} tenta pela esquerda.`, (t) => ataque(t) && todos(xs(t), (x) => x < 0.38)],
    [`${artigo(l)} ${curto(l)} tem paciência, gira de um lado pro outro.`, (t) => abertura(t) > 0.35],
    [`${artigo(l)} ${curto(l)} tenta furar o bloqueio.`, (t) => todos(avanco(t), (a) => a > 0.62)],
    [`${cap(jog(o, 'ATA'))} pressiona a saída.`, (t) => com(t, 0, 'ZAG', 'GOL')],
    [`${curto(o)} recua e fecha os espaços.`, ataque],
    [`Marcação forte ${de(o)} no meio.`, meioCampo],
    [`${artigo(o)} ${curto(o)} aperta a marcação, não deixa respirar.`, () => true],
    [`${cap(jog(o, 'ATA'))} volta pra ajudar na marcação.`, ataque],
  ];
}

/**
 * Frases de jogo corrido para um vão [de, ate] (s de Ao Vivo), uma depois da outra, cada uma
 * com a hora (`em`) para que foi escrita. A frase de posse só entra se a tela mostrar aquilo
 * durante ela; minuto, placar e o que é do momento são os do instante da fala.
 */
function enchimento(
  tl: Timeline,
  o: { vao: number; de: number; ate: number; ditas: Set<string>; mataMata: MataMataDaPartida | null; briga: BrigaPeloMataMata | null },
): { texto: string; em: number }[] {
  const { ditas } = o;
  const r = tl.resultado;
  const rng = criarRng(((r.seed >>> 0) ^ ((o.vao + 1) * 0x85ebca6b)) >>> 0);
  const saida: { texto: string; em: number }[] = [];
  const naoDitasPrimeiro = (lista: string[]) => [...lista.filter((t) => !ditas.has(t)), ...lista.filter((t) => ditas.has(t))];
  // Ordem fixa por vão (sorteio pelo seed), conferida a cada frase na tela daquele instante.
  const ordemDaTela = embaralhar(rng, Array.from({ length: 24 }, (_, k) => k));
  const curtas = embaralhar(rng, [`Segue o jogo.`, `Bola rolando.`, `Vamos lá!`, `Que partida!`]);
  let cursor = o.de;
  for (let guarda = 0; guarda < 40; guarda++) {
    const tJogo = Math.min(cursor * VELOCIDADE_AO_VIVO, tl.duracao);
    const cabe = (t: string) => cursor + estimarDuracao(t) <= o.ate;
    // Confere a tela até o fim mais tarde possível da fala: voz mais lenta e entrada atrasada.
    const tela = (t: string) => telaEntre(tl, cursor, cursor + estimarDuracao(t) * FOLGA_DA_TELA + ATRASO_MAXIMO_ENCHIMENTO);
    const m = momento(tl, { tJogo, emPenaltis: cursor * VELOCIDADE_AO_VIVO > DURACAO_JOGO, ditas, mataMata: o.mataMata, briga: o.briga, inicioDoVao: saida.length === 0 });
    const contexto = naoDitasPrimeiro([...embaralhar(rng, m.doMomento), ...embaralhar(rng, m.contexto)]);
    // Posse: só as que a tela mostra durante a fala.
    const daTela = (): string[] => {
      const lado = telaEntre(tl, cursor, cursor + 1).lado;
      if (!lado) return [];
      const frases = frasesDaTela(tl, lado);
      const lista = ordemDaTela.filter((k) => k < frases.length).map((k) => frases[k]!);
      // A fala inteira no toque de bola, com o mesmo Time na bola, e mostrando o que ela diz.
      return naoDitasPrimeiro(lista.filter(([t, vale]) => {
        if (!cabe(t)) return false;
        const naTela = tela(t);
        return naTela.lado === lado && vale(naTela);
      }).map(([t]) => t));
    };
    let escolhida: string | undefined;
    // O que é da última Rodada vem antes de tudo, no começo do jogo; depois, o que é do momento.
    escolhida = m.primeiro.find((t) => !ditas.has(t) && cabe(t)) ?? m.doMomento.find((t) => !ditas.has(t) && cabe(t));
    if (!escolhida) {
      const posse = daTela();
      const ctx = contexto.filter(cabe);
      const nova = (l: string[]) => l.find((t) => !ditas.has(t));
      // Mais frases de posse, uma de contexto de vez em quando. Frase nova antes de repetida,
      // mesmo que seja do outro tipo: a tela às vezes só deixa poucas frases de posse.
      escolhida = saida.length % 3 === 1 ? (nova(ctx) ?? nova(posse)) : (nova(posse) ?? nova(ctx));
      escolhida ??= saida.length % 3 === 1 ? (ctx[0] ?? posse[0]) : (posse[0] ?? ctx[0]);
    }
    escolhida ??= curtas.find((t) => cabe(t) && !saida.some((s) => s.texto === t));
    if (!escolhida) break;
    saida.push({ texto: escolhida, em: cursor });
    ditas.add(escolhida);
    cursor += estimarDuracao(escolhida) + RESPIRO;
  }
  return saida;
}

/**
 * Frases que não dependem da bola: minuto, placar, torcida, clima, Mata-mata, última Rodada.
 * `doMomento` são as que só fazem sentido agora (virada, reta final...) e vêm na frente.
 */
function momento(
  tl: Timeline,
  o: { tJogo: number; emPenaltis: boolean; ditas: Set<string>; mataMata: MataMataDaPartida | null; briga: BrigaPeloMataMata | null; inicioDoVao: boolean },
): { primeiro: string[]; doMomento: string[]; contexto: string[] } {
  const { ditas } = o;
  const r = tl.resultado;
  const time = (l: Lado): TimeId => r.times[l];
  const de = (l: Lado) => doTime(time(l));
  const curto = (l: Lado) => FALA_DO_TIME[time(l)].curto;
  const artigo = (l: Lado) => cap(FALA_DO_TIME[time(l)].artigo);
  const mm = o.mataMata;
  if (o.emPenaltis) {
    const vale = mm ? [mm.copa ? (mm.copa === 'FINAL' ? `A taça da Copa vai ser decidida nos pênaltis!` : `A vaga na Copa vai ser decidida nos pênaltis!`) : mm.etapa === 'FINAL' ? `O título vai ser decidido nos pênaltis!` : `A vaga na Final vai ser decidida nos pênaltis!`] : [];
    return { primeiro: [], doMomento: [], contexto: [`Tensão total na marca do pênalti.`, `A torcida não respira!`, `Quem vai bater agora?`, `Goleiro se ajeita na linha.`, `Silêncio na Mata...`, ...vale] };
  }
  const minuto = Math.min(90, Math.max(1, Math.round(o.tJogo / 60)));
  const placar = tl.placarEm(o.tJogo);
  // Quem está com a bola agora (no toque de bola) ou quem ataca no próximo lance.
  const naTela = tl.bolaNoToque(o.tJogo);
  const proximo = tl.janelas.find((j) => j.resolucao > o.tJogo);
  const anterior = [...tl.janelas].reverse().find((j) => j.resolucao <= o.tJogo);
  const posse: Lado = naTela?.lado ?? proximo?.lance.ataque ?? 'mandante';
  const outro: Lado = posse === 'mandante' ? 'visitante' : 'mandante';
  const diff = placar[posse] - placar[outro];
  const depoisDeGol = anterior?.lance.tipo === 'GOL' && (o.tJogo - anterior.resolucao) / VELOCIDADE_AO_VIVO < 12 ? anterior.lance.ataque : null;

  const contexto = [
    `${minuto} minutos de jogo. ${placarFalado(tl, placar)}`,
    placarFalado(tl, placar),
    `A torcida canta na Mata!`,
    `Que jogo movimentado na várzea!`,
    `Ritmo forte aqui no Varzeão.`,
    `Jogo aberto, as duas equipes querem.`,
    // Ambiente (frases aprovadas em 11/11, ADR-0045).
    `A bola não para quieta no Varzeão!`,
    `A torcida pede mais raça!`,
    `Ninguém tira o pé nessa dividida.`,
    `Futebol de várzea raiz, do jeito que a gente gosta!`,
    `A galera na beira do campo não para de gritar.`,
    `O campinho tá pegando fogo!`,
    `Jogo pegado, cada bola vale ouro.`,
    `O juiz deixa o jogo correr.`,
    `É bola pra lá, bola pra cá!`,
    `Que partida, minha gente!`,
    `A Mata inteira de olho nesse jogo.`,
    `Respeita a várzea!`,
    `Tem gente subindo na árvore pra ver esse jogo!`,
    `Futebol bonito no Varzeão hoje.`,
    // Na T2 o Clima e a Arquibancada aparecem na tela (ADR-0019); a fala acompanha o que se vê.
    ...(tl.t2
      ? [FALA_DO_CLIMA_AO_VIVO[tl.t2.clima], `A arquibancada de madeira treme!`, `A torcida ${de(posse)} empurra o time!`]
      : [`Sol forte no campinho hoje.`, `A arquibancada de madeira treme!`]),
  ];
  const doMomento: string[] = [];
  if (depoisDeGol) {
    const marcou = depoisDeGol;
    const sofreu: Lado = marcou === 'mandante' ? 'visitante' : 'mandante';
    contexto.push(`A torcida ${de(marcou)} faz a festa!`, `${curto(sofreu)} precisa reagir.`);
    // A saída de bola só é falada enquanto a bola está parada no meio, esperando o toque.
    if (naTela?.tipo === 'PARADA' && Math.hypot(naTela.bola.x - 0.5, naTela.bola.y - 0.5) < 0.05) doMomento.push(`Saída de bola ${de(sofreu)}, depois do gol.`);
    // O gol empatou, ou virou o jogo (quem marcou já esteve atrás).
    if (placar[marcou] === placar[sofreu]) doMomento.push(`Tudo igual de novo no Varzeão!`);
    else if (placar[marcou] === placar[sofreu] + 1) {
      let esteveAtras = false;
      for (let t = 0; t < o.tJogo; t += 60) {
        const p = tl.placarEm(t);
        if (p[marcou] < p[sofreu]) esteveAtras = true;
      }
      if (esteveAtras) doMomento.push(`Virou o jogo! ${artigo(marcou)} ${curto(marcou)} agora está na frente!`);
    }
  }
  // Logo depois de um desarme ou defesa, quem defendeu recupera e recomeça.
  if (o.inicioDoVao && anterior && anterior.lance.tipo !== 'GOL' && naTela && naTela.lado !== anterior.lance.ataque) contexto.push(`Recupera ${de(naTela.lado)}, e começa tudo de novo.`);
  if (diff < 0) contexto.push(`${curto(posse)} está atrás no placar e vai pra cima.`, `${curto(outro)} administra a vantagem.`);
  if (diff > 0) contexto.push(`${curto(posse)} na frente, controla o jogo.`, `${curto(outro)} precisa do gol.`);
  if (minuto >= 80) contexto.push(`Reta final de jogo!`, `O tempo está acabando!`, `Últimos minutos no Varzeão!`);
  if (minuto <= 8) contexto.push(`Começo de jogo, as equipes ainda se estudando.`);
  // Contexto do jogo (frases aprovadas em 11/11, ADR-0045).
  const ataques = r.lances.filter((l) => !l.bolaParada).length;
  if (minuto >= 20 && ataques <= 10) contexto.push(`Jogo truncado, poucas chances até aqui.`, `Muita marcação e pouco espaço no Varzeão.`);
  if (minuto >= 20 && ataques >= 24) contexto.push(`Jogo lá e cá, ninguém se segura!`, `Que jogo aberto! Chance pra todo lado.`);
  if (minuto >= 80 && placar.mandante === placar.visitante) doMomento.push(`Tudo igual e o tempo acabando!`, `Quem vai ter coragem de decidir?`);
  if (minuto >= 80 && Math.abs(diff) === 1) {
    const frente: Lado = diff > 0 ? posse : outro;
    const atras: Lado = frente === 'mandante' ? 'visitante' : 'mandante';
    doMomento.push(`${artigo(frente)} ${curto(frente)} segura o resultado, faltam poucos minutos.`, `${artigo(atras)} ${curto(atras)} tem pouco tempo pra buscar o empate!`);
  }
  if (minuto >= 38 && minuto <= 45) contexto.push(`Fim de primeiro tempo se aproximando.`);
  if (minuto >= 46 && minuto <= 52) contexto.push(`Começa a segunda etapa, bola rolando de novo.`);
  if (minuto >= 87) doMomento.push(`Acréscimos no Varzeão!`, `O juiz já olha o relógio...`, `Última chance pra alguém!`);
  // Mata-mata (ADR-0048): o que está em jogo. A tela mostra "Semifinal" ou "Final" no topo.
  if (mm) {
    contexto.push(...(mm.copa && mm.copa !== 'FINAL' ? [`Quem perder tá fora da Copa!`, `É Copa: noventa minutos e acabou.`, `Ninguém quer cair cedo na Copa.`] : mm.copa ? [`Vale a taça da Copa!`, `É a Final da Copa, cada lance vale ouro!`] : mm.etapa === 'SEMIFINAL' ? [`Quem perder tá fora!`, `Vale vaga na Final!`, `É Semifinal, ninguém quer voltar pra casa.`] : [`Vale a taça!`, `É Final, cada lance vale ouro!`, `Noventa minutos pra entrar na história da Temporada ${mm.temporada}.`]));
    if (minuto >= 80 && placar.mandante === placar.visitante) doMomento.push(`Se ficar assim, vai pros pênaltis!`);
  }

  // Última Rodada (ADR-0053): a viga no topo e as plaquinhas embaixo do placar mostram o mesmo.
  const b = o.briga;
  /** Começo de jogo na última Rodada: o que está em jogo vem antes de tudo, uma vez só. */
  const primeiro: string[] = [];
  if (b) {
    const ts = r.times;
    if (minuto <= 10 && placar.mandante + placar.visitante === 0) {
      // A plaquinha diz do que cada Time precisa até os 10'.
      const g = falaDosGarantidos(b, ts);
      for (const t of [g, ...falasDaNecessidade(b, ts)]) if (t && !ditas.has(t)) primeiro.push(t);
    } else {
      const assim = seAcabarAssim(b, ts, placar);
      if (assim && (depoisDeGol || minuto >= 75)) doMomento.push(assim);
      else if (assim) contexto.push(assim);
      const g = falaDosGarantidos(b, ts);
      if (g) contexto.push(g);
    }
    contexto.push(`É a última Rodada, cada gol mexe na tabela!`, b.grupo ? `Olho na tabela: os dois primeiros ${NOME_DO_GRUPO[b.grupo].replace(/^Grupo d/, 'do Grupo d')} vão pro Mata-mata!` : `Olho na tabela: os quatro primeiros vão pro Mata-mata!`);
  }
  return { primeiro, doMomento, contexto };
}

/**
 * Encaixa as falas: âncoras na hora (sem sobrepor), depois o enchimento de cada vão, em
 * ordem, enquanto couber antes da próxima âncora. Enchimento que não cabe sai.
 */
export function agendarAoVivo(falas: FalaAoVivo[], duracao: (id: string) => number): FalaAgendadaAoVivo[] {
  const ancoras = falas.filter((f) => f.tipo === 'ancora');
  const desejado = (f: FalaAoVivo) => (f.modo === 'ate' ? Math.max(f.naoAntes ?? 0, f.em! - duracao(f.id)) : f.em!);
  // A narração nunca atrasa o jogo. Resolução do lance, intervalo, fim e pênaltis entram na
  // hora certa e cortam o que estiver no ar; construção e comentário pós-lance esperam a vez,
  // mas, se não couberem a tempo, saem.
  const prioritaria = (f: FalaAoVivo) => f.modo !== 'ate' && !f.id.endsWith('-c');
  const fimDe = (a: FalaAgendadaAoVivo) => a.fim ?? a.inicio + duracao(a.id);
  const agenda: FalaAgendadaAoVivo[] = [];
  for (const f of [...ancoras].sort((x, y) => desejado(x) - desejado(y))) {
    const quer = desejado(f);
    const ultima = agenda[agenda.length - 1];
    if (prioritaria(f)) {
      if (ultima && fimDe(ultima) > quer - CORTE) {
        // Corta quem está falando; se sobraria só um pedacinho, tira de vez.
        if (quer - CORTE - ultima.inicio < SOBRA_MINIMA) agenda.pop();
        else ultima.fim = quer - CORTE;
      }
      agenda.push({ id: f.id, texto: f.texto, inicio: quer });
      continue;
    }
    const inicio = Math.max(quer, ultima ? fimDe(ultima) + RESPIRO : -Infinity);
    // Construção: precisa começar com folga antes da resolução. Pós-lance: no máximo um pouco atrasado.
    const limite = f.modo === 'ate' ? f.em! - SOBRA_MINIMA : quer + ATRASO_MAXIMO_POS;
    if (inicio > limite) continue;
    agenda.push({ id: f.id, texto: f.texto, inicio });
  }
  // Construção que passaria da resolução é cortada nela (a resolução corta, como no rádio).
  agenda.sort((a, b) => a.inicio - b.inicio);
  for (let i = 0; i + 1 < agenda.length; i++) {
    const a = agenda[i]!;
    const b = agenda[i + 1]!;
    if (fimDe(a) > b.inicio - CORTE) {
      if (b.inicio - CORTE - a.inicio < SOBRA_MINIMA) agenda.splice(i--, 1);
      else a.fim = b.inicio - CORTE;
    }
  }
  // Enchimento: cada frase foi escrita para a hora `em` (o que a tela mostra ali). Entra nessa
  // hora ou logo depois, sem passar da próxima âncora; se atrasar demais, sai (ADR-0070).
  const fixas = [...agenda].sort((a, b) => a.inicio - b.inicio);
  let livre = -Infinity;
  for (const f of falas.filter((x) => x.tipo === 'enchimento').sort((x, y) => x.em! - y.em!)) {
    const d = duracao(f.id);
    const antes = [...fixas].reverse().find((a) => a.inicio <= f.em!);
    const depois = fixas.find((a) => a.inicio > f.em!);
    const inicio = Math.max(f.em!, antes ? fimDe(antes) + RESPIRO : -Infinity, livre);
    const ate = depois ? depois.inicio - RESPIRO : Infinity;
    if (inicio - f.em! > ATRASO_MAXIMO_ENCHIMENTO || inicio + d > ate) continue;
    agenda.push({ id: f.id, texto: f.texto, inicio });
    livre = inicio + d + RESPIRO;
  }
  return agenda.sort((a, b) => a.inicio - b.inicio);
}

/** Sons do Ao Vivo: apitos, chutes, gols e "uuuh", no tempo do Ao Vivo. */
export function eventosAoVivo(tl: Timeline): EventoSonoro[] {
  const ev: EventoSonoro[] = [{ tipo: 'APITO_INICIAL', t: 0.1 }];
  for (const j of tl.janelas) {
    const t = aoVivo(j.resolucao);
    const tipo = j.lance.tipo;
    if (tipo === 'DESARME') ev.push({ tipo: 'DESARME', t });
    else if (tipo === 'FALTA') ev.push({ tipo: 'APITO_FALTA', t });
    else {
      ev.push({ tipo: 'CHUTE', t: t - 0.15 });
      if (tipo === 'GOL') ev.push({ tipo: 'GOL', t: t + 0.05 });
      if (tipo === 'GOL' && tl.t2) ev.push({ tipo: 'CORO', t: t + 2.6 });
      else if (tipo === 'FORA') ev.push({ tipo: 'QUASE', t: t + 0.1 });
    }
  }
  if (tl.disputa) {
    ev.push({ tipo: 'APITO_FINAL', t: aoVivo(DURACAO_JOGO) });
    tl.disputa.cobrancas.forEach((_, k) => ev.push({ tipo: 'CHUTE', t: aoVivo(instanteDaCobranca(tl.disputa!, k)) - 0.1 }));
    ev.push({ tipo: 'APITO_FINAL', t: aoVivo(tl.disputa.fim) });
  } else ev.push({ tipo: 'APITO_FINAL', t: aoVivo(DURACAO_JOGO) });
  return ev.sort((a, b) => a.t - b.t);
}
