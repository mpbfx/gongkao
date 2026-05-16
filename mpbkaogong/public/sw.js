const CACHE_NAME = "saduck-shell-v2";
const SHELL_URLS = ["/", "/icons/icon.svg", "/icons/maskable-icon.svg", "/manifest.webmanifest"];

async function fetchAndCache(request) {
  const response = await fetch(request);

  if (response.ok) {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  if (url.pathname.startsWith("/_next/") || ["script", "style"].includes(request.destination)) {
    event.respondWith(fetchAndCache(request).catch(() => caches.match(request)));
    return;
  }

  if (["font", "image"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const nextResponse = fetchAndCache(request).catch(() => cached);

        if (cached) {
          event.waitUntil(nextResponse);
          return cached;
        }

        return nextResponse;
      })
    );
  }
});
