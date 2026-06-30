/* Service worker mínimo (Fase 10.3): habilita la instalación PWA y un offline básico
   para navegaciones (network-first con caché de respaldo). No cachea de forma agresiva
   para evitar servir una app obsoleta. */
const CACHE = "nexo-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await caches.match(request);
        return cached || (await caches.match("/dashboard")) || Response.error();
      }
    })(),
  );
});
