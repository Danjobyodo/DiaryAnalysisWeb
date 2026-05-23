// Service worker — caches the static app shell so the PWA works offline.
// Bump CACHE_VERSION whenever the asset list changes to flush old caches.

const CACHE_VERSION = 'diary-web-v1';
const SCOPE_PATH = new URL('./', self.location).pathname;

// Paths are relative to the scope, so the SW works on GitHub Pages subpaths
// (e.g. https://username.github.io/diary-analyzer/).
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/parser.js',
  './js/store.js',
  './js/util.js',
  './js/views/home.js',
  './js/views/search.js',
  './js/views/frequency.js',
  './js/views/length.js',
  './js/views/compare.js',
  './js/views/file-picker.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests within our scope
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  // Network-first for navigation requests so users get fresh HTML when online,
  // but fall back to cached index.html offline (SPA shell).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('./index.html', { ignoreSearch: true }).then((r) => r ?? Response.error())
        )
    );
    return;
  }

  // Cache-first for the static assets
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ??
        fetch(req).then((res) => {
          // Cache successful same-origin responses opportunistically
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
    )
  );
});
