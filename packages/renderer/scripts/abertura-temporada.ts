/**
 * Grava o Reels de Abertura de uma Temporada nova:
 *
 *   pnpm abertura-temporada --estreia 2026-11-19                  (sai em abertura-temporada.mp4)
 *   pnpm abertura-temporada --estreia 2026-11-19 --previa ./previa (só quadros-chave em JPEG)
 *
 * A voz vem do Gemini (GEMINI_API_KEY no .env da raiz); sem chave, sai sem narração.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DADOS_DA_ABERTURA_T2, dadosDaAberturaT3 } from '../src/aberturaTemporada.js';
import { gravarAberturaDaTemporada } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    estreia: { type: 'string', default: '2026-11-19' },
    saida: { type: 'string', default: 'abertura-temporada.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
    /** T3 (ADR-0088): o 1º dia da Copa é --estreia; a Rodada 1 da Liga é --liga. Séries de exemplo. */
    t3: { type: 'boolean', default: false },
    liga: { type: 'string' },
  },
});

if (!/^\d{4}-\d{2}-\d{2}$/.test(args.estreia!)) {
  console.error('Use --estreia AAAA-MM-DD (o dia da Rodada 1).');
  process.exit(1);
}
const base = process.env.INIT_CWD ?? process.cwd();
await gravarAberturaDaTemporada(
  args.t3
    ? dadosDaAberturaT3({ serieA: ['CAP', 'ONC', 'TAT', 'JAC', 'PRE', 'SAG', 'ARA', 'BOT'], serieB: ['TAM', 'SUC', 'LOB', 'LEA', 'TUC', 'COR', 'BES', 'TAR'], estreia: args.estreia!, estreiaDaLiga: args.liga ?? args.estreia! })
    : { ...DADOS_DA_ABERTURA_T2, estreia: args.estreia! },
  { saida: resolve(base, args.saida!), crf: Number(args.crf), ...(args.previa ? { previa: resolve(base, args.previa) } : {}), ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}) },
);
