import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderThreshold } from '../../static/js/domain.js';

function localDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('service worker threshold mirrors domain reminderThreshold for pass kinds and windows', async () => {
  const source = await readFile(new URL('../../static/sw.js', import.meta.url), 'utf8');
  const sandbox = {
    self: { addEventListener() {}, location: { origin: 'https://example.test' }, registration: {} },
    console, Date
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  const activeCount = (expiresAt) => ({ id: 'count', expiresAt, totalCoupons: 10, usedCoupons: 2 });
  const activeAmount = (expiresAt) => ({ id: 'amount', kind: 'amount', expiresAt, totalAmount: 10000, usedAmount: 2000 });
  const cases = [
    ['active count', activeCount(localDate(7))],
    ['active amount', activeAmount(localDate(7))],
    ['used count', { ...activeCount(localDate(7)), usedCoupons: 10 }],
    ['used amount', { ...activeAmount(localDate(7)), usedAmount: 10000 }],
    ['archived', { ...activeCount(localDate(7)), archivedAt: Date.now() }],
    ['expired', activeCount(localDate(-1))],
    ['no date', activeCount(null)],
    ['today', activeCount(localDate(0))],
    ['at 30', activeCount(localDate(30))],
    ['at 7', activeCount(localDate(7))],
    ['at 3', activeCount(localDate(3))],
    ['at 1', activeCount(localDate(1))],
    ['between thresholds', activeCount(localDate(5))],
    ['beyond largest', activeCount(localDate(31))]
  ];
  for (const days of [[7, 3, 1], [30, 7, 3, 1], [1]]) {
    for (const [name, shop] of cases) {
      assert.deepEqual(sandbox.swThreshold(shop, days), reminderThreshold(shop, days), `${name} with ${days}`);
    }
  }
});
