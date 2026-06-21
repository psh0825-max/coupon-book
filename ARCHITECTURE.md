# Coupon Book — Architecture Specification (v3 rewrite)

This document is the single source of truth for the v3 rewrite. It is consumed by
implementation agents. Build modules **bottom-up** in the order given. Every module
must match the exported API listed here exactly so cross-module imports resolve.

## 0. Non-negotiable constraints (never break userspace)

1. **Data compatibility.** Existing users have an IndexedDB database. KEEP IT.
   - DB name: `CouponBookDB`. Object stores: `shops` (keyPath `id`), `logs`
     (keyPath `id`, indexes `shopId`, `usedAt`), `settings` (keyPath `key`).
   - Shop record shape (do not rename fields):
     `{ id, name, category, address, phone, expiresAt, memo, lat, lng,
        totalCoupons, usedCoupons, skin, createdAt, updatedAt }`
   - Log record shape: `{ id, shopId, note?, location?, usedAt }`
   - Settings are key/value rows: `{ key, value }`.
   - Bump DB version to 2 and add an idempotent `onupgradeneeded` migration that
     creates any missing store/index but never drops existing data.
2. **Deployment.** Pure static files served from any subpath (GitHub Pages project
   site). ALL asset paths must be **relative** (`./js/...`, `js/...`), never
   root-absolute (`/js/...`). No build step. No new runtime dependencies.
3. **Zero dependencies.** No frameworks, no bundler. Vanilla ES modules only.
   Leaflet stays vendored under `vendor/leaflet/`.
4. Korean UI copy. Light-only theme (no dark mode toggle). Mobile-first PWA.

## 1. Layered architecture (unidirectional data flow)

```
            ┌─────────── views/* ───────────┐   render(state) -> DOM
            │ home list detail edit map      │
            │ history settings onboarding    │
            └───────────────┬────────────────┘
                            │ actions (dispatch)
                   ┌────────▼─────────┐
                   │   app.js (wire)  │  store + router + actions
                   └────────┬─────────┘
        ┌──────────┬────────┼─────────┬───────────┐
   core/store  core/router  services/*   ui/*    domain.js (pure)
        │                       │                    ▲
   data/repo ──────────────────┘     (views/services call domain for all math)
        │
   data/db (IndexedDB)
```

Rules:
- **domain.js is pure** (no DOM, no IndexedDB, no Date side effects except reading
  `Date.now()`); it is the ONLY place coupon status/sort/filter/expiry math lives.
  Never duplicate this logic in views or ui.
- Views never touch `db`/`repo` directly. They call **actions** (passed via context)
  and read from **store** state. Actions own persistence + store updates.
- `h.js` builds DOM with safe text by construction (textContent, not innerHTML),
  eliminating manual escaping and XSS risk.

## 2. File manifest & public APIs

### core/h.js — tiny hyperscript
```js
// h(tag, props?, ...children) -> HTMLElement
//   props: { class, id, style(obj|string), dataset:{}, attrs:{}, on:{event:fn},
//            html (ONLY for trusted/static SVG markup), ref(fn) }
//   children: string|number (=> textContent, safe), Node, array, falsy(skipped)
export function h(tag, props, ...children) {}
// frag(...children) -> DocumentFragment
export function frag(...children) {}
// svg(pathMarkup, {size, viewBox, ...}) -> SVGElement helper for inline icons
export function icon(name, opts) {}   // central icon registry (see §6)
export function clear(node) {}        // remove all children
export function mount(parent, node) {}// clear(parent) then append node
```

