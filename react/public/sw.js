/* God's Eye service worker v7.2.1-own — network-first, bust stale shells */
const CACHE = "gods-eye-v7.2.1-own";
const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache live / socket / paint / mesh
  if (url.protocol === "ws:" || url.protocol === "wss:" || url.port === "8765") return;
  if (
    url.pathname.includes("mesh-live") ||
    url.pathname.includes("location-paint") ||
    url.pathname.includes("location_paint") ||
    url.pathname.includes("gods-eye-api") ||
    url.pathname.includes("/bridge") ||
    url.pathname.endsWith("gods-eye.html")
  ) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req))
    );
    return;
  }

  // HTML always network-first
  if (url.pathname.endsWith(".html") || url.pathname === "/" || url.pathname.endsWith("manifest.webmanifest")) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/gods-eye.html")))
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
