/**
 * Reels que explica o OVR (de onde vem, o que faz subir, a Resenha e como jogar mais), com as
 * regras da Temporada 1, em dois passos, para conferir antes:
 *
 *   pnpm postar-explicacao-ovr --gravar [--copia arquivo.mp4] [--time CAP]   grava com a voz do Narrador
 *   pnpm postar-explicacao-ovr --postar --video <link do R2>                 publica com a legenda
 *   pnpm postar-explicacao-ovr --so-legenda
 *
 * Os números do vídeo vêm das regras do jogo (não do banco).
 */
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { TIMES, type TimeId } from '@liga/shared';
import { PARAMETROS } from '@liga/sim';
import { CORTE_MINUTOS, Instagram, conectar, nuvemDoAmbiente, prepararBanco, tokenGuardado } from '../src/index.js';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(join(raizRepo, '.env'));
} catch {
  /* sem .env */
}
const { values: args } = parseArgs({ options: { gravar: { type: 'boolean' }, postar: { type: 'boolean' }, video: { type: 'string' }, copia: { type: 'string' }, time: { type: 'string', default: 'CAP' }, 'so-legenda': { type: 'boolean' } } });
const sair = (m: string): never => {
  console.error(m);
  process.exit(1);
};

const BONUS = Math.round((PARAMETROS.multiplicadorResenha - 1) * 100);

export const LEGENDA_DA_EXPLICACAO_DO_OVR = [
  '📈 Quer ver o seu OVR subir? A partir de agora ele pesa mais em cada lance!',
  '',
  'Como funciona:',
  '🧮 O OVR é a média das suas 5 Habilidades (Finalização, Passe, Drible, Defesa e Goleiro), com o peso da sua posição.',
  '⚽ Cada ação no jogo mexe numa Habilidade: gol sobe Finalização, assistência sobe Passe, desarme e bloqueio sobem Defesa, defesa sobe Goleiro.',
  '📉 Chute pra fora, bola perdida e gol sofrido fazem cair.',
  '🔒 Só evolui quem joga (ficou fora? não perde nada), no máximo 2 pontos por Habilidade por jogo. No Clássico vale em dobro.',
  '',
  `🆕 NOVIDADE, a Resenha: comente no Reels do último jogo do seu time, até ${CORTE_MINUTOS} min antes do próximo jogo. Se você for escalado, suas Habilidades sobem ${BONUS}% mais rápido nesse jogo. Um comentário basta.`,
  '',
  'Para jogar mais vezes:',
  '🎯 Escolha uma posição com vaga (menos fila no rodízio).',
  '🔄 Use a sua Transferência: comente TRANSFERIR + time ou posição (uma por temporada).',
  '⭐ O Craque da Rodada tem lugar garantido no jogo seguinte: peça votos no Resumo da Rodada.',
  '',
  'Suas Habilidades e o seu histórico estão no site (link na bio).',
  '',
  '#varzeaodamata #futebol #varzea',
].join('\n');

console.log(`Legenda:\n${LEGENDA_DA_EXPLICACAO_DO_OVR}\n`);
if (args['so-legenda']) process.exit(0);

if (args.gravar) {
  const nuvem = nuvemDoAmbiente() ?? sair('Faltam as variáveis do Cloudflare.');
  const time = args.time!.toUpperCase() as TimeId;
  if (!TIMES.includes(time)) sair(`Time desconhecido: ${time}`);
  const pasta = await mkdtemp(join(tmpdir(), 'varzea-explicacao-ovr-'));
  const arquivo = join(pasta, 'ovr.mp4');
  const { gravarExplicacaoOvr } = await import('@liga/renderer/gravacao');
  await gravarExplicacaoOvr({ time, multiplicadorResenha: PARAMETROS.multiplicadorResenha, corteMinutos: CORTE_MINUTOS }, { saida: arquivo, crf: 18 });
  const chave = `videos/explicacao-ovr-${Date.now()}.mp4`;
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
    const container = await ig.criarReels({ videoUrl: args.video!, legenda: LEGENDA_DA_EXPLICACAO_DO_OVR, capaEmMs: 2500 });
    await ig.esperarContainer(container);
    const mediaId = await ig.publicar(container);
    console.log(`Publicado: ${(await ig.linkDaMidia(mediaId)) ?? mediaId}`);
  } finally {
    await banco.fechar();
  }
} else sair('Use --gravar, --postar --video <link> ou --so-legenda.');
