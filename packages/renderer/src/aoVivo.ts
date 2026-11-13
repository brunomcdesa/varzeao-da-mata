/**
 * Narração do Ao Vivo do site: o Locutor fala o jogo inteiro, sem parar.
 *
 * O Ao Vivo mostra 90 minutos em 4 min 30 s (VELOCIDADE_AO_VIVO). Os lances usam as mesmas falas do
 * Reels (montarNarracao num Roteiro com todos os lances); entre um lance e outro entram
 * falas de "jogo corrido" (posse, construção, minuto, placar, torcida), sempre do Time que
 * vai atacar no próximo lance, para não contradizer o que está na tela.
 *
 * Tempo aqui é sempre "s de Ao Vivo" (s de jogo ÷ VELOCIDADE_AO_VIVO), que é também o
 * tempo do arquivo de áudio: o site toca o áudio em `tempoAoVivo / VELOCIDADE_AO_VIVO`.
 *
 * Duas etapas, porque só se sabe quanto cada fala dura depois de sintetizar:
 *   1. roteiroAoVivo: os textos (âncoras dos lances + enchimento estimado para cada vão);
 *   2. agendarAoVivo: com as durações reais, encaixa tudo sem sobreposição.
 */
import { FALA_DO_TIME, doTime, type MataMataDaPartida, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, type Lado } from '@liga/sim';
import { montarNarracao, type EventoSonoro, type OpcoesNarracao, type Tom } from './narracao.js';
import { instanteDaCobranca } from './penaltis.js';
import { Roteiro } from './roteiro.js';
import { DURACAO_JOGO, VELOCIDADE_AO_VIVO, type Timeline } from './timeline.js';

export interface FalaAoVivo {
  id: string;
  texto: string;
  tom: Tom;
  /** Âncora: fala de lance (tem hora certa). Enchimento: vai no vão entre âncoras, se couber. */
  tipo: 'ancora' | 'enchimento';
  /** Âncora: s de Ao Vivo em que a fala deve terminar ('ate') ou começar ('de'). */
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

export function roteiroAoVivo(tl: Timeline, apelidos?: Record<Lado, (string | null)[]>, opcoes: OpcoesNarracao = {}): FalaAoVivo[] {
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
    } else if (s.tipo === 'FIM') falas.push({ ...base, em: aoVivo(tl.duracao) + 0.2, modo: 'de' });
  }
  // Intervalo: no meio do jogo o Locutor marca os 45 minutos.
  const meio = aoVivo(DURACAO_JOGO / 2);
  const p45 = tl.placarEm(DURACAO_JOGO / 2);
  falas.push({ id: 'meio', texto: `Quarenta e cinco minutos! ${placarFalado(tl, p45)}`, tom: 'normal', tipo: 'ancora', em: meio, modo: 'de' });

  // Vãos entre âncoras, com a duração estimada das âncoras, para escolher o enchimento.
  const estimadas = agendarAoVivo(falas, (id) => estimarDuracao(falas.find((x) => x.id === id)!.texto));
  const fim = aoVivo(tl.duracao);
  let vao = 0;
  /** Memória da Partida (ADR-0045): uma frase dita não volta até as outras se esgotarem. */
  const ditas = new Set<string>();
  for (let i = 0; i <= estimadas.length; i++) {
    const antes = estimadas[i - 1];
    const de = antes ? (antes.fim ?? antes.inicio + estimarDuracao(antes.texto)) + RESPIRO : 0;
    const ate = (estimadas[i]?.inicio ?? fim) - RESPIRO;
    if (ate - de < 1.6) continue;
    // Quem ataca no próximo lance tem a bola agora.
    const tMeio = (de + ate) / 2;
    const proximo = tl.janelas.find((j) => aoVivo(j.resolucao) > tMeio);
    const anterior = [...tl.janelas].reverse().find((j) => aoVivo(j.resolucao) <= tMeio);
    const textos = enchimento(tl, {
      vao,
      tJogo: tMeio * VELOCIDADE_AO_VIVO,
      posse: proximo?.lance.ataque ?? (anterior ? (anterior.lance.ataque === 'mandante' ? 'visitante' : 'mandante') : 'mandante'),
      depoisDeGol: anterior?.lance.tipo === 'GOL' && de - aoVivo(anterior.resolucao) < 12 ? anterior.lance.ataque : null,
      segundos: ate - de,
      penaltis: tMeio * VELOCIDADE_AO_VIVO > DURACAO_JOGO,
      ditas,
      mataMata: opcoes.mataMata ?? null,
    });
    textos.forEach((texto, k) => falas.push({ id: `enche-${vao}-${k}`, texto, tom: 'normal', tipo: 'enchimento', vao }));
    vao++;
  }
  return falas;
}

