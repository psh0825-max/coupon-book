import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7815;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
let server;

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE_URL}/healthz`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Flask server did not become ready in time');
}

async function shopCount(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const req = indexedDB.open('CouponBookDB');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('shops', 'readonly');
      const stores = tx.objectStore('shops').count();
      stores.onsuccess = () => resolve(stores.result);
      stores.onerror = () => reject(stores.error);
    };
  }));
}

test.beforeAll(async () => {
  server = spawn(PYTHON, ['app.py'], { cwd: ROOT, env: { ...process.env, COUPON_BOOK_PORT: String(PORT) }, stdio: 'ignore' });
  await waitForServer();
});
test.afterAll(async () => { if (server && !server.killed) server.kill(); });
test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.locator('[data-fab]').click();
});

test('F1: new count pass keeps only the core form visible', async ({ page }) => {
  await expect(page.locator('#f-name')).toBeVisible();
  await expect(page.getByRole('group', { name: '이용권 종류' })).toBeVisible();
  await expect(page.locator('#f-expires')).toBeVisible();
  await expect(page.locator('#f-address')).toBeHidden();
  await expect(page.locator('#f-gifticon')).toBeHidden();
  const more = page.locator('details.form-more');
  await expect(more).toBeVisible();
  await expect(more).not.toHaveAttribute('open', '');
});

test('F2: coupon promotes image and code; count hides them again', async ({ page }) => {
  await page.getByRole('button', { name: '쿠폰', exact: true }).click();
  await expect(page.locator('#f-gifticon')).toBeVisible();
  await expect(page.locator('#f-code')).toBeVisible();
  await expect(page.locator('details.form-more')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: '횟수권', exact: true }).click();
  await expect(page.locator('#f-gifticon')).toBeHidden();
  await expect(page.locator('#f-code')).toBeHidden();
});

test('F3: opening more fields reveals address, phone, memo, and skin', async ({ page }) => {
  await page.locator('details.form-more summary').click();
  await expect(page.locator('#f-address')).toBeVisible();
  await expect(page.locator('#f-phone')).toBeVisible();
  await expect(page.locator('#f-memo')).toBeVisible();
  await expect(page.locator('#skin-selector')).toBeVisible();
});

test('F4: a name alone saves a count pass', async ({ page }) => {
  const before = await shopCount(page);
  await page.locator('#f-name').fill('간단한 이용권');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect.poll(() => shopCount(page)).toBe(before + 1);
});

test('F5: editing a pass with an address opens more fields', async ({ page }) => {
  await page.locator('#f-name').fill('주소 있는 이용권');
  await page.locator('details.form-more summary').click();
  await page.locator('#f-address').fill('서울시 강남구 테헤란로 1');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  await page.getByRole('button', { name: '나중에' }).click();
  const card = page.locator('.card', { hasText: '주소 있는 이용권' });
  await card.locator('.card-main').click();
  await page.getByRole('button', { name: '편집' }).click();
  await expect(page.locator('details.form-more')).toHaveAttribute('open', '');
  await expect(page.locator('#f-address')).toHaveValue('서울시 강남구 테헤란로 1');
});
