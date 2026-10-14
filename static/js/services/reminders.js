// services/reminders.js — expiry local reminders. Degrades gracefully when the
// Notification API is unsupported or denied: always calls onDue so the app can
// show an in-app badge/toast fallback.

import { daysUntil, dueReminders, reminderThreshold, lowBalancePasses, remainingValue, isCompleted } from '../domain.js';
import { formatWon } from './format.js';

// Latest inputs, kept in module scope so the visibilitychange listener re-runs
// checkDueNow with fresh data without re-binding.
let _shops = [];
let _settings = {};
let _onDue = null;
let _persistMarkers = null;
let _listenerAttached = false;

export async function ensurePermission() {
  // Newer native shells expose an explicit request so the OS prompt appears
  // only after the user turns reminders on. Older shells asked at launch and
  // can only report their current state.
  const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
  if (bridge && typeof bridge.requestNotificationPermission === 'function') {
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId;
      const nativeState = () => bridge.canNotify() ? 'granted' : 'denied';
      const settle = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        delete window.__cbNotifyPermission;
        resolve(result);
      };

      window.__cbNotifyPermission = (granted) => settle(granted === true ? 'granted' : 'denied');
      timeoutId = setTimeout(() => settle(nativeState()), 60000);
      try {
        bridge.requestNotificationPermission();
      } catch (e) {
        settle(nativeState());
      }
    });
  }
  if (bridge && typeof bridge.canNotify === 'function') {
    return bridge.canNotify() ? 'granted' : 'denied';
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return await Notification.requestPermission();
  }
  return 'unsupported';
}

// Post a system notification: the native bridge in the app shell (a bare WebView
// has no Notification API), else the web Notification API when granted. The in-app
// onDue toast fires regardless, so this is purely the OS-level surface.
function pushNotification(title, body, tag) {
  const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
  if (bridge && typeof bridge.showNotification === 'function') {
    bridge.showNotification(title, body);
    return true;
  }
  if (typeof window !== 'undefined' && 'Notification' in window
    && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag }); return true; } catch (e) { return false; }
  }
  return false;
}

