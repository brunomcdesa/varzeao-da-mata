/**
 * Ensaio geral: uma Temporada inteira com os jobs de verdade e um relógio acelerado.
 *
 *   pnpm simular [--inicio 2026-10-26] [--seguidores 150] [--seed 7] [--ate 2026-10-30T20:00:00Z]
 *
 * Seguidores fictícios comentam ENTRO (com apelidos, erros e comentários que não valem),
 * votam no Craque depois de cada Resumo e chegam aos poucos ao longo dos dias. O relógio
 * anda na agenda real: coletar de hora em hora, partida 35 min antes de cada jogo, resumo
 * às 18h10 e a "borda" publicando os Reels na hora marcada. Vídeos não são gravados
 * (um arquivo de mentira ocupa o lugar), então roda em poucos minutos e sem chaves.
 *
 * Saída: banco em .cache/simulacao, dados do site em packages/site/public/dados e um
 * relatório em .cache/simulacao/relatorio.md. Depois: `pnpm site`.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { FALA_DO_TIME, type TimeId } from '@liga/shared';
import {
  AgendaNaMemoria,
  PastaLocal,
  campeao,
  criarTemporada,
  jobColetar,
  jobPartida,
  jobResumo,
  tabela,
  type Comentario,
  type ContextoDoJob,
  type Instagram,
  type ItemDaAgenda,
} from '../src/index.js';
import { bancoLocal } from './banco-local.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { values: args } = parseArgs({
  options: { inicio: { type: 'string' }, seguidores: { type: 'string' }, seed: { type: 'string' }, ate: { type: 'string' } },
});

const H = 3600_000;
const FUSO = -3;
const somarDias = (dia: string, n: number) => {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
/** Hora de Brasília (pode ter fração) → instante UTC. */
const em = (dia: string, hora: number) => {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d) + (hora - FUSO) * H);
};

// Por padrão a Temporada acaba ontem, para o site mostrar tudo encerrado no relógio de hoje.
const hoje = new Date(Date.now() + FUSO * H).toISOString().slice(0, 10);
const inicio = args.inicio ?? somarDias(hoje, -10);
const totalSeguidores = Number(args.seguidores ?? 150);
const ate = args.ate ? new Date(args.ate) : null;

// ------------------------------------------------------------------ sorteio determinístico

