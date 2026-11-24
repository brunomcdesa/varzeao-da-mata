/**
 * Grava o Reels da Mudança de Endereço (ADR-0104), para a prévia:
 *
 *   pnpm mudanca-de-endereco --previa ./previa
 *
 * O Reels de verdade é gravado pelo job `programados`. A voz vem do Gemini (GEMINI_API_KEY);
 * sem chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gravarMudancaDeEndereco } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    saida: { type: 'string', default: 'mudanca-de-endereco.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
await gravarMudancaDeEndereco({
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
