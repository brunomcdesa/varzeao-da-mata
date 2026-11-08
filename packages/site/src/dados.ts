/**
 * Leitura dos dados públicos. Em produção vêm do bucket público do R2 (liga-dados); o
 * lance a lance de uma Partida que acabou de começar vem do worker na borda (liga-api),
 * porque os arquivos estáticos só são regerados de hora em hora.
 */
import { definirAparencias } from '@liga/renderer';
import { duracaoAoVivoMs, type JogadorPublico, type LigaPublica, type LinhaTabelaPublica, type PartidaNoCalendario, type PartidaPublica, type SituacaoPartida } from '@liga/shared';

const meta = (nome: string) => document.querySelector<HTMLMetaElement>(`meta[name="${nome}"]`)?.content.trim() ?? '';
const comBarra = (s: string) => (s && !s.endsWith('/') ? `${s}/` : s);

export const BASE_DADOS = comBarra(meta('liga-dados') || './dados/');
export const BASE_API = comBarra(meta('liga-api'));
export const INSTAGRAM = meta('liga-instagram').replace(/^@/, '');
export const TURNSTILE = meta('liga-turnstile');


const cache = new Map<string, { quando: number; valor: Promise<unknown> }>();
const VALIDADE_MS = 60_000;

async function buscar<T>(url: string, fresco = false): Promise<T> {
  const c = cache.get(url);
  if (c && !fresco && Date.now() - c.quando < VALIDADE_MS) return c.valor as Promise<T>;
  const valor = fetch(url, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new ErroDeDados(r.status, url);
    return r.json() as Promise<T>;
  });
  cache.set(url, { quando: Date.now(), valor });
  valor.catch(() => cache.delete(url));
  return valor;
}

export class ErroDeDados extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`Não deu para carregar ${url} (${status})`);
  }
}

export const liga = async (fresco = false): Promise<LigaPublica> => completarLiga(await buscar<LigaPublica>(`${BASE_DADOS}liga.json`, fresco));

/**
 * O liga.json é gerado pelo worker; entre o fim do Ao Vivo e a próxima publicação ele ainda
 * mostra o jogo sem placar. Pelo relógio de quem está vendo, se o Ao Vivo já acabou, o
 * site pega o resultado (o mesmo da transmissão) e atualiza placar, Card da Rodada e
 * tabela na hora, sem esperar a publicação.
 */
async function completarLiga(l: LigaPublica): Promise<LigaPublica> {
  const atrasadas = l.calendario.filter((p) => p.situacao !== 'ENCERRADA' && situacaoAgora(p) === 'ENCERRADA' && !p.placar);
  if (!atrasadas.length) return l;
  const resultados = await Promise.all(atrasadas.map((p) => partida(p.id).catch(() => null)));
  const calendario = [...l.calendario];
  const tabela = new Map(l.tabela.map((t) => [t.time, { ...t }]));
  let mudouTabela = false;
  atrasadas.forEach((p, k) => {
    const r = resultados[k]?.resultado as ResultadoMinimo | null | undefined;
    if (!r?.gols) return;
    const pen = r.penaltis?.placar;
    const placar = { mandante: r.gols.mandante, visitante: r.gols.visitante, ...(pen ? { penaltis: { mandante: pen.mandante, visitante: pen.visitante } } : {}) };
    const novo: PartidaNoCalendario = { ...p, situacao: 'ENCERRADA', placar };
    if (p.fase === 'MATA_MATA' && r.vencedor) novo.classificado = r.vencedor === 'mandante' ? p.mandante : p.visitante;
    calendario[calendario.indexOf(p)] = novo;
    if (p.fase !== 'LIGA') return;
    for (const [time, pro, contra] of [
      [p.mandante, placar.mandante, placar.visitante],
      [p.visitante, placar.visitante, placar.mandante],
    ] as const) {
      const t = tabela.get(time);
      if (!t) continue;
      t.jogos++;
      t.golsPro += pro;
      t.golsContra += contra;
      t.saldo = t.golsPro - t.golsContra;
      if (pro > contra) (t.vitorias++, (t.pontos += 3));
      else if (pro === contra) (t.empates++, (t.pontos += 1));
      else t.derrotas++;
      mudouTabela = true;
    }
  });
  // Mesmo critério do worker: pontos, vitórias, saldo, gols pró, sigla.
  const ordem = (a: LinhaTabelaPublica, b: LinhaTabelaPublica) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro || a.time.localeCompare(b.time);
  return { ...l, calendario, tabela: mudouTabela ? [...tabela.values()].sort(ordem) : l.tabela };
}

