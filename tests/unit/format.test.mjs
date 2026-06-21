import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatRelative } from '../../static/js/services/format.js';

test('formatDistance: under 1000m shows meters', () => {
  assert.equal(formatDistance(120), '120m');
  assert.equal(formatDistance(0), '0m');
  assert.equal(formatDistance(999), '999m');
});

test('formatDistance: 1000m and over shows kilometers', () => {
  assert.equal(formatDistance(1000), '1.0km');
  assert.equal(formatDistance(1200), '1.2km');
  assert.equal(formatDistance(15300), '15.3km');
});

test('formatRelative: buckets', () => {
  const now = Date.now();
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  assert.equal(formatRelative(now), '방금');
  assert.equal(formatRelative(now - 30000), '방금');
  assert.equal(formatRelative(now - 5 * MIN), '5분 전');
  assert.equal(formatRelative(now - 2 * HOUR), '2시간 전');
  assert.equal(formatRelative(now - 3 * DAY), '3일 전');
});

test('formatRelative: 7+ days shows a date string', () => {
  const out = formatRelative(Date.now() - 10 * 86400000);
  assert.match(out, /^\d{4}\.\d{2}\.\d{2}$/);
});
