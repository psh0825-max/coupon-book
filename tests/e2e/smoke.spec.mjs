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

test('smoke: onboarding, seed sample, use coupon, chrome, navigate tabs', async ({ page }) => {
  // Start from a fully clean slate so the first-run onboarding appears.
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();

  // First run → onboarding is the active section, header reflects it.
  await expect(page.locator('#onboarding')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('[data-page-title]')).toHaveText('시작하기');

  // Step through onboarding: 다음 → 샘플 보기 (seeds demo + advances) → 시작하기.
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '샘플 보기' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();

  // Home: shop rail has cards and the header shows the app name.
  await expect(page.locator('.shop-rail .card').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-page-title]')).toHaveText('Coupon Book');

  // Use the first card's pass. Count passes deduct one session immediately;
  // amount passes open an entry sheet — fill an amount and confirm. Either way
  // we end with a success toast.
  await page.locator('.shop-rail [data-action="quick-use"]').first().click();
  const amountInput = page.locator('#use-amount');
  const sheetOpened = await amountInput
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (sheetOpened) {
    await amountInput.fill('10000');
    await page.locator('.popup-footer').getByRole('button', { name: '사용' }).click();
  }
  await expect(page.locator('#toast.active')).toBeVisible({ timeout: 5000 });

  // Chrome visibility fix: back hidden on home, FAB visible on home.
  await expect(page.locator('[data-back]')).toBeHidden();
  await expect(page.locator('[data-fab]')).toBeVisible();

  // Navigate tabs: 지도 (map) then 설정 (settings).
  await page.locator('.nav-item[data-nav="map"]').click();
  await expect(page.locator('#map')).toHaveClass(/active/);

  await page.locator('.nav-item[data-nav="settings"]').click();
  await expect(page.locator('#settings')).toHaveClass(/active/);
  // New feature surfaced in settings.
  await expect(page.getByText('만료 임박 알림')).toBeVisible();

  // No console errors during the flow (tile/network/sw/favicon/geolocation noise excluded).
  const realErrors = consoleErrors.filter(e =>
    !/tile|favicon|sw\.js|ERR_INTERNET|net::|manifest|geolocation/i.test(e));
  expect(realErrors, `console errors: ${realErrors.join(' | ')}`).toHaveLength(0);
});
