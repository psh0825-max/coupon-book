import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7818;
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
test.beforeAll(async () => {
  server = spawn(PYTHON, ['app.py'], { cwd: ROOT, env: { ...process.env, COUPON_BOOK_PORT: String(PORT) }, stdio: 'ignore' });
  await waitForServer();
});
test.afterAll(() => { if (server && !server.killed) server.kill(); });

async function openCodePass(page, { android = false } = {}) {
  await page.addInitScript(({ android }) => {
    window.__presentationCalls = [];
    window.__wakeLockCalls = [];
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (type) => {
      window.__wakeLockCalls.push(type);
      return { release: async () => window.__wakeLockCalls.push('release') };
    } } });
    if (android) window.AndroidBridge = { setPresentationMode: (value) => window.__presentationCalls.push(value) };
  }, { android });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('CouponBookDB', 2);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('shops')) req.result.createObjectStore('shops', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const now = Date.now();
    const tx = db.transaction(['shops', 'settings'], 'readwrite');
    tx.objectStore('shops').put({ id: 'present-code', name: '코드 테스트', category: '기타', kind: 'coupon', totalCoupons: 1, usedCoupons: 0, code: '1234567890', skin: 'midnight', createdAt: now, updatedAt: now });
    tx.objectStore('settings').put({ key: 'onboarded', value: true });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  await page.getByText('코드 테스트', { exact: true }).first().click();
  await expect(page.getByRole('button', { name: '크게 보기' })).toBeVisible();
}

test('P1: code presenter locks screen and closes cleanly', async ({ page }) => {
  await openCodePass(page);
  await page.getByRole('button', { name: '크게 보기' }).click();
  const presenter = page.getByRole('dialog', { name: '쿠폰 코드 크게 보기' });
  await expect(presenter).toBeVisible();
  await expect(presenter.locator('svg, canvas').first()).toBeVisible();
  await expect(presenter).toContainText('1234567890');
  await expect.poll(() => page.evaluate(() => window.__wakeLockCalls)).toEqual(['screen']);
  await presenter.getByRole('button', { name: '닫기' }).click();
  await expect(presenter).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__wakeLockCalls)).toEqual(['screen', 'release']);
});

test('P2: browser back closes the presenter without leaving detail', async ({ page }) => {
  await openCodePass(page);
  await page.getByRole('button', { name: '크게 보기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '코드 테스트' })).toBeVisible();
});

test('P3: Android bridge controls brightness and bypasses Wake Lock', async ({ page }) => {
  await openCodePass(page, { android: true });
  await page.getByRole('button', { name: '크게 보기' }).click();
  const presenter = page.getByRole('dialog', { name: '쿠폰 코드 크게 보기' });
  await expect(presenter).toBeVisible();
  await expect(presenter.getByText('화면 밝기를 최대로 올리면 더 잘 읽혀요')).toHaveCount(0);
  await presenter.getByRole('button', { name: '닫기' }).click();
  // boot reset, open, close.
  await expect.poll(() => page.evaluate(() => window.__presentationCalls)).toEqual([false, true, false]);
  await expect.poll(() => page.evaluate(() => window.__wakeLockCalls)).toEqual([]);
});

test('P4: short landscape screens show QR, barcode and code without scrolling', async ({ page }) => {
  const viewports = [{ width: 1204, height: 591 }, { width: 780, height: 360 }];

  for (const android of [false, true]) for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openCodePass(page, { android });
    await page.getByRole('button', { name: '크게 보기' }).click();
    await expect(page.getByRole('dialog', { name: '쿠폰 코드 크게 보기' })).toBeVisible();
    const layout = await page.evaluate(() => {
      const presenter = document.querySelector('.presenter-content');
      const code = document.querySelector('.code-presenter');
      const [qr, barcode] = code.querySelectorAll('.code-presenter-media svg');
      const info = code.querySelector('.code-presenter-info');
      const text = code.querySelector('.code-presenter-text');
      const close = document.querySelector('.presenter-close');
      const bounds = (element) => {
        const { left, top, right, bottom, height } = element.getBoundingClientRect();
        return { left, top, right, bottom, height };
      };
      return {
        qr: bounds(qr), barcode: bounds(barcode), info: bounds(info), text: bounds(text), close: bounds(close),
        scrollHeight: presenter.scrollHeight, clientHeight: presenter.clientHeight,
        width: innerWidth, height: innerHeight
      };
    });
    for (const element of ['qr', 'barcode', 'text', 'close']) {
      expect(layout[element].left).toBeGreaterThanOrEqual(-1);
      expect(layout[element].top).toBeGreaterThanOrEqual(-1);
      expect(layout[element].right).toBeLessThanOrEqual(layout.width + 1);
      expect(layout[element].bottom).toBeLessThanOrEqual(layout.height + 1);
    }
    expect(layout.qr.height).toBeGreaterThanOrEqual(viewport.width === 1204 ? 180 : 120);
    expect(Math.abs((layout.info.top + layout.info.height / 2) - (layout.qr.top + layout.qr.height / 2))).toBeLessThanOrEqual(8);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
    await page.getByRole('button', { name: '닫기' }).click();
  }

  await page.setViewportSize({ width: 360, height: 780 });
  await openCodePass(page);
  await page.getByRole('button', { name: '크게 보기' }).click();
  const presenter = page.getByRole('dialog', { name: '쿠폰 코드 크게 보기' });
  await expect(presenter.getByRole('heading', { name: '쿠폰/멤버십 코드' })).toBeVisible();
  const portrait = await presenter.evaluate((dialog) => {
    const [qr, barcode] = dialog.querySelectorAll('.code-presenter-media svg');
    return { qr: qr.getBoundingClientRect().toJSON(), barcode: barcode.getBoundingClientRect().toJSON() };
  });
  expect(portrait.qr.bottom).toBeLessThanOrEqual(portrait.barcode.top);
});
