// MTG Vault service worker. Strategy:
// - Next static chunks → cache-first (immutable per hash).
// - Scryfall card images → cache-first (immutable per URL).
// - HTML navigation requests → NETWORK ONLY. Do not cache server-rendered
//   pages — auth state and live data invalidate them constantly, and a
//   stale cached blank page is worse than a network failure (user gets a
//   white-screen with no recovery path). The Next router handles its own
//   client-side caching for fast nav.
// - /api/* → network-first with a brief cache fallback for offline reads
//   (inventory/decks remain glanceable while offline).
// - Everything else → network with no SW intervention.
//
// Bump CACHE_VERSION to force clients to evict stale entries on next load.

const CACHE_VERSION = "v2";
const STATIC_CACHE = `mtgv-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `mtgv-images-${CACHE_VERSION}`;
const API_CACHE = `mtgv-api-${CACHE_VERSION}`;

self.addEventListener("install", () => {
  // No pre-cache. Auth-gated routes can't be safely pre-cached without
  // knowing the user's session state inside the SW thread. Static chunks
  // are picked up on first real hit.
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
              ![STATIC_CACHE, IMAGE_CACHE, API_CACHE].includes(k),
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
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 3) API — network-first with cache fallback for offline read.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // 4) Manifest and SW — let the browser handle natively (proxy bypass
  //    already exempts them).
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/sw.js") {
    return;
  }

  // 5) HTML navigations and everything else — do NOT intercept. Auth
  //    redirects, fresh server-rendered data, and Next's own caching
  //    are best left to the browser + Next runtime. Caching SSR'd pages
  //    in the SW caused white-screen blanks when a stale empty response
  //    got served instead of the fresh one.
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
