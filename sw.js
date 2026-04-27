const SW_VERSION = '2026.04.22.15';
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
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'audio', 'video']);
const CROSS_ORIGIN_STATIC_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'www.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'i.ytimg.com',
  'www.youtube.com'
]);

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

function isBypassRequest(req, url) {
  const protocol = (url.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') return true;
  const hostname = String(url.hostname || '').toLowerCase();
  const pathname = String(url.pathname || '');
  if (pathname.startsWith('/__/firebase/')) return true;
  if (hostname === 'firestore.googleapis.com') return true;
  if (hostname.endsWith('.googleapis.com')) return true;
  if (hostname.endsWith('.googleusercontent.com')) return true;
  if (pathname.includes('google.firestore')) return true;
  if (pathname.includes('/channel') || pathname.includes('/listen')) return true;
  if (pathname.endsWith('/Listen') || pathname.endsWith('/Write')) return true;
  if (req.destination === '' && req.mode !== 'navigate') return true;
  return false;
}

function shouldCacheRequest(req, url) {
  if (req.method !== 'GET') return false;
  if (req.mode === 'navigate') return true;
  if (isBypassRequest(req, url)) return false;
  if (url.origin === self.location.origin) {
    if (APP_FILE_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return true;
    return STATIC_DESTINATIONS.has(req.destination);
  }
  if (!STATIC_DESTINATIONS.has(req.destination)) return false;
  return CROSS_ORIGIN_STATIC_HOSTS.has(url.hostname);
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

async function clearCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.map(key => cache.delete(key)));
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
          await clearCache(STATIC_CACHE);
          await clearCache(RUNTIME_CACHE);
          await precacheCoreAssets();
          await notifyClients({ type: 'APP_FILES_REFRESHED', version: SW_VERSION });
        } catch (err) {
          await notifyClients({ type: 'APP_FILES_REFRESH_FAILED', error: String(err?.message || err || 'unknown') });
        }
      })()
    );
  }
});

async function cacheFirst(req, fallbackRequest = null) {
  const url = new URL(req.url);
  if (!shouldCacheRequest(req, url)) {
    try {
      return await fetch(req);
    } catch {
      if (fallbackRequest) {
        const staticCache = await caches.open(STATIC_CACHE);
        const fallback = await staticCache.match(fallbackRequest, { ignoreSearch: true });
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  }

  const key = normalizeCacheKey(req);
  const staticCache = await caches.open(STATIC_CACHE);
  const staticHit = await staticCache.match(key, { ignoreSearch: true });
  if (staticHit) return staticHit;

  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(key, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (canBeCached(fresh)) await runtime.put(key, fresh.clone());
    return fresh;
  } catch {
    if (fallbackRequest) {
      const fallback = await staticCache.match(fallbackRequest, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = req.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(cacheFirst(req, '/index.html'));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Cache cross-origin scripts/assets after first successful request.
  event.respondWith(cacheFirst(req));
});
