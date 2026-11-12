/**
 * Reels de agradecimento da Temporada 1 (ADR-0047), em dois passos, à mão:
 *
 *   pnpm postar-agradecimento-t1 --gravar [--copia arquivo.mp4]   grava com os números do banco e a voz do Seu Dito
 *   pnpm postar-agradecimento-t1 --postar --video <link do R2>    publica com a legenda (depois da aprovação do dono)
 *   pnpm postar-agradecimento-t1 --so-legenda
 *
 * O Reels sai sozinho pelo job `resumo` no dia seguinte ao Resumo da Temporada (jobAgradecimentoT1).
 * Este script é para a prévia (gravar com os números de hoje) ou para postar à mão se precisar.
 */
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PISO_DA_TEMPORADA_1, RODADAS_DO_BONUS_T1 } from '@liga/shared';
import { PARAMETROS_T2 } from '@liga/sim';
import { Instagram, conectar, legendaDoAgradecimentoT1, nuvemDoAmbiente, numerosDaTemporada1, prepararBanco, tokenGuardado } from '../src/index.js';

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

export const LEGENDA_DO_AGRADECIMENTO_T1 = legendaDoAgradecimentoT1();

console.log(`Legenda:\n${LEGENDA_DO_AGRADECIMENTO_T1}\n`);
if (args['so-legenda']) process.exit(0);

if (args.gravar) {
  const nuvem = nuvemDoAmbiente() ?? sair('Faltam as variáveis do Cloudflare.');
  const banco = conectar();
  let numeros: Awaited<ReturnType<typeof numerosDaTemporada1>>;
  try {
    await prepararBanco(banco);
    numeros = await numerosDaTemporada1(banco);
  } finally {
    await banco.fechar();
  }
  console.log(`Números: ${numeros.inscritos} inscritos, ${numeros.jogos} jogos, ${numeros.gols} gols`);
  const pasta = await mkdtemp(join(tmpdir(), 'varzea-agradecimento-t1-'));
  const arquivo = join(pasta, 'agradecimento-t1.mp4');
  const { gravarAgradecimentoT1 } = await import('@liga/renderer/gravacao');
  await gravarAgradecimentoT1(
    { ...numeros, piso: PISO_DA_TEMPORADA_1, rodadasDoBonus: RODADAS_DO_BONUS_T1, multiplicadorDoBonus: PARAMETROS_T2.multiplicadorBonusT1 },
    { saida: arquivo, crf: 18 },
  );
  const chave = `videos/agradecimento-t1-${Date.now()}.mp4`;
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
    const container = await ig.criarReels({ videoUrl: args.video!, legenda: LEGENDA_DO_AGRADECIMENTO_T1, capaEmMs: 2500 });
    await ig.esperarContainer(container);
    const mediaId = await ig.publicar(container);
    console.log(`Publicado: ${(await ig.linkDaMidia(mediaId)) ?? mediaId}`);
  } finally {
    await banco.fechar();
  }
} else sair('Use --gravar, --postar --video <link> ou --so-legenda.');