### core/store.js — reactive single source of truth
```js
export function createStore(initialState) {
  return {
    getState(),                       // -> state (shallow-frozen copy semantics ok)
    setState(patch|fn),               // merge patch or apply (state)=>patch; notifies
    subscribe(listener),              // listener(state) -> unsubscribe()
    select(selectorFn, listener)      // memoized; calls listener only when selection changes
  };
}
```
App state shape:
```js
{
  shops: [],            // Shop[]
  logs: [],             // Log[] (all)
  settings: {           // normalized settings (see repo defaults)
    notifyEnabled, notifyRadius, notifyDelay,
    remindersEnabled,   // expiry local-notifications on/off
    reminderDays,       // [7,3,1] thresholds
    onboarded           // bool
  },
  ui: { filter: { query, category, status, sort } },
  ready: false
}
```

### core/router.js — view registry + back stack
```js
export function createRouter({ outlet, routes, onChange }) {
  // routes: { home: renderFn, detail: renderFn, ... } where renderFn(ctx, params)->Element
  return { navigate(name, params), back(), current() };
}
// Root pages (no back button, show bottom-nav): home, history, map, settings.
// Sub pages (show back button): list, add(edit), detail, onboarding.
// Manage: section visibility, nav active state, page title, back btn, FAB visibility,
// scroll reset. FAB visible on: home, list.
```

### data/db.js — IndexedDB primitives (schema compatible)
```js
export const DB_NAME = 'CouponBookDB';
export const DB_VERSION = 2;
export function getDB();                 // singleton open w/ migration
export function generateId();            // crypto.randomUUID w/ fallback
// generic helpers
export function getAll(store), get(store,key), put(store,rec), del(store,key),
       getAllByIndex(store,index,key), clearStores(names);
```

### data/repo.js — repositories (validation/normalization here)
```js
export const Shops = {
  all(), get(id), add(partial), update(shop), remove(id) // remove cascades logs
};
export const Logs = { byShop(id), all(), add(log), remove(id) };
export const Settings = { getAll(), set(key,value), entries(), DEFAULTS };
export function normalizeShop(raw);   // clamp totals 1..100, used 0..total, trims, skin/category fallback
export function normalizeLog(raw);
export async function seedDemoData();  // returns count added (idempotent by name)
export async function clearAll();      // shops+logs only (keep settings)
```
Settings DEFAULTS:
```js
{ notifyEnabled:false, notifyRadius:100, notifyDelay:5,
  remindersEnabled:false, reminderDays:[7,3,1], onboarded:false }
```

### domain.js — PURE business logic (heavily unit-tested)
```js
export function daysUntil(dateStr);                 // null if no/!valid date; ceil to days (end-of-day)
export function isCompleted(shop);
export function isExpired(shop);                    // has date & days<0 & !completed
export function isExpiringSoon(shop, within=30);    // 0..within days, !completed
export function remainingCount(shop);
export function progressPercent(shop);              // 0..100 int
export function couponStatus(shop);                 // { key, label, className, score } (see tiers)
export function formatExpiry(dateStr);              // '만료 없음'|'만료됨'|'오늘 만료'|'D-n'
export function priorityShop(shops);                // next-best non-completed or null
export function sortShops(shops, sortKey);          // 'smart'|'remaining'|'updated'|'name'
export function filterShops(shops, {query,category,status}); // pure predicate set
export function stats(shops, logs);                 // { totalShops,totalCoupons,usedCoupons,
                                                    //   completionRate, expiringCount, completedCount,
                                                    //   monthUses }
export function dueReminders(shops, reminderDays);  // shops crossing a threshold today (pure given Date.now)
```
Status tiers (single definition, className drives badge color):
- completed -> `{key:'done', className:'success', score:0}` label `완성`
- expired -> `{className:'danger', score:10}` label `만료됨`
- days<=7 -> `{className:'danger', score:20+days}` label `만료 D-n`/`오늘 만료`
- remaining<=2 -> `{className:'warning', score:40+remaining}` label `n개 남음`
- days<=30 -> `{className:'warning', score:60+days}` label `만료 D-n`
- else -> `{className:'neutral', score:100+remaining}` label `진행 중`

