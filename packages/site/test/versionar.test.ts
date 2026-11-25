import { describe, expect, it } from 'vitest';
// @ts-expect-error script do build em JS puro (sem tipos)
import { versaoDoDeploy, versionarIndex, versionarServiceWorker } from '../scripts/versionar.mjs';

describe('versão dos arquivos a cada deploy', () => {
  it('usa o commit do GitHub Actions e, fora dele, a hora do build', () => {
    expect(versaoDoDeploy({ GITHUB_SHA: '6942f06d866698ae8e3cbfb1f2e539a648c1e662' }, 0)).toBe('6942f06d8666');
    expect(versaoDoDeploy({}, 1_700_000_000_000)).toBe((1_700_000_000_000).toString(36));
  });

  it('põe a versão nos endereços do estilo e do app no index.html', () => {
    const html = '<link rel="stylesheet" href="estilo.css" />\n<script type="module" src="app.js"></script>';
    expect(versionarIndex(html, 'abc')).toBe('<link rel="stylesheet" href="estilo.css?v=abc" />\n<script type="module" src="app.js?v=abc"></script>');
  });

  it('o index.html de verdade tem os dois endereços para versionar', async () => {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
    const v = versionarIndex(html, 'xyz');
    expect(v).toContain('href="estilo.css?v=xyz"');
    expect(v).toContain('src="app.js?v=xyz"');
  });

  it('o service worker troca de cache a cada versão e pede a rede sem a cópia do navegador', async () => {
    const { readFile } = await import('node:fs/promises');
    const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(sw).toContain("cache: 'no-cache'");
    const v = versionarServiceWorker(sw, 'xyz');
    expect(v).toContain("const CACHE = 'varzeao-app-xyz';");
    expect(v).not.toContain('__VERSAO__');
  });
});
