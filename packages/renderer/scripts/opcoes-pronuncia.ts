/** Grava a mesma frase com grafias diferentes (um pedido só) para escolher de ouvido. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { MODELO_PADRAO, VOZ_PADRAO, falarVariasGemini } from './gemini.js';

process.env.SEM_GRAFIA = '1';
const GRAFIAS = ['Varzeão', 'Varzêão', 'Var-zeão', 'Varzião'];
const NUMEROS = ['um', 'dois', 'três', 'quatro'];
const pasta = resolve(process.argv[2] ?? 'opcoes');
await mkdir(pasta, { recursive: true });
const falas = GRAFIAS.map((g, i) => ({ texto: `Opção ${NUMEROS[i]}: Novidade no ${g} da Mata!`, tom: 'animado' as const }));
const wavs = await falarVariasGemini(falas, process.env.GEMINI_API_KEY!, process.env.VOZ || VOZ_PADRAO, process.env.MODELO || MODELO_PADRAO);
if (!wavs) throw new Error('não consegui recortar o lote');
const partes = wavs.map((w, i) => join(pasta, `${i}.wav`));
for (const [i, w] of wavs.entries()) await writeFile(partes[i]!, w);
const filtro = partes.map((_, i) => `[${i}:a]apad=pad_dur=0.8[a${i}]`).join(';') + ';' + partes.map((_, i) => `[a${i}]`).join('') + `concat=n=${partes.length}:v=0:a=1[s]`;
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...partes.flatMap((p) => ['-i', p]), '-filter_complex', filtro, '-map', '[s]', '-c:a', 'libmp3lame', '-b:a', '128k', join(pasta, 'opcoes-varzeao.mp3')], { stdio: 'inherit' });
console.log('ok', GRAFIAS.join(' | '));
