/**
 * Grava o Reels de Fim da Temporada 2 (ADR-0117) com números de exemplo, para a prévia:
 *
 *   pnpm agradecimento-t2 --previa ./previa
 *   pnpm agradecimento-t2 --saida ~/Vídeos/fim-da-t2.mp4 --jogadores 184 --jogos 59 --gols 231
 *
 * O Reels de verdade é o Programado `agradecimento-t2`, gravado pelo worker com os números do
 * banco. A voz vem do Gemini (GEMINI_API_KEY); sem chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { DadosDoAgradecimentoT2 } from '../src/agradecimentoT2.js';
import { gravarAgradecimentoT2 } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    saida: { type: 'string', default: 'fim-da-t2.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
    jogadores: { type: 'string', default: '184' },
    jogos: { type: 'string', default: '59' },
    gols: { type: 'string', default: '231' },
    abertura: { type: 'string', default: '21' },
    copa: { type: 'string', default: '2026-11-30' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
const dados: DadosDoAgradecimentoT2 = {
  jogadores: Number(args.jogadores),
  jogos: Number(args.jogos),
  gols: Number(args.gols),
  ...(args.abertura ? { aberturaAs: Number(args.abertura) } : {}),
  ...(args.copa ? { copaEm: args.copa } : {}),
};

await gravarAgradecimentoT2(dados, {
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
