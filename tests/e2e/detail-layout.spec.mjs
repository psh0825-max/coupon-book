import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7816;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');

let server;

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Flask server did not become ready in time');
}

test.beforeAll(async () => {
  server = spawn(PYTHON, ['app.py'], {
    cwd: ROOT,
    env: { ...process.env, COUPON_BOOK_PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitForServer();
});

test.afterAll(async () => {
  if (server && !server.killed) server.kill();
});

test('detail header stats stay single-line and within their columns at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase('CouponBookDB');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: '건너뛰기' }).click();

  const cases = [
    { id: 'amount-million', name: '백만원 이용권', kind: 'amount', totalAmount: 1_000_000, usedAmount: 150_000 },
    { id: 'amount-long', name: '고액 이용권', kind: 'amount', totalAmount: 12_345_678, usedAmount: 1_234_567 },
    { id: 'count-pass', name: '횟수 이용권', kind: 'count', totalCoupons: 10, usedCoupons: 3 },
  ];
  await page.evaluate(async (shops) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('CouponBookDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('shops', 'readwrite');
        shops.forEach(shop => transaction.objectStore('shops').put({
          category: '기타', skin: 'midnight', totalCoupons: 1, usedCoupons: 0,
          totalAmount: 0, usedAmount: 0, createdAt: Date.now(), updatedAt: Date.now(),
          ...shop,
        }));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, cases);
  await page.reload();

  for (const [index, pass] of cases.entries()) {
    await page.getByRole('button', { name: new RegExp(`${pass.name}.*상세 보기`) }).click();
    const stats = page.locator('.detail-header .stats .num');
    await expect(stats).toHaveCount(3);
    const layouts = await stats.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    }));
    for (const layout of layouts) {
      expect(layout.height).toBeLessThan(layout.lineHeight * 1.6);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    }
    if (index === 0) await page.screenshot({ path: path.join(ROOT, 'test-results', 'detail-360.png'), fullPage: true });
    await page.getByRole('button', { name: '뒤로' }).click();
  }
});
