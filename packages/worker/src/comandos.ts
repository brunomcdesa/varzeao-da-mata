/**
 * Leitor de Comandos (GLOSSARY: Comando). Função pura: texto do comentário → intenção.
 *
 *   "ENTRO <time|apelido> <posição|sinônimo>"  → Inscrição (em qualquer ordem, com palavras de ligação)
 *   "Onça, atacante" (sem ENTRO)                → também Inscrição, se o comentário for só isso:
 *                                                 um Time, uma posição e palavras de ligação
 *   "ENTRO ARARA" / "eu sou da arara"           → Inscrição sem posição: entra na mais vazia do Time
 *   "CRAQUE 3" (ou "VOTO 3")                    → voto no Candidato número 3 (da Série A)
 *   "CRAQUE B3" / "CRAQUE A3"                   → voto no Candidato 3 da Série B / A (ADR-0017)
 *   "3", "A3" ou "B3" sozinho                   → o mesmo, mas só vale no post do Resumo
 *   "Craque da Temporada 1", "vou de 3", "o 3"  → voto também (ADR-0076): um número só, com
 *                                                 palavras de voto antes; sem CRAQUE/VOTO é solto
 *   "TRANSFERIR PREGUIÇA [posição]"             → Transferência (ADR-0012); também "quero ir pra
 *                                                 Preguiça", "posso ir pro time da Preguiça",
 *                                                 "quero virar zagueiro" (só a posição)
 *   qualquer outra coisa                        → ignorado
 */
import type { Posicao, Serie, TimeId } from '@liga/shared';
import { APELIDOS_DE_TIME, PALAVRAS_DE_LIGACAO, SINONIMOS_DE_POSICAO, normalizar } from './vocabulario.js';

export type MotivoInvalido =
  | 'SEM_TIME'
  | 'SEM_POSICAO'
  | 'TIMES_DEMAIS'
  | 'POSICOES_DEMAIS'
  | 'MARCOU_TERCEIRO'
  | 'SEM_CANDIDATO';

export type Comando =
  /** Sem `posicao`: a pessoa só disse o Time; entra na posição mais vazia dele. */
  | { tipo: 'INSCRICAO'; time: TimeId; posicao?: Posicao }
  /**
   * `numero`: o número dentro da Série (1 a 5). `serie`: a letra que a pessoa escreveu (sem
   * letra, é a A). `solto`: só o número, sem CRAQUE; vale apenas no post da votação.
   */
  | { tipo: 'VOTO'; numero: number; serie?: Serie; solto?: true }
  /**
   * Transferência (ADR-0012). `times`: os Times citados (1, ou 2 quando cita o de origem
   * também: "sair da Onça e ir pra Preguiça"); vazio = só troca de posição.
   */
  | { tipo: 'TRANSFERENCIA'; times: TimeId[]; posicao?: Posicao }
  /** Temporada 2 (ADR-0023): "CONFIRMO" (ou "CONFIRMADO", "TO DENTRO", "VOU JOGAR") para o próximo jogo do Time. */
  | { tipo: 'PRESENCA' }
  | { tipo: 'INVALIDO'; prefixo: 'ENTRO' | 'CRAQUE' | 'TRANSFERIR'; motivo: MotivoInvalido }
  | { tipo: 'IGNORADO' };

/** Expressões (1 a 4 palavras) → valor, das mais longas para as mais curtas. */
function indice<T extends string>(mapa: Record<T, string[]>): [string[], T][] {
  const lista: [string[], T][] = [];
  for (const [valor, expressoes] of Object.entries(mapa) as [T, string[]][]) {
    for (const e of expressoes) lista.push([e.split(' '), valor]);
  }
  return lista.sort((a, b) => b[0].length - a[0].length);
}
const TIMES = indice(APELIDOS_DE_TIME);
const POSICOES = indice(SINONIMOS_DE_POSICAO);

/** O @ da própria Liga: quem marca a Liga ao pedir para entrar não está marcando um terceiro. */
export const CONTA_DA_LIGA = '@VARZEAO_DA_MATA';

function serieDoVoto(letra: string | undefined): { serie?: Serie } {
  return letra ? { serie: letra.toUpperCase() as Serie } : {};
}

