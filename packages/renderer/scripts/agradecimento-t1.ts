/**
 * Grava o Reels de agradecimento da Temporada 1 (ADR-0047) com números de exemplo, para a prévia:
 *
 *   pnpm agradecimento-t1 --previa ./previa
 *   pnpm agradecimento-t1 --saida ~/Vídeos/agradecimento.mp4 --inscritos 100 --jogos 30 --gols 110
 *
 * O Reels de verdade é gravado pelo worker (`pnpm postar-agradecimento-t1`), com os números do
 * banco. A voz vem do Gemini (GEMINI_API_KEY); sem chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PISO_DA_TEMPORADA_1, RODADAS_DO_BONUS_T1 } from '@liga/shared';
import { PARAMETROS_T2 } from '@liga/sim';
import type { DadosDoAgradecimentoT1 } from '../src/agradecimentoT1.js';
import { gravarAgradecimentoT1 } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    saida: { type: 'string', default: 'agradecimento-t1.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
    inscritos: { type: 'string', default: '100' },
    jogos: { type: 'string', default: '31' },
    gols: { type: 'string', default: '116' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
const dados: DadosDoAgradecimentoT1 = {
  inscritos: Number(args.inscritos),
  jogos: Number(args.jogos),
  gols: Number(args.gols),
  piso: PISO_DA_TEMPORADA_1,
  rodadasDoBonus: RODADAS_DO_BONUS_T1,
  multiplicadorDoBonus: PARAMETROS_T2.multiplicadorBonusT1,
};

await gravarAgradecimentoT1(dados, {
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
