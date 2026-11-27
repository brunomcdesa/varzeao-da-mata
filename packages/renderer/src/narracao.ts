/**
 * Locução do Reels: o que o Locutor da Liga fala e quando, e os eventos de som
 * (apitos, chutes, torcida). Tudo derivado do Roteiro, então é determinístico.
 *
 * Regra do glossário: o Locutor fala dos Jogadores pela Posição e pelo Time, nunca pelo @.
 */
import { FALA_DO_TIME, NOME_DA_ETAPA_DA_COPA, type PerfilDoJuiz, concordar, deQuemDepende, doTime, ehGoleada, listaDeTimes, brigaDoTime, necessidadeNaBriga, necessidadeNoRebaixamento, nomeDoClassico, situacoesNaBriga, situacoesNoRebaixamento, textoDaNecessidade, textoDaNecessidadeNoRebaixamento, valeAPermanencia, type BrigaPeloMataMata, type Escalacao, type MataMataDaPartida, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, type Lado, type Lance, type SlotRef } from '@liga/sim';
import { narradorDa } from './narradores.js';
import { F_CHUTE_PENALTI, instanteDaCobranca, resultadoDaCobranca } from './penaltis.js';
import type { Roteiro, Segmento } from './roteiro.js';
import { ocupanteNoLance, type Troca } from './substituicao.js';
import { cartaoSuspende, type SuspensaoNaPartida } from './suspensao.js';

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
 * `apelidos`: o apelido de cada lugar na Escalação (ADR-0014). Na Temporada 1, o narrador fala o
 * nome só nos gols; no resto, pela posição e pelo Time. A partir da Temporada 2 (ADR-0059), toda
 * fala de um Jogador com apelido falável usa o apelido: na primeira vez com a posição e o Time
 * ("Bruninho, atacante da Onça,"), depois só o apelido.
 */
export interface OpcoesNarracao {
  /** Partida do Mata-mata: abertura e fim falam da Semifinal ou da Final (ADR-0048). */
  mataMata?: MataMataDaPartida | null;
  /**
   * Narração do Ao Vivo do site (o jogo inteiro). Sem ela, é a do Reels, que mostra só os
   * melhores momentos: a abertura e o fim dizem isso e chamam para o jogo completo no site
   * (ADR-0052).
   */
  aoVivo?: boolean;
  /** Última Rodada da Fase de Liga (ADR-0053): quem já garantiu e o que a Partida vale. */
  briga?: BrigaPeloMataMata | null;
  /** Técnico de cada lado (ADR-0111): o Narrador fala dele na Escalação e quando vibra no gol. */
  tecnicos?: Partial<Record<Lado, { apelido?: string | null }>> | null;
  /** Marcação individual (ADR-0112), pelos lugares na Escalação: dita na fala da Escalação. */
  marcacoes?: Partial<Record<Lado, { marcador: number; alvo: number }>> | null;
  /** Cartões (ADR-0116): quem chegou pendurado. O Narrador avisa quando o cartão tira do próximo jogo. */
  suspensao?: SuspensaoNaPartida | null;
}

/** "Seu Tonho, técnico da Onça" ou "o técnico da Onça" (ADR-0111). */
export function referenciaDoTecnico(t: { apelido?: string | null }, time: TimeId, primeira: boolean): string {
  const apelido = apelidoFalavel(t.apelido);
  if (!apelido) return `o técnico ${doTime(time)}`;
  return primeira ? `${apelido}, técnico ${doTime(time)}` : apelido;
}

/** Onde passa o jogo completo: o site e, a partir da Temporada 2, também o App (ADR-0052). */
export const ONDE_VER_O_JOGO = (t2: boolean) => (t2 ? 'no site e no app do Varzeão' : 'no site do Varzeão');

/**
 * "Mexida no Tatu: sai o zagueiro, entra o meia." Pela Posição e pelo Time, nunca pelo @. Fora
 * de posição: "entra o meia, pra jogar de zagueiro".
 */
export function falaDaTroca(
  trocas: readonly Troca[],
  esc: Record<Lado, Escalacao>,
  time: (lado: Lado) => TimeId,
  ref: (lado: Lado, ocupante: number, posicao: Posicao) => string = (_l, _o, pos) => `o ${POSICAO[pos]}`,
): string {
  const partes: string[] = [];
  for (const lado of ['mandante', 'visitante'] as const) {
    const minhas = trocas.filter((x) => x.lado === lado);
    if (!minhas.length) continue;
    const titulares = esc[lado].jogadores.length;
    const no = `n${FALA_DO_TIME[time(lado)].artigo} ${FALA_DO_TIME[time(lado)].curto}`;
    const vaga = (x: Troca) => esc[lado].jogadores[x.lugar]!.posicao;
    const sai = (x: Troca) => ref(lado, x.saiu, vaga(x));
    const entra = (x: Troca) => {
      const reserva = esc[lado].banco?.[x.ocupante - titulares];
      const pos = ref(lado, x.ocupante, reserva?.posicao ?? vaga(x));
      return x.foraDePosicao ? `${pos}, pra jogar de ${POSICAO[vaga(x)]}` : pos;
    };
    partes.push(
      minhas.length === 1
        ? `Mexida ${no}! Sai ${sai(minhas[0]!)}, entra ${entra(minhas[0]!)}.`
        : `Duas mexidas ${no}! Saem ${minhas.map(sai).join(' e ')}. Entram ${minhas.map(entra).join(' e ')}.`,
    );
  }
  return partes.join(' ');
}

