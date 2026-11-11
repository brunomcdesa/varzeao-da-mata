/**
 * Grava o Reels que explica o OVR (de onde vem, o que faz subir e o que o Jogador pode fazer),
 * com as regras da Temporada 1:
 *
 *   pnpm explicacao-ovr --previa ./previa
 *   pnpm explicacao-ovr --saida ~/Vídeos/ovr.mp4 [--time CAP]
 *
 * Os números vêm das regras do jogo (não do banco). A voz vem do Gemini (GEMINI_API_KEY); sem
 * chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { TIMES, type TimeId } from '@liga/shared';
import { PARAMETROS } from '@liga/sim';
import type { DadosDaExplicacaoOvr } from '../src/explicacaoOvr.js';
import { gravarExplicacaoOvr } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    time: { type: 'string', default: 'CAP' },
    saida: { type: 'string', default: 'explicacao-ovr.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
const time = args.time!.toUpperCase() as TimeId;
if (!TIMES.includes(time)) {
  console.error(`Time desconhecido: ${time}`);
  process.exit(1);
}
/** O Corte (30 min antes do Apito Inicial) é o de `worker/src/escalacao.ts`. */
const dados: DadosDaExplicacaoOvr = { time, multiplicadorResenha: PARAMETROS.multiplicadorResenha, corteMinutos: 30 };

await gravarExplicacaoOvr(dados, {
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