### services/format.js — presentation formatting (no business rules)
```js
export function formatDate(ts);       // YYYY.MM.DD HH:mm
export function formatRelative(ts);   // 방금/n분 전/n시간 전/n일 전/date
export function formatDistance(m);    // '120m' | '1.2km'
```

### services/location.js
```js
export const EARTH_RADIUS;
export function haversine(lat1,lon1,lat2,lon2);
export function getCurrentPosition();                 // Promise<{lat,lng,accuracy}>
export function setNotifySettings({radius,delay,enabled});
export function startLocationWatch(shops, onNotify);  // dwell-based geofence
export function stopLocationWatch();
```

### services/reminders.js — expiry reminders (NEW)
```js
export function ensurePermission();                   // Notification.requestPermission wrapper -> 'granted'|...
export function syncReminders(shops, settings);       // schedule/refresh in-session timers + fire due ones
export function checkDueNow(shops, settings, onDue);  // called on load/visibility; uses domain.dueReminders
export function reminderState();                      // for tests/debug
// Persist "already notified" markers in localStorage keyed by shopId+threshold+date
// so a reminder fires at most once per threshold. Degrade gracefully if Notification
// unsupported/denied (fall back to in-app toast/badge via onDue callback).
```

### services/pwa.js — install + onboarding (NEW)
```js
export function registerSW();                         // navigator.serviceWorker
export function initInstallPrompt();                  // capture beforeinstallprompt
export function canInstall();                         // bool (deferred prompt available)
export function promptInstall();                      // Promise<outcome>
export function isStandalone();                       // display-mode standalone / iOS
export function isIos();                              // for manual-install hint
```

### services/backup.js
```js
export async function exportData();   // triggers JSON download {version,shops,logs,settings,exportedAt}
export async function importData(file);// validates, upserts via repo.normalize*, returns summary
```

### services/fx.js  (keep current behavior)
```js
export function haptic(intensity);    // light|medium|heavy, respects no-vibrate
export function celebrate();          // confetti, respects prefers-reduced-motion
```

### ui/toast.js
```js
export function showToast(msg, type='success');  // aria-live=polite region, auto-dismiss
```
### ui/overlay.js — accessible modal/bottom-sheet
```js
export function showSheet({title, body, actions, onClose});  // body: Node|string(trusted)
export function showConfirm({title, message, confirmLabel, danger});  // -> Promise<bool>
export function closeOverlay();
// REQUIREMENTS: focus trap, restore focus on close, ESC closes, backdrop click closes,
// role=dialog aria-modal=true aria-labelledby, body scroll lock. No inline onclick.
```
### ui/reward.js
```js
export function showReward({shopName, total});  // full-screen, reduced-motion aware, focus-managed
```
### ui/components.js — reusable view pieces (return Nodes, built via h)
```js
export function shopCard(shop, {onOpen, onQuickUse});  // keyboard-activatable (role/button semantics)
export function stampBoard(total, used);
export function summaryCard(value, label, accent);
export function timelineItem(log, shopName);
export function nearbyCard(shop, distance, onClick);
export function adBanner({slotId});
export function skinSelector(currentSkin, onSelect);
export function emptyState({icon, title, desc, actions});
```

## 3. views/* (each exports `export function render(ctx, params)` returning an Element)
ctx = `{ store, actions, router, services }`. Views are pure of persistence; they read
`store.getState()` and call `actions.*`. Re-render by re-invoking render through router
or via store subscription where a live region is needed.

- **home.js**: hero (priority copy), summary stats row, ad banner, priority panel,
  nearby (if location on), horizontal shop rail (smart-sorted top 10), empty state.
- **list.js**: status tabs + category chips + search + sort + 2-col grid; live filtering
  via domain.filterShops/sortShops.
- **detail.js**: skinned header, quick actions (전화/지도/만료), memo, progress, stamp
  board, use/edit/undo actions, usage timeline, ad. Use **consistent maps provider**
  for 지도 + 길찾기 (use Google Maps directions for both; see §5).
