// services/reminders.js — expiry local reminders. Degrades gracefully when the
// Notification API is unsupported or denied: always calls onDue so the app can
// show an in-app badge/toast fallback.

import { daysUntil, dueReminders, lowBalancePasses, remainingValue } from '../domain.js';
import { formatWon } from './format.js';

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

  const granted = typeof window !== 'undefined' && 'Notification' in window
    && Notification.permission === 'granted';

  const due = dueReminders(shops, settings.reminderDays);
  for (const shop of due) {
    const days = daysUntil(shop.expiresAt);
    if (days === null) continue;
    const key = markerKey(shop.id, days);
    if (alreadyFired(key)) continue;
    markFired(key);

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

    if (typeof onDue === 'function') onDue(shop, { type: 'expiry', days });
  }

  // Low-balance alerts for amount passes (잔액 20% 이하), at most once per day each.
  for (const shop of lowBalancePasses(shops)) {
    const key = balanceMarkerKey(shop.id);
    if (alreadyFired(key)) continue;
    markFired(key);
    const remaining = remainingValue(shop);

    if (granted) {
      try {
        new Notification('잔액 임박', {
          body: `${shop.name} · ${formatWon(remaining)} 남음`,
          tag: `cb_balalert:${shop.id}`
        });
      } catch (e) {
        // construction can throw on some platforms — fall through to onDue
      }
    }

    if (typeof onDue === 'function') onDue(shop, { type: 'lowbalance', remaining });
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
