/**
 * Grava o Reels do Perfil do Time (ADR-0100) com os perfis de hoje, para a prévia:
 *
 *   pnpm perfil-do-time --previa ./previa
 *
 * O Reels de verdade é gravado pelo job `programados`, com os perfis do banco. A voz vem do
 * Gemini (GEMINI_API_KEY); sem chave, sai muda.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { GRUPOS_DA_A_DE_16, type TimeId } from '@liga/shared';
import type { DadosDoPerfilDoTime } from '../src/perfilDoTime.js';
import { gravarPerfilDoTime } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    saida: { type: 'string', default: 'perfil-do-time.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
const perfis: DadosDoPerfilDoTime['perfis'] = [
  { time: 'JAC', usuario: 'jacareacc' },
  { time: 'TAM', usuario: 'tamanduaofc' },
  { time: 'CAP', usuario: 'esporte_clube_capivara' },
];
const daLiga: TimeId[] = [...GRUPOS_DA_A_DE_16.CHAO, ...GRUPOS_DA_A_DE_16.COPA];
const dados: DadosDoPerfilDoTime = { perfis, semPerfil: daLiga.filter((t) => !perfis.some((p) => p.time === t)) };

await gravarPerfilDoTime(dados, {
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