- **edit.js**: add/edit form, live stamp preview, set-current-location, skin selector,
  delete (edit mode). Validation via repo.normalizeShop.
- **map.js**: Leaflet map, user marker + accuracy circle, status-colored pins, floating
  selected-shop card, summary, nearby list, directions.
- **history.js**: all logs timeline, empty state.
- **settings.js**: stats panel; toggles for 위치 알림 AND 만료 알림(NEW); radius/delay;
  reminderDays selector(NEW); install app button(NEW, when canInstall/iOS hint);
  backup/restore; demo; clear-all; about/version.
- **onboarding.js** (NEW): 3-step first-run intro (what it does → add or sample →
  enable reminders/location). Shown when `!settings.onboarded`; sets onboarded=true.
  Skippable. Accessible (focus, ESC).

## 4. actions (defined in app.js, injected into ctx)
```
useCoupon(shopId, note?)      // +1 used, log (+location if available), reward+confetti on complete, persist, refresh
undoLastCoupon(shopId)        // confirm, -1, delete last log
saveShop(data, id?)           // add/update via repo
deleteShop(id)
setFilter(patch)              // ui.filter
toggleNotify(bool) / saveNotifySettings({radius,delay})
toggleReminders(bool) / setReminderDays(arr)
seedDemo() / clearAll() / exportData() / importData(file)
completeOnboarding() / requestInstall()
```
All actions: mutate via repo -> refresh store slices -> trigger re-render -> resync
location/reminder services as needed.

## 5. Consistency fixes (carry into rewrite)
- Single maps provider: Google Maps for both "지도" view-on-map and "길찾기".
  `mapViewUrl(shop)` and `mapsDirectionsUrl(shop)` live in services (one helper file,
  e.g. services/format.js or a small services/maps.js).
- Single status/expiry source: domain.js only.
- E2E test must delete the REAL db name `CouponBookDB` (old test used wrong name).

## 6. Accessibility requirements (apply throughout)
- All interactive controls are real `<button>`/`<a>` or have role+tabindex+key handlers.
- Toggle switches: `role="switch"` + `aria-checked`, keyboard toggle (Enter/Space).
- Status tabs/chips: `role="tab"`/`aria-selected` or `aria-pressed` for chips.
- Modals/sheets: focus trap, ESC, restore focus, aria-modal, labelled.
- Toast region: `aria-live="polite"`.
- Inputs have associated `<label>` (htmlFor/id).
- Icons decorative => `aria-hidden`; icon-only buttons have `aria-label`.
- Respect `prefers-reduced-motion` for confetti/reward/anim.
- Visible focus outline (`:focus-visible`).
- Central icon registry in h.js (`icon(name)`), reused everywhere.

## 7. PWA
- `sw.js`: cache-first-with-network-update (stale-while-revalidate) for same-origin GET;
  precache app shell + all v3 modules; bump cache name to `coupon-book-v5`; navigation
  fallback to `./index.html`; never cache cross-origin (leaflet tiles, fonts).
- `manifest.json`: keep; ensure relative `start_url`/`scope` (`.`/`./`), categories,
  lang `ko`, add `shortcuts` (홈 추가) optional.
- Register SW + init install prompt in app bootstrap.

## 8. Testing (requirement-driven)
- Unit (node --test): domain.js (status tiers, daysUntil edge cases, expiring, sort,
  filter, stats, dueReminders), repo normalize (clamping), format, location.haversine.
- E2E (Playwright): onboarding → seed → use coupon (toast/reward) → undo →
  filter on list → settings toggles → backup export → tabs navigate; assert no console
  errors. Reset via correct DB name.
- Keep `node --test` and `playwright` scripts.

## 9. Quality bar
KISS/YAGNI, functions single-purpose, ≤3 indent levels, comments only where intent is
non-obvious, consistent naming, no dead code, no console noise in production paths.
