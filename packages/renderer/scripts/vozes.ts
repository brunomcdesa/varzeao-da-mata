/**
 * Lista as vozes pt-BR do Azure Speech e os estilos que cada uma aceita.
 *   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=brazilsouth pnpm vozes
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env */
}

const chave = process.env.AZURE_SPEECH_KEY;
const regiao = process.env.AZURE_SPEECH_REGION;
if (!chave || !regiao) {
  console.error('Defina AZURE_SPEECH_KEY e AZURE_SPEECH_REGION.');
  process.exit(1);
}

interface Voz {
  ShortName: string;
  LocalName: string;
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

