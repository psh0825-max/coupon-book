import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7812;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
const ICON_PATH = path.join(ROOT, 'static', 'icon-512.png');

let server;

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

test('G1: attaches a valid gifticon image', async ({ page }) => {
  const input = page.locator('#f-gifticon');
  const hint = page.locator('#f-gifticon ~ .field-hint');
  const preview = page.locator('#f-gifticon ~ .gifticon-preview .gifticon-thumb');

  await input.setInputFiles(ICON_PATH);

  await expect(hint).toHaveText(/첨부했어요/);
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('src', /^data:image\//);
});

test('G2: rejects a non-image gifticon attachment', async ({ page }) => {
  const input = page.locator('#f-gifticon');
  const hint = page.locator('#f-gifticon ~ .field-hint');
  const preview = page.locator('#f-gifticon ~ .gifticon-preview .gifticon-thumb');

  await input.setInputFiles({
    name: 'not-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });

  await expect(hint).toHaveText(/이미지를 읽을 수 없어요/);
  await expect(preview).toBeHidden();
});
