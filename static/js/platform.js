// platform.js — ONE API over three runtimes. Every OS-touching call in the app
// goes through here so views/services never branch on "where am I running":
//
//   ios     → Capacitor plugins (Filesystem/Share/LocalNotifications/Geolocation/
//             Haptics/StatusBar/SplashScreen/Preferences/Browser/App/AdMob),
//             reached through the vendored @capacitor/core (vendor/capacitor/core.js)
//             so the app stays build-free. Loaded lazily and only on native.
//   android → the WebView shell's `window.AndroidBridge` (webview-app/) for
//             files/notifications/alarms, browser APIs for the rest.
//   web     → browser APIs (blob download, Notification API, navigator.*).
//
// Every function degrades gracefully: unsupported → resolves false/null, never throws
// for optional features (haptics, notifications, snapshots).

const win = typeof window !== 'undefined' ? window : undefined;
const nav = typeof navigator !== 'undefined' ? navigator : { userAgent: '' };

const cap = win && win.Capacitor;
const capNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
const bridge = win && win.AndroidBridge ? win.AndroidBridge : null;

/** 'ios' | 'android' | 'web' */
export const platform = capNative ? String(cap.getPlatform()) : (bridge ? 'android' : 'web');
/** true inside either native shell (Capacitor iOS or the Android WebView app). */
export const isNative = capNative || !!bridge;
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';

/** App context = native shell OR a WebView tagged with our user-agent marker.
 *  Used to keep website-only products (AdSense, PWA install) out of the apps. */
export function isAppContext() {
  return isNative || /CouponBookApp/i.test(nav.userAgent || '');
}

// ── Capacitor plugin access (native only) ────────────────────────────────────
let _corePromise = null;
const _plugins = new Map();

function loadCore() {
  if (!_corePromise) _corePromise = import('../vendor/capacitor/core.js');
  return _corePromise;
}

/** plugin(name) -> Promise<proxy> (native only; rejects on web/android). */
export async function plugin(name) {
  if (!capNative) throw new Error(`Capacitor plugin ${name} unavailable on ${platform}`);
  if (!_plugins.has(name)) {
    const core = await loadCore();
    _plugins.set(name, core.registerPlugin(name));
  }
  return _plugins.get(name);
}

// Warm the core module early so the first plugin call has no import latency.
if (capNative) loadCore().catch(() => {});

// ── Small helpers ─────────────────────────────────────────────────────────────
const ls = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* noop */ } }
};

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Files ─────────────────────────────────────────────────────────────────────
/**
 * saveTextFile(filename, content, { mime }) -> Promise<{ ok, where, shared?, toasted? }>
 *   ios:     written to the app's Documents folder (visible in Files) and offered
 *            through the share sheet (Files / iCloud Drive / AirDrop / Mail …).
 *   android: saved to Downloads by the shell (which shows its own toast).
 *   web:     regular browser download.
 */
export async function saveTextFile(filename, content, { mime = 'application/json' } = {}) {
  if (capNative) {
    const Filesystem = await plugin('Filesystem');
    const { uri } = await Filesystem.writeFile({
      path: filename, data: content, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true
    });
    let shared = false;
    try {
      const Share = await plugin('Share');
      await Share.share({ title: filename, files: [uri], dialogTitle: '백업 파일 저장' });
      shared = true;
    } catch { /* share sheet dismissed — the file is still in Documents */ }
    return { ok: true, where: 'documents', shared };
  }
  if (bridge && typeof bridge.saveText === 'function') {
    bridge.saveText(filename, content);
    return { ok: true, where: 'downloads', toasted: true };
  }
  downloadBlob(filename, content, mime);
  return { ok: true, where: 'download' };
}

/** pickTextFile({ accept }) -> Promise<File|null> via a transient file input. */
export function pickTextFile({ accept = '.json,application/json' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const finish = (file) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file || null);
    };
    input.addEventListener('change', () => finish(input.files && input.files[0]));
    // Modern engines (Chrome 113+, Safari 16.4+) fire `cancel`; older ones simply
    // leave the promise pending, which callers treat as "nothing picked".
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

// ── Durable snapshot (auto-backup of the whole database) ─────────────────────
const SNAPSHOT_PATH = 'coupon-book/snapshot.json';
const SNAPSHOT_LS_KEY = 'cb_snapshot';

