const CACHE_NAME = 'bigboy-nautica-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // La aplicación sigue cargando siempre la versión actual desde Internet.
});
