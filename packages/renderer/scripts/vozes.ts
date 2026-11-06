/**
 * Lista vozes para o Locutor.
 *   pnpm vozes                  → vozes pt-BR do Azure e os estilos de cada uma
 *   pnpm vozes --gemini Lumi    → procura vozes do Gemini TTS pelo nome (biblioteca estendida)
 * Lê as chaves do ambiente ou do .env na raiz.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env */
}

const { values: args } = parseArgs({ options: { gemini: { type: 'string' } } });

if (args.gemini !== undefined) {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    console.error('Defina GEMINI_API_KEY (no .env ou no ambiente).');
    process.exit(1);
  }
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/voices');
  if (args.gemini) url.searchParams.set('search', args.gemini);
  const resp = await fetch(url, { headers: { 'x-goog-api-key': chave } });
  if (!resp.ok) {
    console.error(`Erro ${resp.status}: ${await resp.text()}`);
    process.exit(1);
  }
  const corpo = (await resp.json()) as Record<string, unknown>;
  // O formato da lista não é fixo na documentação: mostra cada voz com seus campos de texto.
  const lista = (Object.values(corpo).find(Array.isArray) as Record<string, unknown>[] | undefined) ?? [];
  if (!lista.length) console.log('Nenhuma voz encontrada. Resposta:', JSON.stringify(corpo).slice(0, 500));
  for (const v of lista) {
    const campos = Object.entries(v)
      .filter(([, x]) => typeof x === 'string' || typeof x === 'number')
      .map(([k, x]) => `${k}=${String(x)}`)
      .join('  ');
    console.log(campos);
  }
  console.log('\nUse o identificador da voz em GEMINI_TTS_VOZ no .env.');
  process.exit(0);
}

const chave = process.env.AZURE_SPEECH_KEY;
const regiao = process.env.AZURE_SPEECH_REGION;
if (!chave || !regiao) {
  console.error('Defina AZURE_SPEECH_KEY e AZURE_SPEECH_REGION, ou use --gemini <nome>.');
  process.exit(1);
}

interface Voz {
  ShortName: string;
  Gender: string;
  Locale: string;
  StyleList?: string[];
}

const resp = await fetch(`https://${regiao}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
  headers: { 'Ocp-Apim-Subscription-Key': chave },
});
if (!resp.ok) {
  console.error(`Erro ${resp.status}: ${await resp.text()}`);
  process.exit(1);
}
const vozes = ((await resp.json()) as Voz[]).filter((v) => v.Locale === 'pt-BR');
for (const v of vozes) {
  const estilos = v.StyleList?.length ? v.StyleList.join(', ') : 'sem estilos';
  console.log(`${v.ShortName.padEnd(34)} ${v.Gender.padEnd(7)} ${estilos}`);
}
