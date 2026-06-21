// domain.js — PURE business logic. The ONLY place coupon status/sort/filter/expiry
// math lives. No DOM, no IndexedDB; reads Date.now() only.

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

export function isCompleted(shop) {
  return num(shop.totalCoupons) > 0 && num(shop.usedCoupons) >= num(shop.totalCoupons);
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

export function remainingCount(shop) {
  return Math.max(0, num(shop.totalCoupons) - num(shop.usedCoupons));
}

export function progressPercent(shop) {
  const total = num(shop.totalCoupons);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(num(shop.usedCoupons) / total * 100)));
}

/** { key, label, className, score } — lower score = higher priority. */
export function couponStatus(shop) {
  if (isCompleted(shop)) return { key: 'done', label: '완성', className: 'success', score: 0 };
  const days = daysUntil(shop.expiresAt);
  const remaining = remainingCount(shop);
  if (days !== null && days < 0) {
    return { key: 'expired', label: '만료됨', className: 'danger', score: 10 };
  }
  if (days !== null && days <= 7) {
    const label = days === 0 ? '오늘 만료' : `만료 D-${days}`;
    return { key: 'urgent', label, className: 'danger', score: 20 + days };
  }
  if (remaining <= 2) {
    return { key: 'low', label: `${remaining}개 남음`, className: 'warning', score: 40 + remaining };
  }
  if (days !== null && days <= 30) {
    return { key: 'soon', label: `만료 D-${days}`, className: 'warning', score: 60 + days };
  }
  return { key: 'neutral', label: '진행 중', className: 'neutral', score: 100 + remaining };
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
  const completionRate = totalCoupons ? Math.round(usedCoupons / totalCoupons * 100) : 0;
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

/** shops crossing a reminder threshold today (pure given Date.now). */
export function dueReminders(shops, reminderDays = [7, 3, 1]) {
  const thresholds = new Set(reminderDays);
  return (shops || []).filter((shop) => {
    if (isCompleted(shop)) return false;
    const days = daysUntil(shop.expiresAt);
    return days !== null && days >= 0 && thresholds.has(days);
  });
}
