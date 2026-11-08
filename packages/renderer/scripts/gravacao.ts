/**
 * Gravação do Reels de uma Partida em MP4 1080×1920, no formato que a API do Instagram aceita
 * (H.264, GOP fechado, yuv420p, AAC 48 kHz, moov no início). Usada pela linha de comando
 * (`pnpm gravar`, em gravar.ts) e pelo worker (job `partida`).
 *
 * Precisa de ffmpeg no PATH e do Chromium do Playwright (`pnpm exec playwright install chromium`).
 * A voz do Locutor vem de scripts/locutor.ts (Gemini, Azure, espeak ou mudo).
 */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { IDENTIDADE, TIMES, habilidadesDoPerfil, type Escalacao, type Posicao, type TimeId } from '@liga/shared';
import { criarRng, simularPartida } from '@liga/sim';
import type { PartidaParaVideo } from '../src/video.js';
import { Roteiro, type OpcoesRoteiro } from '../src/roteiro.js';
import { Timeline } from '../src/timeline.js';
import { exigenciasDaNarracao, montarEventos, montarNarracao } from '../src/narracao.js';
import { TAXA, agendarFalas, codificarWav, lerWavMono, mixar, mixarAoVivo, type VozNaMixagem } from '../src/audio.js';
import { agendarAoVivo, duracaoAoVivo, eventosAoVivo, roteiroAoVivo } from '../src/aoVivo.js';
import { criarLocutor } from './locutor.js';
import type { VarzeaApi } from '../video/api.js';
import { RoteiroResumo, narracaoDoResumo, type DadosDoResumo } from '../src/resumo.js';
import { RoteiroApresentacao, narracaoDaApresentacao, type DadosDaApresentacao } from '../src/apresentacao.js';
import type { Fala } from '../src/narracao.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface OpcoesGravacao {
  /** Arquivo MP4 de saída. */
  saida: string;
  fps?: number;
  /** Qualidade do H.264 (menor = melhor). */
  crf?: number;
  /** Em vez do MP4, salva só os quadros-chave em JPEG nesta pasta (sem áudio). */
  previa?: string;
  /** Na prévia, também estes instantes (segundos de vídeo). */
  instantes?: number[];
}

