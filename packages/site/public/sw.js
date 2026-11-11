/*
 * Service worker do App (ADR-0040). Só cuida dos arquivos do próprio site:
 * sempre tenta a rede primeiro (o App nunca fica com versão velha) e, sem conexão,
 * abre o que foi guardado da última visita. Os dados da Liga (R2) e a API da borda
 * vêm de outra origem e passam direto, sem cache aqui.
 */
const CACHE = 'varzeao-app-v2';
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

/*
 * Avisos do App (ADR-0041): a borda manda { titulo, corpo, url, partidaId } e o service worker
 * mostra. A mesma Partida usa a mesma tag: o aviso novo substitui o anterior na bandeja.
 */
self.addEventListener('push', (e) => {
  let a = {};
  try {
    a = e.data ? e.data.json() : {};
  } catch {
    a = { corpo: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(a.titulo || 'Varzeão da Mata', {
      body: a.corpo || '',
      icon: 'icones/icone-192.png',
      badge: 'icones/icone-192.png',
      tag: a.partidaId ? `partida-${a.partidaId}` : 'varzeao',
      renotify: true,
      data: { url: a.url || '#/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || '#/', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.startsWith(self.registration.scope));
      if (aberta) return aberta.navigate(destino).then((j) => (j || aberta).focus());
      return self.clients.openWindow(destino);
    }),
  );
});
