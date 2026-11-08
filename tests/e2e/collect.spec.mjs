import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 적립형 도장판: the cafe template creates a board that starts empty, fills
// with each stamp, celebrates when full and can start a new board.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7819;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
const NAME = '동네 카페';
let server;

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE_URL}/healthz`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Flask server did not become ready in time');
}

async function readBoard(page) {
  return page.evaluate(async (name) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('CouponBookDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction(['shops', 'logs'], 'readonly');
      const all = (store) => new Promise((resolve) => { const q = tx.objectStore(store).getAll(); q.onsuccess = () => resolve(q.result || []); });
      const [shops, logs] = await Promise.all([all('shops'), all('logs')]);
      const shop = shops.find((item) => item.name === name);
      return { shop, logs: logs.filter((item) => item.shopId === shop?.id) };
    } finally {
      db.close();
    }
  }, NAME);
}

const card = (page) => page.locator('#home .shop-rail .card', { hasText: NAME });

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
  await page.locator('.chip', { hasText: '카페 도장판' }).click();
  await page.locator('#f-name').fill(NAME);
  await page.getByRole('button', { name: '추가하기' }).click();
  // The first item (no expiry date) is followed by the one-time backup hint.
  await expect(page.getByRole('dialog', { name: '백업을 권장해요' })).toBeVisible();
  await page.getByRole('button', { name: '나중에' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card(page)).toBeVisible();
});

test('C1: a new cafe board starts empty and fills one stamp per tap', async ({ page }) => {
  await expect(card(page).locator('.stamp-board.collect .stamp.valid')).toHaveCount(0);
  const stamp = card(page).getByRole('button', { name: `${NAME} 도장 찍기` });
  await stamp.click();
  await expect(page.locator('#toast')).toContainText('도장 1/10');
  await page.waitForTimeout(400);
  await stamp.click();
  await expect(page.locator('#toast')).toContainText('도장 2/10');
  await expect(card(page).locator('.stamp-board.collect .stamp.valid')).toHaveCount(2);
  const { shop, logs } = await readBoard(page);
  expect(shop.mode).toBe('collect');
  expect(shop.usedCoupons).toBe(2);
  expect(logs).toHaveLength(2);
});

test('C2: a full board celebrates, stays on home and starts over; undo stays on the new board', async ({ page }) => {
  await card(page).locator('.card-main').click();
  await page.getByRole('button', { name: '도장 찍기' }).click();
  await page.locator('#use-count').fill('10');
  await page.locator('.popup-footer').getByRole('button', { name: '찍기' }).click();
  await expect(page.getByRole('dialog', { name: '🎉 도장판 완성!' })).toBeVisible();
  await page.locator('.popup-footer').getByRole('button', { name: '나중에' }).click();
  await expect(page.locator('#detail .detail-status')).toHaveText('완성');

  await page.locator('.nav-item[data-nav="home"]').click();
  await expect(page.locator('#home .shop-rail .card').first()).toContainText(NAME);
  await card(page).getByRole('button', { name: `${NAME} 새 도장판 시작` }).click();
  await page.locator('.popup-footer').getByRole('button', { name: '새 판 시작' }).click();
  await expect(page.locator('#toast')).toContainText('새 도장판을 시작했어요');

  let { shop, logs } = await readBoard(page);
  expect(shop.usedCoupons).toBe(0);
  expect(shop.completedBoards).toBe(1);
  expect(logs).toHaveLength(1); // the full board's stamps stay as history

  await card(page).locator('.card-main').click();
  await expect(page.getByRole('button', { name: '도장 취소' })).toBeDisabled();
  await expect(page.locator('#detail .stamp-head')).toContainText('완성 1판');
});
