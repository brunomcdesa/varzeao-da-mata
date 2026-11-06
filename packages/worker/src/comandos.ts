/**
 * Leitor de Comandos (GLOSSARY: Comando). Função pura: texto do comentário → intenção.
 *
 *   "ENTRO <time|apelido> <posição|sinônimo>"  → Inscrição (em qualquer ordem, com palavras de ligação)
 *   "CRAQUE @fulano"                            → voto para Craque da Rodada
 *   qualquer outra coisa                        → ignorado
 */
import type { Posicao, TimeId } from '@liga/shared';
import { APELIDOS_DE_TIME, PALAVRAS_DE_LIGACAO, SINONIMOS_DE_POSICAO, normalizar } from './vocabulario.js';

export type MotivoInvalido =
  | 'SEM_TIME'
  | 'SEM_POSICAO'
  | 'TIMES_DEMAIS'
  | 'POSICOES_DEMAIS'
  | 'MARCOU_TERCEIRO'
  | 'SEM_CANDIDATO';

export type Comando =
  | { tipo: 'INSCRICAO'; time: TimeId; posicao: Posicao }
  | { tipo: 'VOTO'; username: string }
  | { tipo: 'INVALIDO'; prefixo: 'ENTRO' | 'CRAQUE'; motivo: MotivoInvalido }
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

export function interpretar(texto: string): Comando {
  const palavras = normalizar(texto).split(' ').filter(Boolean);
  const prefixo = palavras[0];

  if (prefixo === 'CRAQUE') {
    // O @ vem do texto original (preserva o username como a pessoa escreveu).
    const m = /@([A-Za-z0-9._]{1,30})/.exec(texto);
    if (!m) return { tipo: 'INVALIDO', prefixo: 'CRAQUE', motivo: 'SEM_CANDIDATO' };
    return { tipo: 'VOTO', username: m[1]!.toLowerCase().replace(/\.+$/, '') };
  }

  if (prefixo !== 'ENTRO') return { tipo: 'IGNORADO' };

  const resto = palavras.slice(1);
  // Só a própria pessoa se inscreve: comentário marcando alguém não inscreve ninguém.
  if (resto.some((p) => p.startsWith('@'))) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'MARCOU_TERCEIRO' };

  const times = new Set<TimeId>();
  const posicoes = new Set<Posicao>();
  let i = 0;
  while (i < resto.length) {
    const casou = casar(resto, i, TIMES) ?? casar(resto, i, POSICOES);
    if (casou) {
      const [tamanho, valor] = casou;
      if ((APELIDOS_DE_TIME as Record<string, string[]>)[valor]) times.add(valor as TimeId);
      else posicoes.add(valor as Posicao);
      i += tamanho;
      continue;
    }
    i++; // palavra de ligação ou desconhecida
  }
  if (times.size > 1) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'TIMES_DEMAIS' };
  if (posicoes.size > 1) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'POSICOES_DEMAIS' };
  const [time] = times;
  const [posicao] = posicoes;
  if (!time) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'SEM_TIME' };
  if (!posicao) return { tipo: 'INVALIDO', prefixo: 'ENTRO', motivo: 'SEM_POSICAO' };
  return { tipo: 'INSCRICAO', time, posicao };
}

/** A expressão mais longa que começa na palavra `i`, se houver. Ignora palavras de ligação soltas. */
function casar<T>(palavras: string[], i: number, lista: [string[], T][]): [number, T] | null {
  if (PALAVRAS_DE_LIGACAO.has(palavras[i]!) && !lista.some(([e]) => e.length > 1 && e[0] === palavras[i])) return null;
  for (const [expressao, valor] of lista) {
    if (expressao.every((p, k) => palavras[i + k] === p)) return [expressao.length, valor];
  }
  return null;
}
