import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7810;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');

let server;
const consoleErrors = [];

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
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

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
});

test('smoke: header, seed sample, use coupon, navigate tabs', async ({ page }) => {
  // Start from a clean IndexedDB so the empty-state seed button appears.
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('coupon-book');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.reload();

  // Header shows the app name.
  await expect(page.locator('#page-title')).toHaveText('Coupon Book');

  // Seed sample shops via the empty-state button.
  const sampleBtn = page.locator('[data-empty-action="demo"]').first();
  await expect(sampleBtn).toBeVisible({ timeout: 10000 });
  await sampleBtn.click();

  // At least one shop card appears in the rail.
  const cards = page.locator('#shop-rail .card, #shop-rail [data-action="quick-use"]');
  await expect(cards.first()).toBeVisible({ timeout: 10000 });

  // Use a coupon from the first card; expect a toast or reward modal.
  await page.locator('#shop-rail [data-action="quick-use"]').first().click();
  const feedback = page.locator('#toast.active, #reward-modal.active');
  await expect(feedback.first()).toBeVisible({ timeout: 5000 });

  // Navigate to 지도 (map) and 설정 (settings) tabs.
  await page.locator('.nav-item[data-page="map"]').click();
  await expect(page.locator('#map')).toHaveClass(/active/);

  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('#settings')).toHaveClass(/active/);

  // No console errors during the flow (Leaflet tile network noise excluded).
  const realErrors = consoleErrors.filter(e =>
    !/tile|favicon|sw\.js|ERR_INTERNET|net::|manifest/i.test(e));
  expect(realErrors, `console errors: ${realErrors.join(' | ')}`).toHaveLength(0);
});
