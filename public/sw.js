/**
 * ShowRing IQ service worker — offline show-day mode v1.
 *
 * Scope (deliberately read-only):
 * - Page navigations are network-first; every successful HTML response is
 *   cached, so any page already visited (gate, draws, scoring, schedule)
 *   stays viewable when the venue Wi-Fi drops.
 * - Static assets (/_next/static, fonts, images) are cache-first.
 * - Everything else (RSC fetches, server actions, Supabase calls) passes
 *   straight through to the network — writes are NOT queued in v1, so a
 *   change made while offline simply fails visibly instead of silently
 *   pretending to save.
 * - Auth pages are never cached.
 */

const PAGE_CACHE = "showring-pages-v1";
const STATIC_CACHE = "showring-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== PAGE_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

const NEVER_CACHE = /\/(login|signup|auth|api\/auth)(\/|$|\?)/;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.test(url.pathname)) return;

  // Full-page navigations: network-first with cache fallback. Only
  // navigations are cached, so RSC payloads served from the same URL
  // never collide with HTML.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request, { cacheName: PAGE_CACHE });
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset='utf-8'><title>Offline</title>" +
              "<body style='font-family:system-ui;padding:2rem;max-width:32rem;margin:0 auto'>" +
              "<h1 style='font-size:1.25rem'>You're offline</h1>" +
              "<p>This page hasn't been loaded on this device yet. Pages you visited while online (gate, draws, scoring, schedule) stay available offline.</p>" +
              "<p><a href='javascript:location.reload()'>Try again</a></p></body>",
            { status: 503, headers: { "Content-Type": "text/html" } }
          );
        }
      })()
    );
    return;
  }

  // Immutable build assets and images: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(svg|png|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: STATIC_CACHE });
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
  }
});
