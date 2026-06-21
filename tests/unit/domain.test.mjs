import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysUntil, isCompleted, isExpired, isExpiringSoon, remainingCount, progressPercent,
  couponStatus, formatExpiry, priorityShop, sortShops, filterShops, stats, dueReminders
} from '../../static/js/domain.js';

// Local YYYY-MM-DD offset from today, matching domain's local-date parsing.
function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const shop = (over = {}) => ({ totalCoupons: 10, usedCoupons: 0, ...over });

test('daysUntil: no/invalid date -> null', () => {
  assert.equal(daysUntil(null), null);
  assert.equal(daysUntil(undefined), null);
  assert.equal(daysUntil(''), null);
  assert.equal(daysUntil('not-a-date'), null);
});

test('daysUntil: today -> 0, past -> negative, future -> positive', () => {
  assert.equal(daysUntil(dateOffset(0)), 0);
  assert.equal(daysUntil(dateOffset(-3)), -3);
  assert.equal(daysUntil(dateOffset(5)), 5);
});

test('isCompleted / remainingCount / progressPercent', () => {
  assert.equal(isCompleted(shop({ usedCoupons: 10 })), true);
  assert.equal(isCompleted(shop({ usedCoupons: 9 })), false);
  assert.equal(isCompleted(shop({ totalCoupons: 0, usedCoupons: 0 })), false);
  assert.equal(remainingCount(shop({ usedCoupons: 7 })), 3);
  assert.equal(remainingCount(shop({ usedCoupons: 99 })), 0);
  assert.equal(progressPercent(shop({ usedCoupons: 5 })), 50);
  assert.equal(progressPercent(shop({ totalCoupons: 0 })), 0);
});

test('isExpired: has date & days<0 & not completed', () => {
  assert.equal(isExpired(shop({ expiresAt: dateOffset(-1) })), true);
  assert.equal(isExpired(shop({ expiresAt: dateOffset(1) })), false);
  assert.equal(isExpired(shop({})), false);
  assert.equal(isExpired(shop({ usedCoupons: 10, expiresAt: dateOffset(-1) })), false);
});

test('isExpiringSoon: 0..within days and not completed', () => {
  assert.equal(isExpiringSoon(shop({ expiresAt: dateOffset(10) })), true);
  assert.equal(isExpiringSoon(shop({ expiresAt: dateOffset(0) })), true);
  assert.equal(isExpiringSoon(shop({ expiresAt: dateOffset(40) })), false);
  assert.equal(isExpiringSoon(shop({ expiresAt: dateOffset(-1) })), false);
  assert.equal(isExpiringSoon(shop({ usedCoupons: 10, expiresAt: dateOffset(5) })), false);
});

test('couponStatus tiers', () => {
  // completed
  let s = couponStatus(shop({ usedCoupons: 10 }));
  assert.deepEqual([s.key, s.className, s.score, s.label], ['done', 'success', 0, '완성']);
  // expired
  s = couponStatus(shop({ usedCoupons: 1, expiresAt: dateOffset(-2) }));
  assert.deepEqual([s.className, s.score, s.label], ['danger', 10, '만료됨']);
  // days <= 7 (urgent), today
  s = couponStatus(shop({ usedCoupons: 1, expiresAt: dateOffset(0) }));
  assert.deepEqual([s.className, s.score, s.label], ['danger', 20, '오늘 만료']);
  s = couponStatus(shop({ usedCoupons: 1, expiresAt: dateOffset(3) }));
  assert.deepEqual([s.className, s.score, s.label], ['danger', 23, '만료 D-3']);
  // remaining <= 2 (no near expiry)
  s = couponStatus(shop({ usedCoupons: 9, expiresAt: dateOffset(100) }));
  assert.deepEqual([s.className, s.score, s.label], ['warning', 41, '1개 남음']);
  // days <= 30 (soon)
  s = couponStatus(shop({ usedCoupons: 1, expiresAt: dateOffset(20) }));
  assert.deepEqual([s.className, s.score, s.label], ['warning', 80, '만료 D-20']);
  // neutral
  s = couponStatus(shop({ usedCoupons: 1, expiresAt: dateOffset(100) }));
  assert.deepEqual([s.key, s.className, s.score, s.label], ['neutral', 'neutral', 109, '진행 중']);
  // neutral, no expiry
  s = couponStatus(shop({ usedCoupons: 1 }));
  assert.equal(s.className, 'neutral');
});