let estado = Number(args.seed ?? 7) >>> 0 || 7;
const rnd = () => {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const chance = (p: number) => rnd() < p;

// ------------------------------------------------------------------ seguidores

const NOMES = ['rafa', 'bia', 'duda', 'leo', 'malu', 'gui', 'nanda', 'pedrinho', 'lari', 'thiago', 'carol', 'vini', 'ju', 'digo', 'manu', 'caio', 'lu', 'beto', 'dani', 'gabi', 'joao', 'ana', 'enzo', 'lara', 'davi', 'mel', 'theo', 'iris', 'noah', 'cris', 'fefe', 'marcao', 'tati', 'zeca', 'nina', 'kaka', 'lele', 'bruninho', 'paty', 'rods'];
const SUFIXOS = ['fc', 'oficial', 'jr', 'mata', 'gol', '10', '_', 'futebol', 'varzea', ''];
const APELIDO: Record<TimeId, string[]> = {
  CAP: ['CAPIVARA', 'capi', 'Capivaras'],
  ONC: ['ONÇA', 'onca', 'Onça'],
  TAT: ['TATU', 'tatu', 'Tatus'],
  TAM: ['TAMANDUÁ', 'tamandua', 'Tamanduá'],
  PRE: ['PREGUIÇA', 'preguica', 'Preguiça'],
  SAG: ['SAGUI', 'mico', 'Sagui'],
  TUC: ['TUCANO', 'tucano', 'Tucanos'],
  ARA: ['ARARA', 'arara azul', 'Arara Azul'],
};
const POSICAO = {
  GOL: ['GOLEIRO', 'goleira', 'gol'],
  ZAG: ['ZAGUEIRO', 'zaga', 'zagueira', 'lateral'],
  MEI: ['MEIA', 'meio campo', 'volante', 'camisa 10'],
  ATA: ['ATACANTE', 'ata', 'artilheiro', 'centroavante'],
} as const;
// Times "da moda" recebem mais gente; as Posições também não saem iguais.
const PESO_TIME: Record<TimeId, number> = { ONC: 1.6, CAP: 1.4, ARA: 1.2, TUC: 1, SAG: 1, TAT: 0.9, TAM: 0.8, PRE: 0.7 };
const PESO_POS = { ATA: 1.8, MEI: 1.3, ZAG: 0.9, GOL: 0.6 } as const;
function sortearPeso<K extends string>(pesos: Record<K, number>): K {
  const total = Object.values<number>(pesos).reduce((s, p) => s + p, 0);
  let x = rnd() * total;
  for (const [k, p] of Object.entries<number>(pesos)) if ((x -= p) <= 0) return k as K;
  return Object.keys(pesos)[0] as K;
}

interface Seguidor {
  igUserId: string;
  username: string;
  /** Dia (índice desde 2 dias antes do início) em que comenta ENTRO. */
  chegada: number;
  hora: number;
  vota: number; // probabilidade de votar depois de cada Resumo
}
const usados = new Set<string>();
const seguidores: Seguidor[] = Array.from({ length: totalSeguidores }, (_, i) => {
  let username = '';
  do username = `${pick(NOMES)}${pick(['', '.', '_'])}${pick(SUFIXOS)}${chance(0.5) ? Math.floor(rnd() * 99) : ''}`.replace(/[._]$/, '');
  while (usados.has(username) || username.length < 3);
  usados.add(username);
  // 55% antes da estreia; o resto chega aos poucos, cada vez menos.
  const chegada = chance(0.55) ? Math.floor(rnd() * 2) : 2 + Math.floor(-Math.log(1 - rnd() * 0.97) * 2.5);
  return { igUserId: `sim-${i}`, username, chegada, hora: 8 + rnd() * 15, vota: rnd() * 0.8 };
});

function textoDoEntro(): string {
  const t = sortearPeso(PESO_TIME);
  const p = sortearPeso(PESO_POS);
  const formas = [
    () => `ENTRO ${APELIDO[t][0]} ${POSICAO[p][0]}`,
    () => `entro na ${pick(APELIDO[t])} de ${pick(POSICAO[p])}`,
    () => `Entro ${pick(APELIDO[t])} ${pick(POSICAO[p])} 🔥`,
    () => `ENTRO ${pick(POSICAO[p])} ${pick(APELIDO[t])}`,
  ];
  return pick(formas)();
}
const INVALIDOS = ['quero jogar!!', 'ENTRO FLAMENGO ATACANTE', 'entro capivara', 'kkkkk muito bom', 'ENTRO ONÇA TECNICO', 'como faz pra entrar?', '⚽⚽⚽'];

// ------------------------------------------------------------------ Instagram de mentira

interface Post {
  id: string;
  publicadoEm: Date;
  comentarios: Comentario[];
}
const posts: Post[] = [];
let nComentario = 0;
function comentar(post: Post, s: Pick<Seguidor, 'igUserId' | 'username'>, texto: string, quando: Date): void {
  post.comentarios.push({ igCommentId: `cmt-${++nComentario}`, igMediaId: post.id, igUserId: s.igUserId, username: s.username, texto, comentadoEm: quando });
}

let agora = em(somarDias(inicio, -2), 8);
const containers = new Map<string, { legenda: string }>();
const igFalso = {
  token: 'simulado',
  async midiasDesde(desde: Date) {
    return posts.filter((p) => p.publicadoEm >= desde && p.publicadoEm <= agora).map((p) => ({ id: p.id, timestamp: p.publicadoEm.toISOString() }));
  },
  async comentarios(id: string) {
    return (posts.find((p) => p.id === id)?.comentarios ?? []).filter((c) => c.comentadoEm <= agora);
  },
  async criarReels(o: { legenda: string }) {
    const id = `cont-${containers.size + 1}`;
    containers.set(id, o);
    return id;
  },
  async statusDoContainer() {
    return { status: 'FINISHED' as const };
  },
  async esperarContainer() {},
  async renovarToken() {
    return { token: 'simulado', expiraEm: new Date(agora.getTime() + 60 * 24 * H) };
  },
};

// ------------------------------------------------------------------ montagem

const pasta = join(raizRepo, '.cache/simulacao');
await rm(pasta, { recursive: true, force: true });
await mkdir(pasta, { recursive: true });
const banco = await bancoLocal(join(pasta, 'banco'));
const agenda = new AgendaNaMemoria();
const log: string[] = [];
const ctx: ContextoDoJob = {
  banco,
  armazenamento: new PastaLocal(join(pasta, 'nuvem')),
  agenda,
  ig: igFalso as unknown as Instagram,
  agora: () => agora,
  dormir: async (ms) => void (agora = new Date(agora.getTime() + ms)),
  log: (m) => log.push(`${quando(agora)}  ${m}`),
  gravarReels: async (_d, saida) => writeFile(saida, 'reels'),
  gravarResumo: async (_d, saida) => writeFile(saida, 'resumo'),
};
function quando(d: Date): string {
  const b = new Date(d.getTime() + FUSO * H);
  return `${b.toISOString().slice(8, 10)}/${b.toISOString().slice(5, 7)} ${b.toISOString().slice(11, 16)}`;
}

await criarTemporada(banco, { numero: 1, primeiraRodada: inicio, seed: Number(args.seed ?? 7) });
// Post de lançamento, dois dias antes da estreia: onde chegam as primeiras inscrições.
posts.push({ id: 'post-lancamento', publicadoEm: em(somarDias(inicio, -2), 8), comentarios: [] });

/** "A borda": publica o que venceu e vira post (onde chegam novos comentários). */
async function borda(): Promise<void> {
  for (const chave of await agenda.listar('agenda/')) {
    const item = (await agenda.ler<ItemDaAgenda>(chave))!;
    if (item.publicadoEm || Date.parse(item.publicarEm) > agora.getTime()) continue;
    const mediaId = `midia-${item.tipo.toLowerCase()}-${item.ref}`;
    await agenda.gravar(chave, { ...item, publicadoEm: agora.toISOString(), mediaId });
    posts.push({ id: mediaId, publicadoEm: new Date(agora), comentarios: [] });
    log.push(`${quando(agora)}  borda: publicou ${item.tipo === 'PARTIDA' ? `o Reels da Partida ${item.ref}` : `o Resumo da Rodada ${item.ref}`}`);
    if (item.tipo === 'RESUMO') await votar(mediaId);
  }
}

/** Depois do Resumo, parte dos seguidores inscritos vota (alguns mudam de ideia, alguns erram). */
async function votar(postId: string): Promise<void> {
  const post = posts.find((p) => p.id === postId)!;
  const r = (await banco.query<{ username: string; nota: string }>(`SELECT j.username, c.nota FROM candidato c JOIN jogador j ON j.id = c.jogador_id JOIN rodada r ON r.id = c.rodada_id ORDER BY r.data DESC, c.nota DESC LIMIT 5`)).rows;
  if (!r.length) return;
  const inscritos = seguidores.filter((s) => s.chegada <= diaAtual());
  for (const s of inscritos) {
    if (!chance(s.vota)) continue;
    // Quem está entre os Candidatos vota em si mesmo; os outros puxam para a maior Nota.
    const proprio = r.find((c) => c.username === s.username);
    const alvo = proprio ?? (chance(0.55) ? r[0]! : pick(r));
    const t = new Date(agora.getTime() + rnd() * 14 * H);
    comentar(post, s, chance(0.08) ? `CRAQUE @${alvo.username}!!! 🐐` : `CRAQUE @${alvo.username}`, t);
    if (chance(0.1)) comentar(post, s, `CRAQUE @${pick(r).username}`, new Date(t.getTime() + 2 * H)); // mudou de ideia
  }
  if (chance(0.7)) comentar(post, { igUserId: 'sim-fora', username: 'curioso.qualquer' }, 'CRAQUE @ninguem_aqui', new Date(agora.getTime() + H));
}

const diaAtual = () => Math.floor((agora.getTime() - em(somarDias(inicio, -2), 0).getTime()) / (24 * H));

/** Comentários ENTRO do dia, espalhados pelas horas, no post mais recente. */
function agendarEntrosDoDia(d: number): void {
  const doDia = seguidores.filter((s) => s.chegada === d);
  for (const s of doDia) {
    const t = em(somarDias(inicio, d - 2), s.hora);
    const post = [...posts].reverse().find((p) => p.publicadoEm <= t) ?? posts[0]!;
    comentar(post, s, textoDoEntro(), t);
    if (chance(0.08)) comentar(post, s, textoDoEntro(), new Date(t.getTime() + 0.5 * H)); // tentou de novo: JA_INSCRITO
  }
  for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++) {
    const t = em(somarDias(inicio, d - 2), 9 + rnd() * 13);
    const post = [...posts].reverse().find((p) => p.publicadoEm <= t) ?? posts[0]!;
    comentar(post, { igUserId: `sim-x${d}-${i}`, username: `visitante${d}${i}` }, pick(INVALIDOS), t);
  }
}