function placarFalado(tl: Timeline, p: Record<Lado, number>): string {
  const t = tl.resultado.times;
  if (p.mandante === p.visitante) return p.mandante === 0 ? 'Segue zero a zero.' : `Tudo igual, ${numero(p.mandante)} a ${numero(p.visitante)}.`;
  return `${FALA_DO_TIME[t.mandante].curto} ${p.mandante}, ${FALA_DO_TIME[t.visitante].curto} ${p.visitante}.`;
}

/**
 * Frases de jogo corrido para um vão, até encher a duração estimada (um pouco além, para
 * sobrar escolha; o agendamento tira o que não couber). Determinístico pelo seed + vão.
 */
function enchimento(
  tl: Timeline,
  o: { vao: number; tJogo: number; posse: Lado; depoisDeGol: Lado | null; segundos: number; penaltis: boolean; ditas?: Set<string>; mataMata?: MataMataDaPartida | null },
): string[] {
  const ditas = o.ditas ?? new Set<string>();
  const r = tl.resultado;
  const rng = criarRng(((r.seed >>> 0) ^ ((o.vao + 1) * 0x85ebca6b)) >>> 0);
  const time = (l: Lado): TimeId => r.times[l];
  const outro: Lado = o.posse === 'mandante' ? 'visitante' : 'mandante';
  const de = (l: Lado) => doTime(time(l));
  const curto = (l: Lado) => FALA_DO_TIME[time(l)].curto;
  const artigo = (l: Lado) => cap(FALA_DO_TIME[time(l)].artigo);
  const jog = (l: Lado, p: Posicao) => `o ${POSICAO[p]} ${de(l)}`;
  const minuto = Math.min(90, Math.max(1, Math.round(o.tJogo / 60)));
  const placar = tl.placarEm(o.tJogo);
  const diff = placar[o.posse] - placar[outro];

  const mm = o.mataMata ?? null;
  if (o.penaltis) {
    const vale = mm ? [mm.etapa === 'FINAL' ? `O título vai ser decidido nos pênaltis!` : `A vaga na Final vai ser decidida nos pênaltis!`] : [];
    return embaralhar(rng, [`Tensão total na marca do pênalti.`, `A torcida não respira!`, `Quem vai bater agora?`, `Goleiro se ajeita na linha.`, `Silêncio na Mata...`, ...vale]);
  }

  // Só o que aparece na tela: nada de lateral, falta ou bola parada (o jogo não mostra).
  const posse = [
    `Bola com ${artigo(o.posse).toLowerCase()} ${curto(o.posse)}.`,
    `${cap(jog(o.posse, 'ZAG'))} sai jogando.`,
    `${cap(jog(o.posse, 'GOL'))} repõe a bola.`,
    `${curto(o.posse)} troca passes no meio-campo.`,
    `${cap(jog(o.posse, 'MEI'))} pede a bola.`,
    `Toca de lado ${de(o.posse)}, com paciência.`,
    `${cap(jog(o.posse, 'MEI'))} gira o jogo.`,
    `${curto(o.posse)} vai ganhando terreno.`,
    `Passe curto, ${jog(o.posse, 'MEI')} domina.`,
    `${cap(jog(o.posse, 'ATA'))} se movimenta, pede profundidade.`,
    `${curto(o.posse)} roda a bola, procurando espaço.`,
    `${cap(jog(outro, 'ATA'))} pressiona a saída.`,
    `${curto(outro)} recua e fecha os espaços.`,
    `Marcação forte ${de(outro)} no meio.`,
    `Dividida no meio! A bola fica com ${artigo(o.posse).toLowerCase()} ${curto(o.posse)}.`,
    `${cap(jog(o.posse, 'ZAG'))} tenta o lançamento... a zaga ${de(outro)} afasta.`,
    `Recupera ${de(o.posse)}, e começa tudo de novo.`,
    `${curto(o.posse)} chega pela direita.`,
    `${curto(o.posse)} tenta pela esquerda.`,
    // Frases aprovadas em 11/11 (ADR-0045): acompanham o toque de bola da tela.
    `${cap(jog(o.posse, 'ZAG'))} recua pro goleiro.`,
    `${cap(jog(o.posse, 'GOL'))} segura e distribui.`,
    `${artigo(o.posse)} ${curto(o.posse)} tem paciência, gira de um lado pro outro.`,
    `${cap(jog(o.posse, 'MEI'))} olha, procura alguém livre...`,
    `Passe errado! Mas ${artigo(o.posse).toLowerCase()} ${curto(o.posse)} recupera logo.`,
    `${artigo(outro)} ${curto(outro)} aperta a marcação, não deixa respirar.`,
    `${cap(jog(outro, 'ATA'))} volta pra ajudar na marcação.`,
    `${artigo(o.posse)} ${curto(o.posse)} tenta furar o bloqueio.`,
    `Troca de passes no campo de defesa ${de(o.posse)}.`,
  ];
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
      ? [FALA_DO_CLIMA_AO_VIVO[tl.t2.clima], `A arquibancada de madeira treme!`, `A torcida ${de(o.posse)} empurra o time!`]
      : [`Sol forte no campinho hoje.`, `A arquibancada de madeira treme!`]),
  ];
  /** Frases que só fazem sentido agora: entram na frente da fila de contexto. */
  const doMomento: string[] = [];
  if (o.depoisDeGol) {
    const marcou = o.depoisDeGol;
    const sofreu: Lado = marcou === 'mandante' ? 'visitante' : 'mandante';
    contexto.push(`A torcida ${de(marcou)} faz a festa!`, `${curto(sofreu)} precisa reagir.`, `Saída de bola ${de(sofreu)}, depois do gol.`);
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
  if (diff < 0) contexto.push(`${curto(o.posse)} está atrás no placar e vai pra cima.`, `${curto(outro)} administra a vantagem.`);
  if (diff > 0) contexto.push(`${curto(o.posse)} na frente, controla o jogo.`, `${curto(outro)} precisa do gol.`);
  if (minuto >= 80) contexto.push(`Reta final de jogo!`, `O tempo está acabando!`, `Últimos minutos no Varzeão!`);
  if (minuto <= 8) contexto.push(`Começo de jogo, as equipes ainda se estudando.`);
  // Contexto do jogo (frases aprovadas em 11/11, ADR-0045).
  const ataques = r.lances.filter((l) => !l.bolaParada).length;
  if (minuto >= 20 && ataques <= 10) contexto.push(`Jogo truncado, poucas chances até aqui.`, `Muita marcação e pouco espaço no Varzeão.`);
  if (minuto >= 20 && ataques >= 24) contexto.push(`Jogo lá e cá, ninguém se segura!`, `Que jogo aberto! Chance pra todo lado.`);
  if (minuto >= 80 && placar.mandante === placar.visitante) doMomento.push(`Tudo igual e o tempo acabando!`, `Quem vai ter coragem de decidir?`);
  if (minuto >= 80 && Math.abs(diff) === 1) {
    const frente: Lado = diff > 0 ? o.posse : outro;
    const atras: Lado = frente === 'mandante' ? 'visitante' : 'mandante';
    doMomento.push(`${artigo(frente)} ${curto(frente)} segura o resultado, faltam poucos minutos.`, `${artigo(atras)} ${curto(atras)} tem pouco tempo pra buscar o empate!`);
  }
  if (minuto >= 38 && minuto <= 45) contexto.push(`Fim de primeiro tempo se aproximando.`);
  if (minuto >= 46 && minuto <= 52) contexto.push(`Começa a segunda etapa, bola rolando de novo.`);
  if (minuto >= 87) doMomento.push(`Acréscimos no Varzeão!`, `O juiz já olha o relógio...`, `Última chance pra alguém!`);
  // Mata-mata (ADR-0048): o que está em jogo. A tela mostra "Semifinal" ou "Final" no topo.
  if (mm) {
    contexto.push(...(mm.etapa === 'SEMIFINAL' ? [`Quem perder tá fora!`, `Vale vaga na Final!`, `É Semifinal, ninguém quer voltar pra casa.`] : [`Vale a taça!`, `É Final, cada lance vale ouro!`, `Noventa minutos pra entrar na história da Temporada ${mm.temporada}.`]));
    if (minuto >= 80 && placar.mandante === placar.visitante) doMomento.push(`Se ficar assim, vai pros pênaltis!`);
  }

  // Mistura: mais frases de posse, uma de contexto de vez em quando. O que ainda não foi dito na
  // Partida vem primeiro; o que é do momento (virada, reta final...) vem antes de tudo.
  const naoDitasPrimeiro = (lista: string[]) => [...lista.filter((t) => !ditas.has(t)), ...lista.filter((t) => ditas.has(t))];
  const p = naoDitasPrimeiro(embaralhar(rng, posse));
  const c = naoDitasPrimeiro([...embaralhar(rng, doMomento), ...embaralhar(rng, contexto)]);
  const saida: string[] = [];
  let usado = 0;
  let ip = 0;
  let ic = 0;
  while (usado < o.segundos + 2.5 && (ip < p.length || ic < c.length)) {
    const daContexto = saida.length % 3 === 1 && ic < c.length;
    const t = daContexto ? c[ic++]! : (p[ip++] ?? c[ic++]!);
    saida.push(t);
    ditas.add(t);
    usado += estimarDuracao(t) + RESPIRO;
  }
  // Frases curtas no fim, para tapar o que sobrar quando as durações reais forem menores.
  saida.push(...embaralhar(rng, [`Segue o jogo.`, `Bola rolando.`, `Vamos lá!`, `Que partida!`]).slice(0, 2));
  return saida;
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
  const enche = falas.filter((f) => f.tipo === 'enchimento');
  if (!enche.length) return agenda;

  // Vãos reais entre as âncoras já agendadas; cada vão estimado cai no vão real em que estava.
  const fixas = [...agenda].sort((a, b) => a.inicio - b.inicio);
  const vaosReais: [number, number][] = [];
  for (let i = 0; i <= fixas.length; i++) {
    const a = fixas[i - 1];
    const de = a ? fimDe(a) + RESPIRO : 0;
    const ate = (fixas[i]?.inicio ?? Infinity) - RESPIRO;
    if (ate - de >= 0.8) vaosReais.push([de, ate]);
  }
  const porVao = new Map<number, FalaAoVivo[]>();
  for (const f of enche) porVao.set(f.vao!, [...(porVao.get(f.vao!) ?? []), f]);
  const usados = new Set<number>();
  // Associa cada grupo de enchimento ao maior vão real ainda livre na ordem.
  const grupos = [...porVao.keys()].sort((a, b) => a - b);
  let k = 0;
  for (const g of grupos) {
    while (k < vaosReais.length && (vaosReais[k]![1] - vaosReais[k]![0] < 1.2 || usados.has(k))) k++;
    if (k >= vaosReais.length) break;
    usados.add(k);
    let [cursor, ate] = vaosReais[k]!;
    if (!Number.isFinite(ate)) continue; // depois do apito final não tem enchimento
    for (const f of porVao.get(g)!) {
      const d = duracao(f.id);
      if (cursor + d > ate) continue;
      agenda.push({ id: f.id, texto: f.texto, inicio: cursor });
      cursor += d + RESPIRO;
    }
    k++;
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