/** Mesma montagem da página de Replay: Escalações sorteadas a partir do seed. */
export function partidaDeTeste(seed: number, mandante: TimeId, visitante: TimeId, subtitulo?: string, fase: 'LIGA' | 'MATA_MATA' = 'LIGA'): PartidaParaVideo {
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
        { const ovr = 64 + rng.int(13); return { jogadorId: `${time}-${i}`, posicao, ovr, habilidades: habilidadesDoPerfil(posicao, ovr) }; }
      }),
    };
    return { esc, nomes };
  };
  const a = montar(mandante, seed * 7 + 1);
  const b = montar(visitante, seed * 7 + 2);
  const resultado = simularPartida({ mandante: a.esc, visitante: b.esc, seed, fase });
  return {
    resultado,
    escalacoes: { mandante: a.esc, visitante: b.esc },
    nomes: { mandante: a.nomes, visitante: b.nomes },
    ...(subtitulo ? { subtitulo } : {}),
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
  const vozes = await sintetizar(falasBase);
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

function abrirFfmpeg(audio: string, saida: string, fps: number, crf: number): { stdin: NodeJS.WritableStream; fim: Promise<void> } {
  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
      '-i', audio,
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p',
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

/** Captura os quadros da página e monta o MP4 com o áudio. */
async function codificar(pagina: import('playwright').Page, totalQuadros: number, audio: string, saida: string, fps: number, crf: number): Promise<void> {
  const ff = abrirFfmpeg(audio, saida, fps, crf);
  const LOTE = 15;
  for (let n = 0; n < totalQuadros; n += LOTE) {
    const quantos = Math.min(LOTE, totalQuadros - n);
    const jpegs = await pagina.evaluate(([i, q]) => window.varzea.capturar(i, q), [n, quantos] as const);
    for (const b64 of jpegs) await escrever(ff.stdin, Buffer.from(b64, 'base64'));
    if (process.stdout.isTTY) process.stdout.write(`\r  ${Math.min(n + quantos, totalQuadros)}/${totalQuadros} quadros`);
  }
  ff.stdin.end();
  await ff.fim;
  if (process.stdout.isTTY) process.stdout.write('\n');
}

/** Sintetiza as falas pelo Locutor e devolve as amostras de cada uma (48 kHz mono). */
async function sintetizar(falas: Fala[]): Promise<Map<string, Float32Array>> {
  const locutor = criarLocutor(join(raiz, '.cache/locutor'));
  if (locutor.modo === 'espeak') console.warn('  Sem chave de voz: usando a voz de teste do espeak-ng.');
  if (locutor.modo === 'mudo') console.warn('  Sem chave de voz nem espeak-ng: o vídeo sai sem a voz do Locutor.');
  const wavs = await locutor.falarTodas(falas, (feitas) => {
    if (process.stdout.isTTY) process.stdout.write(`\r  voz ${feitas}/${falas.length}   `);
  });
  if (process.stdout.isTTY) process.stdout.write('\r');
  const vozes = new Map<string, Float32Array>();
  falas.forEach((f, i) => {
    const { amostras, taxa } = lerWavMono(wavs[i]!);
    if (taxa !== TAXA) throw new Error(`voz em ${taxa} Hz; esperado ${TAXA}`);
    vozes.set(f.id, amostras);
  });
  return vozes;
}

/**
 * Grava o Reels do Resumo da Rodada: cartelas de placares, tabela, Novos Contratados,
 * Candidatos a Craque e a chamada. Cada cartela estica até a fala do Locutor caber.
 */
export async function gravarResumo(dados: DadosDoResumo, o: OpcoesGravacao): Promise<{ duracao: number }> {
  const inicio = performance.now();
  const fps = o.fps ?? 30;
  const crf = o.crf ?? 20;
  await mkdir(dirname(o.saida), { recursive: true });
  const dir = await mkdtemp(join(tmpdir(), 'varzea-resumo-'));
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
    pagina.on('pageerror', (e) => console.error('[página]', e.message));
    await pagina.goto(await montarPagina(dir));

    let minimos: Record<number, { antes?: number }> = {};
    let audio: string | null = null;
    if (!o.previa) {
      console.log('Locução:');
      const base = new RoteiroResumo(dados);
      const falasBase = narracaoDoResumo(base);
      const vozes = await sintetizar(falasBase);
      const duracao = (id: string) => vozes.get(id)!.length / TAXA;
      minimos = exigenciasDaNarracao(base, falasBase, duracao);
      const roteiro = new RoteiroResumo(dados, minimos);
      const falas = narracaoDoResumo(roteiro);
      const naMixagem: VozNaMixagem[] = agendarFalas(falas, duracao).map((a) => {
        console.log(`  ${a.inicio.toFixed(1).padStart(5)} s  ${falas.find((x) => x.id === a.id)!.texto}`);
        return { inicio: a.inicio, amostras: vozes.get(a.id)! };
      });
      const { esq, dir: direita } = mixar({ duracao: roteiro.duracao, segmentos: roteiro.segmentos, eventos: [{ tipo: 'APITO_FINAL', t: 0.1 }], vozes: naMixagem });
      audio = join(dir, 'audio.wav');
      await writeFile(audio, codificarWav(esq, direita));
    }
    const { duracao, totalQuadros } = await pagina.evaluate(([d, m, f]) => window.varzea.prepararResumo(d, m, f), [dados, minimos, fps] as const);
    console.log(`Resumo da Rodada ${dados.rodada} · ${duracao.toFixed(1)} s · ${totalQuadros} quadros a ${fps} fps`);
    if (o.previa) {
      await gravarPrevia(pagina, o.previa, fps);
      return { duracao };
    }
    await codificar(pagina, totalQuadros, audio!, o.saida, fps, crf);
    console.log(`Pronto: ${o.saida} (${((performance.now() - inicio) / 1000).toFixed(1)} s)`);
    return { duracao };
  } finally {
    await navegador.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/** Grava o Reels de apresentação da Liga (o primeiro post do perfil). */
export async function gravarApresentacao(dados: DadosDaApresentacao, o: OpcoesGravacao): Promise<{ duracao: number }> {
  const inicio = performance.now();
  const fps = o.fps ?? 30;
  const crf = o.crf ?? 20;
  await mkdir(dirname(o.saida), { recursive: true });
  const dir = await mkdtemp(join(tmpdir(), 'varzea-apresentacao-'));
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
    pagina.on('pageerror', (e) => console.error('[página]', e.message));
    await pagina.goto(await montarPagina(dir));

    let minimos: Record<number, { antes?: number }> = {};
    let audio: string | null = null;
    if (!o.previa) {
      console.log('Locução:');
      const base = new RoteiroApresentacao(dados);
      const falasBase = narracaoDaApresentacao(base);
      const vozes = await sintetizar(falasBase);
      const duracao = (id: string) => vozes.get(id)!.length / TAXA;
      minimos = exigenciasDaNarracao(base, falasBase, duracao);
      const roteiro = new RoteiroApresentacao(dados, minimos);
      const falas = narracaoDaApresentacao(roteiro);
      const naMixagem: VozNaMixagem[] = agendarFalas(falas, duracao).map((a) => {
        console.log(`  ${a.inicio.toFixed(1).padStart(5)} s  ${falas.find((x) => x.id === a.id)!.texto}`);
        return { inicio: a.inicio, amostras: vozes.get(a.id)! };
      });
      const { esq, dir: direita } = mixar({ duracao: roteiro.duracao, segmentos: roteiro.segmentos, eventos: [{ tipo: 'APITO_FINAL', t: 0.1 }, { tipo: 'APITO_FINAL', t: roteiro.duracao - 1.2 }], vozes: naMixagem });
      audio = join(dir, 'audio.wav');
      await writeFile(audio, codificarWav(esq, direita));
    }
    const { duracao, totalQuadros } = await pagina.evaluate(([d, m, f]) => window.varzea.prepararApresentacao(d, m, f), [dados, minimos, fps] as const);
    console.log(`Apresentação da Liga · ${duracao.toFixed(1)} s · ${totalQuadros} quadros a ${fps} fps`);
    if (o.previa) {
      await gravarPrevia(pagina, o.previa, fps, o.instantes);
      return { duracao };
    }
    await codificar(pagina, totalQuadros, audio!, o.saida, fps, crf);
    console.log(`Pronto: ${o.saida} (${((performance.now() - inicio) / 1000).toFixed(1)} s)`);
    return { duracao };
  } finally {
    await navegador.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Grava o Reels da Partida. Devolve a duração do vídeo (s). Não altera `partida`.
 */
export async function gravarReels(partidaOriginal: PartidaParaVideo, o: OpcoesGravacao): Promise<{ duracao: number }> {
  const inicio = performance.now();
  const fps = o.fps ?? 30;
  const crf = o.crf ?? 20;
  const partida: PartidaParaVideo = { ...partidaOriginal };
  await mkdir(dirname(o.saida), { recursive: true });
  const dir = await mkdtemp(join(tmpdir(), 'varzea-video-'));
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
    pagina.on('pageerror', (e) => console.error('[página]', e.message));
    await pagina.goto(await montarPagina(dir));

    // O áudio vem primeiro: a duração das falas define quanto cada trecho do vídeo dura.
    let audio: string | null = null;
    if (!o.previa) {
      console.log('Locução:');
      const montado = await montarAudio(partida, dir);
      audio = montado.arquivo;
      partida.roteiro = montado.roteiro;
    }
    const { duracao, totalQuadros } = await pagina.evaluate(([d, f]) => window.varzea.preparar(d, f), [partida, fps] as const);
    // Capa do Reels ao lado do vídeo: reels.mp4 → reels-capa.jpg (o job sobe as duas).
    const capa = Buffer.from(await pagina.evaluate(() => window.varzea.capa()), 'base64');
    if (o.previa) await mkdir(o.previa, { recursive: true }).then(() => writeFile(join(o.previa!, 'capa.jpg'), capa));
    else await writeFile(o.saida.replace(/\.mp4$/, '-capa.jpg'), capa);

    const r = partida.resultado;
    console.log(
      `${IDENTIDADE[r.times.mandante].sigla} ${r.gols.mandante} × ${r.gols.visitante} ${IDENTIDADE[r.times.visitante].sigla}` +
        ` · ${duracao.toFixed(1)} s · ${totalQuadros} quadros a ${fps} fps`,
    );

    if (o.previa) {
      await gravarPrevia(pagina, o.previa, fps);
      return { duracao };
    }

    await codificar(pagina, totalQuadros, audio!, o.saida, fps, crf);
    console.log(`Pronto: ${o.saida} (${((performance.now() - inicio) / 1000).toFixed(1)} s)`);
    return { duracao };
  } finally {
    await navegador.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Narração do Ao Vivo do site: o jogo inteiro narrado, no tempo do Ao Vivo, com a torcida
 * por baixo. Mesma voz do Reels (e o mesmo cache de falas). Grava um .m4a em `saida`.
 */
export async function gravarNarracaoAoVivo(partida: PartidaParaVideo, saida: string): Promise<{ duracao: number; falas: number }> {
  const inicio = performance.now();
  const timeline = new Timeline(partida.resultado, partida.escalacoes);
  const falas = roteiroAoVivo(timeline);
  // Em lotes: um pedido só com o jogo inteiro ficaria longo demais para recortar.
  const vozes = new Map<string, Float32Array>();
  for (let i = 0; i < falas.length; i += 20) {
    const lote = falas.slice(i, i + 20).map((f) => ({ id: f.id, texto: f.texto, tom: f.tom }) as Fala);
    for (const [id, a] of await sintetizar(lote)) vozes.set(id, a);
  }
  const duracaoFala = (id: string) => vozes.get(id)!.length / TAXA;
  const agenda = agendarAoVivo(falas, duracaoFala);
  const ultima = agenda.reduce((m, a) => Math.max(m, a.inicio + duracaoFala(a.id)), 0);
  const duracao = Math.max(duracaoAoVivo(timeline), ultima) + 1.5;
  const falando = agenda.reduce((s, a) => s + duracaoFala(a.id), 0);
  console.log(`  Ao Vivo: ${agenda.length} de ${falas.length} falas, ${Math.round((100 * falando) / duracaoAoVivo(timeline))}% do tempo com voz.`);
  const { esq, dir } = mixarAoVivo({ duracao, eventos: eventosAoVivo(timeline), vozes: agenda.map((a) => ({ inicio: a.inicio, amostras: vozes.get(a.id)! })) });
  const pasta = await mkdtemp(join(tmpdir(), 'varzea-aovivo-'));
  try {
    const wav = join(pasta, 'aovivo.wav');
    await writeFile(wav, codificarWav(esq, dir));
    await mkdir(dirname(saida), { recursive: true });
    await new Promise<void>((ok, erro) => {
      const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', saida], { stdio: 'inherit' });
      ff.on('error', erro);
      ff.on('close', (c) => (c === 0 ? ok() : erro(new Error(`ffmpeg saiu com código ${c}`))));
    });
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
  console.log(`Narração do Ao Vivo: ${saida} (${duracao.toFixed(0)} s de áudio, ${((performance.now() - inicio) / 1000).toFixed(1)} s)`);
  return { duracao, falas: agenda.length };
}

export async function exportarEscudos(dir: string): Promise<void> {
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
/** A página de gravação expõe `window.varzea` (contrato em video/api.ts). */
export type { VarzeaApi };

async function gravarPrevia(pagina: import('playwright').Page, dir: string, fps: number, instantes: number[] = []): Promise<void> {
  await mkdir(dir, { recursive: true });
  const segs = await pagina.evaluate(() => window.varzea.segmentos());
  const momentos: [string, number][] = [];
  segs.forEach((s, i) => {
    const em = (f: number) => Math.floor((s.inicio + (s.fim - s.inicio) * f) * fps);
    if (s.tipo === 'ABERTURA') momentos.push(['00-abertura', em(0.6)]);
    else if (s.tipo === 'PENALTIS') for (const f of [0.05, 0.17, 0.24, 0.3, 0.52, 0.97]) momentos.push([`${String(i).padStart(2, '0')}-penaltis-${Math.round(f * 100)}`, em(f)]);
    else if (s.tipo !== 'LANCE' && s.tipo !== 'FIM') momentos.push([`${String(i).padStart(2, '0')}-${s.tipo.toLowerCase()}`, em(0.85)]);
    else if (s.tipo === 'FIM') momentos.push([`${String(i).padStart(2, '0')}-fim`, em(0.75)]);
    else {
      const r = s.resolucao ?? s.inicio;
      momentos.push([`${String(i).padStart(2, '0')}-lance-a`, Math.floor((s.inicio + (r - s.inicio) * 0.6) * fps)]);
      momentos.push([`${String(i).padStart(2, '0')}-lance-b`, Math.floor((r + (s.fim - r) * 0.45) * fps)]);
    }
  });
  for (const t of instantes) momentos.push([`t-${t.toFixed(1).padStart(5, '0')}`, Math.floor(t * fps)]);
  for (const [nome, n] of momentos) {
    const [jpeg] = await pagina.evaluate(([q]) => window.varzea.capturar(q, 1, 0.95), [n] as const);
    await writeFile(join(dir, `${nome}.jpg`), Buffer.from(jpeg!, 'base64'));
  }
  console.log(`Prévia: ${momentos.length} quadros em ${dir}`);
}