/** writeSnapshot(json) -> Promise<boolean> */
export async function writeSnapshot(json) {
  if (capNative) {
    try {
      const Filesystem = await plugin('Filesystem');
      await Filesystem.writeFile({
        path: SNAPSHOT_PATH, data: json, directory: 'DATA', encoding: 'utf8', recursive: true
      });
      return true;
    } catch { return false; }
  }
  if (json.length > 4 * 1024 * 1024) return false; // keep well inside localStorage quota
  return ls.set(SNAPSHOT_LS_KEY, json);
}

/** readSnapshot() -> Promise<string|null> */
export async function readSnapshot() {
  if (capNative) {
    try {
      const Filesystem = await plugin('Filesystem');
      const { data } = await Filesystem.readFile({ path: SNAPSHOT_PATH, directory: 'DATA', encoding: 'utf8' });
      return typeof data === 'string' ? data : null;
    } catch { return null; }
  }
  return ls.get(SNAPSHOT_LS_KEY);
}

// ── Preferences (tiny durable key/value, outside IndexedDB) ──────────────────
export async function prefGet(key) {
  if (capNative) {
    try {
      const Preferences = await plugin('Preferences');
      const { value } = await Preferences.get({ key });
      return value == null ? null : value;
    } catch { return null; }
  }
  return ls.get(`cb_pref:${key}`);
}

export async function prefSet(key, value) {
  if (capNative) {
    try {
      const Preferences = await plugin('Preferences');
      await Preferences.set({ key, value: String(value) });
      return true;
    } catch { return false; }
  }
  return ls.set(`cb_pref:${key}`, String(value));
}

// ── Notifications ─────────────────────────────────────────────────────────────
/** canNotify() -> Promise<boolean> — permission currently granted. */
export async function canNotify() {
  if (capNative) {
    try {
      const LocalNotifications = await plugin('LocalNotifications');
      const { display } = await LocalNotifications.checkPermissions();
      return display === 'granted';
    } catch { return false; }
  }
  if (bridge && typeof bridge.canNotify === 'function') {
    try { return !!bridge.canNotify(); } catch { return false; }
  }
  return !!(win && 'Notification' in win && Notification.permission === 'granted');
}

/** requestNotifyPermission() -> Promise<'granted'|'denied'|'unsupported'> — call only
 *  from a user gesture that enables reminders. */
export async function requestNotifyPermission() {
  if (capNative) {
    try {
      const LocalNotifications = await plugin('LocalNotifications');
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted' ? 'granted' : 'denied';
    } catch { return 'unsupported'; }
  }
  if (bridge) return (await canNotify()) ? 'granted' : 'denied'; // the shell asks at launch
  if (win && 'Notification' in win) {
    try {
      const r = await Notification.requestPermission();
      return r === 'granted' ? 'granted' : 'denied';
    } catch { return 'denied'; }
  }
  return 'unsupported';
}

/** notify(title, body, { id, tag }) -> Promise<boolean> — immediate system notification. */
export async function notify(title, body, { id, tag } = {}) {
  if (capNative) {
    try {
      const LocalNotifications = await plugin('LocalNotifications');
      await LocalNotifications.schedule({ notifications: [{
        id: id || (Date.now() % 2000000000), title, body,
        schedule: { at: new Date(Date.now() + 500) }
      }] });
      return true;
    } catch { return false; }
  }
  if (bridge && typeof bridge.showNotification === 'function') {
    try { bridge.showNotification(title, body); return true; } catch { return false; }
  }
  if (win && 'Notification' in win && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag }); return true; } catch { return false; }
  }
  return false;
}

const SCHEDULED_IDS_KEY = 'cb_scheduled_ids';

/**
 * replaceScheduledReminders(entries) -> Promise<number scheduled>
 *   entries: [{ id:int32, title, body, at:Date|ms }] — the FULL desired set; anything
 *   previously scheduled by us is cancelled first. Fires even when the app is closed
 *   (iOS UNUserNotificationCenter / Android AlarmManager). No-op on the web.
 */
