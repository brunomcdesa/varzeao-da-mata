/*
 * Service worker do App (ADR-0040). Só cuida dos arquivos do próprio site:
 * sempre tenta a rede primeiro (o App nunca fica com versão velha) e, sem conexão,
 * abre o que foi guardado da última visita. Os dados da Liga (R2) e a API da borda
 * vêm de outra origem e passam direto, sem cache aqui.
 */
const CACHE = 'varzeao-app-v1';
const ESSENCIAIS = ['./', './index.html', './app.js', './estilo.css', './escudo.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('.map')) return;
  e.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          void caches.open(CACHE).then((c) => c.put(pedido, copia));
        }
        return resposta;
      })
      .catch(async () => (await caches.match(pedido)) ?? (pedido.mode === 'navigate' ? caches.match('./index.html') : Response.error())),
  );
});
