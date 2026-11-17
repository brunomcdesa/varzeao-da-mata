/**
 * Grava o Reels do Rebalanceamento da T2 (ADR-0066) com números de exemplo, para a prévia:
 *
 *   pnpm rebalanceamento-t2 --previa ./previa
 *
 * O Reels de verdade é gravado pelo job `programados`, com os números do banco. A voz vem do
 * Gemini (GEMINI_API_KEY); sem chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { DadosDoRebalanceamentoT2 } from '../src/rebalanceamentoT2.js';
import { gravarRebalanceamentoT2 } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    saida: { type: 'string', default: 'rebalanceamento-t2.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
    movidos: { type: 'string', default: '61' },
    ficaram: { type: 'string', default: '56' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
const dados: DadosDoRebalanceamentoT2 = {
  movidos: Number(args.movidos),
  ficaram: Number(args.ficaram),
  primos: [['CAP', 'SUC'], ['ONC', 'JAC'], ['TAT', 'LEA'], ['TAM', 'LOB'], ['PRE', 'COR'], ['SAG', 'BES'], ['TUC', 'BOT'], ['ARA', 'TAR']],
  estreia: '2026-11-19',
  primeiroJogoAs: 11,
};

await gravarRebalanceamentoT2(dados, {
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
