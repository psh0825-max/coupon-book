import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShop } from '../../static/js/data/repo.js';

test('normalizeShop: clamps totalCoupons to 100 max', () => {
  assert.equal(normalizeShop({ totalCoupons: 999 }).totalCoupons, 100);
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
