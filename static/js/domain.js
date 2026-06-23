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
// Two kinds of paid pass: 'count' (횟수권, sessions) and 'amount' (금액권, KRW).
// Records predating the concept have no `kind` and are treated as 'count'.
export function isAmountKind(shop) { return shop && shop.kind === 'amount'; }
export function isCountKind(shop) { return !isAmountKind(shop); }

/** generic total (won for amount, sessions for count) */
export function passTotal(shop) {
  return isAmountKind(shop) ? num(shop.totalAmount) : num(shop.totalCoupons);
}

/** generic used (won for amount, sessions for count) */
export function passUsed(shop) {
  return isAmountKind(shop) ? num(shop.usedAmount) : num(shop.usedCoupons);
}

/** generic numeric remaining (won or sessions), never negative */
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

/** Numeric remaining (won or sessions). Same as remainingValue for both kinds;
 *  kept as a named export so existing count callers keep working. */
export function remainingCount(shop) {
  return remainingValue(shop);
}

/** remaining as display text: amount -> '850,000원'; count -> '8회' */
export function remainingLabel(shop) {
  return isAmountKind(shop) ? formatWon(remainingValue(shop)) : `${remainingValue(shop)}회`;
}

/** total as display text: amount -> '1,000,000원'; count -> '10회' */
export function totalLabel(shop) {
  return isAmountKind(shop) ? formatWon(passTotal(shop)) : `${passTotal(shop)}회`;
}

/** used as display text: amount -> '150,000원'; count -> '2회' */
export function usedLabel(shop) {
  return isAmountKind(shop) ? formatWon(passUsed(shop)) : `${passUsed(shop)}회`;
}

export function progressPercent(shop) {
  const total = passTotal(shop);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(passUsed(shop) / total * 100)));
}

/** { key, label, className, score } — lower score = higher priority. */
export function couponStatus(shop) {
  // A used-up paid pass is depleted ('소진'), not a prize to redeem.
  if (isCompleted(shop)) return { key: 'done', label: '소진', className: 'success', score: 0 };
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
  const lowBalance = isAmountKind(shop)
    ? (total > 0 && remaining <= total * 0.2)
    : remaining <= 2;
  if (lowBalance) {
    const label = isAmountKind(shop) ? `${formatWon(remaining)} 남음` : `${remaining}회 남음`;
    return { key: 'low', label, className: 'warning', score: 40 + Math.min(remaining, 9) };
  }
  if (days !== null && days <= 30) {
    return { key: 'soon', label: `만료 D-${days}`, className: 'warning', score: 60 + days };
  }
  return { key: 'neutral', label: '이용 중', className: 'neutral', score: 100 + Math.min(remaining, 99) };
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

/** shops crossing a reminder threshold today (pure given Date.now). */
export function dueReminders(shops, reminderDays = [7, 3, 1]) {
  const thresholds = new Set(reminderDays);
  return (shops || []).filter((shop) => {
    if (isCompleted(shop)) return false;
    const days = daysUntil(shop.expiresAt);
    return days !== null && days >= 0 && thresholds.has(days);
  });
}