export async function replaceScheduledReminders(entries) {
  const list = (entries || []).map((e) => ({ ...e, at: new Date(e.at) })).filter((e) => e.at.getTime() > Date.now());
  if (capNative) {
    try {
      const LocalNotifications = await plugin('LocalNotifications');
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending && pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
      if (!list.length) return 0;
      // iOS keeps at most 64 pending local notifications — schedule the soonest.
      const batch = list.sort((a, b) => a.at - b.at).slice(0, 60);
      await LocalNotifications.schedule({ notifications: batch.map((e) => ({
        id: e.id, title: e.title, body: e.body, schedule: { at: e.at, allowWhileIdle: true }
      })) });
      return batch.length;
    } catch { return 0; }
  }
  if (bridge && typeof bridge.scheduleReminder === 'function') {
    let previous = [];
    try { previous = JSON.parse(ls.get(SCHEDULED_IDS_KEY) || '[]'); } catch { previous = []; }
    for (const id of previous) { try { bridge.cancelReminder(id); } catch { /* noop */ } }
    for (const e of list) { try { bridge.scheduleReminder(e.id, e.title, e.body, e.at.getTime()); } catch { /* noop */ } }
    ls.set(SCHEDULED_IDS_KEY, JSON.stringify(list.map((e) => e.id)));
    return list.length;
  }
  return 0;
}

export async function scheduleReminder(id, title, body, whenMillis) {
  return replaceScheduledReminders([{ id, title, body, at: whenMillis }]);
}

export async function cancelReminder(id) {
  if (capNative) {
    try {
      const LocalNotifications = await plugin('LocalNotifications');
      await LocalNotifications.cancel({ notifications: [{ id }] });
      return true;
    } catch { return false; }
  }
  if (bridge && typeof bridge.cancelReminder === 'function') {
    try { bridge.cancelReminder(id); return true; } catch { return false; }
  }
  return false;
}

// ── Location ──────────────────────────────────────────────────────────────────
const GEO_OPTS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 };

