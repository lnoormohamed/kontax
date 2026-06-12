// @ts-nocheck
const SHELL_CACHE = "kontax-shell-v3";
const PAGE_CACHE = "kontax-pages-v3";
const ASSET_CACHE = "kontax-assets-v3";
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

  // Static assets — cache first, then network.
  if (/\.(?:js|css|png|jpg|jpeg|svg|ico|woff2?)(\?|$)/.test(url.pathname)) {
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

  // Navigation requests — network first, cache fallback, offline page last.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache a clean 200 for this exact URL. Never cache a redirected
          // response (e.g. an auth redirect to /login) — caching that under the
          // requested page URL would later serve the login screen for an
          // authenticated route.
          if (response.ok && !response.redirected) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached ?? caches.match(OFFLINE_URL))
            .then((res) => res ?? Response.error())
        )
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