export function montarNarracao(roteiro: Roteiro, apelidos?: Record<Lado, (string | null)[]>, o: OpcoesNarracao = {}): Fala[] {
  const tl = roteiro.timeline;
  const r = tl.resultado;
  const esc = tl.escalacoes;
  const time = (lado: Lado): TimeId => r.times[lado];
  /** T2 (ADR-0059): o apelido entra em toda fala de Jogador. Na T1, só nos gols. */
  const comApelido = !!tl.t2;
  /** `indice` aqui é o ocupante (titulares e depois o Banco, ADR-0061), não o lugar. */
  const nomeDe = (s: SlotRef) => (comApelido ? apelidoFalavel(apelidos?.[s.lado]?.[s.indice]) : null);
  /** Substituição (ADR-0061): quem estava no lugar no lance `iLance` e a Posição da vaga dele. */
  const ocupanteNo = (s: SlotRef, iLance: number): SlotRef => ({ lado: s.lado, indice: ocupanteNoLance(r, esc[s.lado].jogadores.length, s.lado, s.indice, iLance) });
  const posicaoDoOcupante = new Map<string, Posicao>();
  /** "o atacante da Onça", ou a marca do apelido, resolvida no fim (primeira vez ou não). */
  const referencia = (s: SlotRef, comTime: boolean, iLance = 0) => {
    const o = ocupanteNo(s, iLance);
    const pos = esc[s.lado].jogadores[s.indice]!.posicao;
    // A primeira menção decide a Posição dita (a da troca, para o reserva fora de posição).
    if (!posicaoDoOcupante.has(`${o.lado}.${o.indice}`)) posicaoDoOcupante.set(`${o.lado}.${o.indice}`, pos);
    return nomeDe(o) ? marcaDoApelido(o, comTime) : `o ${POSICAO[pos]}${comTime ? ` ${doTime(time(s.lado))}` : ''}`;
  };
  const quem = (lance: Lance, papel: 'criador' | 'finalizador' | 'defensor') => referencia(lance[papel]!, true, r.lances.indexOf(lance));
  /** Só a posição, quando o Time já foi dito na mesma frase: "o atacante". */
  const posicao = (lance: Lance, papel: 'criador' | 'finalizador' | 'defensor') => referencia(lance[papel]!, false, r.lances.indexOf(lance));
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
      o.mataMata
        ? `${o.aoVivo ? '' : 'Melhores momentos! '}${aberturaDoMataMata(o.mataMata, r.times.mandante, r.times.visitante, r.seed)}`
        : classico
          ? `${o.aoVivo ? 'É o' : 'Melhores momentos do'} ${classico}! ${curto('mandante')} contra ${curto('visitante')}!`
          : `${o.aoVivo ? 'Bola rolando no' : 'Melhores momentos do'} Varzeão da Mata! ${curto('mandante')} contra ${curto('visitante')}!`
    }${o.briga ? ` ${aberturaDaBriga(o.briga, r.times)}` : ''}${tl.t2 ? ` ${FALA_DO_CLIMA[tl.t2.clima]}` : ''}${r.juiz ? ` ${FALA_DO_JUIZ[r.juiz]}` : ''}`,
    inicio: 0.25,
    limite: segs[0]!.fim,
    tom: 'animado',
    segmento: 0,
    parte: 'antes',
  });
  // Escalação (ADRs 0111 e 0112): quem está na beira do campo e a Marcação individual.
  const tecnicoDito = new Set<Lado>();
  const tecnicoDe = (lado: Lado) => {
    const t = o.tecnicos?.[lado];
    if (!t) return null;
    const primeira = !tecnicoDito.has(lado);
    tecnicoDito.add(lado);
    return referenciaDoTecnico(t, time(lado), primeira);
  };
  {
    const lados = (['mandante', 'visitante'] as const).filter((l) => o.tecnicos?.[l]);
    const nomes = lados.map(tecnicoDe);
    const beira = nomes.length === 2 ? `Na beira do campo, ${nomes[0]}, e ${nomes[1]}.` : nomes.length === 1 ? `Na beira do campo, ${nomes[0]}.` : '';
    const marcacoes = (['mandante', 'visitante'] as const).flatMap((l) => {
      const m = o.marcacoes?.[l];
      if (!m) return [];
      const rival: Lado = l === 'mandante' ? 'visitante' : 'mandante';
      return [`${cap(referencia({ lado: l, indice: m.marcador }, true))} vai colado ${comPreposicao(referencia({ lado: rival, indice: m.alvo }, true), 'no')}.`];
    });
    const texto = [beira, marcacoes.length ? `Marcação individual! ${marcacoes.join(' ')}` : ''].filter(Boolean).join(' ');
    if (texto) falas.push({ id: 'escalacao-beira', texto, inicio: 0.5, limite: segs[0]!.fim, tom: 'normal', segmento: 0, parte: 'antes', opcional: true });
  }
  // Reels: a cartela de abertura mostra os garantidos e do que cada Time precisa (ADR-0053).
  const briga = o.briga ?? null;
  if (briga && !o.aoVivo) {
    const texto = [falaDosGarantidos(briga, r.times), ...falasDaNecessidade(briga, r.times)].filter(Boolean).join(' ');
    if (texto) falas.push({ id: 'briga-inicio', texto, inicio: 0.4, limite: segs[0]!.fim, tom: 'normal', segmento: 0, parte: 'antes' });
  }

  // Substituição (ADR-0061): o Narrador diz quem sai e quem entra, pela Posição e pelo Time.
  segs.forEach((s, indice) => {
    if (s.tipo !== 'TROCA') return;
    // T2: com apelido, "Sai Bruninho, o zagueiro, entra Juca, o meia" (ADR-0059 e ADR-0061).
    const ref = (lado: Lado, ocupante: number, pos: Posicao) => {
      if (!posicaoDoOcupante.has(`${lado}.${ocupante}`)) posicaoDoOcupante.set(`${lado}.${ocupante}`, pos);
      return nomeDe({ lado, indice: ocupante }) ? marcaDoApelido({ lado, indice: ocupante }, false) : `o ${POSICAO[pos]}`;
    };
    const texto = falaDaTroca(tl.trocas, esc, time, ref);
    if (texto) falas.push({ id: 'troca', texto, inicio: s.inicio + 0.2, limite: s.fim, tom: 'normal', segmento: indice, parte: 'antes' });
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
    const pro = (p: string) => comPreposicao(p, 'pro');
    const construcao: Record<string, string[]> = {
      TABELA: [`Tabela ${doTime(time(atq))}! ${cap(pc)} toca e recebe de volta...`, `${cap(c)} faz a parede com ${pf}...`, `Toque de primeira ${doTime(time(atq))}...`],
      CHUTE_DE_LONGE: [`${cap(f)} ajeita... vai arriscar de longe!`, `Olha ${f}, de fora da área!`, `Espaço ${pro(f)} bater...`],
      LANCAMENTO: [`Lançamento longo ${doTime(time(atq))}!`, `${cap(c)} vira o jogo, bola longa ${pro(pf)}!`, `Bola esticada ${doTime(time(atq))}...`],
      CRUZAMENTO: [`${cap(c)} vai pela ponta... cruzou!`, `Cruzamento ${doTime(time(atq))}, ${pf} sobe!`, `Bola na área ${doTime(time(atq))}...`],
      INDIVIDUAL: [`${cap(f)} parte pra cima do zagueiro...`, `${cap(f)} limpa a marcação...`, `${cap(f)} vai no drible...`],
      DESARME: [`${cap(c)} conduz a bola...`, `Vem ${doTime(time(atq))} pelo meio...`, `${cap(c)} tenta a jogada...`],
    };
    // Frases aprovadas em 11/11 (ADR-0045): mais opções de construção.
    const chegando = [`${cap(FALA_DO_TIME[time(atq)].artigo)} ${curto(atq)} vem trabalhando a bola...`, `${cap(c)} carrega pelo meio...`, `Olha ${FALA_DO_TIME[time(atq)].artigo} ${curto(atq)} chegando!`];
    for (const k of ['TABELA', 'LANCAMENTO', 'CRUZAMENTO', 'DESARME']) construcao[k] = [...construcao[k]!, ...chegando];
    // Marcação dupla com passe (ADR-0045): os dois zagueiros fecham e a bola sai para quem está livre.
    if (lance.dobra?.passe) {
      for (const k of Object.keys(construcao)) construcao[k] = [`Dobraram a marcação... e a bola sai pro companheiro livre!`, `Dois zagueiros em cima... tocou ${pro(pf)}, livre!`];
    } else if (lance.dobra && !lance.bolaParada) {
      construcao[plano.estilo] = [...construcao[plano.estilo]!, `A zaga ${doTime(time(lance.dobra.zagueiro.lado))} dobra a marcação ${comPreposicao(f, 'no')}!`];
    }
    // Contra-ataque: o rival perdeu a bola com gente na frente.
    if (lance.contraAtaque) {
      const linhas = lance.contraAtaque.recomposto
        ? [`Contra-ataque ${doTime(time(atq))}! A defesa volta correndo...`, `Puxou o contra-ataque! ${cap(pc)} sai em velocidade...`]
        : [`Contra-ataque ${doTime(time(atq))}! A defesa ficou lá na frente!`, `Olha o buraco na defesa! ${cap(pc)} sai sozinho...`, `Contra-ataque mortal! Ninguém voltou!`];
      for (const k of Object.keys(construcao)) construcao[k] = linhas;
    }
    // Bola parada: o escanteio e o lateral aparecem na tela, então o narrador fala deles.
    construcao.ESCANTEIO = [`Escanteio ${doTime(time(atq))}! ${cap(pc)} vai cobrar...`, `Bola na bandeirinha. Cobra ${c}...`, `Escanteio! ${cap(c)} levanta na área...`];
    if (lance.bolaParada === 'LATERAL') {
      for (const k of Object.keys(construcao)) {
        if (k !== 'ESCANTEIO') construcao[k] = [`Lateral ${doTime(time(atq))}, cobrança rápida...`, `Cobrou o lateral, ${pc} recebe...`, `Lateral cobrado, ${c} domina...`];
      }
    }
    // Temporada 2: faltas e cobranças (ADR-0024).
    construcao.FALTA = construcao.DESARME!;
    if (lance.tipo === 'FALTA' && lance.finalizador) construcao.FALTA = [`${cap(f)} recebe e parte pra cima...`, `${cap(f)} vai no drible...`];
    construcao.PENALTI = [`Pênalti ${doTime(time(atq))}! ${cap(pc)} ajeita a bola...`, `${cap(pc)} vai bater o pênalti...`, `Bola na marca. Cobra ${c}...`];
    construcao.FALTA_DIRETA = [`Falta perigosa! ${cap(pc)} na bola, barreira armada...`, `Falta na entrada da área. Vai bater ${c}...`];
    construcao.FALTA_CURTA = [`Falta ${doTime(time(atq))}, jogada ensaiada...`, `${cap(pc)} rola curto pra ${pf}...`];
    if (lance.bolaParada === 'FALTA_CRUZADA') construcao.ESCANTEIO = [`Falta ${doTime(time(atq))}! ${cap(pc)} vai levantar na área...`, `Cobrança de falta, bola na área...`];
    // O finalizador foi no drible e perdeu a bola: a construção fala dele.
    if (lance.tipo === 'DESARME' && lance.drible && lance.finalizador) {
      construcao.DESARME = [`${cap(c)} acha ${f}... vai pra cima!`, `${cap(f)} recebe e tenta o drible...`, `${cap(f)} parte pra cima do marcador...`];
    }
    // T3 (ADR-0094): Rebote, Chute de longe de verdade e Pressão final, que aparecem na tela.
    construcao.REBOTE = [`Soltou! A bola sobra na área...`, `Rebote! ${cap(f)} vai na sobra...`, `O goleiro não segura! Bola viva na área...`];
    if (lance.chuteDeLonge && lance.finalizador) {
      const mesmo = lance.finalizador.indice === lance.criador.indice;
      const doZagueiro = esc[atq].jogadores[lance.finalizador.indice]?.posicao === 'ZAG';
      construcao.CHUTE_DE_LONGE = doZagueiro
        ? [`${cap(pc)} rola pro zagueiro que subiu... vai arriscar de longe!`, `Olha o zagueiro ${doTime(time(atq))} chegando de trás pra bater!`]
        : mesmo
          ? [`${cap(c)} ajeita... vai arriscar de longe!`, `Olha ${c}, de fora da área!`, `${cap(c)} carrega e solta a bomba!`]
          : construcao.CHUTE_DE_LONGE!;
    }
    if (lance.pressao && !lance.contraAtaque && !lance.bolaParada && !lance.rebote) {
      const pressao = [`${cap(FALA_DO_TIME[time(atq)].artigo)} ${curto(atq)} vai pra cima, pressão total!`, `Pressão ${doTime(time(atq))}! Todo mundo no ataque!`, `${cap(FALA_DO_TIME[time(atq)].artigo)} ${curto(atq)} se lança ao ataque...`];
      construcao[plano.estilo] = [...pressao, ...(construcao[plano.estilo] ?? [])];
    }
    // Jogada da Formação (ADR-0044): o Narrador diz o nome dela, porque ela aparece na tela.
    const dfs = doTime(time(atq === 'mandante' ? 'visitante' : 'mandante'));
    if (lance.jogadaDaFormacao === 'TABELA' && !lance.contraAtaque && lance.bolaParada !== 'LATERAL') {
      const tabela = [`Tabela no meio ${doTime(time(atq))}! Os meias trocam passes...`, `Olha a tabela ${doTime(time(atq))}! ${cap(pc)} toca e recebe...`, `Tabelinha no meio-campo ${doTime(time(atq))}...`];
      for (const k of ['TABELA', 'INDIVIDUAL', 'DESARME', 'FALTA']) construcao[k] = tabela;
    }
    if (lance.jogadaDaFormacao === 'LIGACAO_DIRETA' && !lance.contraAtaque && lance.bolaParada !== 'LATERAL') {
      const ligacao = [`Ligação direta ${doTime(time(atq))}! ${cap(pc)} lança lá da defesa!`, `Ligação direta! O zagueiro ${doTime(time(atq))} manda lá na frente!`, `Bola longa da zaga ${doTime(time(atq))}, ligação direta!`];
      for (const k of ['LANCAMENTO', 'INDIVIDUAL', 'DESARME', 'FALTA']) construcao[k] = ligacao;
    }
    if (lance.cobertura && lance.finalizador && !lance.contraAtaque && lance.bolaParada !== 'LATERAL') {
      const cobertura = [`${cap(f)} passa pelo marcador... olha a cobertura ${dfs}!`, `${cap(f)} limpa o primeiro... e vem a cobertura!`];
      for (const k of ['INDIVIDUAL', 'DESARME']) construcao[k] = cobertura;
    }
    // T3: o primeiro lance dos Acréscimos começa com a placa levantada; o Narrador avisa.
    const primeiroDosAcrescimos = lance.acrescimo !== undefined && !r.lances[s.lance! - 1]?.acrescimo;
    if (primeiroDosAcrescimos && r.acrescimos) {
      const minutos = r.acrescimos === 1 ? 'um minuto' : `${['', '', 'dois', 'três', 'quatro'][r.acrescimos]} minutos`;
      falas.push({ id: `acrescimos-${s.lance}`, texto: escolher(rng, [`Placa levantada: mais ${minutos} de acréscimo!`, `Vai ter mais ${minutos}!`]), inicio: s.inicio + 0.15, limite: s.resolucao! - 0.05, tom: 'normal', segmento: indice, parte: 'antes', opcional: true });
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
        [`Que defesa ${comPreposicao(def, 'do')}!`, 'animado'],
        [`Defesaça! ${cap(def)} fecha o gol!`, 'animado'],
        [`Pegou! ${cap(def)} tá atento!`, 'animado'],
        [`Espalmou ${def}!`, 'animado'],
        [`Que reflexo ${comPreposicao(def, 'do')}!`, 'animado'],
        [`Mãos firmes! ${cap(posicao(lance, 'defensor'))} segura.`, 'animado'],
      ],
      FORA: [
        [`Pra fora! Passou perto!`, 'animado'],
        [`Uuuh! Tirou tinta da trave!`, 'animado'],
        [`Isolou! Lá pro mato!`, 'animado'],
        [`Chutou com vontade, mas foi pra fora!`, 'animado'],
        // Só quando a bola foi por cima (a tela mostra).
        ...(plano.bola.some((b) => b.tipo === 'VOO' && b.chute && b.altura >= 0.5) ? [[`Passou raspando o travessão!`, 'animado'] as [string, Tom]] : []),
      ],
      BLOQUEIO: [
        [`Bloqueou! ${cap(def)} se jogou na frente!`, 'animado'],
        [`Travou o chute! Que corte ${comPreposicao(def, 'do')}!`, 'animado'],
        [`Na zaga! ${cap(def)} bloqueia!`, 'animado'],
        [`Bloqueou com o corpo! Que coragem ${comPreposicao(def, 'do')}!`, 'animado'],
        [`Parou na zaga!`, 'animado'],
      ],
      DESARME: [
        [`Desarmou! ${cap(def)} chega firme.`, 'normal'],
        [`Roubou a bola ${def}!`, 'normal'],
        [`Chegou na hora certa! Bola recuperada.`, 'normal'],
        [`Bote perfeito ${comPreposicao(def, 'do')}!`, 'normal'],
        [`Tomou a bola no tempo certo!`, 'normal'],
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
              : [[`Falta ${comPreposicao(def, 'do')}! O juiz marca.`, 'normal'], [`Apita o juiz, falta!`, 'normal']];
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
    // T3 (ADR-0094): Trave, Rebote, Chute de longe e Gol de placa.
    if (lance.trave) resolucao.FORA = [[`Na trave! Que azar!`, 'grito'], [`Carimbou o poste!`, 'grito'], [`No ferro! Por pouco!`, 'grito']];
    if (lance.rebote) {
      resolucao.GOL = [[`No rebote! Gol ${doTime(time(atq))}!`, 'grito'], [`Pegou a sobra e marcou! Gooool!`, 'grito']];
      resolucao.DESARME = [[`Afastou o rebote! ${cap(def)} chega antes.`, 'normal'], [`A zaga tira o rebote!`, 'normal']];
    }
    if (lance.chuteDeLonge) resolucao.GOL = [[`De fora da área! Gol ${doTime(time(atq))}!`, 'grito'], [`Que bomba! Gooool de longe!`, 'grito']];
    if (lance.golDePlaca) resolucao.GOL = [[`Gol de placa ${doTime(time(atq))}!`, 'grito'], [`Que pintura! Gol de placa!`, 'grito']];
    if (lance.cobertura && lance.tipo === 'DESARME') {
      resolucao.DESARME = [[`Na cobertura! ${cap(def)} chega na sobra!`, 'animado'], [`Cobertura perfeita! ${cap(def)} desarma!`, 'animado']];
    }
    if (lance.jogadaDaFormacao === 'LIGACAO_DIRETA' && lance.tipo === 'DESARME' && !lance.finalizador) {
      resolucao.DESARME = [[`Cortou a ligação direta! ${cap(def)} sobe e tira.`, 'normal'], [`Interceptou! ${cap(def)} lê o lançamento.`, 'normal']];
    }
    const [escolhido, tom] = escolher(rng, resolucao[lance.tipo]!);
    // Suspensão (ADR-0116): o cartão gigante mostra "Fora do próximo jogo", e o Narrador diz junto.
    const falta = lance.falta;
    const suspende = !!falta?.cartao && cartaoSuspende(o.suspensao, falta.autor.lado, ocupanteNo(falta.autor, s.lance!).indice, falta.cartao);
    const texto = !suspende ? escolhido : falta!.cartao === 'VERMELHO' ? `${escolhido} E tá fora do próximo jogo!` : `${escolhido} Tava pendurado: tá fora do próximo jogo!`;
    falas.push({ id: `lance-${s.lance}-b`, texto, inicio: s.resolucao! - 0.1, limite: s.fim - 0.1, tom, segmento: indice, parte: 'depois' });

    if (lance.tipo === 'GOL') {
      const placar = tl.placarEm(tl.janelas[s.lance!]!.resolucao + 1);
      // T2: o nome do gol também passa pela apresentação (ADR-0059).
      const nome = !lance.finalizador ? null : comApelido ? (nomeDe(ocupanteNo(lance.finalizador, s.lance!)) ? quem(lance, 'finalizador') : null) : apelidoFalavel(apelidos?.[lance.finalizador.lado]?.[lance.finalizador.indice]);
      const rival = atq === 'mandante' ? 'visitante' : 'mandante';
      // O gol que confirma a Goleada: a fala extra comemora o placar (que está na tela).
      // Só a primeira vez: se o rival diminuir e a Goleada voltar, não repete (4×1, 4×2, 5×2).
      const golDaGoleada = !goleou.has(atq) && ehGoleada(placar[atq], placar[rival]);
      if (golDaGoleada) goleou.add(atq);
      const placaExtra = lance.golDePlaca ? [`Esse vai pra galeria! Que gol!`, `Coisa de cinema no Varzeão!`] : null;
      const extras = placaExtra ?? (golDaGoleada
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
        `Explode a torcida ${doTime(time(atq))}!`,
        // Sem "Comemora…!": a comemoração já acabou na tela quando esta fala sai (ADR-0071).
        `Que golaço no Varzeão!`,
      ]);
      falas.push({ id: `lance-${s.lance}-c`, texto: escolher(rng, extras), inicio: s.resolucao! + 1.3, limite: s.fim - 0.05, tom: 'animado', segmento: indice, parte: 'depois' });
      // O Técnico vibra na beira do campo (ADR-0111): às vezes o Narrador mostra.
      if (o.tecnicos?.[atq] && !(briga && !o.aoVivo) && rng.chance(0.5)) {
        const t = tecnicoDe(atq)!;
        falas.push({ id: `tecnico-gol-${s.lance}`, texto: escolher(rng, [`E na beira do campo, ${t} vibra!`, `Olha ${t} pulando na beira do campo!`, `${cap(t)} comemora na área técnica!`]), inicio: s.resolucao! + 2.6, limite: s.fim - 0.05, tom: 'animado', segmento: indice, parte: 'depois', opcional: true });
      }
      // Reels, última Rodada: o gol mudou a situação de quem ainda briga (as plaquinhas mudam junto).
      if (briga && !o.aoVivo) {
        const antes = tl.placarEm(tl.janelas[s.lance!]!.resolucao - 1);
        const texto = seAcabarAssim(briga, r.times, placar, antes);
        if (texto) falas.push({ id: `briga-gol-${s.lance}`, texto, inicio: s.resolucao! + 2.6, limite: s.fim - 0.05, tom: 'animado', segmento: indice, parte: 'depois', opcional: true });
      }
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
            ? [[`Pegou! ${cap(referencia(c.goleiro, true, r.lances.length))} defende!`, 'grito'], [`Defendeu!`, 'grito']]
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
  const consequencia = o.mataMata && r.vencedor ? ` ${desfechoDoMataMata(o.mataMata, time(r.vencedor))}` : briga ? desfechoDaBriga(briga, r.times, g).map((t) => ` ${t}`).join('') : '';
  falas.push({ id: 'fim', texto: `Fim de jogo! ${placar}. ${vencedor}${consequencia} ${o.aoVivo ? 'Curtiu? Compartilha com a galera!' : `O jogo completo, Ao Vivo e no Replay, tá ${ONDE_VER_O_JOGO(!!tl.t2)}!`} ${narrador.despedida}`, inicio: fim.inicio + 0.35, limite: fim.fim, tom: 'animado', segmento: segs.length - 1, parte: 'antes' });
  // Apelidos (ADR-0059): a primeira vez de cada Jogador vem com a posição e o Time.
  const apresentados = new Set<string>();
  for (const f of falas) f.texto = resolverApelidos(f.texto, apresentados, (lado, indice) => ({
    nome: nomeDe({ lado, indice })!,
    posicao: POSICAO[posicaoDoOcupante.get(`${lado}.${indice}`) ?? esc[lado].jogadores[indice]!.posicao],
    time: doTime(time(lado)),
  }));
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

/**
 * Marca de um Jogador com apelido dentro do texto de uma fala (ADR-0059). Fica no texto enquanto
 * a fala é escolhida e vira o nome no fim, quando já se sabe se é a primeira vez dele na Partida.
 */
const MARCA = /\u0001(mandante|visitante)\.(\d+)\.([TP])\.(\w*)\u0002/g;
function marcaDoApelido(s: SlotRef, comTime: boolean, preposicao = ''): string {
  return `\u0001${s.lado}.${s.indice}.${comTime ? 'T' : 'P'}.${preposicao}\u0002`;
}

/** "o goleiro" → "do goleiro"; com apelido, "de Bruninho" (sem artigo: não sabemos o gênero). */
export function comPreposicao(ref: string, p: 'do' | 'no' | 'pro'): string {
  if (ref.startsWith('\u0001')) return ref.replace(/\.\w*\u0002$/, `.${p}\u0002`);
  return ref.replace(/^o /, `${p} `);
}

const PREPOSICAO_DO_NOME: Record<string, string> = { do: 'de ', no: 'em ', pro: 'pra ', '': '' };

/**
 * Troca as marcas pelos apelidos. Na primeira vez: "Bruninho, atacante da Onça," (ou "Bruninho,
 * o atacante," quando o Time já foi dito na frase); depois, só "Bruninho".
 */
export function resolverApelidos(
  texto: string,
  apresentados: Set<string>,
  dados: (lado: Lado, indice: number) => { nome: string; posicao: string; time: string },
): string {
  if (!texto.includes('\u0001')) return texto;
  const VIRGULA = '\u0003';
  return texto
    .replace(MARCA, (_, lado: Lado, indice: string, modo: string, prep: string) => {
      const d = dados(lado, Number(indice));
      const chave = `${lado}.${indice}`;
      const antes = PREPOSICAO_DO_NOME[prep] ?? '';
      if (apresentados.has(chave)) return `${antes}${d.nome}`;
      apresentados.add(chave);
      return `${antes}${d.nome}, ${modo === 'T' ? `${d.posicao} ${d.time}` : `o ${d.posicao}`}${VIRGULA}`;
    })
    .replace(/\u0003(?=\s*[,.!?…]|\s*$)/g, '')
    .replace(/\u0003/g, ',');
}

/** Temporada 2: o Narrador comenta o Clima na abertura (o Clima aparece na tela). */
const FALA_DO_CLIMA = {
  SOL: 'Sol forte no Varzeão!',
  NUBLADO: 'Céu fechado no Varzeão.',
  CHUVA: 'Chove no Varzeão, campo pesado!',
  LAMA: 'Muita lama no gramado hoje!',
} as const;
const artigoDe = (t: TimeId) => FALA_DO_TIME[t].artigo;

/** "da Série B" quando a Temporada tem duas Séries; vazio com Série única. */
const daSerie = (m: MataMataDaPartida) => (m.serie ? ` da Série ${m.serie}` : '');

/**
 * Abertura de uma Partida do Mata-mata (ADR-0048). A tela mostra "Semifinal" ou "Final" no
 * subtítulo da abertura; o Clássico, quando é, também aparece.
 */
export function aberturaDoMataMata(m: MataMataDaPartida, mandante: TimeId, visitante: TimeId, seed: number): string {
  const rng = criarRng(((seed >>> 0) ^ 0x27d4eb2f) >>> 0);
  const confronto = `${FALA_DO_TIME[mandante].curto} contra ${FALA_DO_TIME[visitante].curto}`;
  const classico = nomeDoClassico(mandante, visitante);
  // Supercopa (ADR-0118): o campeão da Série A contra o campeão da Copa, abrindo a Temporada.
  if (m.supercopa) {
    return classico
      ? `É o ${classico} na Supercopa! ${confronto}, abrindo a Temporada ${m.temporada} valendo taça!`
      : rng.pick([`É a Supercopa do Varzeão! ${confronto}, abrindo a Temporada ${m.temporada} valendo taça!`, `Campeão contra campeão! Supercopa no Varzeão: ${confronto}!`]);
  }
  // Copa (ADR-0088): Times das duas Séries; perdeu, tá fora.
  if (m.copa) {
    const etapa = NOME_DA_ETAPA_DA_COPA[m.copa];
    if (m.copa === 'FINAL') return classico ? `É o ${classico} na Final da Copa! ${confronto}, valendo a taça!` : `É a Final da Copa do Varzeão! ${confronto}, valendo a taça!`;
    if (m.copa === 'OITAVAS') return `É Copa! Oitavas de Clássico: ${classico ? `o ${classico}, ` : ''}${confronto}! Perdeu, tá fora!`;
    if (m.copa === 'CLASSICO') return `É Copa! Fase do Clássico: ${classico ? `o ${classico}, ` : ''}${confronto}! Perdeu, tá fora!`;
    if (m.copa === 'REPESCAGEM') return `É a Repescagem da Copa: ${confronto}! Quem vencer pega as Quartas, quem perder volta pra casa!`;
    return rng.pick([`É Copa! ${etapa}: ${confronto}! Quem perder volta pra casa!`, `${etapa} da Copa no Varzeão: ${confronto}!`]);
  }
  if (m.etapa === 'SEMIFINAL') {
    if (classico) return `É o ${classico}, valendo vaga na Final${daSerie(m)}! ${confronto}!`;
    return rng.pick([
      `Começou o Mata-mata! Semifinal${daSerie(m)} no Varzeão: ${confronto}! Quem vencer vai pra Final!`,
      `É Semifinal${daSerie(m)} no Varzeão da Mata! ${confronto}! Perdeu, tá fora!`,
    ]);
  }
  const titulo = `o título${daSerie(m)} da Temporada ${m.temporada}`;
  if (classico) return `É o ${classico} na Final${daSerie(m)}! ${confronto}, valendo ${titulo}!`;
  return rng.pick([`É a Final${daSerie(m)} do Varzeão da Mata! ${confronto}, valendo ${titulo}!`, `Chegou o grande dia! Final${daSerie(m)} no Varzeão: ${confronto}! Vale ${titulo}!`]);
}

// ---------------------------------------------------------------- Briga pelo Mata-mata (ADR-0053)

type Times = Record<'mandante' | 'visitante', TimeId>;
type Placar = Record<'mandante' | 'visitante', number>;
const LADOS = ['mandante', 'visitante'] as const;
const oTime = (t: TimeId) => `${cap(artigoDe(t))} ${FALA_DO_TIME[t].curto}`;
const serieDa = (b: BrigaPeloMataMata) => (b.serie ? ` da Série ${b.serie}` : '');

/**
 * Abertura: a tela mostra "Última Rodada" e "Vale a Semifinal", ou "Vale a permanência" quando
 * nenhum dos dois briga pelo Mata-mata e alguém ainda pode cair (ADR-0115).
 */
export function aberturaDaBriga(b: BrigaPeloMataMata, times?: Times): string {
  if (times && valeAPermanencia(b, times)) return 'Última Rodada da Fase de Liga, valendo a permanência na Série A!';
  return `Última Rodada da Fase de Liga, valendo vaga no Mata-mata${serieDa(b)}!`;
}

/** Quem está fora do Mata-mata e ainda briga para não cair, antes do Apito Inicial (ADR-0115). */
function contraAQueda(b: BrigaPeloMataMata, times: Times): ('mandante' | 'visitante')[] {
  const queda = situacoesNoRebaixamento(b, times, null);
  return queda ? LADOS.filter((l) => brigaDoTime(b, times, l, null) === 'REBAIXAMENTO' && queda.get(times[l]) === 'DEPENDE') : [];
}

/** Quem ainda briga nesta Partida (nem garantido nem eliminado antes do Apito Inicial). */
function emAberto(b: BrigaPeloMataMata, times: Times): ('mandante' | 'visitante')[] {
  const antes = situacoesNaBriga(b, times, null);
  return LADOS.filter((l) => antes.get(times[l]) === 'DEPENDE');
}

/** "A Arara já está garantida no Mata-mata! Será que a Onça também garante?" */
export function falaDosGarantidos(b: BrigaPeloMataMata, times: Times): string {
  const antes = situacoesNaBriga(b, times, null);
  const garantidos = [...antes].filter(([, s]) => s === 'GARANTIDO').map(([t]) => t);
  const partes: string[] = [];
  if (garantidos.length) {
    const lista = cap(listaDeTimes(garantidos));
    partes.push(`${lista} já ${garantidos.length > 1 ? 'estão' : 'está'} ${concordar(garantidos, 'garantid')} no Mata-mata!`);
    const abertos = emAberto(b, times).map((l) => times[l]);
    if (abertos.length === 1) partes.push(`Será que ${listaDeTimes(abertos)} também garante?`);
    if (abertos.length === 2) partes.push(`Será que ${abertos.map((t) => FALA_DO_TIME[t].curto).join(' e ')} também garantem?`);
  }
  const queda = situacoesNoRebaixamento(b, times, null);
  for (const l of LADOS) {
    const t = times[l];
    if (antes.get(t) !== 'ELIMINADO') continue;
    // Rebaixamento (ADR-0115): fora do Mata-mata não é jogar pela honra se ainda pode cair.
    if (queda?.get(t) === 'DEPENDE') partes.push(`${oTime(t)} está fora do Mata-mata e agora briga pra não cair!`);
    else if (queda?.get(t) === 'ELIMINADO') partes.push(`${oTime(t)} já está ${concordar([t], 'rebaixad')}, joga pela honra.`);
    else partes.push(`${oTime(t)} já está fora, joga pela honra.`);
  }
  return partes.join(' ');
}

/** Do que cada Time em aberto precisa (a plaquinha do começo de jogo mostra o mesmo). */
export function falasDaNecessidade(b: BrigaPeloMataMata, times: Times): string[] {
  return emAberto(b, times).map((l) => {
    const t = times[l];
    const n = textoDaNecessidade(necessidadeNaBriga(b, times, l));
    if (n === 'Empate basta') return `Um empate já basta pr${artigoDe(t)} ${FALA_DO_TIME[t].curto}!`;
    if (n === 'Vencendo, classifica') return `${oTime(t)} depende só de si: vencendo, está no Mata-mata!`;
    if (n === 'Vence e torce') return `${oTime(t)} precisa vencer e ainda torcer pelos outros resultados!`;
    return `${oTime(t)} ainda sonha com a vaga, mas depende dos outros resultados.`;
  }).concat(
    // Rebaixamento (ADR-0115): a plaquinha de quem já está fora do Mata-mata fala da queda.
    contraAQueda(b, times).map((l) => {
      const t = times[l];
      const n = textoDaNecessidadeNoRebaixamento(necessidadeNoRebaixamento(b, times, l)!);
      if (n === 'Empate salva') return `Um empate já salva ${artigoDe(t)} ${FALA_DO_TIME[t].curto}!`;
      if (n === 'Vencendo, se salva') return `${oTime(t)} depende só de si: vencendo, fica na Série A!`;
      if (n === 'Vence e torce') return `${oTime(t)} precisa vencer e ainda torcer pelos outros resultados pra não cair!`;
      return `${oTime(t)} corre risco de cair e depende dos outros resultados.`;
    }),
  );
}

/**
 * "Se terminar assim…" para quem ainda briga. Com `antes` (placar antes do gol), só fala de
 * quem teve a situação mudada.
 */
export function seAcabarAssim(b: BrigaPeloMataMata, times: Times, placar: Placar, antes?: Placar): string {
  const agora = situacoes(b, times, placar);
  const eraAssim = antes ? situacoes(b, times, antes) : null;
  const lados = [...new Set([...emAberto(b, times), ...contraAQueda(b, times)])];
  const partes = porOrdem(lados.filter((l) => !eraAssim || eraAssim.get(times[l]) !== agora.get(times[l])), times, agora).map((l) => {
    const t = times[l];
    const s = agora.get(t);
    const quem = `${artigoDe(t)} ${FALA_DO_TIME[t].curto}`;
    if (s === 'Q:GARANTIDO') return `${quem} se salva`;
    if (s === 'Q:ELIMINADO') return `${quem} cai pra Série B`;
    if (s === 'Q:DEPENDE') return `${quem} ainda corre risco de cair`;
    return s === 'GARANTIDO' ? `${quem} está no Mata-mata` : s === 'ELIMINADO' ? `${quem} está fora` : `${quem} ainda depende ${deQuemDepende(b)}`;
  });
  return partes.length ? `Se terminar assim, ${partes.join(', e ')}!` : '';
}

/**
 * A situação de cada Time na briga dele com este placar: a do Mata-mata ("GARANTIDO"…) ou, para
 * quem briga contra o Rebaixamento (ADR-0115), a da queda com "Q:" na frente.
 */
function situacoes(b: BrigaPeloMataMata, times: Times, placar: Placar): Map<TimeId, string> {
  const mm = situacoesNaBriga(b, times, placar);
  const queda = situacoesNoRebaixamento(b, times, placar);
  const s = new Map<TimeId, string>(mm);
  for (const l of LADOS) if (queda && brigaDoTime(b, times, l, placar) === 'REBAIXAMENTO') s.set(times[l], `Q:${queda.get(times[l])}`);
  return s;
}

/** Quem garantiu vem primeiro, depois quem depende, depois quem caiu. */
function porOrdem(lados: ('mandante' | 'visitante')[], times: Times, s: Map<TimeId, string>): ('mandante' | 'visitante')[] {
  const peso = { GARANTIDO: 0, DEPENDE: 1, ELIMINADO: 2, 'Q:GARANTIDO': 3, 'Q:DEPENDE': 4, 'Q:ELIMINADO': 5 } as Record<string, number>;
  return [...lados].sort((a, c) => peso[s.get(times[a])!]! - peso[s.get(times[c])!]!);
}

/** Fim: quem garantiu, quem caiu e quem vai ter que esperar. */
export function desfechoDaBriga(b: BrigaPeloMataMata, times: Times, placar: Placar): string[] {
  const fim = situacoes(b, times, placar);
  const lados = [...new Set([...emAberto(b, times), ...contraAQueda(b, times)])];
  return porOrdem(lados, times, fim).map((l) => {
    const t = times[l];
    const s = fim.get(t);
    // Rebaixamento (ADR-0115).
    if (s === 'Q:GARANTIDO') return `${oTime(t)} se salvou e fica na Série A!`;
    if (s === 'Q:ELIMINADO') return `${oTime(t)} está ${concordar([t], 'rebaixad')} pra Série B.`;
    if (s === 'Q:DEPENDE') return `${oTime(t)} ainda corre risco de cair, depende ${deQuemDepende(b)}.`;
    return s === 'GARANTIDO'
      ? `${oTime(t)} está no Mata-mata e vai brigar pelo título${serieDa(b)}!`
      : s === 'ELIMINADO'
        ? `${oTime(t)} está fora do Mata-mata.`
        : `${oTime(t)} agora depende ${deQuemDepende(b)}.`;
  });
}

/** O que a vitória vale, no fim da Partida do Mata-mata: vaga na Final ou o Título. */
export function desfechoDoMataMata(m: MataMataDaPartida, vencedor: TimeId): string {
  const quem = `${cap(artigoDe(vencedor))} ${FALA_DO_TIME[vencedor].curto}`;
  if (m.supercopa) return `${quem} é campeão da Supercopa do Varzeão da Mata!`;
  if (m.copa) return m.copa === 'FINAL' ? `${quem} é campeão da Copa do Varzeão da Mata!` : m.copa === 'SEMIFINAL' ? `${quem} está na Final da Copa!` : `${quem} avança na Copa!`;
  return m.etapa === 'SEMIFINAL' ? `${quem} está na Final${daSerie(m)}!` : `${quem} é campeão${daSerie(m)} da Temporada ${m.temporada} do Varzeão da Mata!`;
}

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

/** T3 (ADR-0094): o Narrador comenta o Perfil do Juiz no Apito Inicial (a placa está na tela). */
const FALA_DO_JUIZ: Record<PerfilDoJuiz, string> = {
  RIGOROSO: 'Juiz rigoroso hoje: falta é falta e o cartão tá no bolso!',
  NORMAL: 'Arbitragem tranquila hoje.',
  DEIXA_JOGAR: 'O juiz de hoje deixa o jogo correr!',
};
