const CACHE_NAME = 'coupon-book-v13';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/skins.css',
  './css/extras.css',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet-src.esm.js',
  './vendor/qr/qrcode.js',
  './vendor/barcode/JsBarcode.all.min.js',
  './js/app.js',
  './js/core/h.js',
  './js/core/store.js',
  './js/core/router.js',
  './js/data/db.js',
  './js/data/skins.js',
  './js/data/repo.js',
  './js/domain.js',
  './js/services/format.js',
  './js/services/codes.js',
  './js/services/maps.js',
  './js/services/location.js',
  './js/services/places.js',
  './js/services/photo.js',
  './js/services/reminders.js',
  './js/services/pwa.js',
  './js/services/backup.js',
  './js/services/storage.js',
  './js/services/fx.js',
  './js/services/ads.js',
  './js/ui/toast.js',
  './js/ui/overlay.js',
  './js/ui/reward.js',
  './js/ui/components.js',
  './js/views/home.js',
  './js/views/list.js',
  './js/views/detail.js',
  './js/views/edit.js',
  './js/views/map.js',
  './js/views/history.js',
  './js/views/settings.js',
  './js/views/onboarding.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  // No automatic skipWaiting: a new SW waits until the page asks it to take over
  // (via the SKIP_WAITING message below), so it never swaps in mid-session.
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for same-origin GET: serve cache immediately when present
// while refreshing it in the background; fall back to network, then to the app shell
// for navigations. Cross-origin requests (leaflet tiles, fonts) are left untouched.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
        return cached || network;
      })
    )
  );
});
