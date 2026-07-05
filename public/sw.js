// @ts-nocheck
// This worker keeps offline support intentionally small. Next.js build assets are
// already content-hashed and handled well by the browser HTTP cache; caching them
// again here makes deploy-time chunk mismatches much more likely.
const SHELL_CACHE = "kontax-shell-v8";
const PAGE_CACHE = "kontax-pages-v8";
const ASSET_CACHE = "kontax-assets-v8";
const OFFLINE_URL = "/offline.html";

const ALL_CACHES = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll([OFFLINE_URL])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Let the browser handle hashed Next.js build assets directly. Service-worker
  // cache-first logic here can pin an old runtime or route chunk across deploys.
  if (url.pathname.startsWith("/_next/static/")) {
    return;
  }

  // Public assets — cache first, then network.
  if (/\.(?:png|jpg|jpeg|svg|ico|woff2?)(\?|$)/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests — network only, no caching of authenticated pages
  // (stateful, scroll-sensitive; replaying stale shells fights the
  // contact-list restore logic).
  //
  // P42-01 §2: the offline.html takeover is reserved for cold starts. When a
  // live window initiated the navigation (in-session link click or refresh),
  // abort it with 204 instead — a 204 navigation response leaves the current
  // document in place, so the user keeps their view and the in-app banner
  // (P42-DB01) owns the connection-loss experience.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const initiator = event.clientId
          ? await self.clients.get(event.clientId).catch(() => null)
          : null;
        if (initiator) {
          // Tell the live page its navigation failed so the banner can show
          // degraded even before the browser notices it is offline.
          initiator.postMessage({ type: "NAV_OFFLINE", url: event.request.url });
          return new Response(null, { status: 204 });
        }
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      })
    );
    return;
  }

  // Everything else — network only, no caching.
});

// Notify all clients when a new SW has taken control so they can show a banner.
self.addEventListener("controllerchange", () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
  });
});
