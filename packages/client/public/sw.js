// Minimal service worker: makes the app installable and caches the shell.
// Game state always comes live from the server.
const CACHE = 'eden-island-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    '/', '/manifest.webmanifest', '/favicon.ico',
    '/eden-island-icon-192.png', '/eden-island-icon-512.png', '/eden-island-apple-touch-icon.png',
  ])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/socket.io')) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  );
});
