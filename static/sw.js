const CACHE_NAME = 'coupon-book-v37';
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
  './js/core/keyed-lock.js',
  './js/data/db.js',
  './js/data/skins.js',
  './js/data/repo.js',
  './js/domain.js',
  './js/services/format.js',
  './js/services/codes.js',
  './js/services/maps.js',
  './js/services/location.js',
  './js/services/places.js',
  './js/services/reminders.js',
  './js/services/pwa.js',
  './js/services/backup.js',
  './js/services/storage.js',
  './js/services/fx.js',
  './js/services/ads.js',
  './js/services/gifticon.js',
  './js/ui/toast.js',
  './js/ui/art.js',
  './art/onb-wallet.webp',
  './art/onb-stamps.webp',
  './art/onb-bell.webp',
  './art/empty-ticket.webp',
  './art/empty-map.webp',
  './art/empty-search.webp',
  './art/backup-restore.webp',
  './js/ui/overlay.js',
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

// ── Background expiry check (Periodic Background Sync) ──────────────────────
// Installed apps (TWA/PWA) may be woken by the browser without the page open.
// The page keeps its own on-open reminder path (services/reminders.js); this is
// the best-effort background complement. Runs at most once per calendar day,
// tracked via a marker row in the settings store. Logic mirrors
// domain.daysUntil/dueReminders but stays dependency-free: a SW script cannot
// import the app's ES modules.
const SW_MARKER_KEY = 'swReminderCheckedOn';

function swOpenDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('CouponBookDB');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function swGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function swPut(db, store, rec) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function swDaysUntil(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  const target = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - n.getTime()) / 86400000);
}

function swTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function swPassTotal(shop) {
  return shop && shop.kind === 'amount' ? Number(shop.totalAmount) || 0 : Number(shop && shop.totalCoupons) || 0;
}

function swPassUsed(shop) {
  return shop && shop.kind === 'amount' ? Number(shop.usedAmount) || 0 : Number(shop && shop.usedCoupons) || 0;
}

function swIsCompleted(shop) {
  return swPassTotal(shop) > 0 && swPassUsed(shop) >= swPassTotal(shop);
}

function swThreshold(shop, reminderDays) {
  if (swIsCompleted(shop)) return null;
  const days = swDaysUntil(shop && shop.expiresAt);
  if (days === null || days < 0) return null;
  const reached = (reminderDays || []).filter((t) => days <= t);
  return reached.length ? Math.min(...reached) : null;
}

function swPruneReminderMarkers(markers, now = Date.now()) {
  if (!markers || typeof markers !== 'object' || Array.isArray(markers)) return {};
  const d = new Date(now);
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out = {};
  for (const [key, value] of Object.entries(markers)) {
    const match = /^cb_reminder:[^:]+:([^:]+):t[^:]+$/.exec(key);
    if (!match || (match[1] !== 'none' && match[1] >= today)) out[key] = value;
  }
  return out;
}

async function checkExpiryInBackground() {
  let db;
  try {
    db = await swOpenDb();
    const settingsRows = await swGetAll(db, 'settings');
    const settings = {};
    for (const row of settingsRows) if (row && row.key != null) settings[row.key] = row.value;
    if (!settings.remindersEnabled) return;
    if (settings[SW_MARKER_KEY] === swTodayKey()) return; // once per day

    const reminderDays = Array.isArray(settings.reminderDays) ? settings.reminderDays : [7, 3, 1];
    const shops = await swGetAll(db, 'shops');
    const markers = settings.reminderMarkers && typeof settings.reminderMarkers === 'object'
      && !Array.isArray(settings.reminderMarkers) ? settings.reminderMarkers : {};
    let notified = 0;

    for (const shop of shops) {
      const threshold = swThreshold(shop, reminderDays);
      if (threshold === null) continue;
      const key = `cb_reminder:${shop.id}:${shop.expiresAt || 'none'}:t${threshold}`;
      if (markers[key] || notified >= 5) continue;
      const days = swDaysUntil(shop.expiresAt);
      await self.registration.showNotification('쿠폰북', {
        body: `${shop.name} · ${days === 0 ? '오늘 만료' : `D-${days}`} 만료 임박`,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: `expiry-${shop.id}-${swTodayKey()}`
      });
      markers[key] = Date.now();
      notified += 1;
    }
    await Promise.all([
      swPut(db, 'settings', { key: SW_MARKER_KEY, value: swTodayKey() }),
      swPut(db, 'settings', { key: 'reminderMarkers', value: swPruneReminderMarkers(markers) })
    ]);
  } catch (e) {
    // best-effort: background check must never throw out of the event
  } finally {
    try { db && db.close(); } catch (e) { /* noop */ }
  }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'expiry-check') e.waitUntil(checkExpiryInBackground());
});

// Tapping a notification focuses the app (or opens it).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow('./');
    })
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