function toPos(pos) {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

/** hasLocationPermission() -> Promise<boolean> — true only when already granted
 *  (never prompts), so background conveniences can skip the OS dialog. */
export async function hasLocationPermission() {
  if (capNative) {
    try {
      const Geolocation = await plugin('Geolocation');
      const { location } = await Geolocation.checkPermissions();
      return location === 'granted';
    } catch { return false; }
  }
  try {
    if (nav.permissions && nav.permissions.query) {
      const st = await nav.permissions.query({ name: 'geolocation' });
      return st.state === 'granted';
    }
  } catch { /* unsupported */ }
  return false;
}

/** getCurrentPosition() -> Promise<{lat,lng,accuracy}> (prompts on first use) */
export async function getCurrentPosition(opts = {}) {
  const options = { ...GEO_OPTS, ...opts };
  if (capNative) {
    const Geolocation = await plugin('Geolocation');
    return toPos(await Geolocation.getCurrentPosition(options));
  }
  return new Promise((resolve, reject) => {
    if (!nav.geolocation) { reject(new Error('Geolocation not supported')); return; }
    nav.geolocation.getCurrentPosition((p) => resolve(toPos(p)), reject, options);
  });
}

/** watchPosition(onPos, onErr, opts) -> { stop() } */
export function watchPosition(onPos, onErr, opts = {}) {
  const options = { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000, ...opts };
  let stopped = false;
  if (capNative) {
    let idPromise = plugin('Geolocation').then((Geolocation) =>
      Geolocation.watchPosition(options, (pos, err) => {
        if (stopped) return;
        if (err) onErr?.(err);
        else if (pos) onPos?.(toPos(pos));
      })
    ).catch((e) => { onErr?.(e); return null; });
    return {
      stop() {
        stopped = true;
        idPromise.then(async (id) => {
          if (!id) return;
          try { (await plugin('Geolocation')).clearWatch({ id }); } catch { /* noop */ }
        });
      }
    };
  }
  if (!nav.geolocation) { onErr?.(new Error('Geolocation not supported')); return { stop() {} }; }
  const id = nav.geolocation.watchPosition((p) => onPos?.(toPos(p)), (e) => onErr?.(e), options);
  return { stop() { stopped = true; nav.geolocation.clearWatch(id); } };
}

// ── Haptics ───────────────────────────────────────────────────────────────────
const VIBRATE = { light: 10, medium: 20, heavy: [30, 40, 30], success: [12, 60, 18], warning: [20, 40, 20], error: [40, 60, 40], selection: 6 };

/** haptic(kind) — light|medium|heavy|success|warning|error|selection. Fire-and-forget. */
export function haptic(kind = 'light') {
  if (capNative) {
    plugin('Haptics').then((Haptics) => {
      if (kind === 'success' || kind === 'warning' || kind === 'error') {
        return Haptics.notification({ type: kind.toUpperCase() });
      }
      if (kind === 'selection') return Haptics.selectionChanged();
      return Haptics.impact({ style: (kind === 'heavy' || kind === 'medium') ? kind.toUpperCase() : 'LIGHT' });
    }).catch(() => {});
    return;
  }
  if (!nav.vibrate) return;
  try { nav.vibrate(VIBRATE[kind] || VIBRATE.light); } catch { /* noop */ }
}

// ── External links / maps ─────────────────────────────────────────────────────
/**
 * openExternal(url, { inApp }) — leave the app for a URL (maps, tel:, mailto:, web).
 *   ios:     http(s) with inApp → in-app Safari sheet; everything else → system
 *            (Apple Maps / Phone / Safari) through Capacitor's window.open bridge.
 *   android: the shell's shouldOverrideUrlLoading hands non-app URLs to an Intent.
 *   web:     new tab (http) or same-window navigation for tel:/mailto:.
 */
export async function openExternal(url, { inApp = false } = {}) {
  if (!url) return false;
  const isHttp = /^https?:/i.test(url);
  if (capNative) {
    if (isHttp && inApp) {
      try {
        const Browser = await plugin('Browser');
        await Browser.open({ url, presentationStyle: 'popover' });
        return true;
      } catch { /* fall through to system open */ }
    }
    win.open(url, '_blank');
    return true;
  }
  if (bridge) {
    win.location.href = url;
    return true;
  }
  if (isHttp) {
    const w = win.open(url, '_blank', 'noopener');
    if (!w) win.location.href = url;
  } else {
    win.location.href = url;
  }
  return true;
}

/** Maps provider for the current runtime: Apple Maps on iOS, Google Maps elsewhere. */
export const mapsProvider = isIOS ? 'apple' : 'google';

function mapsQuery(lat, lng, name) {
  const hasCoord = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== null && lng !== null && lat !== '' && lng !== '';
  return { hasCoord, coord: hasCoord ? `${Number(lat)},${Number(lng)}` : '', name: name ? String(name).trim() : '' };
}

/** directionsUrl(lat, lng, name|address) -> '' when there is nothing to navigate to. */
export function directionsUrl(lat, lng, name) {
  const q = mapsQuery(lat, lng, name);
  if (!q.hasCoord && !q.name) return '';
  if (mapsProvider === 'apple') {
    const p = new URLSearchParams();
    if (q.hasCoord) { p.set('daddr', q.coord); if (q.name) p.set('q', q.name); }
    else p.set('daddr', q.name);
    p.set('dirflg', 'd');
    return `https://maps.apple.com/?${p.toString()}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q.hasCoord ? q.coord : q.name)}`;
}

/** mapViewUrl(lat, lng, name|address) -> '' when there is nothing to show. */
export function mapViewUrl(lat, lng, name) {
  const q = mapsQuery(lat, lng, name);
  if (!q.hasCoord && !q.name) return '';
  if (mapsProvider === 'apple') {
    const p = new URLSearchParams();
    if (q.hasCoord) { p.set('ll', q.coord); p.set('q', q.name || q.coord); }
    else p.set('q', q.name);
    return `https://maps.apple.com/?${p.toString()}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.hasCoord ? q.coord : q.name)}`;
}

export function openDirections(lat, lng, name) {
  return openExternal(directionsUrl(lat, lng, name));
}

// ── App chrome / lifecycle (native) ──────────────────────────────────────────
/** Dark status-bar text over our light UI; hide the splash once the first view is up. */
export async function applyNativeChrome() {
  if (!capNative) return;
  try { (await plugin('StatusBar')).setStyle({ style: 'LIGHT' }); } catch { /* noop */ }
}

export async function hideSplash() {
  if (!capNative) return;
  try { await (await plugin('SplashScreen')).hide({ fadeOutDuration: 250 }); } catch { /* noop */ }
}

/**
 * onAppState({ onResume, onPause }) — native foreground/background hooks; the web
 * falls back to visibilitychange so callers register once.
 */
export function onAppState({ onResume, onPause } = {}) {
  if (capNative) {
    plugin('App').then((App) => {
      App.addListener('appStateChange', ({ isActive }) => { if (isActive) onResume?.(); else onPause?.(); });
    }).catch(() => {});
    return;
  }
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onResume?.(); else onPause?.();
  });
}

/** Android WebView cannot open file pickers (no onShowFileChooser in the shell). */
export const canPickFiles = !bridge;

/** Service workers / PWA install only make sense on the website. */
export const supportsPWA = !isNative && !!(win && 'serviceWorker' in nav);

export const supportsScheduledReminders = capNative || !!(bridge && typeof bridge.scheduleReminder === 'function');
