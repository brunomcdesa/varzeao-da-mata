/**
 * Teste de pronúncia: sintetiza a mesma frase com grafias diferentes de uma palavra, em cada
 * voz, e pede ao Gemini para transcrever o áudio como foi falado. Serve para achar a grafia
 * que o Locutor nunca erra (ex.: "Varzeão" virando "Varzeadão").
 *
 *   pnpm --filter @liga/renderer pronuncia   (precisa de GEMINI_API_KEY; NARRADORES_IDS opcional)
 */
import { MODELO_PADRAO, VOZ_PADRAO, falarGemini } from './gemini.js';

const GRAFIAS = ['Varzeão', 'Var-ze-ão', 'Varzêão', 'Várzeão'];
const FRASES = (g: string) => [`Bola rolando no ${g} da Mata!`, `GOOOL! É do ${g}! Que festa na arquibancada!`];
const REPETICOES = 1;

const chave = process.env.GEMINI_API_KEY;
if (!chave) throw new Error('Falta GEMINI_API_KEY.');
const vozes: Record<string, string> = { 'Beto Bola': VOZ_PADRAO, ...(JSON.parse(process.env.NARRADORES_IDS || '{}') as Record<string, string>) };

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
        const errou = /VARZEAD|VARZIAD|VARZEADA/i.test(t.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
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
