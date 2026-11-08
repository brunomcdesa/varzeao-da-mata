/**
 * Cria os candidatos a Narrador no Voice design do Gemini e grava amostras para ouvir.
 *
 *   pnpm --filter @liga/renderer narradores [pasta]   (precisa de GEMINI_API_KEY)
 *
 * Cada candidato vira uma voz guardada no projeto (id voice_..., vale 1 ano). Na pasta saem
 * <nome>.mp3 (a prévia do Voice design + as falas de teste) e narradores.json com os ids.
 * Os ids não são segredo: os escolhidos vão para src/narradores.ts.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { MODELO_PADRAO, falarGemini } from './gemini.js';
import type { Tom } from '../src/narracao.js';

interface Candidato {
  nome: string;
  genero: 'male' | 'female';
  persona: string;
}

// Uma ou duas frases, sem contradição (recomendação da Google para a voz ficar estável).
const CANDIDATOS: Candidato[] = [
  { nome: 'Seu Dito', genero: 'male', persona: 'Locutor esportivo brasileiro veterano de rádio AM, homem de uns 60 anos, voz grave e encorpada, sotaque paulista, dicção clássica e ritmo firme.' },
  { nome: 'Tiago Turbo', genero: 'male', persona: 'Narrador esportivo brasileiro jovem, homem de uns 25 anos, voz média e brilhante, sotaque carioca, fala rápida e cheia de energia.' },
  { nome: 'Zé da Várzea', genero: 'male', persona: 'Locutor de futebol de várzea brasileiro, homem de uns 45 anos, voz rouca e calorosa, sotaque do interior de Minas Gerais, bem-humorado como quem narra no alto-falante do campinho.' },
  { nome: 'Rita Rádio', genero: 'female', persona: 'Narradora esportiva brasileira, mulher de uns 35 anos, voz média-grave e firme, sotaque nordestino suave, entusiasmada e precisa.' },
];

const FALAS: { texto: string; tom: Tom }[] = [
  { texto: 'Bola rolando no Varzeão da Mata! Onça contra Tatu, e a torcida já canta na arquibancada.', tom: 'normal' },
  { texto: 'O atacante da Onça avança, passa pelo zagueiro, vai chutar... que perigo!', tom: 'animado' },
  { texto: 'GOOOOOOL! É da Onça! Golaço do atacante, no ângulo!', tom: 'grito' },
];

const ffmpeg = (args: string[]) =>
  new Promise<void>((ok, erro) => {
    const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    p.on('error', erro);
    p.on('close', (c) => (c === 0 ? ok() : erro(new Error(`ffmpeg saiu com código ${c}`))));
  });

async function criarVoz(chave: string, c: Candidato): Promise<{ id: string; previa: Uint8Array | null }> {
  const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/voices', {
    method: 'POST',
    headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store: true,
      voice: { model: MODELO_PADRAO, type: 'prompted', display_name: `Varzeão: ${c.nome}`, gender: c.genero, language_code: 'pt-BR', prompted: { input: c.persona } },
    }),
  });
  if (!resp.ok) throw new Error(`Voice design recusou ${c.nome}: ${resp.status} ${await resp.text()}`);
  const v = (await resp.json()) as { id?: string; name?: string; sample_audio?: { data?: string } };
  const id = v.id ?? v.name?.split('/').pop();
  if (!id) throw new Error(`Voice design não devolveu o id de ${c.nome}: ${JSON.stringify(v).slice(0, 300)}`);
  return { id, previa: v.sample_audio?.data ? Uint8Array.from(Buffer.from(v.sample_audio.data, 'base64')) : null };
}

const chave = process.env.GEMINI_API_KEY;
if (!chave) throw new Error('Falta GEMINI_API_KEY.');
const pasta = resolve(process.argv[2] ?? 'narradores');
await mkdir(pasta, { recursive: true });
// NARRADORES_IDS='{"Seu Dito":"voice_..."}': regrava as amostras sem criar vozes novas.
const existentes = JSON.parse(process.env.NARRADORES_IDS || '{}') as Record<string, string>;
const ids: Record<string, string> = {};
for (const c of CANDIDATOS) {
  const { id, previa } = existentes[c.nome] ? { id: existentes[c.nome]!, previa: null } : await criarVoz(chave, c);
  ids[c.nome] = id;
  console.log(`${c.nome}: ${id}`);
  const partes: string[] = [];
  if (previa) {
    partes.push(join(pasta, `${c.nome}-0.wav`));
    await writeFile(partes.at(-1)!, previa);
  }
  for (const [i, f] of FALAS.entries()) {
    partes.push(join(pasta, `${c.nome}-${i + 1}.wav`));
    await writeFile(partes.at(-1)!, await falarGemini(f.texto, f.tom, chave, id, MODELO_PADRAO));
  }
  // Tudo num mp3 só, com meio segundo entre as partes.
  const entradas = partes.flatMap((p) => ['-i', p]);
  const filtro = partes.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur=0.6[a${i}]`).join(';') + ';' + partes.map((_, i) => `[a${i}]`).join('') + `concat=n=${partes.length}:v=0:a=1[s]`;
  await ffmpeg([...entradas, '-filter_complex', filtro, '-map', '[s]', '-c:a', 'libmp3lame', '-b:a', '128k', join(pasta, `${c.nome}.mp3`)]);
}
await writeFile(join(pasta, 'narradores.json'), JSON.stringify(ids, null, 2));
console.log(`Amostras em ${pasta}`);
