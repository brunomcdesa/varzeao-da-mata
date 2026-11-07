/**
 * Grava o Reels de apresentação da Liga, o primeiro post do perfil:
 *
 *   pnpm apresentacao                              (estreia 2026-11-16, sai em apresentacao.mp4)
 *   pnpm apresentacao --estreia 2026-11-16 --saida ~/Vídeos/varzeao.mp4
 *   pnpm apresentacao --previa ./previa            (só quadros-chave em JPEG)
 *
 * A voz vem do Gemini (GEMINI_API_KEY no .env da raiz); sem chave, sai sem narração.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DADOS_PADRAO } from '../src/apresentacao.js';
import { gravarApresentacao } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    estreia: { type: 'string', default: '2026-11-16' },
    saida: { type: 'string', default: 'apresentacao.mp4' },
    previa: { type: 'string' },
    /** Na prévia, instantes extras em segundos, separados por vírgula. */
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
  },
});

if (!/^\d{4}-\d{2}-\d{2}$/.test(args.estreia!)) {
  console.error('Use --estreia AAAA-MM-DD (o dia da Rodada 1).');
  process.exit(1);
}
// pnpm roda o script dentro de packages/renderer; caminhos relativos valem a partir de onde a pessoa chamou.
const base = process.env.INIT_CWD ?? process.cwd();
await gravarApresentacao(
  { ...DADOS_PADRAO, estreia: args.estreia! },
  { saida: resolve(base, args.saida!), crf: Number(args.crf), ...(args.previa ? { previa: resolve(base, args.previa) } : {}), ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}) },
);
