import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7811;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
const SHOP_NAME = '허브 커피 로스터스';

let server;

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
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

async function seedSample(page) {
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '샘플 보기' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(hubButton(page)).toBeVisible({ timeout: 10000 });
}

function hubButton(page) {
  return page.locator('.shop-rail .card')
    .filter({ has: page.getByRole('heading', { name: SHOP_NAME }) })
    .locator('[data-action="quick-use"]');
}

async function readPassData(page) {
  return page.evaluate(async (name) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('CouponBookDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction(['shops', 'logs'], 'readonly');
      const getAll = (store) => new Promise((resolve, reject) => {
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      const [shops, logs] = await Promise.all([getAll('shops'), getAll('logs')]);
      const shop = shops.find((item) => item.name === name);
      return { shop, logs: logs.filter((item) => item.shopId === shop?.id) };
    } finally {
      db.close();
    }
  }, SHOP_NAME);
}

test('E1: double tap records one use and one log', async ({ page }) => {
  await seedSample(page);
  const before = await readPassData(page);
  await page.evaluate((name) => {
    const card = [...document.querySelectorAll('.shop-rail .card')]
      .find((item) => item.querySelector('h3')?.textContent === name);
    const button = card?.querySelector('[data-action="quick-use"]');
    button.click();
    button.click();
  }, SHOP_NAME);
  await expect(page.locator('#toast.active')).toBeVisible();
  await page.waitForTimeout(500);
  const after = await readPassData(page);
  expect(after.shop.usedCoupons).toBe(before.shop.usedCoupons + 1);
  expect(after.logs).toHaveLength(1);
});

test('E2: sequential uses each persist after the lock releases', async ({ page }) => {
  await seedSample(page);
  const before = await readPassData(page);
  await hubButton(page).click();
  await expect(page.locator('#toast.active')).toBeVisible();
  await page.waitForTimeout(400);
  await hubButton(page).click();
  await expect(page.locator('#toast.active')).toBeVisible();
  await page.waitForTimeout(400);
  const after = await readPassData(page);
  expect(after.shop.usedCoupons).toBe(before.shop.usedCoupons + 2);
  expect(after.logs).toHaveLength(2);
});

test('E3: GPS cannot delay use and new logs have no location', async ({ browser }) => {
  const context = await browser.newContext();
  await context.grantPermissions(['geolocation'], { origin: BASE_URL });
  await context.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      setTimeout(() => success({ coords: { latitude: 37.4, longitude: 126.95 } }), 8000);
    };
  });
  const page = await context.newPage();
  try {
    await seedSample(page);
    await hubButton(page).click();
    await expect(page.locator('#toast.active')).toBeVisible({ timeout: 2000 });
    const after = await readPassData(page);
    expect(after.logs).toHaveLength(1);
    expect(Object.hasOwn(after.logs[0], 'location')).toBe(false);
  } finally {
    await context.close();
  }
});

test('E4: duplicate undo cannot restore below the original value', async ({ page }) => {
  await seedSample(page);
  const before = await readPassData(page);
  await hubButton(page).click();
  await expect(page.locator('#toast.active')).toBeVisible();
  await page.evaluate(() => {
    const undo = document.querySelector('#toast .toast-action');
    undo.click();
    undo.click();
  });
  await page.waitForTimeout(500);
  const after = await readPassData(page);
  expect(after.shop.usedCoupons).toBe(before.shop.usedCoupons);
  expect(after.logs).toHaveLength(0);
});
