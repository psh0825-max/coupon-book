import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeKind, kindLabel, isStampKind, isCountKind, isAmountKind, remainingLabel, totalLabel,
  couponStatus, reminderSchedule, reminderId, REMINDER_HOUR, unitLabel
} from '../../static/js/domain.js';
import { normalizeShop } from '../../static/js/data/repo.js';

function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test('normalizeKind: stamp/amount kept, anything else -> count', () => {
  assert.equal(normalizeKind('stamp'), 'stamp');
  assert.equal(normalizeKind('amount'), 'amount');
  assert.equal(normalizeKind('count'), 'count');
  assert.equal(normalizeKind(undefined), 'count');
  assert.equal(normalizeKind('bogus'), 'count');
});

test('kindLabel: Korean labels per kind', () => {
  assert.equal(kindLabel('stamp'), '도장판');
  assert.equal(kindLabel('count'), '횟수권');
  assert.equal(kindLabel('amount'), '금액권');
  assert.equal(kindLabel(undefined), '횟수권');
});

test('stamp kind: predicates, units and labels', () => {
  const s = { kind: 'stamp', totalCoupons: 10, usedCoupons: 7 };
  assert.equal(isStampKind(s), true);
  assert.equal(isCountKind(s), true);   // count-like math (totalCoupons/usedCoupons)
  assert.equal(isAmountKind(s), false);
  assert.equal(unitLabel(s), '개');
  assert.equal(remainingLabel(s), '3개');
  assert.equal(totalLabel(s), '10개');
  assert.equal(remainingLabel({ kind: 'count', totalCoupons: 8, usedCoupons: 2 }), '6회');
});

test('couponStatus: full stamp card is 완성, used-up count pass is 소진', () => {
  assert.equal(couponStatus({ kind: 'stamp', totalCoupons: 10, usedCoupons: 10 }).label, '완성');
  assert.equal(couponStatus({ kind: 'count', totalCoupons: 10, usedCoupons: 10 }).label, '소진');
  assert.equal(couponStatus({ kind: 'amount', totalAmount: 1000, usedAmount: 1000 }).label, '소진');
});

test('couponStatus: nearly complete stamp card is an upbeat accent, not a warning', () => {
  const st = couponStatus({ kind: 'stamp', totalCoupons: 10, usedCoupons: 8 });
  assert.equal(st.key, 'almost');
  assert.equal(st.className, 'accent');
  assert.equal(st.label, '2개만 더');
  const neutral = couponStatus({ kind: 'stamp', totalCoupons: 10, usedCoupons: 3 });
  assert.equal(neutral.label, '적립 중');
  // count passes keep the low-balance warning
  assert.equal(couponStatus({ kind: 'count', totalCoupons: 10, usedCoupons: 8 }).className, 'warning');
});

test('normalizeShop: keeps stamp kind, falls back to count for legacy/unknown', () => {
  assert.equal(normalizeShop({ name: 'a', kind: 'stamp' }).kind, 'stamp');
  assert.equal(normalizeShop({ name: 'a' }).kind, 'count');
  assert.equal(normalizeShop({ name: 'a', kind: 'weird' }).kind, 'count');
});

test('reminderSchedule: one future moment per shop per threshold at REMINDER_HOUR, sorted', () => {
  const shops = [
    { id: 'a', name: 'A', totalCoupons: 10, usedCoupons: 0, expiresAt: dateOffset(10) },
    { id: 'b', name: 'B', totalCoupons: 10, usedCoupons: 0, expiresAt: dateOffset(2) },
    { id: 'done', name: 'D', totalCoupons: 10, usedCoupons: 10, expiresAt: dateOffset(10) },
    { id: 'nodate', name: 'N', totalCoupons: 10, usedCoupons: 0, expiresAt: null }
  ];
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const list = reminderSchedule(shops, [7, 3, 1], now.getTime());
  // a: D-7, D-3, D-1 all in the future; b: D-1 only (D-7/D-3 are in the past)
  assert.deepEqual(list.map((e) => `${e.shopId}:${e.days}`), ['b:1', 'a:7', 'a:3', 'a:1']);
  for (const e of list) {
    const d = new Date(e.at);
    assert.equal(d.getHours(), REMINDER_HOUR);
    assert.ok(e.at > now.getTime());
  }
  assert.deepEqual(reminderSchedule([], [7, 3, 1]), []);
});

test('reminderId: stable positive int32, distinct per threshold', () => {
  const a = reminderId('shop-1', 7);
  assert.equal(a, reminderId('shop-1', 7));
  assert.notEqual(a, reminderId('shop-1', 3));
  assert.notEqual(a, reminderId('shop-2', 7));
  assert.ok(Number.isInteger(a) && a > 0 && a < 2147483647);
});
