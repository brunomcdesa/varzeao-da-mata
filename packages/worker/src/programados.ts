/**
 * Job `programados` (ADR-0051): grava e agenda os Reels Programados (REELS_PROGRAMADOS, no shared).
 * Retomável: a marca `programados/<id>` na agenda diz que já foi agendado, e a chave da agenda
 * (tipo + ref + horário) é a mesma em toda tentativa, então nunca publica duas vezes.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FALA_DO_TIME, PISO_DA_TEMPORADA_1, PRIMEIRA_TEMPORADA_COM_REGRAS_T2, REELS_PROGRAMADOS, RODADAS_DO_BONUS_T1, GRUPOS_DA_A_DE_16, NOME_DO_GRUPO, programadosDaVez, type ReelsProgramado, type TimeId } from '@liga/shared';
import type { Banco } from './banco.js';
import { gravarNaAgenda, type Agenda, type Armazenamento, type ItemDaAgenda } from './nuvem.js';
import type { Instagram } from './instagram.js';
import type { DadosDoAgradecimentoT1, DadosDoPerfilDoTime, DadosDoRebalanceamentoT2 } from '@liga/renderer';
import { TIME_PRIMO } from './rebalanceamento.js';
import { PARAMETROS_T2 } from '@liga/sim';
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
  'novidades-campo': { temporada: 2, estreia: '2026-11-19' },
  'novidades-capitao': { temporada: 2, estreia: '2026-11-19' },
  'novidades-jogador': { temporada: 2, estreia: '2026-11-19' },
  'novidades-site': { temporada: 2, estreia: '2026-11-19' },
  'rebalanceamento-t2': { temporada: 2, estreia: '2026-11-19' },
  'perfil-do-time': { temporada: 2, estreia: '2026-11-19' },
};

/** Legenda de cada Programado. */
async function legendaDe(banco: Banco, p: ReelsProgramado, temporada: number, estreia: string): Promise<string> {
  if (p.id === 'agradecimento-t1') return legendaDoAgradecimentoT1(await dadosDoAgradecimentoT1(banco, { publicarEm: p.publicarEm }));
  if (p.id.startsWith('novidades-')) return legendaDasNovidades(p.id, estreia, p.publicarEm);
  if (p.id === 'rebalanceamento-t2') return legendaDoRebalanceamentoT2(await dadosDoRebalanceamentoT2(banco, estreia));
  if (p.id === 'perfil-do-time') return legendaDoPerfilDoTime(await dadosDoPerfilDoTime(banco));
  return legendaDaAbertura(temporada, estreia);
}

