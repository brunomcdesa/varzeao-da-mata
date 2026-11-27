/**
 * Audiência do site por dia (ADR-0119): lê o Cloudflare Web Analytics pela API GraphQL e
 * guarda um retrato por dia no banco. O histórico do Cloudflare é limitado (~6 meses), então
 * guardar dia a dia é o que mantém os números para sempre. Só agregados, nada pessoal.
 */
import type { Banco } from './banco.js';

export type Recorte = 'total' | 'pagina' | 'pais' | 'origem';

/** Cada recorte é uma consulta própria: se um campo falhar, os outros seguem. */
const DIMENSAO: Record<Recorte, string | null> = { total: null, pagina: 'requestPath', pais: 'countryName', origem: 'refererHost' };
/** Quantas linhas por dia e recorte (as maiores). */
const LIMITE_POR_DIA = 50;

export interface OpcoesDaAudienciaSite {
  token: string;
  contaId: string;
  /** Filtra um site do Web Analytics; sem isso soma todos os da conta. */
  siteTag?: string;
  /** Quantos dias para trás refazer (o dia de hoje fica de fora). Padrão 3. */
  dias?: number;
  agora?: Date;
  fetch?: typeof fetch;
}

export interface LinhaDeAudiencia {
  dia: string;
  recorte: Recorte;
  valor: string;
  paginas: number;
  visitas: number;
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

export function consulta(recorte: Recorte, siteTag?: string): string {
  const dim = DIMENSAO[recorte];
  const site = siteTag ? `, siteTag: "${siteTag.replace(/[^\w-]/g, '')}"` : '';
  return `query($conta: String!, $de: Date!, $ate: Date!) { viewer { accounts(filter: { accountTag: $conta }) { rumPageloadEventsAdaptiveGroups(filter: { date_geq: $de, date_leq: $ate${site} }, limit: ${LIMITE_POR_DIA * 7}) { count sum { visits } dimensions { date${dim ? ` ${dim}` : ''} } } } } }`;
}

interface Grupo {
  count?: number;
  sum?: { visits?: number };
  dimensions?: Record<string, string | null>;
}

/** Lê um recorte do Cloudflare. Falha com mensagem clara se a API devolver erro. */
export async function lerRecorte(o: OpcoesDaAudienciaSite, recorte: Recorte, de: string, ate: string): Promise<LinhaDeAudiencia[]> {
  const r = await (o.fetch ?? fetch)('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${o.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: consulta(recorte, o.siteTag), variables: { conta: o.contaId, de, ate } }),
  });
  if (!r.ok) throw new Error(`Cloudflare respondeu ${r.status}`);
  const j = (await r.json()) as { data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: Grupo[] }[] } }; errors?: { message: string }[] | null };
  if (j.errors?.length) throw new Error(`Cloudflare: ${j.errors.map((e) => e.message).join('; ')}`);
  const grupos = j.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
  if (!grupos) throw new Error('Cloudflare: resposta sem dados (conta errada ou sem permissão?)');
  const campo = DIMENSAO[recorte];
  const linhas: LinhaDeAudiencia[] = [];
  for (const g of grupos) {
    const d = g.dimensions?.date;
    if (!d) continue;
    linhas.push({ dia: d, recorte, valor: campo ? (g.dimensions?.[campo] ?? '(sem valor)') : '', paginas: g.count ?? 0, visitas: g.sum?.visits ?? 0 });
  }
  // Dentro de cada dia, só as maiores.
  const porDia = new Map<string, LinhaDeAudiencia[]>();
  for (const l of linhas) porDia.set(l.dia, [...(porDia.get(l.dia) ?? []), l]);
  return [...porDia.values()].flatMap((ls) => ls.sort((a, b) => b.paginas - a.paginas).slice(0, LIMITE_POR_DIA));
}

export interface RelatorioDaAudienciaSite {
  linhas: number;
  de: string;
  ate: string;
  falhas: { recorte: Recorte; erro: string }[];
}

/** Refaz os últimos dias (sem hoje). Um dia só vira `fechado` depois de passar 1 dia inteiro. */
export async function coletarAudienciaDoSite(banco: Banco, o: OpcoesDaAudienciaSite): Promise<RelatorioDaAudienciaSite> {
  const agora = o.agora ?? new Date();
  const dias = o.dias ?? 3;
  const ontem = new Date(agora.getTime() - 86_400_000);
  const de = dia(new Date(agora.getTime() - dias * 86_400_000));
  const ate = dia(ontem);
  const antesDeOntem = dia(new Date(agora.getTime() - 2 * 86_400_000));
  const relatorio: RelatorioDaAudienciaSite = { linhas: 0, de, ate, falhas: [] };
  for (const recorte of Object.keys(DIMENSAO) as Recorte[]) {
    try {
      const linhas = await lerRecorte(o, recorte, de, ate);
      for (const l of linhas) {
        await banco.query(
          `INSERT INTO audiencia_site_dia (dia, recorte, valor, paginas, visitas, fechado) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (dia, recorte, valor) DO UPDATE SET paginas = $4, visitas = $5, fechado = $6, coletado_em = now()
           WHERE audiencia_site_dia.fechado = false`,
          [l.dia, l.recorte, l.valor, l.paginas, l.visitas, l.dia <= antesDeOntem],
        );
      }
      relatorio.linhas += linhas.length;
    } catch (e) {
      relatorio.falhas.push({ recorte, erro: (e as Error).message });
    }
  }
  return relatorio;
}
