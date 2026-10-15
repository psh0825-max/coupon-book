import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7817;
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

async function freshDemo(page) {
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
}

async function openHub(page) {
  await page.locator('.nav-item[data-nav="home"]').click();
  await page.getByRole('button', { name: /허브 커피 로스터스.*상세 보기/ }).click();
}

test.beforeAll(async () => {
  server = spawn(PYTHON, ['app.py'], { cwd: ROOT, env: { ...process.env, COUPON_BOOK_PORT: String(PORT) }, stdio: 'ignore' });
  await waitForServer();
});
test.afterAll(async () => { if (server && !server.killed) server.kill(); });

test('archive: 보관, 되돌리기, 꺼내기와 삭제가 사용 내역을 보존하거나 함께 삭제한다', async ({ page }) => {
  await freshDemo(page);
  await openHub(page);

  // Create a real usage log before archiving.
  await page.getByRole('button', { name: '사용하기' }).click();
  await page.locator('.popup-footer').getByRole('button', { name: '사용' }).click();
  await expect(page.locator('#toast.active')).toBeVisible();
  const hubId = await page.evaluate(async () => new Promise((resolve) => {
    const req = indexedDB.open('CouponBookDB');
    req.onsuccess = () => {
      const tx = req.result.transaction('shops', 'readonly');
      const get = tx.objectStore('shops').getAll();
      get.onsuccess = () => resolve(get.result.find((shop) => shop.name === '허브 커피 로스터스').id);
    };
  }));

  await page.getByRole('button', { name: '보관하기' }).click();
  await expect(page.locator('#toast')).toContainText('보관함으로 옮겼어요');
  await page.locator('[data-back]').click();
  await expect(page.locator('.shop-rail')).not.toContainText('허브 커피 로스터스');
  await page.getByRole('button', { name: '모두보기 ›' }).click();
  await expect(page.locator('#shop-grid')).not.toContainText('허브 커피 로스터스');
  await page.getByRole('tab', { name: '보관함' }).click();
  await expect(page.locator('#shop-grid')).toContainText('허브 커피 로스터스');
  await expect(page.locator('#shop-grid')).toContainText('보관됨');
  expect(await page.evaluate(async (id) => new Promise((resolve) => {
    const req = indexedDB.open('CouponBookDB');
    req.onsuccess = () => { const q = req.result.transaction('logs', 'readonly').objectStore('logs').index('shopId').getAll(id); q.onsuccess = () => resolve(q.result.length); };
  }), hubId)).toBeGreaterThan(0);

  // A2: toast undo restores it.
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.locator('#toast')).toContainText('보관함에서 꺼냈어요');
  await openHub(page);
  await page.getByRole('button', { name: '보관하기' }).click();
  await page.locator('[data-back]').click();
  await page.getByRole('button', { name: '모두보기 ›' }).click();
  await page.getByRole('tab', { name: '보관함' }).click();
  await page.getByRole('button', { name: /허브 커피 로스터스.*상세 보기/ }).click();

  // A3: archived detail can restore it.
  await expect(page.getByText('보관된 이용권이에요 · 사용 내역은 그대로 남아 있어요')).toBeVisible();
  await page.getByRole('button', { name: '꺼내기' }).click();
  await expect(page.locator('#toast')).toContainText('보관함에서 꺼냈어요');
  await page.getByRole('button', { name: '보관하기' }).click();
  await page.getByRole('button', { name: '삭제' }).click();
  await page.getByRole('button', { name: '삭제' }).last().click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  expect(await page.evaluate(async (id) => new Promise((resolve) => {
    const req = indexedDB.open('CouponBookDB');
    req.onsuccess = () => { const tx = req.result.transaction(['shops', 'logs'], 'readonly'); const shop = tx.objectStore('shops').get(id); const logs = tx.objectStore('logs').index('shopId').getAll(id); tx.oncomplete = () => resolve({ exists: !!shop.result, logs: logs.result.length }); };
  }), hubId)).toEqual({ exists: false, logs: 0 });
});
