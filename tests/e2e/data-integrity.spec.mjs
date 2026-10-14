import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7813;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
let server;

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE_URL}/healthz`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Flask server did not become ready in time');
}

async function readStores(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const req = indexedDB.open('CouponBookDB');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(['shops', 'logs'], 'readonly');
      const shops = tx.objectStore('shops').getAll();
      const logs = tx.objectStore('logs').getAll();
      tx.oncomplete = () => resolve({ shops: shops.result, logs: logs.result });
      tx.onerror = () => reject(tx.error);
    };
  }));
}

async function seedSample(page) {
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '샘플 보기' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.locator('.shop-rail .card').first()).toBeVisible();
}

test.beforeAll(async () => {
  server = spawn(PYTHON, ['app.py'], { cwd: ROOT, env: { ...process.env, COUPON_BOOK_PORT: String(PORT) }, stdio: 'ignore' });
  await waitForServer();
});

test.afterAll(async () => {
  if (server && !server.killed) server.kill();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = originalPut.apply(this, args);
      if (window.__failWrites) this.transaction.abort();
      return request;
    };
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();
});

test('D1: first pass shows the backup suggestion once', async ({ page }) => {
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.locator('[data-fab]').click();
  await page.locator('#f-name').fill('첫 이용권');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByRole('dialog', { name: '백업을 권장해요' })).toBeVisible();
  await page.getByRole('button', { name: '나중에' }).click();
  await page.locator('[data-fab]').click();
  await page.locator('#f-name').fill('두 번째 이용권');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByRole('dialog', { name: '백업을 권장해요' })).toBeHidden();
});

test('D2: failed write is reported and changes nothing', async ({ page }) => {
  await seedSample(page);
  const before = await readStores(page);
  const hub = before.shops.find((shop) => shop.name === '허브 커피 로스터스');
  await page.evaluate(() => { window.__failWrites = true; });
  await page.locator(`.card:has-text("허브 커피 로스터스") [data-action="quick-use"]`).click();
  await expect(page.locator('#toast')).toContainText('저장하지 못했어요');
  await page.evaluate(() => { window.__failWrites = false; });
  const after = await readStores(page);
  expect(after.shops.find((shop) => shop.id === hub.id).usedCoupons).toBe(hub.usedCoupons);
  expect(after.logs.filter((log) => log.shopId === hub.id)).toHaveLength(0);
});

test('D3: deleting a pass removes it and all its logs', async ({ page }) => {
  await seedSample(page);
  const before = await readStores(page);
  const hub = before.shops.find((shop) => shop.name === '허브 커피 로스터스');
  const hubCard = page.locator('.card', { hasText: '허브 커피 로스터스' });
  const quickUse = hubCard.locator('[data-action="quick-use"]');
  await quickUse.click();
  await expect(page.locator('#toast.active')).toBeVisible();
  await quickUse.click();
  await expect(page.locator('#toast.active')).toBeVisible();
  await hubCard.locator('.card-main').click();
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByRole('button', { name: '이용권 삭제' }).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const { shops, logs } = await readStores(page);
  expect(shops.some((shop) => shop.name === '허브 커피 로스터스')).toBe(false);
  expect(logs.some((log) => log.shopId === hub.id)).toBe(false);
});

test('D4: double submit creates one pass', async ({ page }) => {
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.locator('[data-fab]').click();
  await page.locator('#f-name').fill('중복 방지 이용권');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent === '추가하기');
    button.click();
    button.click();
  });
  await expect(page.locator('#home')).toHaveClass(/active/);
  const { shops } = await readStores(page);
  expect(shops.filter((shop) => shop.name === '중복 방지 이용권')).toHaveLength(1);
});
