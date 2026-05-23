// MTG Vault service worker. Strategy:
// - App shell + Next static chunks → cache-first (immutable).
// - Scryfall card images → cache-first (immutable per URL).
// - HTML navigation requests → network-first, fall back to last good page.
// - /api/* → network-first, fall back to a cached response so previously-
//   loaded data (inventory, decks) stays readable when offline.
// - Everything else → network with a graceful fallback.
//
// Bump CACHE_VERSION to force clients to evict stale entries on next load.

const CACHE_VERSION = "v1";
const SHELL_CACHE = `mtgv-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `mtgv-images-${CACHE_VERSION}`;
const API_CACHE = `mtgv-api-${CACHE_VERSION}`;

const SHELL_PATHS = ["/", "/dashboard", "/inventory", "/decks", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      c.addAll(SHELL_PATHS).catch(() => {
        // Pre-cache is best-effort — some routes 307 to /login when
        // unauthenticated and that's fine, we'll cache them on first real hit.
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              k.startsWith("mtgv-") &&
              ![SHELL_CACHE, IMAGE_CACHE, API_CACHE].includes(k),
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1) Scryfall image CDN — cache-first, immutable per URL.
  if (
    url.hostname === "cards.scryfall.io" ||
    url.hostname === "c1.scryfall.com" ||
    url.hostname === "c2.scryfall.com"
  ) {
    event.respondWith(cacheFirst(req, IMAGE_CACHE));
    return;
  }

  // Same-origin only beyond this point.
  if (url.origin !== self.location.origin) return;

  // 2) Next static chunks — cache-first, immutable per hash.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // 3) API — network-first with cache fallback for offline read.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // 4) HTML navigations — network-first; fall back to last good shell entry.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // 5) Everything else — network, no cache (avoid storing one-shot fetches).
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // No cache entry and no network — let the browser surface the failure.
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    // Don't cache 3xx (auth redirects) or non-2xx responses.
    if (res.ok && res.status < 300) {
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    // No cached fallback — let the browser show its offline page for
    // navigations; API callers will surface their own error toasts.
    throw new Error("offline and no cached response available");
  }
}
