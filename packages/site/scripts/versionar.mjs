/**
 * Versão dos arquivos do site a cada deploy.
 *
 * O estilo.css e o app.js têm sempre o mesmo nome. Sem versão no endereço, o celular (navegador,
 * App e Cloudflare) pode continuar usando a cópia guardada de antes do deploy, e a mudança não
 * aparece. Com `?v=<versão>` no index.html, cada deploy pede um endereço novo. O service worker
 * também ganha a versão no nome do cache, para trocar de versão e apagar a cópia velha.
 */

/** Versão do deploy: o commit no GitHub Actions; fora dele, a hora do build. */
export function versaoDoDeploy(env = process.env, agora = Date.now()) {
  const sha = env.GITHUB_SHA?.trim();
  return sha ? sha.slice(0, 12) : agora.toString(36);
}

/** Põe `?v=<versão>` nos endereços do estilo.css e do app.js do index.html. */
export function versionarIndex(html, versao) {
  return html.replace(/href="estilo\.css"/g, `href="estilo.css?v=${versao}"`).replace(/src="app\.js"/g, `src="app.js?v=${versao}"`);
}

/** Troca o marcador `__VERSAO__` do sw.js pela versão do deploy. */
export function versionarServiceWorker(sw, versao) {
  return sw.replace(/__VERSAO__/g, versao);
}