/** Legendas dos Reels de Novidades da T2 (ADR-0063). */
export function legendaDasNovidades(id: string, estreia: string, publicarEm: string): string {
  const [a, m, d] = estreia.split('-').map(Number) as [number, number, number];
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!;
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  const post = new Date(Date.parse(publicarEm) - 3 * 3600_000);
  const amanha = Date.UTC(a, m - 1, d, 12) - Date.UTC(post.getUTCFullYear(), post.getUTCMonth(), post.getUTCDate(), 12) === 86_400_000;
  const estreiaTxt = `🏁 Estreia ${amanha ? 'amanhã, ' : ''}${dia}, ${data}. Série A com 16 times em 2 grupos, um jogo por hora, das 11h às 18h.`;
  const fim = ['', estreiaTxt, 'Tabela, jogadores e o seu painel no link da bio.', '', '#futebol #varzea #jogo #liga'];
  const corpo: Record<string, string[]> = {
    'novidades-campo': [
      '⚽ Novidades da Temporada 2 (1/4): dentro de campo!',
      '',
      '🟨 Juiz em campo, falta e cartão (o vermelho expulsa; dois amarelos na temporada dão suspensão)',
      '🎯 Pênalti, falta com barreira e jogada ensaiada',
      '🚩 Escanteio e lateral',
      '📣 Arquibancada nas cores do time, com grito de guerra depois do gol',
      '🌧️ Sol, chuva ou lama, e segundo uniforme quando as camisas se confundem',
      '🔁 Substituição no intervalo: quem está indo mal sai e entra um reserva do Banco',
      '🎙️ Cinco Narradores, cada um com a sua voz',
      '',
      'Às 14h: o Capitão.',
    ],
    'novidades-capitao': [
      '©️ Novidades da Temporada 2 (2/4): o Capitão!',
      '',
      'O Capitão é o jogador com mais partidas pelo time (com Vínculo no site).',
      'Antes de cada jogo, até o Corte, ele escolhe pelo site:',
      '👉 a Postura, em segredo: Ofensiva, Equilibrada ou Defensiva',
      '👉 a Formação: 2-2-2, 2-3-1, 3-2-1 ou 3-1-2',
      '',
      'Cada Formação tem a sua jogada: Tabela (2-3-1), Cobertura (3-2-1) e Ligação direta (3-1-2).',
      '',
      'Às 16h: o seu Jogador.',
    ],
    'novidades-jogador': [
      '🧑 Novidades da Temporada 2 (3/4): o seu Jogador!',
      '',
      'Com o Vínculo (código na DM da Liga), você escolhe pelo site:',
      '🏷️ Apelido: aparece no jogo e o Narrador fala nos lances',
      '👕 Número da camisa: de 1 a 99, sem repetir no Time, nas costas do seu Jogador',
      '⭐ Especialização: 3 por posição, melhora uma coisa e piora outra',
      '💪 Treino: a habilidade que sobe mais rápido',
      '🥅 Canto do pênalti, de batedor e de goleiro',
      '',
      '✅ Comente CONFIRMO (ou confirme no site) até o Corte e passe na frente no rodízio.',
      '💬 Resenha: comentou no Reels do último jogo do seu time? Habilidades 50% mais rápido; no Clássico, ainda passa na frente.',
      '🏆 Seleção da Rodada: Muralha, Carrapato, Garçom e Matador, a maior Nota de cada posição.',
      '',
      'Às 18h: o Site e o App.',
    ],
    'novidades-site': [
      '📱 Novidades da Temporada 2 (4/4): Site e App!',
      '',
      '📲 App: instale o site no celular, com ícone e tela cheia (sem loja)',
      '🔔 Avisos dos seus times: Escalação, 5 min antes do Apito Inicial, gols e fim de jogo',
      '👀 Ao Vivo com Público e Reações: ⚽ 🔥 😱 👏',
      '📖 Página de Carreira, temporada por temporada, com troféus e o Selo da Temporada 1',
    ],
  };
  const linhas = corpo[id];
  if (!linhas) throw new Error(`Novidades sem legenda: ${id}`);
  return [...linhas, ...fim].join('\n');
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const marca = (id: string) => `programados/${id}`;

const lista = (times: readonly TimeId[]) => {
  const nomes = times.map((t) => FALA_DO_TIME[t].curto);
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
};

export function legendaDaAbertura(temporada: number, estreia: string): string {
  const [a, m, d] = estreia.split('-').map(Number) as [number, number, number];
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]!;
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return [
    `⚽ Vem aí a Temporada ${temporada} do Varzeão da Mata!`,
    '',
    `A Série A cresce para 16 times, em dois grupos de 8 (os clássicos juntos):`,
    `🟫 ${NOME_DO_GRUPO.CHAO}: ${lista(GRUPOS_DA_A_DE_16.CHAO)}`,
    `🌳 ${NOME_DO_GRUPO.COPA}: ${lista(GRUPOS_DA_A_DE_16.COPA)}`,
    'Todos contra todos no grupo. Os 2 primeiros de cada grupo vão pra semifinal (1º de um × 2º do outro).',
    `Os 4 últimos de cada grupo caem e formam a Série B, que estreia na Temporada ${temporada + 1}.`,
    'Quem entra agora escolhe o time (até 2 goleiros e 4 em cada posição por time). Posição cheia, vai para outro time na mesma posição.',
    '',
    'Pra jogar, comente:',
    '👉 ENTRO + TIME + POSIÇÃO',
    'Ex.: ENTRO JACARÉ ATACANTE',
    '',
    `🏁 Estreia ${dia}, ${data}. 8 jogos por dia, um por hora, das 11h às 18h. 7 rodadas, semifinal e final.`,
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
 * Dados do Reels de agradecimento (ADR-0047), lidos na hora de gravar: números da T1 e a
 * Recompensa. O Rebalanceamento fica fora (ADR-0058): o formato novo das Séries é contado na
 * Abertura da T2. Se a Abertura sai depois, no mesmo dia, o Reels chama para ela.
 */
export async function dadosDoAgradecimentoT1(banco: Banco, o: { publicarEm?: string } = {}): Promise<DadosDoAgradecimentoT1> {
  const numeros = await numerosDaTemporada1(banco);
  const nosso = Date.parse(o.publicarEm ?? REELS_PROGRAMADOS.find((p) => p.id === 'agradecimento-t1')?.publicarEm ?? '');
  const abertura = Date.parse(REELS_PROGRAMADOS.find((p) => p.id === 'abertura-t2')?.publicarEm ?? '');
  const local = (ms: number) => new Date(ms - 3 * 3600_000);
  const mesmoDiaDepois = Number.isFinite(nosso) && Number.isFinite(abertura) && abertura > nosso && local(abertura).toISOString().slice(0, 10) === local(nosso).toISOString().slice(0, 10);
  return {
    ...numeros,
    piso: PISO_DA_TEMPORADA_1,
    rodadasDoBonus: RODADAS_DO_BONUS_T1,
    multiplicadorDoBonus: PARAMETROS_T2.multiplicadorBonusT1,
    ...(mesmoDiaDepois ? { aberturaAs: local(abertura).getUTCHours() } : {}),
  };
}

/** Legenda do Reels de agradecimento da Temporada 1 (ADR-0047). */
export function legendaDoAgradecimentoT1(d?: Pick<DadosDoAgradecimentoT1, 'aberturaAs'>): string {
  const bonus = Math.round((PARAMETROS_T2.multiplicadorBonusT1 - 1) * 100);
  return [
    '🏆 Fim da Temporada 1! Obrigado a cada um que comentou, se inscreveu e acreditou no Varzeão desde o começo.',
    '',
    '🎖️ Quem jogou a T1 ganha o Selo Temporada 1 na página de Carreira.',
    `📈 Ninguém da T1 começa a T2 com OVR abaixo de ${PISO_DA_TEMPORADA_1}.`,
    `⚡ Nas ${RODADAS_DO_BONUS_T1} primeiras Rodadas da T2, suas Habilidades sobem ${bonus}% mais rápido (e soma com a Resenha).`,
    d?.aberturaAs !== undefined ? `👀 Hoje, às ${d.aberturaAs}h, sai a Abertura da Temporada 2. Ativa as notificações!` : '👀 A Temporada 2 vem aí, com muita novidade. Ativa as notificações!',
    '',
    '#varzeaodamata #futebol #varzea',
  ].join('\n');
}

/**
 * Dados do Reels do Rebalanceamento (ADR-0067), lidos na hora de gravar: quantos mudaram de Time
 * e quantos ficaram nos fundadores no momento do Rebalanceamento. Sem o Rebalanceamento feito, não
 * grava (o job tenta de novo na próxima chamada).
 */
export async function dadosDoRebalanceamentoT2(banco: Banco, estreia: string): Promise<DadosDoRebalanceamentoT2> {
  const r = (
    await banco.query<{ temporada_id: number; feito_em: Date | string; movidos: number }>(
      `SELECT r.temporada_id, r.feito_em, r.movidos FROM rebalanceamento r JOIN temporada t ON t.id = r.temporada_id WHERE t.numero = 2`,
    )
  ).rows[0];
  if (!r) throw new Error('O Rebalanceamento da T2 ainda não rodou: o Reels dele espera.');
  const fundadores = Object.keys(TIME_PRIMO);
  const ficaram = Number(
    (
      await banco.query<{ n: string }>(`SELECT count(*) AS n FROM jogador WHERE NOT banido AND time_id = ANY($1) AND inscrito_em <= $2`, [fundadores, new Date(r.feito_em).toISOString()])
    ).rows[0]!.n,
  );
  const primeiro = (
    await banco.query<{ apito_inicial: Date | string }>(
      `SELECT p.apito_inicial FROM partida p JOIN rodada x ON x.id = p.rodada_id WHERE x.temporada_id = $1 ORDER BY p.apito_inicial LIMIT 1`,
      [r.temporada_id],
    )
  ).rows[0];
  const primeiroJogoAs = primeiro ? (new Date(primeiro.apito_inicial).getUTCHours() + 21) % 24 : 11;
  return {
    movidos: Number(r.movidos),
    ficaram,
    primos: Object.entries(TIME_PRIMO).map(([de, para]) => [de as TimeId, para!] as const),
    estreia,
    primeiroJogoAs,
  };
}

/** Legenda do Reels do Rebalanceamento (ADR-0067). */
export function legendaDoRebalanceamentoT2(d: DadosDoRebalanceamentoT2): string {
  const [a, m, dia] = d.estreia.split('-').map(Number) as [number, number, number];
  const semana = DIAS[new Date(Date.UTC(a, m - 1, dia, 12)).getUTCDay()]!;
  const data = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return [
    '🔄 Rebalanceamento da Temporada 2: como ficaram os Times!',
    '',
    'Cada Time da T1 fica com uma Escalação inteira (1 goleiro, 2 zagueiros, 2 meias e 2 atacantes): ficam os mais antigos de cada posição.',
    'Quem saiu foi para o Time Primo, um dos Times que chegaram. Primo cheio na posição? Outro Time novo, na mesma posição.',
    `📊 ${d.movidos} mudaram de Time e ${d.ficaram} ficaram.`,
    '⭐ Quem joga nos Times que chegaram vira Fundador: Selo na Carreira e escolhe a camisa primeiro.',
    '🔁 Até a estreia, trocar de Time não gasta a Transferência.',
    '',
    `🏁 Estreia ${semana}, ${data}, primeiro jogo às ${d.primeiroJogoAs}h. Confere o seu Time no link da bio.`,
    '',
    '#futebol #varzea #jogo #liga',
  ].join('\n');
}

/**
 * Dados do Reels do Perfil do Time (ADR-0100), lidos na hora de gravar: os Perfis do Time
 * oficiais, do mais antigo para o mais novo, e os Times da Série A que ainda não têm perfil.
 */
export async function dadosDoPerfilDoTime(banco: Banco): Promise<DadosDoPerfilDoTime> {
  const perfis = (await banco.query<{ time_id: TimeId; usuario: string }>(`SELECT time_id, usuario FROM perfil_do_time ORDER BY oficial_desde, time_id`)).rows.map((l) => ({ time: l.time_id, usuario: l.usuario }));
  const daLiga = [...GRUPOS_DA_A_DE_16.CHAO, ...GRUPOS_DA_A_DE_16.COPA];
  return { perfis, semPerfil: daLiga.filter((t) => !perfis.some((p) => p.time === t)) };
}

/** Legenda do Reels do Perfil do Time (ADR-0100). Aqui o @ aparece: é texto, não fala. */
export function legendaDoPerfilDoTime(d: DadosDoPerfilDoTime): string {
  const exemplos = d.perfis.map((p) => `${FALA_DO_TIME[p.time].curto}: @${p.usuario}`);
  return [
    '📲 O seu Time pode ter perfil oficial no Instagram!',
    '',
    ...(exemplos.length ? ['Já tem Time com perfil, criado pelos próprios Jogadores:', ...exemplos.map((e) => `👉 ${e}`), ''] : []),
    '✅ Pra ser oficial:',
    '1. @varzeao_da_mata na bio',
    '2. Nome e bicho do Time (o escudo pode ser o seu)',
    '3. Não se passar pela Liga (nada de selo de verificado falso)',
    '4. Respeito aos rivais (provocação de Clássico pode!)',
    '',
    '📩 Criou? Manda DM pro @varzeao_da_mata. Um perfil por Time: vale o primeiro que pedir.',
    '',
    '🎁 O perfil oficial ganha link na página do Time no site e no App, é seguido pela Liga, pode aparecer nos Stories e entra de colaborador em todo Reels de jogo do Time.',
    '',
    '#varzeaodamata #futebol #varzea',
  ].join('\n');
}
