/**
 * Reels de anúncio do vínculo pela DM (ADR-0013), em dois passos, para conferir antes:
 *
 *   pnpm postar-anuncio --gravar [--copia arquivo.mp4]   grava, sobe no R2 e mostra o link
 *   pnpm postar-anuncio --postar --video <link do R2>     publica no Instagram, com a legenda
 *   pnpm postar-anuncio --so-legenda
 */
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Instagram, conectar, nuvemDoAmbiente, prepararBanco, tokenGuardado } from '../src/index.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* sem .env */
}
const { values: args } = parseArgs({ options: { gravar: { type: 'boolean' }, postar: { type: 'boolean' }, video: { type: 'string' }, copia: { type: 'string' }, 'so-legenda': { type: 'boolean' } } });
const sair = (m: string): never => {
  console.error(m);
  process.exit(1);
};

export const LEGENDA_DO_ANUNCIO = [
  '📲 Novidade no Varzeão da Mata: agora você cuida do seu personagem pelo site!',
  '',
  'Uma vez por temporada, dá para trocar de time, de posição ou dos dois. É assim:',
  '1️⃣ Abra o site (link na bio) e ache o seu @',
  '2️⃣ Toque em "Vincular pela DM": aparece um código, tipo VZ-1234',
  '3️⃣ Mande o código aqui na nossa DM, pela sua conta',
  '4️⃣ Volte no site e toque em "Já mandei"',
  '5️⃣ Escolha o time e a posição e peça a transferência',
  '',
  'Vale do próximo jogo em diante, e você leva as suas habilidades.',
  'Prefere comentar? Escreva TRANSFERIR + time + posição (ex.: TRANSFERIR Preguiça zagueiro).',
  'Só não dá para ir para time lotado: a Liga mantém os times equilibrados. ⚖️',
  '',
  '#varzeaodamata #futebol #varzea',
].join('\n');

console.log(`Legenda:\n${LEGENDA_DO_ANUNCIO}\n`);
if (args['so-legenda']) process.exit(0);

if (args.gravar) {
  const nuvem = nuvemDoAmbiente() ?? sair('Faltam as variáveis do Cloudflare.');
  const pasta = await mkdtemp(join(tmpdir(), 'varzea-anuncio-'));
  const arquivo = join(pasta, 'anuncio.mp4');
  const { gravarAnuncio } = await import('@liga/renderer/gravacao');
  await gravarAnuncio({ saida: arquivo, crf: 18 });
  const chave = `videos/anuncio-vinculo-${Date.now()}.mp4`;
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
    const container = await ig.criarReels({ videoUrl: args.video!, legenda: LEGENDA_DO_ANUNCIO, capaEmMs: 1500 });
    await ig.esperarContainer(container);
    const mediaId = await ig.publicar(container);
    console.log(`Publicado: ${(await ig.linkDaMidia(mediaId)) ?? mediaId}`);
  } finally {
    await banco.fechar();
  }
} else sair('Use --gravar, --postar --video <link> ou --so-legenda.');
