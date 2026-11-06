/**
 * Grava o Reels de uma Partida em MP4 1080×1920, no formato que a API do Instagram aceita
 * (H.264, GOP fechado, yuv420p, AAC 48 kHz, moov no início).
 *
 *   pnpm gravar --entrada partida.json --saida reels.mp4
 *   pnpm gravar --seed 42 --mandante CAP --visitante ONC --saida reels.mp4   (Partida de teste)
 *   pnpm gravar --seed 42 --previa ./previa   (só os quadros-chave em JPEG, sem gerar vídeo)
 *   pnpm gravar --escudos ./times              (exporta os escudos dos Times em PNG)
 *
 * `partida.json` segue PartidaParaVideo (src/video.ts). Precisa de ffmpeg no PATH e do
 * Chromium do Playwright (`pnpm exec playwright install chromium`).
 *
 * O áudio tem narração do Locutor (Azure Speech, veja scripts/locutor.ts), trilha chiptune,
 * torcida, apitos e chutes. Sem AZURE_SPEECH_KEY, sai tudo menos a voz.
 */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { IDENTIDADE, TIMES, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, simularPartida } from '@liga/sim';
import type { PartidaParaVideo } from '../src/video.js';
import { Roteiro, type OpcoesRoteiro } from '../src/roteiro.js';
import { Timeline } from '../src/timeline.js';
import { exigenciasDaNarracao, montarEventos, montarNarracao } from '../src/narracao.js';
import { TAXA, agendarFalas, codificarWav, lerWavMono, mixar, type VozNaMixagem } from '../src/audio.js';
import { criarLocutor } from './locutor.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Lê AZURE_SPEECH_* do .env na raiz do repositório, se existir (o .env não vai para o git).
try {
  process.loadEnvFile(resolve(raiz, '../../.env'));
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

const fps = Number(args.fps);
const saida = resolve(process.cwd(), args.saida!);

async function carregarPartida(): Promise<PartidaParaVideo> {
  if (args.entrada) return JSON.parse(await readFile(resolve(process.cwd(), args.entrada), 'utf8')) as PartidaParaVideo;
  if (!args.seed) throw new Error('informe --entrada partida.json, --seed N ou --escudos pasta');
  return partidaDeTeste(Number(args.seed), args.mandante as TimeId, args.visitante as TimeId);
}

/** Mesma montagem da página de Replay: Escalações sorteadas a partir do seed. */
function partidaDeTeste(seed: number, mandante: TimeId, visitante: TimeId): PartidaParaVideo {
  for (const t of [mandante, visitante]) if (!TIMES.includes(t)) throw new Error(`Time desconhecido: ${t} (use ${TIMES.join(', ')})`);
  const ORDEM: Posicao[] = ['GOL', 'ZAG', 'ZAG', 'MEI', 'MEI', 'ATA', 'ATA'];
  const APELIDOS = ['rafa', 'bia', 'duda', 'leo', 'malu', 'gui', 'nanda', 'pedrinho', 'lari', 'thiago', 'carol', 'vini', 'ju', 'digo'];
  const montar = (time: TimeId, s: number) => {
    const rng = criarRng(s);
    const usados = new Set<string>();
    const nomes: string[] = [];
    const esc: Escalacao = {
      time,
      jogadores: ORDEM.map((posicao, i) => {
        let a = rng.pick(APELIDOS);
        while (usados.has(a)) a = rng.pick(APELIDOS);
        usados.add(a);
        nomes.push(`@${a}_${IDENTIDADE[time].bicho}`);
        return { jogadorId: `${time}-${i}`, posicao, ovr: 64 + rng.int(13) };
      }),
    };
    return { esc, nomes };
  };
  const a = montar(mandante, seed * 7 + 1);
  const b = montar(visitante, seed * 7 + 2);
  const resultado = simularPartida({ mandante: a.esc, visitante: b.esc, seed, fase: 'LIGA' });
  return {
    resultado,
    escalacoes: { mandante: a.esc, visitante: b.esc },
    nomes: { mandante: a.nomes, visitante: b.nomes },
    ...(args.subtitulo ? { subtitulo: args.subtitulo } : {}),
  };
}

async function montarPagina(dir: string): Promise<string> {
  await build({
    entryPoints: [join(raiz, 'video/main.ts')],
    outfile: join(dir, 'main.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
    loader: { '.woff2': 'dataurl', '.png': 'dataurl' },
    logLevel: 'warning',
  });
  await copyFile(join(raiz, 'video/index.html'), join(dir, 'index.html'));
  return pathToFileURL(join(dir, 'index.html')).href;
}

/**
 * Narração + trilha + efeitos. Primeiro sintetiza as falas e mede cada uma; depois estica
 * os trechos do Roteiro para todas caberem inteiras (exigenciasDaNarracao) e mixa.
 * Devolve o WAV e as opções do Roteiro esticado, que a página de gravação também usa.
 */
async function montarAudio(partida: PartidaParaVideo, dir: string): Promise<{ arquivo: string; roteiro: OpcoesRoteiro }> {
  const timeline = new Timeline(partida.resultado, partida.escalacoes);
  const base = new Roteiro(timeline, partida.roteiro);
  const falasBase = montarNarracao(base);
  const locutor = criarLocutor(join(raiz, '.cache/locutor'));
  if (locutor.modo === 'espeak') console.warn('  Sem chave do Azure: usando a voz de teste do espeak-ng.');
  if (locutor.modo === 'mudo') console.warn('  Sem chave do Azure nem espeak-ng: o vídeo sai sem a voz do Locutor.');

  const vozes = new Map<string, Float32Array>();
  for (const [i, f] of falasBase.entries()) {
    if (process.stdout.isTTY) process.stdout.write(`\r  voz ${i + 1}/${falasBase.length}   `);
    const { amostras, taxa } = lerWavMono(await locutor.falar(f.texto, f.tom));
    if (taxa !== TAXA) throw new Error(`voz em ${taxa} Hz; esperado ${TAXA}`);
    vozes.set(f.id, amostras);
  }
  if (process.stdout.isTTY) process.stdout.write('\r');
  const duracao = (id: string) => vozes.get(id)!.length / TAXA;
  const opcoes: OpcoesRoteiro = { ...partida.roteiro, minimos: exigenciasDaNarracao(base, falasBase, duracao) };
  const roteiro = new Roteiro(timeline, opcoes);
  const falas = montarNarracao(roteiro);

  const naMixagem: VozNaMixagem[] = [];
  for (const a of agendarFalas(falas, duracao)) {
    naMixagem.push({ inicio: a.inicio, amostras: vozes.get(a.id)! });
    console.log(`  ${a.inicio.toFixed(1).padStart(5)} s  ${falas.find((x) => x.id === a.id)!.texto}`);
  }
  if (roteiro.duracao > base.duracao + 0.05) console.log(`  Vídeo esticado de ${base.duracao.toFixed(1)} s para ${roteiro.duracao.toFixed(1)} s para as falas caberem.`);
  const { esq, dir: direita } = mixar({ duracao: roteiro.duracao, segmentos: roteiro.segmentos, eventos: montarEventos(roteiro), vozes: naMixagem });
  const arquivo = join(dir, 'audio.wav');
  await writeFile(arquivo, codificarWav(esq, direita));
  return { arquivo, roteiro: opcoes };
}

function abrirFfmpeg(audio: string): { stdin: NodeJS.WritableStream; fim: Promise<void> } {
  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
      '-i', audio,
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', args.crf!, '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-r', String(fps), '-g', String(fps * 2), '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
      '-movflags', '+faststart',
      saida,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const fim = new Promise<void>((ok, erro) => {
    ff.on('error', (e) => erro(new Error(`não consegui rodar o ffmpeg (${e.message}). Instale com: sudo apt install ffmpeg`)));
    ff.on('close', (codigo) => (codigo === 0 ? ok() : erro(new Error(`ffmpeg saiu com código ${codigo}`))));
  });
  return { stdin: ff.stdin, fim };
}

const escrever = (s: NodeJS.WritableStream, buf: Buffer) =>
  new Promise<void>((ok) => (s.write(buf) ? ok() : s.once('drain', () => ok())));

async function main(): Promise<void> {
  const inicio = performance.now();
  if (args.escudos) return exportarEscudos(resolve(process.cwd(), args.escudos));
  const partida = await carregarPartida();
  const dir = await mkdtemp(join(tmpdir(), 'varzea-video-'));
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
    pagina.on('pageerror', (e) => console.error('[página]', e.message));
    await pagina.goto(await montarPagina(dir));

    // O áudio vem primeiro: a duração das falas define quanto cada trecho do vídeo dura.
    let audio: string | null = null;
    if (!args.previa) {
      console.log('Locução:');
      const montado = await montarAudio(partida, dir);
      audio = montado.arquivo;
      partida.roteiro = montado.roteiro;
    }
    const { duracao, totalQuadros } = await pagina.evaluate(([d, f]) => window.varzea.preparar(d, f), [partida, fps] as const);

    const r = partida.resultado;
    console.log(
      `${IDENTIDADE[r.times.mandante].sigla} ${r.gols.mandante} × ${r.gols.visitante} ${IDENTIDADE[r.times.visitante].sigla}` +
        ` · ${duracao.toFixed(1)} s · ${totalQuadros} quadros a ${fps} fps`,
    );

    if (args.previa) {
      await gravarPrevia(pagina, resolve(process.cwd(), args.previa));
      return;
    }

    const ff = abrirFfmpeg(audio!);
    const LOTE = 15;
    for (let n = 0; n < totalQuadros; n += LOTE) {
      const quantos = Math.min(LOTE, totalQuadros - n);
      const jpegs = await pagina.evaluate(([i, q]) => window.varzea.capturar(i, q), [n, quantos] as const);
      for (const b64 of jpegs) await escrever(ff.stdin, Buffer.from(b64, 'base64'));
      if (process.stdout.isTTY) process.stdout.write(`\r  ${Math.min(n + quantos, totalQuadros)}/${totalQuadros} quadros`);
    }
    ff.stdin.end();
    await ff.fim;
    console.log(`\nPronto: ${saida} (${((performance.now() - inicio) / 1000).toFixed(1)} s)`);
  } finally {
    await navegador.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function exportarEscudos(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const tmp = await mkdtemp(join(tmpdir(), 'varzea-escudos-'));
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage();
    await pagina.goto(await montarPagina(tmp));
    const times = await pagina.evaluate(() => window.varzea.times());
    for (const t of times) {
      const png = await pagina.evaluate(([time]) => window.varzea.escudoPng(time, 40), [t] as const);
      await writeFile(join(dir, `${t.toLowerCase()}.png`), Buffer.from(png, 'base64'));
    }
    console.log(`Escudos: ${times.length} PNGs (800×960) em ${dir}`);
  } finally {
    await navegador.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

/** Um quadro de cada momento: abertura, cada lance (logo depois da resolução) e fim. */
async function gravarPrevia(pagina: import('playwright').Page, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const segs = await pagina.evaluate(() => window.varzea.segmentos());
  const momentos: [string, number][] = [];
  segs.forEach((s, i) => {
    const em = (f: number) => Math.floor((s.inicio + (s.fim - s.inicio) * f) * fps);
    if (s.tipo === 'ABERTURA') momentos.push(['00-abertura', em(0.6)]);
    else if (s.tipo === 'FIM') momentos.push([`${String(i).padStart(2, '0')}-fim`, em(0.75)]);
    else {
      const r = s.resolucao ?? s.inicio;
      momentos.push([`${String(i).padStart(2, '0')}-lance-a`, Math.floor((s.inicio + (r - s.inicio) * 0.6) * fps)]);
      momentos.push([`${String(i).padStart(2, '0')}-lance-b`, Math.floor((r + (s.fim - r) * 0.45) * fps)]);
    }
  });
  for (const [nome, n] of momentos) {
    const [jpeg] = await pagina.evaluate(([q]) => window.varzea.capturar(q, 1, 0.95), [n] as const);
    await writeFile(join(dir, `${nome}.jpg`), Buffer.from(jpeg!, 'base64'));
  }
  console.log(`Prévia: ${momentos.length} quadros em ${dir}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
