/**
 * Build do site em dist/ (estático: vai para o Cloudflare Pages).
 *
 *   pnpm --filter @liga/site build           build minificado
 *   pnpm --filter @liga/site dev             servidor local em http://localhost:5174 com rebuild
 *
 * Os dados vêm de public/dados/ (gere com `pnpm liga site`). Em produção, o
 * <meta name="liga-dados"> aponta para o bucket público do R2.
 */
import { context, build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const saida = resolve(raiz, 'dist');
const servir = process.argv.includes('--servir');

await mkdir(saida, { recursive: true });
await cp(resolve(raiz, 'public'), saida, { recursive: true });

// Configuração de produção por variável de ambiente (preenchida no deploy).
const html = (await readFile(resolve(raiz, 'public/index.html'), 'utf8'))
  .replace('content="./dados/"', `content="${process.env.LIGA_DADOS_URL ?? './dados/'}"`)
  .replace('name="liga-api" content=""', `name="liga-api" content="${process.env.LIGA_API_URL ?? ''}"`)
  .replace('name="liga-instagram" content=""', `name="liga-instagram" content="${process.env.LIGA_INSTAGRAM ?? ''}"`)
  .replace('name="liga-turnstile" content=""', `name="liga-turnstile" content="${process.env.LIGA_TURNSTILE_SITEKEY ?? ''}"`)
  // Avisos do App (ADR-0041): chave pública VAPID; não é segredo.
  .replace('name="liga-vapid" content=""', `name="liga-vapid" content="${process.env.LIGA_VAPID_PUBLICA ?? ''}"`);
await writeFile(resolve(saida, 'index.html'), html);

const opcoes = {
  entryPoints: { app: resolve(raiz, 'src/main.ts'), estilo: resolve(raiz, 'src/estilo.css') },
  outdir: saida,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  loader: { '.woff2': 'file', '.woff': 'file' },
  assetNames: 'fontes/[name]-[hash]',
  sourcemap: true,
  logLevel: 'info',
};

if (servir) {
  const ctx = await context(opcoes);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: saida, port: 5174 });
  console.log(`\nSite em http://localhost:${port}  (Ctrl+C para sair)`);
} else {
  await build({ ...opcoes, minify: true });
  console.log(`\nPronto: ${saida}`);
}
