// Minimal offline shell cache — NOT a full offline-data strategy. Its only job
// is to let the app itself reopen (HTML/JS/CSS) when the phone has zero signal;
// actual data (rounds, tasks, scans) still comes from /api/* live, and is never
// cached here — that's handled by IndexedDB queues in src/lib/offlineQueue.ts.
const CACHE_NAME = "vistoria-solar-shell-v1";
const OFFLINE_FALLBACK_URL = "/scan";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses — they must always reflect live or queued state,
  // never a stale snapshot from before the device went offline.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK_URL)))
    );
    return;
  }

  // Static assets (JS/CSS/fonts/icons): serve from cache instantly if we have
  // it, but always refresh the cache in the background for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