export function interpretar(texto: string): Comando {
  const palavras = normalizar(texto)
    // "meu nome é Fulano": o nome não é Time nem posição, e não atrapalha o pedido.
    .replace(/\b(MEU NOME (E |EH )?|ME CHAMO |AQUI E (O |A )?)\S+/g, ' ')
    // "bote o meu, goleiro, onça": o "meu" de quem pede para pôr o próprio boneco.
    .replace(/\b(BOTA|BOTE|COLOCA|COLOQUE|POE) (O )?MEU\b/g, '$1')
    .split(' ')
    .filter((p) => p && p !== CONTA_DA_LIGA);
  const prefixo = palavras[0];

  // Voto por número (ADR-0011): não marca ninguém nos comentários.
  const voto = lerVoto(texto);
  if (voto) return voto;
  if (prefixo === 'CRAQUE' || prefixo === 'VOTO') {
    const m = /^\s*\S+\s*(?:(?:DA\s+)?(?:S[EÉ]RIE\s+)?([AB])\s*)?(?:N[ºO°]?\s*)?#?\s*([1-9])(?!\d)/iu.exec(texto);
    if (!m) return { tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' };
    return { tipo: 'VOTO', numero: Number(m[2]), ...serieDoVoto(m[1]) };
  }

  // Presença (T2): "CONFIRMO", "confirmado!", "tô dentro", "vou jogar" — sozinho no comentário.
  if (/^(CONFIRMO|CONFIRMADO|CONFIRMADISSIMO|PRESENCA CONFIRMADA|PRESENTE|TO DENTRO|TO DENTRO DO JOGO|VOU JOGAR)$/.test(palavras.join(' '))) return { tipo: 'PRESENCA' };

  if (prefixo !== 'ENTRO') return transferencia(palavras) ?? semPrefixo(palavras);

  const resto = palavras.slice(1);
  // Só a própria pessoa se inscreve: comentário marcando alguém não inscreve ninguém.
  if (resto.some((p) => p.startsWith('@'))) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'MARCOU_TERCEIRO' };

  const { times, posicoes } = analisar(resto);
  if (times.size > 1) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'TIMES_DEMAIS' };
  if (posicoes.size > 1) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'POSICOES_DEMAIS' };
  const [time] = times;
  const [posicao] = posicoes;
  if (!time) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'SEM_TIME' };
  return posicao ? { tipo: 'INSCRICAO', time, posicao } : { tipo: 'INSCRICAO', time };
}

/**
 * Times e posições que um comentário cita, sem decidir se é Comando. Serve para juntar dois
 * comentários da mesma pessoa ("Arara" e depois "Entro como meia").
 */
export function citacoes(texto: string): { times: TimeId[]; posicoes: Posicao[] } {
  const palavras = normalizar(texto).split(' ').filter((p) => p && !p.startsWith('@'));
  const { times, posicoes } = analisar(palavras);
  return { times: [...times], posicoes: [...posicoes] };
}

/** Times e posições citados, e as palavras que não são nenhum dos dois. */
function analisar(palavras: string[]): { times: Set<TimeId>; posicoes: Set<Posicao>; outras: string[] } {
  const times = new Set<TimeId>();
  const posicoes = new Set<Posicao>();
  const outras: string[] = [];
  let i = 0;
  while (i < palavras.length) {
    const casou = casar(palavras, i, TIMES) ?? casar(palavras, i, POSICOES);
    if (casou) {
      const [tamanho, valor] = casou;
      if ((APELIDOS_DE_TIME as Record<string, string[]>)[valor]) times.add(valor as TimeId);
      else posicoes.add(valor as Posicao);
      i += tamanho;
      continue;
    }
    outras.push(palavras[i]!);
    i++; // palavra de ligação ou desconhecida
  }
  return { times, posicoes, outras };
}

/** Palavras que aparecem em quem pede para entrar sem escrever ENTRO ("quero entrar na onça de atacante"). */
const PEDIDO = new Set([
  'ENTRAR', 'ENTRANDO', 'ENTRA', 'ME', 'INSCREVE', 'INSCREVER', 'INSCRICAO', 'BORA', 'VAMOS', 'VAMO', 'BOTA', 'COLOCA', 'POE',
  'AI', 'AQUI', 'SIM', 'OPA', 'OI', 'OLA', 'TO', 'TOU', 'ESTOU', 'DENTRO', 'QUERIA', 'GOSTARIA', 'DE', 'PO', 'MANO',
  'VAGA', 'VAGAS', 'UMA', 'TEM', 'COMENTE', 'COMENTO', 'ENTRO', 'ENTROU', 'QUER', 'ESQUERDA', 'ESQUERDO', 'DIREITA', 'DIREITO', 'FIZ', 'LA', 'JA', 'TAMBEM', 'TB', 'TBM', 'ENTAO', 'BLZ', 'BELEZA', 'VALEU', 'OBRIGADO', 'OBRIGADA', 'POSSO', 'PODE', 'SERIA',
  // Vistos nos pedidos de 10/11: "mim bota nesse time", "cuida mano bote o meu", "na primeira partida".
  'MIM', 'BOTE', 'COLOQUE', 'CUIDA', 'PRIMEIRA', 'PARTIDA',
]);

