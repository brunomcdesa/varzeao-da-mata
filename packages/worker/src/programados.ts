/**
 * Job `programados` (ADR-0051): grava e agenda os Reels Programados (REELS_PROGRAMADOS, no shared).
 * Retomável: a marca `programados/<id>` na agenda diz que já foi agendado, e a chave da agenda
 * (tipo + ref + horário) é a mesma em toda tentativa, então nunca publica duas vezes.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FALA_DO_TIME, PISO_DA_TEMPORADA_1, PRIMEIRA_TEMPORADA_COM_REGRAS_T2, REELS_PROGRAMADOS, RODADAS_DO_BONUS_T1, TIMES_NOVOS, programadosDaVez, type ReelsProgramado, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { gravarNaAgenda, type Agenda, type Armazenamento, type ItemDaAgenda } from './nuvem.js';
import type { Instagram } from './instagram.js';
import type { DadosDoAgradecimentoT1 } from '@liga/renderer';
import { PARAMETROS_T2 } from '@liga/sim';
import { TAMANHO_DA_A, TIME_PRIMO } from './rebalanceamento.js';
import { numerosDaTemporada1 } from './recompensaT1.js';

/** Grava o vídeo de um Programado em `saida`. A estreia vem da Temporada nova (ou da data prevista). */
export type GravarProgramado = (id: string, o: { estreia: string }, saida: string) => Promise<void>;

export interface ContextoDosProgramados {
  banco: Banco;
  armazenamento: Armazenamento;
  agenda: Agenda;
  ig: Instagram | null;
  gravar?: GravarProgramado;
  lista?: readonly ReelsProgramado[];
  agora?: () => Date;
  log?: (m: string) => void;
}

/** Dia da Rodada 1 previsto para cada Programado, se a Temporada ainda não existir no banco. */
const ESTREIA_PREVISTA: Record<string, { temporada: number; estreia: string }> = {
  'abertura-t2': { temporada: 2, estreia: '2026-11-19' },
  'agradecimento-t1': { temporada: 2, estreia: '2026-11-19' },
};

