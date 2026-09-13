// domain.js — PURE business logic. The ONLY place coupon status/sort/filter/expiry
// math lives. No DOM, no IndexedDB; reads Date.now() only.

import { formatWon } from './services/format.js';

const DAY_MS = 86400000;

function parseDate(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) // local calendar date
    : new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** null if no/invalid date; calendar-day difference (end-of-day semantics). */
export function daysUntil(dateStr) {
  const target = parseDate(dateStr);
  if (!target) return null;
  const now = new Date(Date.now());
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - n.getTime()) / DAY_MS);
}

// ── Pass kind ────────────────────────────────────────────────────────────────
// Three kinds: 'stamp' (도장판 — collect stamps, completion is a REWARD),
// 'count' (횟수권 — prepaid sessions, completion is depletion) and 'amount'
// (금액권 — prepaid KRW). Records predating the concept have no `kind` and are
// treated as 'count'.
export const PASS_KINDS = ['stamp', 'count', 'amount'];

export function normalizeKind(kind) {
  return kind === 'amount' || kind === 'stamp' ? kind : 'count';
}

export function kindLabel(kind) {
  const k = normalizeKind(kind);
  return k === 'stamp' ? '도장판' : k === 'amount' ? '금액권' : '횟수권';
}

export function isAmountKind(shop) { return !!shop && shop.kind === 'amount'; }
export function isStampKind(shop) { return !!shop && shop.kind === 'stamp'; }
/** count-like passes use totalCoupons/usedCoupons: 'count' (incl. legacy) and 'stamp'. */
export function isCountKind(shop) { return !isAmountKind(shop); }

/** generic total (won for amount, sessions/stamps otherwise) */
export function passTotal(shop) {
  return isAmountKind(shop) ? num(shop.totalAmount) : num(shop.totalCoupons);
}

/** generic used (won for amount, sessions/stamps otherwise) */
export function passUsed(shop) {
  return isAmountKind(shop) ? num(shop.usedAmount) : num(shop.usedCoupons);
}

/** generic numeric remaining (won, sessions or stamps), never negative */
export function remainingValue(shop) {
  return Math.max(0, passTotal(shop) - passUsed(shop));
}

export function isCompleted(shop) {
  return passTotal(shop) > 0 && passUsed(shop) >= passTotal(shop);
}

export function isExpired(shop) {
  if (isCompleted(shop)) return false;
  const days = daysUntil(shop.expiresAt);
  return days !== null && days < 0;
}

export function isExpiringSoon(shop, within = 30) {
  if (isCompleted(shop)) return false;
  const days = daysUntil(shop.expiresAt);
  return days !== null && days >= 0 && days <= within;
}

/** Numeric remaining. Same as remainingValue; kept as a named export. */
export function remainingCount(shop) {
  return remainingValue(shop);
}

/** unit suffix for count-like passes: stamps '개', sessions '회' */
export function unitLabel(shop) {
  return isStampKind(shop) ? '개' : '회';
}

/** remaining as display text: amount '850,000원'; count '8회'; stamp '3개' */
export function remainingLabel(shop) {
  return isAmountKind(shop) ? formatWon(remainingValue(shop)) : `${remainingValue(shop)}${unitLabel(shop)}`;
}

/** total as display text */
export function totalLabel(shop) {
  return isAmountKind(shop) ? formatWon(passTotal(shop)) : `${passTotal(shop)}${unitLabel(shop)}`;
}

/** used as display text */
export function usedLabel(shop) {
  return isAmountKind(shop) ? formatWon(passUsed(shop)) : `${passUsed(shop)}${unitLabel(shop)}`;
}

export function progressPercent(shop) {
  const total = passTotal(shop);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(passUsed(shop) / total * 100)));
}

/** { key, label, className, score } — lower score = higher priority. */
export function couponStatus(shop) {
  if (isCompleted(shop)) {
    // A full stamp card is a prize to redeem; a used-up paid pass is just depleted.
    return isStampKind(shop)
      ? { key: 'done', label: '완성', className: 'success', score: 0 }
      : { key: 'done', label: '소진', className: 'success', score: 0 };
  }
  const days = daysUntil(shop.expiresAt);
  const remaining = remainingValue(shop);
  if (days !== null && days < 0) {
    return { key: 'expired', label: '만료됨', className: 'danger', score: 10 };
  }
  if (days !== null && days <= 7) {
    const label = days === 0 ? '오늘 만료' : `만료 D-${days}`;
    return { key: 'urgent', label, className: 'danger', score: 20 + days };
  }
  const total = passTotal(shop);
  if (isStampKind(shop)) {
    if (remaining <= 2) {
      return { key: 'almost', label: `${remaining}개만 더`, className: 'accent', score: 40 + remaining };
    }
  } else {
    const lowBalance = isAmountKind(shop)
      ? (total > 0 && remaining <= total * 0.2)
      : remaining <= 2;
    if (lowBalance) {
      const label = isAmountKind(shop) ? `${formatWon(remaining)} 남음` : `${remaining}회 남음`;
      return { key: 'low', label, className: 'warning', score: 40 + Math.min(remaining, 9) };
    }
  }
  if (days !== null && days <= 30) {
    return { key: 'soon', label: `만료 D-${days}`, className: 'warning', score: 60 + days };
  }
  return { key: 'neutral', label: isStampKind(shop) ? '적립 중' : '이용 중', className: 'neutral', score: 100 + Math.min(remaining, 99) };
}

export function formatExpiry(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return '만료 없음';
  if (days < 0) return '만료됨';
  if (days === 0) return '오늘 만료';
  return `D-${days}`;
}

/** next-best non-completed shop, or null */
export function priorityShop(shops) {
  const active = (shops || []).filter((s) => !isCompleted(s));
  if (!active.length) return null;
  return sortShops(active, 'smart')[0];
}