/** Palavras que, sozinhas com um Time, já são pedido para entrar. */
const PEDIDO_EXPLICITO = new Set(['VAGA', 'ENTRO', 'ENTROU', 'QUER', 'SOU', 'SER', 'QUERO', 'QUERIA', 'ENTRAR', 'ENTRA', 'ENTRANDO', 'COLOCA', 'BOTA', 'POE', 'INSCREVE', 'INSCREVER', 'JOGAR', 'ME', 'MIM', 'BOTE', 'COLOQUE']);

/**
 * Sem ENTRO: vale como Inscrição só quando o comentário é um pedido curto, com exatamente um
 * Time e uma posição e nada além de palavras de ligação ("Onça, atacante"; "quero entrar na
 * capivara de goleiro"). Frase comentando o jogo ("o atacante da onça jogou muito") não entra.
 */
function semPrefixo(palavras: string[]): Comando {
  // O limite é folgado: quem decide é a regra de baixo (só Time, posição e palavras de pedido).
  if (palavras.length > 16 || palavras.some((p) => p.startsWith('@'))) return { tipo: 'IGNORADO' };
  const { times, posicoes, outras } = analisar(palavras);
  if (times.size !== 1 || posicoes.size > 1) return { tipo: 'IGNORADO' };
  if (!outras.every((p) => PALAVRAS_DE_LIGACAO.has(p) || PEDIDO.has(p))) return { tipo: 'IGNORADO' };
  const [time] = times;
  const [posicao] = posicoes;
  if (posicao) return { tipo: 'INSCRICAO', time: time!, posicao };
  // Só o Time: precisa de um pedido explícito ("eu sou da arara", "quero entrar na onça"),
  // senão "Onça!" de torcedor viraria Inscrição.
  return outras.some((p) => PEDIDO_EXPLICITO.has(p)) ? { tipo: 'INSCRICAO', time: time! } : { tipo: 'IGNORADO' };
}

/** Verbos de quem quer mudar ("posso ir pro", "quero mudar pra", "quero virar zagueiro"). */
const MUDANCA = new Set(['IR', 'MUDAR', 'MUDO', 'MUDA', 'TROCAR', 'TROCO', 'TROCA', 'VIRAR', 'SAIR', 'SAIO']);
/** Palavras que podem acompanhar um pedido de Transferência curto. */
const DA_TRANSFERENCIA = new Set(['EQUILIBRAR', 'EQUILIBRIO', 'AJUDAR', 'OUTRO', 'POSSO', 'PODE', 'QUERIA', 'GOSTARIA', 'ME', 'DEIXA', 'TEM', 'COMO', 'AGORA', 'E', 'VIR', 'IR', 'PASSAR']);

/**
 * Transferência (ADR-0012): com a palavra TRANSFERIR (ou transferência, transfere...) vale
 * em qualquer frase; sem ela, só pedido curto com um verbo de mudança e nada além de
 * palavras de ligação ("posso ir pro time da preguiça pra equilibrar?").
 */
function transferencia(palavras: string[]): Comando | null {
  const explicita = palavras.some((p) => p.startsWith('TRANSFER') || p === 'TRANSFIRO');
  if (palavras.some((p) => p.startsWith('@'))) return null;
  // Pedido por outra pessoa ("meu amigo its___mu quer ir pra preguiça"): não é da própria
  // pessoa, então não mexe em ninguém nem responde; quem cuida é a Liga, no privado.
  if (porOutraPessoa(palavras)) return explicita ? { tipo: 'IGNORADO' } : null;
  const { times, posicoes, outras } = analisar(palavras.filter((p) => !(p.startsWith('TRANSFER') || p === 'TRANSFIRO')));
  if (!explicita) {
    if (palavras.length > 12 || !palavras.some((p) => MUDANCA.has(p))) return null;
    if (times.size + posicoes.size === 0) return null;
    if (!outras.every((p) => PALAVRAS_DE_LIGACAO.has(p) || PEDIDO.has(p) || MUDANCA.has(p) || DA_TRANSFERENCIA.has(p))) return null;
  }
  if (times.size > 2) return { tipo: 'INVALIDO', prefixo: 'TRANSFERIR', motivo: 'TIMES_DEMAIS' };
  if (posicoes.size > 1) return { tipo: 'INVALIDO', prefixo: 'TRANSFERIR', motivo: 'POSICOES_DEMAIS' };
  if (times.size + posicoes.size === 0) return { tipo: 'INVALIDO', prefixo: 'TRANSFERIR', motivo: 'SEM_TIME' };
  const [posicao] = posicoes;
  return posicao ? { tipo: 'TRANSFERENCIA', times: [...times], posicao } : { tipo: 'TRANSFERENCIA', times: [...times] };
}

