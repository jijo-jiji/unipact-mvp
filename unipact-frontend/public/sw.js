/* UniPact service worker: makes the site installable as an app and shows a friendly page when offline.
 *
 * Deliberately small, so a deploy can never leave people stuck on an old version:
 *  - Pages (navigations) always come from the network; the offline page is only a fallback.
 *  - Built files under /assets/ have content hashes in their names, so they are cached once and reused.
 *  - The API (another domain) and anything else is never touched: it goes straight to the network.
 * Bump VERSION to drop the old caches. */
const VERSION = 'v1';
const SHELL = `unipact-shell-${VERSION}`;
const ASSETS = `unipact-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then((cache) => cache.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }))),
    );
  }
});
