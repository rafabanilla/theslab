// The Slab — deliberately non-caching service worker.
//
// Earlier versions cached the app shell, which repeatedly served stale builds
// during development. The app needs a network connection for its data anyway,
// so caching the shell bought very little and cost a lot of confusion.
// This version registers (so the app stays installable) but always goes to the
// network, and clears anything a previous version left behind.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// No fetch handler at all: every request goes straight to the network,
// exactly as it would with no service worker installed.