function todayKey() {
  const d = new Date(Date.now());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// Keyed by the reminder *window*, not the calendar day: a window fires once per
// (pass, expiry date), so a late delivery does not then repeat every single day
// until expiry. Including expiresAt means editing the date re-arms the reminders.
function markerKey(shopId, expiresAt, threshold) {
  return `cb_reminder:${shopId}:${expiresAt || 'none'}:t${threshold}`;
}

function balanceMarkerKey(shopId) {
  return `cb_balalert:${shopId}:${todayKey()}`;
}

function alreadyFired(key, settings) {
  if (settings && settings.reminderMarkers && settings.reminderMarkers[key]) return true;
  try {
    return localStorage.getItem(key) === '1';
  } catch (e) {
    return false;
  }
}

function markFired(key) {
  try {
    localStorage.setItem(key, '1');
  } catch (e) {
    // storage unavailable/full — best-effort, ignore
  }
}

function expiryLabel(days) {
  if (days === 0) return '오늘 만료';
  return `D-${days}`;
}

export function pruneReminderMarkers(markers, now) {
  if (!markers || typeof markers !== 'object' || Array.isArray(markers)) return {};
  const today = new Date(now);
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const out = {};
  for (const [key, value] of Object.entries(markers)) {
    const match = /^cb_reminder:[^:]+:([^:]+):t[^:]+$/.exec(key);
    if (!match || (match[1] !== 'none' && match[1] >= todayValue)) out[key] = value;
  }
  return out;
}

export function checkDueNow(shops, settings, onDue) {
  if (!settings || !settings.remindersEnabled) return;

  const nativeAlarms = typeof window !== 'undefined'
    && window.AndroidBridge && typeof window.AndroidBridge.scheduleReminder === 'function';
  const newMarkers = {};
  const due = dueReminders(shops, settings.reminderDays);
  for (const shop of due) {
    const days = daysUntil(shop.expiresAt);
    const threshold = reminderThreshold(shop, settings.reminderDays);
    if (days === null || threshold === null) continue;
    const key = markerKey(shop.id, shop.expiresAt, threshold);
    if (alreadyFired(key, settings)) continue;
    markFired(key);
    newMarkers[key] = Date.now();

    // Android's scheduled alarm owns OS notifications in the app shell.
    if (!nativeAlarms) pushNotification('이용권 만료 임박', `${shop.name} · ${expiryLabel(days)}`, `cb_reminder:${shop.id}:${days}`);
    if (typeof onDue === 'function') onDue(shop, { type: 'expiry', days });
  }

  // Low-balance alerts for amount passes (잔액 20% 이하), at most once per day each.
  for (const shop of lowBalancePasses(shops)) {
    const key = balanceMarkerKey(shop.id);
    if (alreadyFired(key)) continue;
    markFired(key);
    const remaining = remainingValue(shop);

    if (!nativeAlarms) pushNotification('잔액 임박', `${shop.name} · ${formatWon(remaining)} 남음`, `cb_balalert:${shop.id}`);
    if (typeof onDue === 'function') onDue(shop, { type: 'lowbalance', remaining });
  }
  if (Object.keys(newMarkers).length && typeof _persistMarkers === 'function') {
    _persistMarkers(pruneReminderMarkers({ ...(settings.reminderMarkers || {}), ...newMarkers }, Date.now()));
  }
}

export function reminderId(shopId, d) {
  let hsh = 0;
  const s = String(shopId);
  for (let i = 0; i < s.length; i++) hsh = (hsh * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hsh % 1000000) * 10 + (d % 10);
}

// ms at 10:00 local, d days before the expiry date; null if no valid date.
export function triggerTimeFor(dateStr, d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  t.setDate(t.getDate() - d);
  t.setHours(10, 0, 0, 0);
  return t.getTime();
}

// Native app shell: hand upcoming expiry thresholds to Android (AlarmManager) so
// reminders fire even when the app is closed — a bare WebView cannot run the
// service-worker periodic sync the TWA relied on. Idempotent (same id updates).
export function nativeReminderPlan(shops, settings, now = Date.now()) {
  const desired = {};
  if (!settings || !settings.remindersEnabled) return desired;
  const days = Array.isArray(settings.reminderDays) ? settings.reminderDays : [7, 3, 1];
  for (const shop of (shops || [])) {
    if (!shop.expiresAt || isCompleted(shop)) continue;
    for (const d of days) {
      const when = triggerTimeFor(shop.expiresAt, d);
      if (when != null && when > now) {
        desired[reminderId(shop.id, d)] = { title: '이용권 만료 임박', body: `${shop.name} · ${expiryLabel(d)}`, when };
      }
    }
  }
  return desired;
}

function storedNativeIds() {
  try {
    const ids = JSON.parse(localStorage.getItem('cb_native_reminder_ids'));
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : null;
  } catch (e) { return null; }
}

function storeNativeIds(ids) {
  try { localStorage.setItem('cb_native_reminder_ids', JSON.stringify(ids)); } catch (e) { /* best-effort */ }
}

function scheduleNativeReminders(shops, settings) {
  const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
  if (!bridge || typeof bridge.scheduleReminder !== 'function') return;
  const desired = nativeReminderPlan(shops, settings, Date.now());
  const desiredIds = Object.keys(desired).map(Number);
  const previous = storedNativeIds();
  if (typeof bridge.cancelReminder === 'function') {
    const cancel = previous === null
      ? (shops || []).flatMap((shop) => Array.from({ length: 10 }, (_, d) => reminderId(shop.id, d)))
      : previous;
    for (const id of new Set(cancel)) if (!Object.prototype.hasOwnProperty.call(desired, id)) bridge.cancelReminder(id);
  }
  for (const [id, reminder] of Object.entries(desired)) bridge.scheduleReminder(Number(id), reminder.title, reminder.body, reminder.when);
  storeNativeIds(desiredIds);
}

export function syncReminders(shops, settings, onDue, opts = {}) {
  _shops = shops;
  _settings = settings;
  _onDue = onDue;
  _persistMarkers = opts.persistMarkers;

  checkDueNow(_shops, _settings, _onDue);
  scheduleNativeReminders(_shops, _settings);

  if (!_listenerAttached && typeof document !== 'undefined') {
    _listenerAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkDueNow(_shops, _settings, _onDue);
      }
    });
  }
}
