// services/reminders.js — expiry local reminders. Degrades gracefully when the
// Notification API is unsupported or denied: always calls onDue so the app can
// show an in-app badge/toast fallback.

import { daysUntil, dueReminders, lowBalancePasses, remainingValue, isCompleted } from '../domain.js';
import { formatWon } from './format.js';

// Latest inputs, kept in module scope so the visibilitychange listener re-runs
// checkDueNow with fresh data without re-binding.
let _shops = [];
let _settings = {};
let _onDue = null;
let _listenerAttached = false;

export async function ensurePermission() {
  // Native app shell: notification permission is an Android runtime grant; the
  // WebView has no Notification API. Report the native state instead.
  const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
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

function markerKey(shopId, days) {
  return `cb_reminder:${shopId}:${days}:${todayKey()}`;
}

function balanceMarkerKey(shopId) {
  return `cb_balalert:${shopId}:${todayKey()}`;
}

function alreadyFired(key) {
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

export function checkDueNow(shops, settings, onDue) {
  if (!settings || !settings.remindersEnabled) return;

  const due = dueReminders(shops, settings.reminderDays);
  for (const shop of due) {
    const days = daysUntil(shop.expiresAt);
    if (days === null) continue;
    const key = markerKey(shop.id, days);
    if (alreadyFired(key)) continue;
    markFired(key);

    pushNotification('쿠폰 만료 임박', `${shop.name} · ${expiryLabel(days)}`, `cb_reminder:${shop.id}:${days}`);
    if (typeof onDue === 'function') onDue(shop, { type: 'expiry', days });
  }

  // Low-balance alerts for amount passes (잔액 20% 이하), at most once per day each.
  for (const shop of lowBalancePasses(shops)) {
    const key = balanceMarkerKey(shop.id);
    if (alreadyFired(key)) continue;
    markFired(key);
    const remaining = remainingValue(shop);

    pushNotification('잔액 임박', `${shop.name} · ${formatWon(remaining)} 남음`, `cb_balalert:${shop.id}`);
    if (typeof onDue === 'function') onDue(shop, { type: 'lowbalance', remaining });
  }
}

function reminderId(shopId, d) {
  let hsh = 0;
  const s = String(shopId);
  for (let i = 0; i < s.length; i++) hsh = (hsh * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hsh % 1000000) * 10 + (d % 10);
}

// ms at 10:00 local, d days before the expiry date; null if no valid date.
function triggerTimeFor(dateStr, d) {
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
function scheduleNativeReminders(shops, settings) {
  const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
  if (!bridge || typeof bridge.scheduleReminder !== 'function') return;
  if (!settings || !settings.remindersEnabled) return;
  const days = Array.isArray(settings.reminderDays) ? settings.reminderDays : [7, 3, 1];
  const now = Date.now();
  for (const shop of (shops || [])) {
    if (!shop.expiresAt || isCompleted(shop)) continue;
    for (const d of days) {
      const when = triggerTimeFor(shop.expiresAt, d);
      if (when == null || when <= now) continue;
      bridge.scheduleReminder(reminderId(shop.id, d), '쿠폰 만료 임박',
        `${shop.name} · ${expiryLabel(d)}`, when);
    }
  }
}

export function syncReminders(shops, settings, onDue) {
  _shops = shops;
  _settings = settings;
  _onDue = onDue;

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
