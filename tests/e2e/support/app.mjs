// Shared setup for the newer specs: start the app server on a spec's own port
// and open the app with a known set of passes and settings.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appServerCommand } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export async function startAppServer(port) {
  const { command, args } = appServerCommand(ROOT);
  const server = spawn(command, args, { cwd: ROOT, env: { ...process.env, COUPON_BOOK_PORT: String(port) }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/healthz`)).ok) return { server, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error('app server did not become ready in time');
}

// Settings that keep first-run sheets (reminder offer, backup hint) out of the way.
export const QUIET = { onboarded: true, remindersOffered: true, backupHinted: true };

export async function openApp(page, base, { shops = [], settings = QUIET } = {}) {
  await page.goto(base);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('section.active')?.children.length > 0);
  await page.evaluate(async ({ shops, settings }) => {
    const repo = await import('/js/data/repo.js');
    for (const shop of shops) await repo.Shops.add(shop);
    for (const [key, value] of Object.entries(settings)) await repo.Settings.set(key, value);
  }, { shops, settings });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('section.active')?.children.length > 0);
}

export const activeSection = (page) => page.evaluate(() => document.querySelector('section.active')?.id);
export const dbShops = (page) => page.evaluate(async () => (await import('/js/data/repo.js')).Shops.all());
export const dbLogs = (page) => page.evaluate(async () => (await import('/js/data/repo.js')).Logs.all());
