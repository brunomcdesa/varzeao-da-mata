/**
 * Linha de comando do gravador de Reels (a lógica fica em gravacao.ts).
 *
 *   pnpm gravar --entrada partida.json --saida reels.mp4
 *   pnpm gravar --seed 42 --mandante CAP --visitante ONC --saida reels.mp4   (Partida de teste)
 *   pnpm gravar --seed 42 --previa ./previa   (só os quadros-chave em JPEG, sem gerar vídeo)
 *   pnpm gravar --escudos ./times              (exporta os escudos dos Times em PNG)
 *
 * `partida.json` segue PartidaParaVideo (src/video.ts). Chaves de voz vêm do .env da raiz.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { TimeId } from '@liga/shared';
import type { PartidaParaVideo } from '../src/video.js';
import { exportarEscudos, gravarReels, partidaDeTeste } from './gravacao.js';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: vale o que estiver no ambiente */
}

const { values: args } = parseArgs({
  options: {
    entrada: { type: 'string' },
    seed: { type: 'string' },
    mandante: { type: 'string', default: 'CAP' },
    visitante: { type: 'string', default: 'ONC' },
    subtitulo: { type: 'string' },
    saida: { type: 'string', default: 'reels.mp4' },
    fps: { type: 'string', default: '30' },
    crf: { type: 'string', default: '20' },
    previa: { type: 'string' },
    escudos: { type: 'string' },
  },
});

async function main(): Promise<void> {
  if (args.escudos) return exportarEscudos(resolve(process.cwd(), args.escudos));
  let partida: PartidaParaVideo;
  if (args.entrada) partida = JSON.parse(await readFile(resolve(process.cwd(), args.entrada), 'utf8')) as PartidaParaVideo;
  else if (args.seed) partida = partidaDeTeste(Number(args.seed), args.mandante as TimeId, args.visitante as TimeId, args.subtitulo);
  else throw new Error('informe --entrada partida.json, --seed N ou --escudos pasta');
  await gravarReels(partida, {
    saida: resolve(process.cwd(), args.saida!),
    fps: Number(args.fps),
    crf: Number(args.crf),
    ...(args.previa ? { previa: resolve(process.cwd(), args.previa) } : {}),
  });
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
