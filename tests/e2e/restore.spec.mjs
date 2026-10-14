import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 7814;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PYTHON = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
let server;

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE_URL}/healthz`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Flask server did not become ready in time');
}

async function resetAndSeed(page) {
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
  await page.locator('.nav-item[data-nav="settings"]').click();
  await expect(page.locator('#settings')).toHaveClass(/active/);
}

function backupFile() {
  return {
    name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      version: 3, exportedAt: 1700000000000,
      shops: [{ id: 'restore-a', name: '복원 테스트 가게', totalCoupons: 5, usedCoupons: 2, kind: 'count', createdAt: 1, updatedAt: 2 }],
      logs: [
        { id: 'restore-log-1', shopId: 'restore-a', usedAt: 3, count: 1 },
        { id: 'restore-log-2', shopId: 'restore-a', usedAt: 4, count: 1 }
      ]
    }))
  };
}

async function dbCounts(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('CouponBookDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(['shops', 'logs']);
    const all = (store) => new Promise((resolve, reject) => {
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const [shops, logs] = await Promise.all([all('shops'), all('logs')]);
    db.close();
    return { shops, logs };
  });
}

test.beforeAll(async () => {
  server = spawn(PYTHON, ['app.py'], { cwd: ROOT, env: { ...process.env, COUPON_BOOK_PORT: String(PORT) }, stdio: 'ignore' });
  await waitForServer();
});
test.afterAll(async () => { if (server && !server.killed) server.kill(); });

test('R1: 확인하면 백업 내용으로 완전히 복원한다', async ({ page }) => {
  await resetAndSeed(page);
  await page.setInputFiles('#s-import', backupFile());
  const dialog = page.getByRole('dialog', { name: '백업으로 복원할까요?' });
  await expect(dialog).toContainText('이용권 1개');
  await expect(dialog).toContainText('사용 내역 2건');
  await dialog.getByRole('button', { name: '복원하기' }).click();
  await expect(page.locator('#toast')).toContainText('복원 완료');
  const data = await dbCounts(page);
  expect(data.shops).toHaveLength(1);
  expect(data.shops[0].id).toBe('restore-a');
  expect(data.logs).toHaveLength(2);
});

test('R2: 취소하면 기존 데이터를 유지한다', async ({ page }) => {
  await resetAndSeed(page);
  const before = await dbCounts(page);
  await page.setInputFiles('#s-import', backupFile());
  await page.getByRole('dialog', { name: '백업으로 복원할까요?' }).getByRole('button', { name: '취소' }).click();
  const after = await dbCounts(page);
  expect(after).toEqual(before);
});

test('R3: 잘못된 JSON은 데이터를 바꾸지 않고 오류를 보인다', async ({ page }) => {
  await resetAndSeed(page);
  const before = await dbCounts(page);
  await page.setInputFiles('#s-import', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#toast')).toContainText('JSON');
  expect(await dbCounts(page)).toEqual(before);
});