interface ResultadoMinimo {
  gols: { mandante: number; visitante: number };
  penaltis?: { placar: { mandante: number; visitante: number } };
  vencedor: 'mandante' | 'visitante' | null;
}
export const jogadores = async (fresco = false): Promise<JogadorPublico[]> => {
  const lista = await buscar<JogadorPublico[]>(`${BASE_DADOS}jogadores.json`, fresco);
  // O boneco de cada um como o dono escolheu (ADR-0013); sem escolha, o sorteado pelo @.
  definirAparencias(Object.fromEntries(lista.filter((j) => j.visual).map((j) => [j.username, j.visual!])));
  return lista;
};

/**
 * Partida com o que já pode ser mostrado agora. Se o Apito já soou e o arquivo estático
 * ainda não tem o lance a lance, pede ao worker na borda.
 */
export async function partida(id: number, fresco = false): Promise<PartidaPublica | null> {
  let p: PartidaPublica | null = null;
  try {
    p = await buscar<PartidaPublica>(`${BASE_DADOS}partidas/${id}.json`, fresco);
  } catch (e) {
    if (!(e instanceof ErroDeDados && e.status === 404)) throw e;
  }
  if ((!p || !p.resultado) && BASE_API && (!p || Date.parse(p.apito) <= Date.now())) {
    try {
      p = await buscar<PartidaPublica>(`${BASE_API}partidas/${id}`, true);
    } catch {
      /* borda fora do ar: fica com o estático */
    }
  }
  return p;
}

/** Situação calculada pelo relógio de quem está vendo (o JSON pode ter até 1 h). */
export function situacaoAgora(p: { apito: string; fase: 'LIGA' | 'MATA_MATA' }, agora = Date.now()): SituacaoPartida {
  const t = Date.parse(p.apito);
  if (agora < t) return 'AGENDADA';
  return agora < t + duracaoAoVivoMs(p.fase) ? 'AO_VIVO' : 'ENCERRADA';
}

/** Rodada "da vez": a que tem Partida ao vivo ou a próxima a jogar; senão a última. */
export function rodadaAtual(l: LigaPublica, agora = Date.now()): number | null {
  const viva = l.calendario.find((p) => situacaoAgora(p, agora) === 'AO_VIVO');
  if (viva) return viva.rodada;
  const proxima = l.calendario.find((p) => situacaoAgora(p, agora) === 'AGENDADA');
  if (proxima) {
    // Se a Rodada anterior terminou hoje, ela ainda é a "da vez" até a meia-noite.
    const anterior = l.calendario.filter((p) => p.rodada === proxima.rodada - 1).at(-1);
    if (anterior && mesmoDia(anterior.apito, new Date(agora).toISOString())) return anterior.rodada;
    return proxima.rodada;
  }
  return l.calendario.at(-1)?.rodada ?? null;
}

export function partidasDaRodada(l: LigaPublica, rodada: number): PartidaNoCalendario[] {
  return l.calendario.filter((p) => p.rodada === rodada);
}

const FUSO = 'America/Sao_Paulo';
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' });
const fmtChave = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

export const hora = (iso: string) => fmtHora.format(new Date(iso)).replace(':00', 'h').replace(':', 'h');
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
export const diaCurto = (iso: string) => fmtDiaCurto.format(new Date(iso));
export const dia = (iso: string) => fmtDia.format(new Date(iso)).replace('.', '');
export const diaLongo = (iso: string) => fmtDiaLongo.format(new Date(iso));
export const mesmoDia = (a: string, b: string) => fmtChave.format(new Date(a)) === fmtChave.format(new Date(b));

/** "em 1h 12min", "em 8min", "agora". */
export function contagem(iso: string, agora = Date.now()): string {
  const ms = Date.parse(iso) - agora;
  if (ms <= 0) return 'agora';
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h}h${min % 60 ? ` ${min % 60}min` : ''}`;
  const d = Math.round(h / 24);
  return d === 1 ? 'amanhã' : `em ${d} dias`;
}
