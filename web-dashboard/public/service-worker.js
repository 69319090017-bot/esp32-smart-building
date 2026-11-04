/**
 * Service Worker Cache Buster & Migration Handler
 * Cleans out legacy caches and unregisters obsolete workers.
 */
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => {
        clients.forEach((c) => {
          if (c.url && 'navigate' in c) {
            c.navigate(c.url);
          }
        });
      })
  );
});
