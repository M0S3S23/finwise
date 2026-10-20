/* FinWise service worker
 * - Precaches the app shell + offline page
 * - Static assets (/_next/static, icons): cache-first (they are content-hashed)
 * - Page navigations: network-first, fall back to cached copy, then /offline
 * - GET /api/*: network-first, fall back to last cached response (read-only offline viewing)
 * - Non-GET requests are never cached (writes are queued by the app's IndexedDB outbox)
 */
const VERSION = 'v1.0.0';
const STATIC_CACHE = `finwise-static-${VERSION}`;
const PAGE_CACHE = `finwise-pages-${VERSION}`;
const API_CACHE = `finwise-api-${VERSION}`;
const PRECACHE = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [STATIC_CACHE, PAGE_CACHE, API_CACHE];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

async function networkFirst(request, cacheName, preload) {
  const cache = await caches.open(cacheName);
  try {
    const res = (preload && (await preload)) || (await fetch(request));
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth or CSV exports
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/reports/export')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE).catch(() =>
      new Response(JSON.stringify({ error: 'You are offline and this data has not been cached yet.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE, event.preloadResponse).catch(async () =>
      (await caches.match('/offline')) || new Response('Offline', { status: 503 })));
    return;
  }
  // RSC payloads & other same-origin GETs: network-first with page cache fallback
  if (request.headers.get('RSC') || url.searchParams.has('_rsc')) {
    event.respondWith(networkFirst(request, PAGE_CACHE).catch(() => new Response('', { status: 503 })));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-caches') {
    event.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  }
  if (event.data === 'skip-waiting') self.skipWaiting();
});
