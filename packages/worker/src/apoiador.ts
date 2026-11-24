/**
 * Apoiador (ADR-0108, GLOSSARY: Apoiador, Selo de Apoiador, Item de Apoiador).
 *
 * Quem apoia pelo Apoia-se informa o @, e o dono roda o workflow apoiador: abre um período de
 * apoio (R$ 5 ou R$ 15) ou fecha o aberto. Trocar de nível fecha um período e abre outro. Os
 * períodos dão:
 * - o Selo de Apoiador na Carreira ("Apoiador" com apoio aberto; depois, as Temporadas em que apoiou);
 * - o nome nos créditos do Resumo da Temporada;
 * - o Item de Apoiador, para quem teve algum período de R$ 15 (a partir da segunda fase da Loja).
 * Nada disso mexe em OVR, Habilidade, Escalação, Transferência nem Moedas.
 */
import { ITEM_DE_APOIADOR } from '@liga/shared';
import type { Banco } from './banco.js';

export type NivelDeApoio = 5 | 15;
export const NIVEIS_DE_APOIO: readonly NivelDeApoio[] = [5, 15];
/** Nível que dá o Item de Apoiador. */
export const NIVEL_DO_ITEM: NivelDeApoio = 15;

/** O @ como fica guardado: sem @, sem espaços, minúsculo. */
export const normalizarArroba = (u: string) => u.trim().replace(/^@+/, '').toLowerCase();

/** A Temporada mais recente já criada (a da Pré-temporada, se ela já existe). */
async function temporadaMaisRecente(b: Banco): Promise<number> {
  const n = (await b.query<{ numero: number | null }>(`SELECT max(numero) AS numero FROM temporada`)).rows[0]?.numero;
  if (n == null) throw new Error('Nenhuma Temporada criada.');
  return n;
}

interface PeriodoAberto {
  id: string;
  nivel: NivelDeApoio;
}
async function periodoAberto(b: Banco, username: string): Promise<PeriodoAberto | null> {
  const r = (await b.query<{ id: string; nivel: number }>(`SELECT id::text AS id, nivel FROM apoio WHERE username = $1 AND fim IS NULL`, [username])).rows[0];
  return r ? { id: r.id, nivel: r.nivel as NivelDeApoio } : null;
}

export type AcaoDoApoio = 'ABERTO' | 'TROCOU_DE_NIVEL' | 'JA_ESTAVA' | 'ENCERRADO' | 'SEM_APOIO';
export interface ResultadoDoApoio {
  username: string;
  acao: AcaoDoApoio;
  antes: NivelDeApoio | null;
  depois: NivelDeApoio | null;
  /** O @ joga na Liga (só quem joga ganha Selo e Item; os outros ficam só nos créditos). */
  jogador: boolean;
  gravado: boolean;
}

/**
 * Abre (nível 5 ou 15) ou fecha (nível null) o apoio de um @. Sem `gravar`, só diz o que faria.
 * Rodar de novo com o mesmo nível não muda nada.
 */
export async function registrarApoio(
  b: Banco,
  opcoes: { username: string; nivel: NivelDeApoio | null; agora: Date; gravar: boolean },
): Promise<ResultadoDoApoio> {
  const username = normalizarArroba(opcoes.username);
  if (!/^[a-z0-9._]{1,30}$/.test(username)) throw new Error(`@ inválido: "${opcoes.username}".`);
  if (opcoes.nivel !== null && !NIVEIS_DE_APOIO.includes(opcoes.nivel)) throw new Error('O nível do apoio é 5 ou 15 (ou vazio para encerrar).');
  const jogador = (await b.query(`SELECT 1 FROM jogador WHERE lower(username) = $1 AND NOT banido`, [username])).rows.length > 0;
  const aberto = await periodoAberto(b, username);
  const antes = aberto?.nivel ?? null;
  const depois = opcoes.nivel;
  const acao: AcaoDoApoio =
    depois === null ? (aberto ? 'ENCERRADO' : 'SEM_APOIO') : !aberto ? 'ABERTO' : aberto.nivel === depois ? 'JA_ESTAVA' : 'TROCOU_DE_NIVEL';
  const muda = acao === 'ABERTO' || acao === 'TROCOU_DE_NIVEL' || acao === 'ENCERRADO';
  if (!opcoes.gravar || !muda) return { username, acao, antes, depois: acao === 'SEM_APOIO' ? null : depois ?? null, jogador, gravado: false };

  const temporada = await temporadaMaisRecente(b);
  const quando = opcoes.agora.toISOString();
  await b.transacao(async (t) => {
    if (aberto) await t.query(`UPDATE apoio SET fim = $2, temporada_fim = $3 WHERE id = $1`, [aberto.id, quando, temporada]);
    if (depois !== null) {
      await t.query(`INSERT INTO apoio (username, nivel, inicio, temporada_inicio) VALUES ($1, $2, $3, $4)`, [username, depois, quando, temporada]);
    }
  });
  return { username, acao, antes, depois, jogador, gravado: true };
}

