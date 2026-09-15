/* FantasyForge service worker: installable app + offline fallback.
 * - Build assets (/_next/static) are immutable: cache-first.
 * - Pages and /api/nfl data: network-first, falling back to the last copy so
 *   the app still opens (with stale data) when offline.
 * - Third-party requests (Sleeper, images) are left to the browser.
 */
const VERSION = 'v2';
// Bounded caches: old hashed build assets and URL variants age out
const MAX_STATIC_ENTRIES = 150;
const MAX_RUNTIME_ENTRIES = 40;
const STATIC_CACHE = `ff-static-${VERSION}`;
const RUNTIME_CACHE = `ff-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  // Never evict the offline page; keys come back in insertion order (oldest first)
  const keys = (await cache.keys()).filter(key => new URL(key.url).pathname !== OFFLINE_URL);
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)));
}

async function store(cacheName, maxEntries, request, response) {
  const cache = await caches.open(cacheName);
  await cache.delete(request);
  await cache.put(request, response);
  await trimCache(cacheName, maxEntries);
}

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) event.waitUntil(store(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES, request, response.clone()));
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match(OFFLINE_URL);
    throw error;
  }
}

async function cacheFirst(event) {
  const { request } = event;
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) event.waitUntil(store(STATIC_CACHE, MAX_STATIC_ENTRIES, request, response.clone()));
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event));
  } else if (request.mode === 'navigate' || url.pathname.startsWith('/api/nfl/')) {
    event.respondWith(networkFirst(event));
  }
});