// ------------------------------------------------------------------ o relógio

const ULTIMO_DIA = 2 + 9; // 2 dias de pré-temporada + 7 Rodadas + Semifinais + Final
const inicioDoRelogio = Date.now();
for (let d = 0; d < ULTIMO_DIA + 1; d++) {
  const dia = somarDias(inicio, d - 2);
  agendarEntrosDoDia(d);
  const eventos: [number, () => Promise<unknown>][] = [];
  for (let h = 8; h <= 23; h++) eventos.push([h + 17 / 60, () => jobColetar(ctx)]);
  for (const h of [11, 13, 15, 17]) eventos.push([h + 25 / 60, () => jobPartida(ctx)]);
  eventos.push([18 + 10 / 60, () => jobResumo(ctx)]);
  for (let m = 6; m < 24 * 60; m += 60) eventos.push([m / 60, borda]); // :06 de cada hora (Reels)
  eventos.push([19, borda]);
  eventos.sort((a, b) => a[0] - b[0]);
  for (const [hora, fazer] of eventos) {
    const t = em(dia, hora);
    if (ate && t > ate) break;
    if (t > agora) agora = t;
    await fazer();
  }
  if (ate && em(dia, 24) > ate) break;
  process.stdout.write(`\r${dia} ok (${Math.round((Date.now() - inicioDoRelogio) / 1000)} s)   `);
}
process.stdout.write('\n');

