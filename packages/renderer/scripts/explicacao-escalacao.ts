/**
 * Grava o Reels que explica a Escalação (rodízio por Posição) com os Elencos do momento:
 *
 *   pnpm explicacao-escalacao --previa ./previa
 *   pnpm explicacao-escalacao --saida ~/Vídeos/escalacao.mp4
 *   pnpm explicacao-escalacao --jogadores ./jogadores.json --situacao 2026-11-10T19:51-03:00
 *
 * Os números vêm do jogadores.json do site: por padrão de LIGA_EDGE_URL/dados (no .env da
 * raiz), ou de um arquivo/URL em --jogadores. Rode logo antes de publicar: o vídeo mostra
 * "situação em <dia> às <hora>". A voz vem do Gemini (GEMINI_API_KEY); sem chave, sai muda.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { TIMES, TIMES_FUNDADORES, type Posicao, type TimeId } from '@liga/shared';
import { contarElencos, exemploPadrao, type DadosDaExplicacao } from '../src/explicacaoEscalacao.js';
import { gravarExplicacao } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    jogadores: { type: 'string' },
    situacao: { type: 'string' },
    exemplo: { type: 'string' },
    temporada: { type: 'string', default: '1' },
    saida: { type: 'string', default: 'explicacao-escalacao.mp4' },
    previa: { type: 'string' },
    instantes: { type: 'string' },
    crf: { type: 'string', default: '18' },
  },
});

const base = process.env.INIT_CWD ?? process.cwd();
const origem = args.jogadores ?? (process.env.LIGA_EDGE_URL ? `${process.env.LIGA_EDGE_URL.replace(/\/$/, '')}/dados/jogadores.json` : null);
if (!origem) {
  console.error('Passe --jogadores <arquivo ou URL do jogadores.json> ou defina LIGA_EDGE_URL no .env.');
  process.exit(1);
}
const jogadores = (
  /^https?:/.test(origem) ? await fetch(origem, { cache: 'no-store' }).then((r) => r.json()) : JSON.parse(await readFile(resolve(base, origem), 'utf8'))
) as { time: TimeId; posicao: Posicao }[];

const temporada = Number(args.temporada);
const times = temporada >= 2 ? [...TIMES] : [...TIMES_FUNDADORES];
const elencos = contarElencos(jogadores, times);
const exemplo = (args.exemplo?.toUpperCase() as TimeId | undefined) ?? exemploPadrao(elencos);
if (!elencos[exemplo]) {
  console.error(`Time do exemplo desconhecido: ${exemplo}`);
  process.exit(1);
}
const dados: DadosDaExplicacao = { temporada, rodadas: 7, situacaoEm: new Date(args.situacao ?? Date.now()).toISOString(), elencos, exemplo };
console.log(`Elencos (${jogadores.length} Jogadores), exemplo: ${exemplo}`);
for (const t of times) console.log(`  ${t}  GOL ${elencos[t].GOL}  ZAG ${elencos[t].ZAG}  MEI ${elencos[t].MEI}  ATA ${elencos[t].ATA}`);

await gravarExplicacao(dados, {
  saida: resolve(base, args.saida!),
  crf: Number(args.crf),
  ...(args.previa ? { previa: resolve(base, args.previa) } : {}),
  ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
});
