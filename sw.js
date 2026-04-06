const CACHE_NAME = 'guitartrainer-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/404.html',
  '/browserconfig.xml',
  '/manifest.webmanifest',
  '/app/main.js',
  '/app/modules/audio-engine.js',
  '/app/modules/music.js',
  '/app/modules/renderers.js',
  '/app/modules/repository.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/ms-tile-150.png',
  '/assets/icons/favicon-32.png',
  '/assets/icons/favicon-16.png',
  '/assets/pwa/icon-192.png',
  '/assets/pwa/icon-512.png',
  '/assets/pwa/apple-touch-icon.png',
  '/assets/pwa/ms-tile-150.png',
  '/assets/pwa/favicon-32.png',
  '/assets/pwa/favicon-16.png',
  '/assets/pwa/screenshot-desktop.png',
  '/assets/pwa/screenshot-phone.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPwaMetaRequest = url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/assets/pwa/');

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (isPwaMetaRequest) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          if (!res || res.status !== 200) return res;
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
