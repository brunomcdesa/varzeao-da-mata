/**
 * Grava um Reels de Novidades da T2 (ADR-0062), para a prévia ou à mão:
 *
 *   pnpm novidades --reels CAMPO --previa ./previa
 *   pnpm novidades --reels SITE --saida ~/Vídeos/novidades-site.mp4
 *
 * O Reels de verdade é gravado pelo job `programados` na quarta antes da estreia. A voz vem do
 * Gemini (GEMINI_API_KEY); sem chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { REELS_DE_NOVIDADES, type ReelsDeNovidades } from '../src/novidades.js';
import { gravarNovidades } from './gravacao.js';
import { dadosDasNovidades } from './partidasDasNovidades.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    reels: { type: 'string', default: 'CAMPO' },
    saida: { type: 'string' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
    estreia: { type: 'string', default: '2026-11-19' },
    publicado: { type: 'string', default: '2026-11-18T15:00:00Z' },
  },
});

const reels = args.reels!.toUpperCase() as ReelsDeNovidades;
if (!REELS_DE_NOVIDADES.includes(reels)) throw new Error(`--reels: use ${REELS_DE_NOVIDADES.join(', ')}`);
const base = process.env.INIT_CWD ?? process.cwd();
await gravarNovidades(dadosDasNovidades(reels, { estreia: args.estreia!, publicadoEm: args.publicado! }), {
  saida: resolve(base, args.saida ?? `novidades-${reels.toLowerCase()}.mp4`),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
