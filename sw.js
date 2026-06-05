const CACHE_NAME = "guy-learning-v14";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./content.js",
  "./russian-content.js",
  "./lesson-upgrades.js",
  "./app.js",
  "./games-lab/brick-breaker/index.html",
  "./games-lab/brick-breaker/styles.css",
  "./games-lab/brick-breaker/brick-breaker.js",
  "./manifest.webmanifest",
  "./assets/guy-driver.png",
  "./assets/garage-room.png",
  "./assets/item-stickers.svg",
  "./assets/item-cone.svg",
  "./assets/item-badge.svg",
  "./assets/item-flags.svg",
  "./assets/item-helmet.svg",
  "./assets/item-wheel.svg",
  "./assets/item-tools.svg",
  "./assets/item-wheels.svg",
  "./assets/item-garage-light.svg",
  "./assets/item-cup.svg",
  "./assets/item-rocket.svg",
  "./assets/item-blue-car.svg",
  "./assets/item-yellow-car.svg",
  "./assets/item-red-formula.svg",
  "./assets/item-super-car.svg",
  "./assets/reward-stickers.png",
  "./assets/reward-cone.png",
  "./assets/reward-badge.png",
  "./assets/reward-flags.png",
  "./assets/reward-helmet.png",
  "./assets/reward-wheel.png",
  "./assets/reward-tools.png",
  "./assets/reward-wheels.png",
  "./assets/reward-garage-light.png",
  "./assets/reward-cup.png",
  "./assets/reward-rocket.png",
  "./assets/reward-blue-car.png",
  "./assets/reward-yellow-car.png",
  "./assets/reward-red-formula.png",
  "./assets/reward-super-car.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request))
  );
});
