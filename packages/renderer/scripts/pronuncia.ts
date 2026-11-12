/**
 * Teste de pronúncia: sintetiza a mesma frase com grafias diferentes de uma palavra, em cada
 * voz, e pede ao Gemini para transcrever o áudio como foi falado. Serve para achar a grafia
 * que o Locutor nunca erra (ex.: "Varzeão" virando "Varzeadão").
 *
 *   pnpm --filter @liga/renderer pronuncia [pasta]   (precisa de GEMINI_API_KEY)
 *
 * NARRADORES_IDS ({"Nome": "voz"}) escolhe as vozes; sem ele, só o Beto Bola. PRONUNCIA_GRAFIAS
 * (separadas por |) troca as grafias. PRONUNCIA_CURTA=1 usa uma frase só (um pedido de voz por
 * grafia). Com [pasta], guarda cada tentativa em mp3 para ouvir.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODELO_PADRAO, VOZ_PADRAO, falarGemini } from './gemini.js';

const GRAFIAS = process.env.PRONUNCIA_GRAFIAS ? process.env.PRONUNCIA_GRAFIAS.split('|') : ['Varzeão', 'Var-ze-ão', 'Varzêão', 'Várzeão'];
const FRASES = (g: string) =>
  process.env.PRONUNCIA_CURTA === '1' ? [`Acabou a primeira temporada do ${g} da Mata!`] : [`Bola rolando no ${g} da Mata!`, `GOOOL! É do ${g}! Que festa na arquibancada!`];
const REPETICOES = 1;
const pasta = process.argv[2];
if (pasta) mkdirSync(pasta, { recursive: true });

const chave = process.env.GEMINI_API_KEY;
if (!chave) throw new Error('Falta GEMINI_API_KEY.');
const escolhidas = JSON.parse(process.env.NARRADORES_IDS || '{}') as Record<string, string>;
const vozes: Record<string, string> = Object.keys(escolhidas).length ? escolhidas : { 'Beto Bola': VOZ_PADRAO };
let n = 0;

async function transcrever(wav: Uint8Array): Promise<string> {
  const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
    method: 'POST',
    headers: { 'x-goog-api-key': chave!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'audio/wav', data: Buffer.from(wav).toString('base64') } },
            { text: 'Transcreva foneticamente o áudio, exatamente como foi pronunciado, sem corrigir palavras para a forma "certa". Atenção especial à palavra depois de "no" ou "do": escreva cada sílaba que ouvir. Responda só com a transcrição.' },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) return `(erro ${resp.status} ${(await resp.text()).slice(0, 120)})`;
  const j = (await resp.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
}

const placar = new Map<string, { ok: number; total: number }>();
for (const [nome, voz] of Object.entries(vozes)) {
  for (const g of GRAFIAS) {
    for (const frase of FRASES(g)) {
      for (let r = 0; r < REPETICOES; r++) {
        // Texto com um espaço extra a cada repetição: evita reaproveitar a mesma síntese.
        const wav = await falarGemini(frase + ' '.repeat(r), frase.startsWith('GOO') ? 'grito' : 'normal', chave, voz, MODELO_PADRAO);
        const t = await transcrever(wav);
        // Certo é só "Varzeão" inteiro: "Varzeadão", "Varzeaolan" e afins contam como erro.
        const errou = !/\bvarzeao\b/i.test(t.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
        if (pasta) {
          const base = join(pasta, `${String(++n).padStart(2, '0')}-${nome}-${g}`.replace(/[^\p{L}\p{N}-]+/gu, '_'));
          writeFileSync(`${base}.wav`, wav);
          spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${base}.wav`, '-c:a', 'libmp3lame', '-b:a', '96k', `${base}.mp3`]);
        }
        const p = placar.get(g) ?? { ok: 0, total: 0 };
        p.total++;
        if (!errou) p.ok++;
        placar.set(g, p);
        console.log(`${errou ? '✗' : '✓'} ${nome.padEnd(13)} ${g.padEnd(10)} → ${t}`);
      }
    }
  }
}
console.log('\nGrafia       acertos');
for (const [g, p] of placar) console.log(`${g.padEnd(12)} ${p.ok}/${p.total}`);