export interface ApoioPublico {
  /** Apoio aberto agora (o Selo diz "Apoiador"). */
  ativo: boolean;
  /** Temporadas em que apoiou, em ordem (o Selo de quem parou diz "Apoiou na T3"). */
  temporadas: number[];
}

interface LinhaDeApoio {
  username: string;
  nivel: number;
  temporada_inicio: number;
  temporada_fim: number | null;
}
async function periodos(b: Banco): Promise<LinhaDeApoio[]> {
  return (await b.query<LinhaDeApoio>(`SELECT username, nivel, temporada_inicio, temporada_fim FROM apoio ORDER BY inicio, id`)).rows;
}

/** Monta o Selo de cada @ a partir dos períodos (puro, para testar sem banco). */
export function selosDeApoiador(linhas: readonly LinhaDeApoio[], temporadaAtual: number): Map<string, ApoioPublico> {
  const selos = new Map<string, { ativo: boolean; temporadas: Set<number> }>();
  for (const l of linhas) {
    const s = selos.get(l.username) ?? { ativo: false, temporadas: new Set<number>() };
    const fim = l.temporada_fim ?? temporadaAtual;
    for (let n = l.temporada_inicio; n <= fim; n++) s.temporadas.add(n);
    if (l.temporada_fim === null) s.ativo = true;
    selos.set(l.username, s);
  }
  return new Map([...selos].map(([u, s]) => [u, { ativo: s.ativo, temporadas: [...s.temporadas].sort((a, c) => a - c) }]));
}

/** O Selo de Apoiador de cada @ (minúsculo) que já apoiou. */
export async function apoiadores(b: Banco): Promise<Map<string, ApoioPublico>> {
  const linhas = await periodos(b);
  if (!linhas.length) return new Map();
  return selosDeApoiador(linhas, await temporadaMaisRecente(b));
}

/** Os @ que apoiaram em algum momento da Temporada, em ordem alfabética (créditos do Resumo). */
export async function creditosDaTemporada(b: Banco, numero: number): Promise<string[]> {
  const linhas = await periodos(b);
  if (!linhas.length) return [];
  const selos = selosDeApoiador(linhas, await temporadaMaisRecente(b));
  return [...selos].filter(([, s]) => s.temporadas.includes(numero)).map(([u]) => u).sort();
}

/** O Jogador teve algum período de R$ 15 (é dono do Item de Apoiador, quando a fase abrir). */
export async function temItemDeApoiador(b: Banco, jogadorId: string): Promise<boolean> {
  return (
    (
      await b.query(
        `SELECT 1 FROM apoio a JOIN jogador j ON lower(j.username) = a.username WHERE j.id = $1 AND a.nivel >= $2 LIMIT 1`,
        [jogadorId, NIVEL_DO_ITEM],
      )
    ).rows.length > 0
  );
}

/** O código do Item de Apoiador, para quem é dono. */
export const CODIGO_DO_ITEM_DE_APOIADOR = ITEM_DE_APOIADOR.codigo;
