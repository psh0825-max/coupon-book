import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShop } from '../../static/js/data/repo.js';

test('normalizeShop: clamps totalCoupons to 1000 max', () => {
  assert.equal(normalizeShop({ totalCoupons: 9999 }).totalCoupons, 1000);
});

test('normalizeShop: default kind is count (no kind field)', () => {
  assert.equal(normalizeShop({}).kind, 'count');
  assert.equal(normalizeShop({ kind: 'weird' }).kind, 'count');
});

test('normalizeShop: kind amount is preserved', () => {
  assert.equal(normalizeShop({ kind: 'amount' }).kind, 'amount');
});

test('normalizeShop: always stores all four pass fields', () => {
  const s = normalizeShop({ kind: 'amount', totalAmount: 1000000, usedAmount: 150000 });
  assert.equal(s.totalCoupons, 10); // default kept so switching kind never loses data
  assert.equal(s.usedCoupons, 0);
  assert.equal(s.totalAmount, 1000000);
  assert.equal(s.usedAmount, 150000);
});

test('normalizeShop: clamps totalAmount to 1억 max', () => {
  assert.equal(normalizeShop({ totalAmount: 999999999 }).totalAmount, 100000000);
});

test('normalizeShop: usedAmount clamped to totalAmount', () => {
  const s = normalizeShop({ totalAmount: 500000, usedAmount: 900000 });
  assert.equal(s.usedAmount, 500000);
});

test('normalizeShop: negative amounts -> 0', () => {
  const s = normalizeShop({ totalAmount: -5, usedAmount: -5 });
  assert.equal(s.totalAmount, 0);
  assert.equal(s.usedAmount, 0);
});

test('normalizeShop: clamps usedCoupons to total', () => {
  const s = normalizeShop({ totalCoupons: 10, usedCoupons: 50 });
  assert.equal(s.totalCoupons, 10);
  assert.equal(s.usedCoupons, 10);
});

test('normalizeShop: negative usedCoupons -> 0', () => {
  assert.equal(normalizeShop({ totalCoupons: 10, usedCoupons: -5 }).usedCoupons, 0);
});

test('normalizeShop: totalCoupons floor is 1', () => {
  assert.equal(normalizeShop({ totalCoupons: 0 }).totalCoupons, 1);
  assert.equal(normalizeShop({ totalCoupons: -3 }).totalCoupons, 1);
});

test('normalizeShop: unknown category falls back to 기타', () => {
  assert.equal(normalizeShop({ category: '우주정거장' }).category, '기타');
  assert.equal(normalizeShop({}).category, '기타');
});

test('normalizeShop: known category preserved, skin defaults from category', () => {
  const s = normalizeShop({ category: '카페' });
  assert.equal(s.category, '카페');
  assert.equal(s.skin, 'espresso');
});

test('normalizeShop: invalid skin falls back to category default', () => {
  assert.equal(normalizeShop({ category: '병원', skin: 'nope' }).skin, 'stone');
});

test('normalizeShop: trims strings', () => {
  assert.equal(normalizeShop({ name: '  카페  ' }).name, '카페');
});

test('normalizeShop: preserves and trims code', () => {
  assert.equal(normalizeShop({ code: '  1234-5678  ' }).code, '1234-5678');
});

test('normalizeShop: missing code -> empty string', () => {
  assert.equal(normalizeShop({}).code, '');
});
