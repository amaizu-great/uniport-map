/* Map of UNIPORT service worker — offline app shell, place data and map tiles. */

const VERSION = "v3";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;
const TILE_CACHE = "tiles"; // kept across versions; trimmed instead
const MAX_TILES = 500;

const SHELL_URLS = [
  "/",
  "/campus/abuja",
  "/campus/choba",
  "/campus/delta",
  "/manifest.webmanifest",
  "/api/places",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icon.svg",
];

const TILE_HOSTS = ["tile.openstreetmap.org", "server.arcgisonline.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, STATIC_CACHE, DATA_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Map tiles: stale-while-revalidate, capped.
  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE, MAX_TILES));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Page loads: network first so updates show up, cache as fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Build output is content-hashed, so cache-first is safe.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/places")) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
  }
});

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("/")) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        if (maxEntries) trimCache(cache, maxEntries);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  // Cache.keys() returns insertion order, so the oldest go first.
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}