test('formatExpiry', () => {
  assert.equal(formatExpiry(null), '만료 없음');
  assert.equal(formatExpiry(dateOffset(-1)), '만료됨');
  assert.equal(formatExpiry(dateOffset(0)), '오늘 만료');
  assert.equal(formatExpiry(dateOffset(5)), 'D-5');
});

test('sortShops: smart orders by urgency score, completed last', () => {
  const completed = shop({ usedCoupons: 10, name: 'c' });
  const expired = shop({ usedCoupons: 1, expiresAt: dateOffset(-1), name: 'e' });
  const urgent = shop({ usedCoupons: 1, expiresAt: dateOffset(2), name: 'u' });
  const neutral = shop({ usedCoupons: 1, expiresAt: dateOffset(100), name: 'n' });
  const sorted = sortShops([neutral, completed, urgent, expired], 'smart');
  // incomplete shops first (by urgency), completed sinks to the bottom
  assert.deepEqual(sorted.map((s) => s.name), ['e', 'u', 'n', 'c']);
  assert.equal(sorted[sorted.length - 1].name, 'c');
});

test('sortShops: remaining and name', () => {
  const a = shop({ usedCoupons: 8, name: '가' }); // remaining 2
  const b = shop({ usedCoupons: 3, name: '나' }); // remaining 7
  assert.deepEqual(sortShops([b, a], 'remaining').map((s) => s.name), ['가', '나']);
  assert.deepEqual(sortShops([b, a], 'name').map((s) => s.name), ['가', '나']);
});

test('filterShops: status, category, query', () => {
  const list = [
    shop({ name: '카페 모카', category: '카페', usedCoupons: 10 }),
    shop({ name: '안양 마사지', category: '마사지', usedCoupons: 1, expiresAt: dateOffset(-1) }),
    shop({ name: '동네 식당', category: '식당', usedCoupons: 1, expiresAt: dateOffset(5) }),
    shop({ name: '먼 카페', category: '카페', usedCoupons: 1, expiresAt: dateOffset(100) })
  ];
  assert.deepEqual(filterShops(list, { status: 'completed' }).map((s) => s.name), ['카페 모카']);
  assert.deepEqual(filterShops(list, { status: 'expired' }).map((s) => s.name), ['안양 마사지']);
  assert.deepEqual(filterShops(list, { status: 'expiring' }).map((s) => s.name), ['동네 식당']);
  assert.deepEqual(filterShops(list, { category: '카페' }).map((s) => s.name), ['카페 모카', '먼 카페']);
  assert.deepEqual(filterShops(list, { query: '안양' }).map((s) => s.name), ['안양 마사지']);
  assert.equal(filterShops(list, { category: 'all' }).length, 4);
});

test('stats: aggregation', () => {
  const now = Date.now();
  const list = [
    shop({ totalCoupons: 10, usedCoupons: 10 }),
    shop({ totalCoupons: 10, usedCoupons: 5, expiresAt: dateOffset(10) })
  ];
  const logs = [{ usedAt: now }, { usedAt: now }];
  const s = stats(list, logs);
  assert.equal(s.totalShops, 2);
  assert.equal(s.totalCoupons, 20);
  assert.equal(s.usedCoupons, 15);
  assert.equal(s.completionRate, 75);
  assert.equal(s.expiringCount, 1);
  assert.equal(s.completedCount, 1);
  assert.equal(s.monthUses, 2);
});

test('priorityShop: highest-priority non-completed or null', () => {
  const completed = shop({ usedCoupons: 10, name: 'c' });
  const urgent = shop({ usedCoupons: 1, expiresAt: dateOffset(1), name: 'u' });
  assert.equal(priorityShop([completed, urgent]).name, 'u');
  assert.equal(priorityShop([completed]), null);
  assert.equal(priorityShop([]), null);
});

test('dueReminders: shops crossing a threshold today', () => {
  const days = [7, 3, 1];
  const list = [
    shop({ name: 'd3', usedCoupons: 1, expiresAt: dateOffset(3) }),
    shop({ name: 'd5', usedCoupons: 1, expiresAt: dateOffset(5) }),
    shop({ name: 'd1done', usedCoupons: 10, expiresAt: dateOffset(1) }),
    shop({ name: 'past', usedCoupons: 1, expiresAt: dateOffset(-3) })
  ];
  assert.deepEqual(dueReminders(list, days).map((s) => s.name), ['d3']);
});
