self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("lak-learn-static-v1").then((cache) => cache.addAll(["/", "/study", "/manifest.json"])),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("/study"));
    }),
  );
});