/** Quem fala de terceiros: amigo, irmão, ele/ela... */
const TERCEIROS = new Set([
  'AMIGO', 'AMIGA', 'AMIGOS', 'ELE', 'ELA', 'DELE', 'DELA', 'IRMAO', 'IRMA', 'PRIMO', 'PRIMA', 'NAMORADO', 'NAMORADA',
  'MARIDO', 'ESPOSA', 'FILHO', 'FILHA', 'PAI', 'MAE', 'COLEGA', 'PARCEIRO', 'PARCEIRA', 'COMPANHEIRO', 'COMPANHEIRA',
]);

/** O comentário fala de outra pessoa: palavra de terceiro ou um nome de usuário sem @ (its___mu_27). */
function porOutraPessoa(palavras: string[]): boolean {
  return palavras.some((p) => TERCEIROS.has(p) || /[._]/.test(p) || (/\d/.test(p) && /[A-Z]/.test(p)));
}

/** A expressão mais longa que começa na palavra `i`, se houver. Ignora palavras de ligação soltas. */
function casar<T>(palavras: string[], i: number, lista: [string[], T][]): [number, T] | null {
  if (PALAVRAS_DE_LIGACAO.has(palavras[i]!) && !lista.some(([e]) => e.length > 1 && e[0] === palavras[i])) return null;
  for (const [expressao, valor] of lista) {
    if (expressao.every((p, k) => palavras[i + k] === p)) return [expressao.length, valor];
  }
  return null;
}

/**
 * Palavras que podem vir antes do número num voto ("Craque da Temporada 1", "meu voto é o 3",
 * "vou de 2", "número 4"). Nenhum Time nem posição: esses são Inscrição (ADR-0076).
 */
const ANTES_DO_VOTO = new Set([
  'O', 'A', 'B', 'NO', 'NA', 'NUM', 'DE', 'DO', 'DA', 'EM', 'E', 'EH', 'PRO', 'PRA', 'PARA', 'PELO', 'PELA', 'COM', 'SO', 'EU', 'TO',
  'VOTO', 'VOTOS', 'VOTE', 'VOTA', 'VOTEI', 'VOTANDO', 'VOTAR', 'VOTAMOS', 'MEU', 'MINHA', 'VOU', 'VAI', 'VAMOS', 'FICO', 'FECHO',
  'CRAQUE', 'CRAQUES', 'TEMPORADA', 'RODADA', 'FINAL', 'SERIE', 'NUMERO', 'N', 'NR', 'NRO', 'CANDIDATO', 'OPCAO', 'ESCOLHO', 'ESCOLHA',
]);
/** Quem escreve uma destas antes do número votou de propósito: vale em qualquer post. */
const VOTO_EXPLICITO = new Set(['CRAQUE', 'CRAQUES', 'VOTO', 'VOTOS', 'VOTE', 'VOTA', 'VOTEI', 'VOTANDO', 'VOTAR', 'VOTAMOS']);

/**
 * Voto em linguagem do dia a dia (ADR-0076): um único número de 1 a 9 (com a letra da Série, se
 * houver), antes dele só palavras de voto e depois qualquer comentário sem outro número
 * ("3 sem dúvidas", "o 5 merece", "4 @fulano"). Os @ marcados não contam. Com CRAQUE ou VOTO
 * antes, vale em qualquer post; sem, é voto solto (só no post da votação).
 */
export function lerVoto(texto: string): Comando | null {
  const palavras = normalizar(texto.replace(/@[\p{L}\p{N}._]+/gu, ' ')).split(' ').filter(Boolean);
  const comNumero = palavras.map((p, i) => [p, i] as const).filter(([p]) => /\d/.test(p));
  if (comNumero.length !== 1) return null;
  const [token, i] = comNumero[0]!;
  const m = /^([AB])?#?([1-9])$/.exec(token);
  if (!m) return null;
  const antes = palavras.slice(0, i);
  if (antes.length > 6 || !antes.every((p) => ANTES_DO_VOTO.has(p))) return null;
  // "B 3" / "série B 3": a letra logo antes do número é a Série.
  const letra = m[1] ?? (['A', 'B'].includes(antes.at(-1) ?? '') && (antes.length === 1 || antes.at(-2) === 'SERIE') ? antes.at(-1) : undefined);
  const explicito = antes.some((p) => VOTO_EXPLICITO.has(p));
  return { tipo: 'VOTO', numero: Number(m[2]), ...serieDoVoto(letra), ...(explicito ? {} : { solto: true as const }) };
}
