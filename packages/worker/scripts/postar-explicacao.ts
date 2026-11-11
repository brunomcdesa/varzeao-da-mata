/**
 * Reels que explica a Escalação (rodízio por Posição), em dois passos, para conferir antes:
 *
 *   pnpm postar-explicacao --gravar [--copia arquivo.mp4] [--exemplo CAP]   grava com os Elencos de agora
 *   pnpm postar-explicacao --postar --video <link do R2>                      publica com a legenda
 *   pnpm postar-explicacao --so-legenda
 *
 * Os números dos Elencos são lidos do banco na hora de gravar; o vídeo mostra "situação em
 * <dia> às <hora>" e a legenda avisa que eles mudam a cada Inscrição.
 */
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { TIMES, TIMES_FUNDADORES, type Posicao, type TimeId } from '@liga/shared';
import { Instagram, conectar, nuvemDoAmbiente, prepararBanco, tokenGuardado } from '../src/index.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* sem .env */
}
const { values: args } = parseArgs({ options: { gravar: { type: 'boolean' }, postar: { type: 'boolean' }, video: { type: 'string' }, copia: { type: 'string' }, exemplo: { type: 'string' }, 'so-legenda': { type: 'boolean' } } });
const sair = (m: string): never => {
  console.error(m);
  process.exit(1);
};

export const LEGENDA_DA_EXPLICACAO = [
  '🤔 Se inscreveu e ficou fora do jogo? Não é bug: é o rodízio!',
  '',
  'Como funciona a Escalação:',
  '⚽ Cada time joga com 7: 1 goleiro, 2 zagueiros, 2 meias e 2 atacantes. A disputa é dentro da sua posição.',
  '⏰ A Escalação fecha 30 min antes do jogo. Se inscreveu depois? Entra no próximo jogo do seu time.',
  '🔁 Entra primeiro o Craque da Rodada anterior. Depois, quem jogou menos na temporada. Empatou? Quem está há mais tempo sem jogar.',
  '🆕 Chegou agora? Com 0 jogos, você entra antes de quem já jogou.',
  '🔄 Transferiu? Seus jogos vão junto para o time novo.',
  '',
  '📊 Os números do vídeo mostram a situação no momento da postagem. Os elencos mudam a cada inscrição: confira no site (link na bio).',
  '',
  'Quer jogar mais? Comenta ENTRO + time + uma posição com vaga 👇',
  '',
  '#varzeaodamata #futebol #varzea',
].join('\n');

console.log(`Legenda:\n${LEGENDA_DA_EXPLICACAO}\n`);
if (args['so-legenda']) process.exit(0);

if (args.gravar) {
  const nuvem = nuvemDoAmbiente() ?? sair('Faltam as variáveis do Cloudflare.');
  const banco = conectar();
  let jogadores: { time: TimeId; posicao: Posicao }[];
  let temporada: number;
  try {
    await prepararBanco(banco);
    temporada = (await banco.query<{ numero: number }>(`SELECT numero FROM temporada WHERE status <> 'ENCERRADA' ORDER BY numero DESC LIMIT 1`)).rows[0]?.numero ?? sair('Nenhuma Temporada em andamento.');
    jogadores = (await banco.query<{ time: TimeId; posicao: Posicao }>(`SELECT time_id AS time, posicao FROM jogador WHERE NOT banido`)).rows;
  } finally {
    await banco.fechar();
  }
  const { contarElencos, exemploPadrao } = await import('@liga/renderer/explicacao');
  const elencos = contarElencos(jogadores, temporada >= 2 ? [...TIMES] : [...TIMES_FUNDADORES]);
  const exemplo = (args.exemplo?.toUpperCase() as TimeId | undefined) ?? exemploPadrao(elencos);
  console.log(`Temporada ${temporada} · ${jogadores.length} Jogadores · exemplo ${exemplo}`);
  for (const [t, e] of Object.entries(elencos)) console.log(`  ${t}  GOL ${e.GOL}  ZAG ${e.ZAG}  MEI ${e.MEI}  ATA ${e.ATA}`);

  const pasta = await mkdtemp(join(tmpdir(), 'varzea-explicacao-'));
  const arquivo = join(pasta, 'escalacao.mp4');
  const { gravarExplicacao } = await import('@liga/renderer/gravacao');
  await gravarExplicacao({ temporada, rodadas: 7, situacaoEm: new Date().toISOString(), elencos, exemplo }, { saida: arquivo, crf: 18 });
  const chave = `videos/explicacao-escalacao-${Date.now()}.mp4`;
  await nuvem.armazenamento.enviar('publico', chave, new Uint8Array(await readFile(arquivo)), { tipo: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
  if (args.copia) await copyFile(arquivo, resolve(process.env.INIT_CWD ?? process.cwd(), args.copia));
  await rm(pasta, { recursive: true, force: true });
  console.log(`VIDEO_URL=${nuvem.armazenamento.urlPublica(chave)}`);
} else if (args.postar) {
  if (!args.video?.startsWith('https://')) sair('Passe --video com o link do R2 que o --gravar mostrou.');
  const banco = conectar();
  try {
    await prepararBanco(banco);
    const token = (await tokenGuardado(banco))?.token ?? process.env.IG_ACCESS_TOKEN;
    if (!process.env.IG_USER_ID || !token) sair('Faltam IG_USER_ID e IG_ACCESS_TOKEN.');
    const ig = new Instagram({ userId: process.env.IG_USER_ID!, token: token! });
    const container = await ig.criarReels({ videoUrl: args.video!, legenda: LEGENDA_DA_EXPLICACAO, capaEmMs: 2000 });
    await ig.esperarContainer(container);
    const mediaId = await ig.publicar(container);
    console.log(`Publicado: ${(await ig.linkDaMidia(mediaId)) ?? mediaId}`);
  } finally {
    await banco.fechar();
  }
} else sair('Use --gravar, --postar --video <link> ou --so-legenda.');
