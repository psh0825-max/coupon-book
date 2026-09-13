// services/reminders.js — expiry reminders on two tracks:
//   1. on-open check (all runtimes): shops crossing a threshold today → onDue
//      (in-app toast) and, where the runtime posts to a tray while the app is
//      open (web Notification API / Android shell), a system notification.
//   2. scheduled reminders (native only): every future D-n moment is registered
//      with the OS (iOS UNUserNotificationCenter / Android AlarmManager) so the
//      user is reminded even when the app is closed.
// Degrades gracefully when notifications are unsupported or denied: onDue always
// fires so the app can show the in-app fallback.

import { daysUntil, dueReminders, lowBalancePasses, remainingValue, reminderSchedule, reminderId } from '../domain.js';
import { formatWon } from './format.js';
import * as platform from '../platform.js';

let _scheduleTimer = null;

export async function ensurePermission() {
  return platform.requestNotifyPermission();
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

export function expiryLabel(days) {
  if (days === 0) return '오늘 만료';
  return `D-${days}`;
}

// iOS shows the in-app toast only: the scheduled D-n notification covers the
// closed-app case and a tray banner while the app is open would just duplicate it.
const postsWhileOpen = !platform.isIOS;

/**
 * checkDueNow(shops, settings, onDue) — fire each due reminder at most once per
 * threshold per day. Async because native permission checks are.
 */
export async function checkDueNow(shops, settings, onDue) {
  if (!settings || !settings.remindersEnabled) return;
  const granted = postsWhileOpen ? await platform.canNotify() : false;

  const due = dueReminders(shops, settings.reminderDays);
  for (const shop of due) {
    const days = daysUntil(shop.expiresAt);
    if (days === null) continue;
    const key = markerKey(shop.id, days);
    if (alreadyFired(key)) continue;
    markFired(key);

    if (granted) {
      platform.notify('쿠폰 만료 임박', `${shop.name} · ${expiryLabel(days)}`, {
        id: reminderId(shop.id, days), tag: `cb_reminder:${shop.id}:${days}`
      }).catch(() => {});
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
      platform.notify('잔액 임박', `${shop.name} · ${formatWon(remaining)} 남음`, {
        id: reminderId(shop.id, 'balance'), tag: `cb_balalert:${shop.id}`
      }).catch(() => {});
    }
    if (typeof onDue === 'function') onDue(shop, { type: 'lowbalance', remaining });
  }
}

/**
 * syncScheduledReminders(shops, settings) — replace the OS-level schedule with the
 * full desired set (or clear it when reminders are off). Debounced: data changes
 * arrive in bursts. No-op on the web (the service worker's periodic sync covers it).
 */
export function syncScheduledReminders(shops, settings) {
  if (!platform.supportsScheduledReminders) return;
  if (_scheduleTimer) clearTimeout(_scheduleTimer);
  _scheduleTimer = setTimeout(async () => {
    _scheduleTimer = null;
    const enabled = !!(settings && settings.remindersEnabled);
    const entries = enabled
      ? reminderSchedule(shops, settings.reminderDays).map(({ shop, days, at }) => ({
        id: reminderId(shop.id, days),
        title: '쿠폰 만료 임박',
        body: `${shop.name} · ${expiryLabel(days)} — 만료 전에 챙기세요`,
        at
      }))
      : [];
    try {
      await platform.replaceScheduledReminders(entries);
    } catch { /* best-effort */ }
  }, 800);
}

/** syncReminders(shops, settings, onDue) — run the on-open check + refresh the schedule. */
export function syncReminders(shops, settings, onDue) {
  checkDueNow(shops, settings, onDue).catch(() => {});
  syncScheduledReminders(shops, settings);
}
