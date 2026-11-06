/**
 * Gera versões do grito de gol em várias vozes do Azure, para escolher pelo ouvido.
 *
 *   pnpm testar-grito                 → salva em ./gritos
 *   pnpm testar-grito --saida ~/gritos --time Capivara
 *
 * Usa AZURE_SPEECH_KEY e AZURE_SPEECH_REGION (do ambiente ou do .env na raiz).
 * Cada arquivo custa poucos caracteres da cota (cerca de 25 por versão).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(resolve(raiz, '../../.env'));
} catch {
  /* sem .env */
}

const { values: args } = parseArgs({
  options: {
    saida: { type: 'string', default: 'gritos' },
    time: { type: 'string', default: 'Capivara' },
    vozes: { type: 'string', default: 'pt-BR-AntonioNeural,pt-BR-DonatoNeural,pt-BR-ValerioNeural,pt-BR-JulioNeural,pt-BR-FabioNeural' },
  },
});

const chave = process.env.AZURE_SPEECH_KEY;
const regiao = process.env.AZURE_SPEECH_REGION;
if (!chave || !regiao) {
  console.error('Defina AZURE_SPEECH_KEY e AZURE_SPEECH_REGION (no .env ou no ambiente).');
  process.exit(1);
}

const time = args.time!;
const da = /a$/.test(time) ? 'da' : 'do';

/** Cada variação é o miolo do SSML (dentro de <voice>). */
const VARIACOES: [string, string][] = [
  ['1-atual', `<prosody rate="+4%" pitch="+14%">Gooooool ${da} ${time}!</prosody>`],
  ['2-gol-gol-gol', `<prosody rate="-5%" pitch="+20%" volume="+20%">Gol!<break time="150ms"/> Gol!<break time="150ms"/> Gol!</prosody><break time="250ms"/><prosody rate="+5%" pitch="+10%">Gol ${da} ${time}!</prosody>`],
  ['3-e-gol', `<prosody rate="-12%" pitch="+25%" volume="+30%">É gol!</prosody><break time="300ms"/><prosody rate="+5%" pitch="+12%">Gol ${da} ${time}!</prosody>`],
  ['4-vogal-longa', `<prosody rate="-35%" pitch="+22%" volume="+30%">Gôôôôôl!</prosody><break time="200ms"/><prosody pitch="+10%">${time}!</prosody>`],
  ['5-pra-dentro', `<prosody rate="+10%" pitch="+8%">Bateu...</prosody><break time="200ms"/><prosody rate="-8%" pitch="+24%" volume="+30%">é gol!</prosody><break time="200ms"/><prosody pitch="+12%">Gol ${da} ${time}!</prosody>`],
];

const ssml = (voz: string, miolo: string) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR"><voice name="${voz}">${miolo}</voice></speak>`;

const dir = resolve(process.cwd(), args.saida!);
await mkdir(dir, { recursive: true });
for (const voz of args.vozes!.split(',')) {
  const nomeVoz = voz.replace(/^pt-BR-|Neural$/g, '').toLowerCase();
  for (const [nome, miolo] of VARIACOES) {
    const resp = await fetch(`https://${regiao}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': chave,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-48khz-96kbitrate-mono-mp3',
        'User-Agent': 'varzeao-da-mata',
      },
      body: ssml(voz, miolo),
    });
    if (!resp.ok) {
      console.error(`${voz} ${nome}: erro ${resp.status} ${await resp.text()}`);
      continue;
    }
    const arquivo = join(dir, `${nomeVoz}-${nome}.mp3`);
    await writeFile(arquivo, new Uint8Array(await resp.arrayBuffer()));
    console.log(`  ${arquivo}`);
  }
}
console.log(`\nPronto. Ouça os arquivos em ${dir} e me diga a voz e a versão (ex.: donato 3).`);