export function sortShops(shops, sortKey = 'smart') {
  const arr = [...(shops || [])];
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko');
  const comparators = {
    remaining: (a, b) => remainingCount(a) - remainingCount(b) || byName(a, b),
    updated: (a, b) => num(b.updatedAt) - num(a.updatedAt) || byName(a, b),
    name: byName,
    smart: (a, b) =>
      (Number(isCompleted(a)) - Number(isCompleted(b)))  // incomplete first, completed last
      || (couponStatus(a).score - couponStatus(b).score)
      || (remainingCount(a) - remainingCount(b))
      || (num(b.updatedAt) - num(a.updatedAt))
  };
  arr.sort(comparators[sortKey] || comparators.smart);
  return arr;
}

function matchStatus(shop, status) {
  if (!status || status === 'all') return true;
  if (status === 'completed') return isCompleted(shop);
  if (status === 'expired') return isExpired(shop);
  if (status === 'expiring') return isExpiringSoon(shop);
  if (status === 'active') return !isCompleted(shop) && !isExpired(shop);
  return true;
}

export function filterShops(shops, { query = '', category = '', status = '' } = {}) {
  const q = String(query).trim().toLowerCase();
  return (shops || []).filter((shop) => {
    if (category && category !== 'all' && shop.category !== category) return false;
    if (!matchStatus(shop, status)) return false;
    if (q) {
      const hay = [shop.name, shop.category, shop.address, shop.memo]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function stats(shops = [], logs = []) {
  const totalShops = shops.length;
  const totalCoupons = shops.reduce((acc, s) => acc + num(s.totalCoupons), 0);
  const usedCoupons = shops.reduce((acc, s) => acc + num(s.usedCoupons), 0);
  // Average of each shop's progress %. Summing raw totals would mix won and
  // sessions across kinds, which is meaningless — per-shop % is comparable.
  const completionRate = totalShops
    ? Math.round(shops.reduce((acc, s) => acc + progressPercent(s), 0) / totalShops)
    : 0;
  const expiringCount = shops.filter((s) => isExpiringSoon(s)).length;
  const completedCount = shops.filter(isCompleted).length;
  const now = new Date(Date.now());
  const monthUses = logs.filter((l) => {
    const d = new Date(l.usedAt);
    return !Number.isNaN(d.getTime())
      && d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth();
  }).length;
  return { totalShops, totalCoupons, usedCoupons, completionRate, expiringCount, completedCount, monthUses };
}

/** amount passes whose remaining balance has dropped to <= ratio of the total. */
export function lowBalancePasses(shops, ratio = 0.2) {
  return (shops || []).filter((s) =>
    isAmountKind(s) && !isCompleted(s) && passTotal(s) > 0
    && remainingValue(s) > 0 && remainingValue(s) <= passTotal(s) * ratio);
}

// ── Backup nudge ─────────────────────────────────────────────────────────────
const BACKUP_STALE_MS = 30 * DAY_MS;   // re-nudge when the last backup is this old
const NUDGE_SNOOZE_MS = 14 * DAY_MS;   // respect a dismissal for this long
const NUDGE_GRACE_MS = 1 * DAY_MS;     // let brand-new data (first day) settle before nudging

/**
 * Whether home should surface the backup banner: meaningful data (3+ shops)
 * that has never been backed up or not in the last 30 days, unless the user
 * dismissed the nudge within 14 days. Pure given `now`.
 */
export function needsBackupNudge(shops, settings = {}, now = Date.now()) {
  if ((shops || []).length < 3) return false;
  // A wallet that is less than a day old (fresh install, samples just seeded) is
  // not nudged yet — the first session should not open with a warning banner.
  const oldest = Math.min(...shops.map((s) => num(s.createdAt) || 0));
  if (oldest && now - oldest < NUDGE_GRACE_MS) return false;
  const dismissedAt = num(settings.backupNudgeDismissedAt);
  if (dismissedAt && now - dismissedAt < NUDGE_SNOOZE_MS) return false;
  const lastBackupAt = num(settings.lastBackupAt);
  return !lastBackupAt || now - lastBackupAt > BACKUP_STALE_MS;
}

/** shops crossing a reminder threshold today (pure given Date.now). */
export function dueReminders(shops, reminderDays = [7, 3, 1]) {
  const thresholds = new Set(reminderDays);
  return (shops || []).filter((shop) => {
    if (isCompleted(shop)) return false;
    const days = daysUntil(shop.expiresAt);
    return days !== null && days >= 0 && thresholds.has(days);
  });
}

// ── Native reminder schedule ─────────────────────────────────────────────────
export const REMINDER_HOUR = 9; // local time at which a D-n reminder fires

/**
 * Future reminder moments: for every non-completed shop with an expiry date and
 * every threshold d, the calendar day (expiry − d) at REMINDER_HOUR local time,
 * strictly after `now`. Sorted soonest first. Pure given `now`.
 * -> [{ shopId, shop, days, at:number }]
 */
export function reminderSchedule(shops, reminderDays = [7, 3, 1], now = Date.now()) {
  const out = [];
  for (const shop of shops || []) {
    if (isCompleted(shop)) continue;
    const expiry = parseDate(shop.expiresAt);
    if (!expiry) continue;
    for (const d of reminderDays) {
      const days = Number(d);
      if (!Number.isFinite(days) || days < 0) continue;
      const at = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate() - days, REMINDER_HOUR, 0, 0, 0).getTime();
      if (at > now) out.push({ shopId: shop.id, shop, days, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Stable 31-bit positive integer id for a reminder (native ids must be int32). */
export function reminderId(shopId, days) {
  const s = `${shopId}:${days}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}
