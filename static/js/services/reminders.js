// services/reminders.js — expiry local reminders. Degrades gracefully when the
// Notification API is unsupported or denied: always calls onDue so the app can
// show an in-app badge/toast fallback.

import { daysUntil, dueReminders } from '../domain.js';

// Latest inputs, kept in module scope so the visibilitychange listener re-runs
// checkDueNow with fresh data without re-binding.
let _shops = [];
let _settings = {};
let _onDue = null;
let _listenerAttached = false;

export async function ensurePermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return await Notification.requestPermission();
  }
  return 'unsupported';
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

function alreadyFired(shopId, days) {
  try {
    return localStorage.getItem(markerKey(shopId, days)) === '1';
  } catch (e) {
    return false;
  }
}

function markFired(shopId, days) {
  try {
    localStorage.setItem(markerKey(shopId, days), '1');
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

  const granted = typeof window !== 'undefined' && 'Notification' in window
    && Notification.permission === 'granted';

  const due = dueReminders(shops, settings.reminderDays);
  for (const shop of due) {
    const days = daysUntil(shop.expiresAt);
    if (days === null) continue;
    if (alreadyFired(shop.id, days)) continue;
    markFired(shop.id, days);

    if (granted) {
      try {
        new Notification('쿠폰 만료 임박', {
          body: `${shop.name} · ${expiryLabel(days)}`,
          tag: `cb_reminder:${shop.id}:${days}`
        });
      } catch (e) {
        // construction can throw on some platforms — fall through to onDue
      }
    }

    if (typeof onDue === 'function') onDue(shop, days);
  }
}

export function syncReminders(shops, settings, onDue) {
  _shops = shops;
  _settings = settings;
  _onDue = onDue;

  checkDueNow(_shops, _settings, _onDue);

  if (!_listenerAttached && typeof document !== 'undefined') {
    _listenerAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkDueNow(_shops, _settings, _onDue);
      }
    });
  }
}

export function reminderState() {
  const permission = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission : 'unsupported';
  return { permission, enabled: !!_settings.remindersEnabled };
}
