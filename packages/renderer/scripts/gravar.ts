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
    /** Procura a partir de --seed a primeira Partida de Mata-mata decidida nos pênaltis. */
    penaltis: { type: 'boolean' },
    /** Partida com as regras da Temporada 2 (ADR-0019 a 0024). Com --vitrine, procura uma com falta, cartão, pênalti e barreira. */
    t2: { type: 'boolean' },
    vitrine: { type: 'boolean' },
    /** Na prévia, instantes extras em segundos, separados por vírgula. */
    instantes: { type: 'string' },
    /** Mata-mata (ADR-0048): semifinal ou final, com --temporada N e, se houver Séries, --serie A|B. */
    etapa: { type: 'string' },
    temporada: { type: 'string', default: '1' },
    serie: { type: 'string' },
  },
});

async function main(): Promise<void> {
  if (args.escudos) return exportarEscudos(resolve(process.cwd(), args.escudos));
  let partida: PartidaParaVideo;
  if (args.entrada) partida = JSON.parse(await readFile(resolve(process.cwd(), args.entrada), 'utf8')) as PartidaParaVideo;
  else if (args.penaltis) {
    let s = Number(args.seed ?? 1);
    do partida = partidaDeTeste(s++, args.mandante as TimeId, args.visitante as TimeId, args.subtitulo ?? 'Final', 'MATA_MATA');
    while (!partida.resultado.penaltis);
    console.log(`seed ${s - 1}: ${partida.resultado.gols.mandante}x${partida.resultado.gols.visitante}, pênaltis ${partida.resultado.penaltis.placar.mandante}x${partida.resultado.penaltis.placar.visitante}`);
  } else if (args.t2 && args.vitrine) {
    // A primeira Partida da T2 a partir de --seed com pênalti, chute direto, cartão e gol.
    let s = Number(args.seed ?? 1);
    const tem = (p: PartidaParaVideo) =>
      p.resultado.lances.some((l) => l.bolaParada === 'PENALTI') &&
      p.resultado.lances.some((l) => l.bolaParada === 'FALTA_DIRETA') &&
      p.resultado.lances.some((l) => l.falta?.cartao) &&
      p.resultado.lances.filter((l) => l.tipo === 'GOL').length >= 2;
    do partida = partidaDeTeste(s++, args.mandante as TimeId, args.visitante as TimeId, args.subtitulo, 'LIGA', true);
    while (!tem(partida));
    console.log(`seed ${s - 1}: ${partida.resultado.gols.mandante}x${partida.resultado.gols.visitante}`);
  } else if (args.seed) partida = partidaDeTeste(Number(args.seed), args.mandante as TimeId, args.visitante as TimeId, args.subtitulo, 'LIGA', !!args.t2);
  else throw new Error('informe --entrada partida.json, --seed N ou --escudos pasta');
  if (args.etapa) {
    const etapa = args.etapa.toUpperCase();
    if (etapa !== 'SEMIFINAL' && etapa !== 'FINAL') throw new Error('--etapa: semifinal ou final');
    if (!args.entrada && !args.penaltis) {
      // Mata-mata sem empate no fim: refaz no modo do Mata-mata (pênaltis se empatar).
      partida = partidaDeTeste(Number(args.seed ?? 1), args.mandante as TimeId, args.visitante as TimeId, args.subtitulo ?? (etapa === 'FINAL' ? 'Final, jogo das 18h' : 'Semifinal, jogo das 14h'), 'MATA_MATA');
    }
    partida.mataMata = { etapa, temporada: Number(args.temporada), serie: args.serie === 'A' || args.serie === 'B' ? args.serie : null };
  }
  await gravarReels(partida, {
    saida: resolve(process.cwd(), args.saida!),
    fps: Number(args.fps),
    crf: Number(args.crf),
    ...(args.previa ? { previa: resolve(process.cwd(), args.previa) } : {}),
    ...(args.instantes ? { instantes: args.instantes.split(',').map(Number) } : {}),
  });
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