// ------------------------------------------------------------------ resultado

await cp(join(pasta, 'nuvem/publico/dados'), join(raizRepo, 'packages/site/public/dados'), { recursive: true, force: true });

const t1 = (await banco.query<{ id: number }>(`SELECT id FROM temporada WHERE numero = 1`)).rows[0]!.id;
const t = await tabela(banco, t1);
const camp = await campeao(banco, t1);
const n = async (sql: string) => Number((await banco.query<{ n: string }>(sql)).rows[0]!.n);
const resumo = [
  `# Ensaio da Temporada 1`,
  '',
  `${quando(em(somarDias(inicio, -2), 8))} a ${quando(agora)} (horário de Brasília)`,
  '',
  `- Seguidores simulados: ${totalSeguidores}; Jogadores inscritos: ${await n(`SELECT count(*) AS n FROM jogador`)}`,
  `- Comentários lidos: ${await n(`SELECT count(*) AS n FROM comando`)}; votos válidos: ${await n(`SELECT count(*) AS n FROM voto`)}`,
  `- Partidas jogadas: ${await n(`SELECT count(*) AS n FROM partida WHERE resultado IS NOT NULL`)}; Reels publicados: ${await n(`SELECT count(*) AS n FROM partida WHERE status = 'PUBLICADA'`)}; Resumos: ${await n(`SELECT count(*) AS n FROM rodada WHERE resumo_status = 'PUBLICADO'`)}`,
  `- Vagas completadas pela Base: ${await n(`SELECT count(*) AS n FROM escalacao WHERE jogador_id IS NULL`)} de ${await n(`SELECT count(*) AS n FROM escalacao`)}`,
  camp ? `- **Campeão: ${FALA_DO_TIME[camp].curto}**` : '- Temporada ainda em andamento',
  '',
  '## Tabela da Fase de Liga',
  '',
  '| # | Time | P | V | E | D | SG |',
  '|---|---|---|---|---|---|---|',
  ...t.map((l, i) => `| ${i + 1} | ${FALA_DO_TIME[l.time].curto} | ${l.pontos} | ${l.vitorias} | ${l.empates} | ${l.derrotas} | ${l.saldo} |`),
  '',
  '## Elencos',
  '',
  ...(
    await banco.query<{ time_id: TimeId; n: string; ovr: string }>(`SELECT time_id, count(*) AS n, round(avg(ovr), 1) AS ovr FROM jogador GROUP BY time_id ORDER BY count(*) DESC`)
  ).rows.map((r) => `- ${FALA_DO_TIME[r.time_id].curto}: ${r.n} inscritos, OVR médio ${r.ovr}`),
  '',
  '## Como foram os comentários',
  '',
  ...(await banco.query<{ resultado: string; n: string }>(`SELECT coalesce(resultado, '?') AS resultado, count(*) AS n FROM comando GROUP BY 1 ORDER BY 2 DESC`)).rows.map((r) => `- ${r.resultado}: ${r.n}`),
  '',
  '## Diário dos jobs',
  '',
  '```',
  ...log.filter((l) => !l.includes('coletar:') && !l.includes('nada a fazer') && !l.includes('nenhuma Rodada')),
  '```',
].join('\n');
await writeFile(join(pasta, 'relatorio.md'), resumo);
console.log(resumo.split('## Diário')[0]);
console.log(`Relatório completo: ${join(pasta, 'relatorio.md')}\nVeja no site: pnpm site  →  http://localhost:5174`);
await banco.fechar();