/** Legenda de cada Programado. */
async function legendaDe(banco: Banco, p: ReelsProgramado, temporada: number, estreia: string): Promise<string> {
  if (p.id === 'agradecimento-t1') return legendaDoAgradecimentoT1(await dadosDoAgradecimentoT1(banco, { publicarEm: p.publicarEm }));
  return legendaDaAbertura(temporada, estreia);
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const marca = (id: string) => `programados/${id}`;

export function legendaDaAbertura(temporada: number, estreia: string): string {
  const [a, m, d] = estreia.split('-').map(Number) as [number, number, number];
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!;
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return [
    `⚽ Vem aí a Temporada ${temporada} do Varzeão da Mata!`,
    '',
    `Agora são 16 times em duas séries. Na Série B chegam: ${TIMES_NOVOS.map((t) => FALA_DO_TIME[t].curto).join(', ')}.`,
    'Os 2 últimos da A caem e os 2 finalistas da B sobem.',
    '',
    'Pra jogar, comente:',
    '👉 ENTRO + TIME + POSIÇÃO',
    'Ex.: ENTRO JACARÉ ATACANTE',
    '',
    `🏁 Estreia ${dia}, ${data}. Um jogo por hora: Série B das 11h às 14h, Série A das 15h às 18h.`,
    'Amanhã sai um Reels pra cada novidade. Tabela e jogadores no link da bio.',
    '',
    '#futebol #varzea #jogo #liga',
  ].join('\n');
}

async function estreiaDe(banco: Banco, id: string): Promise<{ temporada: number; estreia: string }> {
  const prevista = ESTREIA_PREVISTA[id];
  if (!prevista) throw new Error(`Programado sem estreia prevista: ${id}`);
  const t = (await banco.query<{ inicio: string | Date }>(`SELECT inicio FROM temporada WHERE numero = $1`, [prevista.temporada])).rows[0];
  if (!t) return prevista;
  return { temporada: prevista.temporada, estreia: (t.inicio instanceof Date ? t.inicio.toISOString() : String(t.inicio)).slice(0, 10) };
}

/** Grava, sobe e agenda os Programados da vez. Devolve os ids agendados nesta rodada. */
export async function jobProgramados(c: ContextoDosProgramados): Promise<string[]> {
  const log = c.log ?? ((m: string) => console.log(m));
  const agora = c.agora ? c.agora() : new Date();
  const feitos: string[] = [];
  const daVez = programadosDaVez(agora, c.lista);
  if (!daVez.length) log('programados: nada a fazer agora.');
  for (const p of daVez) {
    if (await c.agenda.ler(marca(p.id))) {
      log(`${p.id}: já agendado.`);
      continue;
    }
    if (!c.ig) {
      log(`${p.id}: sem Instagram configurado, não agendou.`);
      continue;
    }
    if (!c.gravar) throw new Error('programados: falta a gravação');
    const { temporada, estreia } = await estreiaDe(c.banco, p.id);
    const pasta = await mkdtemp(join(tmpdir(), 'varzea-programado-'));
    try {
      const saida = join(pasta, `${p.id}.mp4`);
      log(`${p.id}: gravando (estreia ${estreia})...`);
      await c.gravar(p.id, { estreia }, saida);
      const chave = `videos/${p.id}-${randomUUID()}.mp4`;
      await c.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(saida)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
      const container = await c.ig.criarReels({ videoUrl: c.armazenamento.urlPublica(chave), legenda: await legendaDe(c.banco, p, temporada, estreia), capaEmMs: 1500 });
      await c.ig.esperarContainer(container);
      // Atrasado (a reserva rodou depois do horário): publica no próximo minuto.
      const publicarEm = new Date(Math.max(Date.parse(p.publicarEm), agora.getTime() + 60_000));
      const item: ItemDaAgenda = { tipo: 'APRESENTACAO', ref: p.ref, containerId: container, publicarEm: publicarEm.toISOString() };
      await gravarNaAgenda(c.agenda, item);
      await c.agenda.gravar(marca(p.id), { agendadoEm: agora.toISOString(), publicarEm: item.publicarEm });
      feitos.push(p.id);
      log(`${p.id}: agendado para ${item.publicarEm}.`);
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }
  return feitos;
}

/**
 * Dados do Reels de agradecimento (ADR-0047), lidos na hora de gravar: números da T1, a
 * Recompensa e o Rebalanceamento (se já foi feito). Se a Abertura da T2 sai depois, no mesmo
 * dia, o Reels chama para ela.
 */
export async function dadosDoAgradecimentoT1(banco: Banco, o: { publicarEm?: string } = {}): Promise<DadosDoAgradecimentoT1> {
  const numeros = await numerosDaTemporada1(banco);
  const movidos = (
    await banco.query<{ movidos: number }>(
      `SELECT r.movidos FROM rebalanceamento r JOIN temporada t ON t.id = r.temporada_id WHERE t.numero = $1`,
      [PRIMEIRA_TEMPORADA_COM_REGRAS_T2],
    )
  ).rows[0]?.movidos;
  const nosso = Date.parse(o.publicarEm ?? REELS_PROGRAMADOS.find((p) => p.id === 'agradecimento-t1')?.publicarEm ?? '');
  const abertura = Date.parse(REELS_PROGRAMADOS.find((p) => p.id === 'abertura-t2')?.publicarEm ?? '');
  const local = (ms: number) => new Date(ms - 3 * 3600_000);
  const mesmoDiaDepois = Number.isFinite(nosso) && Number.isFinite(abertura) && abertura > nosso && local(abertura).toISOString().slice(0, 10) === local(nosso).toISOString().slice(0, 10);
  return {
    ...numeros,
    piso: PISO_DA_TEMPORADA_1,
    rodadasDoBonus: RODADAS_DO_BONUS_T1,
    multiplicadorDoBonus: PARAMETROS_T2.multiplicadorBonusT1,
    ...(movidos ? { rebalanceamento: { movidos, tamanhoDaA: TAMANHO_DA_A, pares: Object.entries(TIME_PRIMO).map(([a, b]) => [a as TimeId, b!] as const) } } : {}),
    ...(mesmoDiaDepois ? { aberturaAs: local(abertura).getUTCHours() } : {}),
  };
}

/** Legenda do Reels de agradecimento da Temporada 1 (ADR-0047). */
export function legendaDoAgradecimentoT1(d?: Pick<DadosDoAgradecimentoT1, 'rebalanceamento' | 'aberturaAs'>): string {
  const bonus = Math.round((PARAMETROS_T2.multiplicadorBonusT1 - 1) * 100);
  const r = d?.rebalanceamento;
  return [
    '🏆 Fim da Temporada 1! Obrigado a cada um que comentou, se inscreveu e acreditou no Varzeão desde o começo.',
    '',
    '🎖️ Quem jogou a T1 ganha o Selo Temporada 1 na página de Carreira.',
    `📈 Ninguém da T1 começa a T2 com OVR abaixo de ${PISO_DA_TEMPORADA_1}.`,
    `⚡ Nas ${RODADAS_DO_BONUS_T1} primeiras Rodadas da T2, suas Habilidades sobem ${bonus}% mais rápido (e soma com a Resenha).`,
    ...(r
      ? [
          '',
          `🔀 Agora são duas Séries. Cada Time da A fica com os ${r.tamanhoDaA} primeiros inscritos e ${r.movidos} Jogadores vão para a Série B, no Time Primo, na mesma posição (OVR, apelido e Carreira vão junto).`,
          '🏅 Quem foi para a B vira Fundador: título na Carreira, prioridade na camisa e volta grátis na próxima Janela. Confira seu Time no site (link na bio).',
        ]
      : []),
    d?.aberturaAs !== undefined ? `👀 Hoje, às ${d.aberturaAs}h, sai a Abertura da Temporada 2. Ativa as notificações!` : '👀 A Temporada 2 vem aí, com muita novidade. Ativa as notificações!',
    '',
    '#varzeaodamata #futebol #varzea',
  ].join('\n');
}
