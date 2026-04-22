const SW_VERSION = '2026.04.22.1';
const STATIC_CACHE = `guitartrainer-static-${SW_VERSION}`;
const RUNTIME_CACHE = `guitartrainer-runtime-${SW_VERSION}`;
const CORE_ASSETS = [
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
  '/assets/pwa/icon-192.png',
  '/assets/pwa/icon-512.png',
  '/assets/pwa/apple-touch-icon.png',
  '/assets/pwa/ms-tile-150.png',
  '/assets/pwa/favicon-32.png',
  '/assets/pwa/favicon-16.png',
  '/assets/pwa/screenshot-desktop.png',
  '/assets/pwa/screenshot-phone.png'
];
const APP_FILE_PATH_PREFIXES = ['/app/', '/assets/', '/default_tuning/'];

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

function normalizeCacheKey(request) {
  try {
    const url = new URL(request.url);
    if (url.origin === self.location.origin && APP_FILE_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
      return new Request(url.pathname, { method: 'GET' });
    }
  } catch {}
  return request;
}

function canBeCached(response) {
  if (!response) return false;
  if (response.status === 200) return true;
  return response.type === 'opaque';
}

async function precacheCoreAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    CORE_ASSETS.map(async asset => {
      try {
        const fresh = await fetch(asset, { cache: 'reload' });
        if (canBeCached(fresh)) await cache.put(asset, fresh.clone());
      } catch {}
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(precacheCoreAssets());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      );
      await self.clients.claim();
      await notifyClients({ type: 'SW_ACTIVE', version: SW_VERSION });
    })()
  );
});

self.addEventListener('message', event => {
  const type = event?.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'FORCE_UPDATE') {
    event.waitUntil(
      (async () => {
        try {
          await precacheCoreAssets();
          await notifyClients({ type: 'APP_FILES_REFRESHED', version: SW_VERSION });
        } catch (err) {
          await notifyClients({ type: 'APP_FILES_REFRESH_FAILED', error: String(err?.message || err || 'unknown') });
        }
      })()
    );
  }
});

async function networkFirst(req, fallbackRequest = null) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req);
    if (canBeCached(fresh)) await runtime.put(normalizeCacheKey(req), fresh.clone());
    return fresh;
  } catch {
    const cached = await runtime.match(normalizeCacheKey(req), { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackRequest) {
      const staticCache = await caches.open(STATIC_CACHE);
      const fallback = await staticCache.match(fallbackRequest, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(req) {
  const key = normalizeCacheKey(req);
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(key, { ignoreSearch: true });
  const networkPromise = fetch(req)
    .then(async fresh => {
      if (canBeCached(fresh)) await runtime.put(key, fresh.clone());
      return fresh;
    })
    .catch(() => null);
  if (cached) {
    networkPromise.catch(() => null);
    return cached;
  }
  const networkRes = await networkPromise;
  if (networkRes) return networkRes;
  const staticCache = await caches.open(STATIC_CACHE);
  return staticCache.match(key, { ignoreSearch: true }) || new Response('Offline', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = req.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(networkFirst(req, '/index.html'));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Cache cross-origin scripts/assets (e.g. CDN files) for offline reuse.
  event.respondWith(staleWhileRevalidate(req));
});
