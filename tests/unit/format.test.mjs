import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatRelative, formatWon, groupDigits, parseNumber } from '../../static/js/services/format.js';

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

test('formatWon: thousands separators + 원 suffix', () => {
  assert.equal(formatWon(850000), '850,000원');
  assert.equal(formatWon(1000000), '1,000,000원');
  assert.equal(formatWon(0), '0원');
  assert.equal(formatWon(1500), '1,500원');
});

test('formatWon: non-finite -> 0원', () => {
  assert.equal(formatWon(NaN), '0원');
  assert.equal(formatWon(Infinity), '0원');
  assert.equal(formatWon(null), '0원');
  assert.equal(formatWon('abc'), '0원');
});

test('formatWon: rounds and floors decimals', () => {
  assert.equal(formatWon(1234.6), '1,235원');
});

test('groupDigits: digits grouped, non-digits stripped, empty stays empty', () => {
  assert.equal(groupDigits('1000000'), '1,000,000');
  assert.equal(groupDigits(''), '');
  assert.equal(groupDigits('1,000,000원'), '1,000,000');
  assert.equal(groupDigits(50000), '50,000');
  assert.equal(groupDigits(null), '');
});

test('parseNumber: strips non-digits to an integer', () => {
  assert.equal(parseNumber('1,000,000원'), 1000000);
  assert.equal(parseNumber(''), 0);
  assert.equal(parseNumber(null), 0);
  assert.equal(parseNumber('30,000'), 30000);
});
