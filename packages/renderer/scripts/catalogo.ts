/**
 * Lista as vozes prontas pt-BR da biblioteca do Gemini (sem gerar áudio, não gasta pedidos de voz).
 *
 *   pnpm --filter @liga/renderer exec tsx scripts/catalogo.ts [pasta]   (precisa de GEMINI_API_KEY)
 *
 * Grava catalogo.json (todas as vozes com tom, gênero, sotaque e descrição) para escolher
 * candidatas a Narrador com contraste de tom.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const chave = process.env.GEMINI_API_KEY;
if (!chave) throw new Error('Falta GEMINI_API_KEY.');
const pasta = resolve(process.argv[2] ?? 'catalogo');
await mkdir(pasta, { recursive: true });

const vozes: Record<string, unknown>[] = [];
let pagina = '';
do {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/voices');
  url.searchParams.append('language_code', 'pt-BR');
  url.searchParams.append('type', 'prebuilt');
  url.searchParams.set('page_size', '1000');
  if (pagina) url.searchParams.set('page_token', pagina);
  const resp = await fetch(url, { headers: { 'x-goog-api-key': chave } });
  if (!resp.ok) throw new Error(`Erro ${resp.status}: ${await resp.text()}`);
  const corpo = (await resp.json()) as { voices?: Record<string, unknown>[]; next_page_token?: string; nextPageToken?: string };
  vozes.push(...(corpo.voices ?? []));
  pagina = corpo.next_page_token ?? corpo.nextPageToken ?? '';
} while (pagina);

// Só os campos de texto curtos de cada voz (o áudio de amostra não vem na lista).
const enxuto = vozes.map((v) => Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'object' || Array.isArray(x))));
await writeFile(join(pasta, 'catalogo.json'), JSON.stringify(enxuto, null, 2));
console.log(`${enxuto.length} vozes pt-BR em ${pasta}/catalogo.json`);
for (const v of enxuto) console.log(JSON.stringify(v).slice(0, 300));
