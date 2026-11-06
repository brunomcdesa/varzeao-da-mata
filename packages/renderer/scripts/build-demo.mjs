/**
 * Gera a página de Replay de demonstração em dist/demo/.
 *
 *   pnpm demo            → build único; abra dist/demo/index.html no navegador
 *   pnpm demo --servir   → build + servidor local com rebuild a cada mudança
 *
 * O bundle sai em IIFE (script comum, sem type="module"), então a página também
 * funciona aberta direto do disco (file://).
 */
import { context, build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const saida = resolve(raiz, 'dist/demo');
const servir = process.argv.includes('--servir');

await mkdir(saida, { recursive: true });
await copyFile(resolve(raiz, 'demo/index.html'), resolve(saida, 'index.html'));

const opcoes = {
  entryPoints: [resolve(raiz, 'demo/main.ts')],
  outfile: resolve(saida, 'main.js'),
  bundle: true,
  format: 'iife',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
};

if (servir) {
  const ctx = await context(opcoes);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: saida, port: 5173 });
  console.log(`\nReplay em http://localhost:${port}  (Ctrl+C para sair)`);
} else {
  await build({ ...opcoes, minify: true });
  console.log(`\nPronto: ${resolve(saida, 'index.html')}`);
}
