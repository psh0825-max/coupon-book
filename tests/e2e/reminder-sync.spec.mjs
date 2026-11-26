import { test, expect } from '@playwright/test';
import { startAppServer, openApp } from './support/app.mjs';

let app;
test.beforeAll(async () => { app = await startAppServer(7822); });
test.afterAll(() => { app?.server.kill(); });

function inDays(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A recording stand-in for the Android shell's native alarm bridge.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__alarms = new Map();
    window.AndroidBridge = {
      scheduleReminder: (id, title, body, when) => window.__alarms.set(id, when),
      cancelReminder: (id) => window.__alarms.delete(id),
      showNotification: () => {},
      canNotify: () => true,
      requestNotificationPermission: () => setTimeout(() => window.__cbNotifyPermission?.(true), 0)
    };
  });
});

const armed = (page) => page.evaluate(() => window.__alarms.size);
const settings = { onboarded: true, remindersOffered: true, backupHinted: true, remindersEnabled: true, reminderDays: [7, 3, 1] };

test('S1: undoing the use that finished a pass re-arms its expiry alarms', async ({ page }) => {
  await openApp(page, app.base, { settings, shops: [{ name: '한 번 남은 이용권', kind: 'count', totalCoupons: 1, usedCoupons: 0, expiresAt: inDays(30) }] });
  expect(await armed(page)).toBe(3);
  await page.locator('[data-action="quick-use"]').first().click();
  await expect(page.locator('#toast')).toContainText('모두 사용했어요');
  expect(await armed(page)).toBe(0);
  await page.locator('#toast').getByRole('button', { name: '되돌리기' }).click();
  await expect(page.locator('#toast')).toContainText('마지막 사용 기록을 취소했어요');
  expect(await armed(page)).toBe(3);
});

test('S2: clearing all data cancels the alarms of the passes it removed', async ({ page }) => {
  await openApp(page, app.base, { settings, shops: [{ name: '만료 예정 이용권', kind: 'count', totalCoupons: 5, expiresAt: inDays(30) }] });
  expect(await armed(page)).toBe(3);
  await page.locator('[data-nav="settings"]').click();
  await page.getByRole('button', { name: '모든 업체와 내역 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '초기화' }).click();
  await expect(page.locator('#toast')).toContainText('전체 데이터를 초기화했어요');
  expect(await armed(page)).toBe(0);
});

const denyingShell = () => {
  window.AndroidBridge.canNotify = () => false;
  window.AndroidBridge.requestNotificationPermission = () => {
    window.__prompts = (window.__prompts || 0) + 1;
    setTimeout(() => window.__cbNotifyPermission?.(false), 0);
  };
};

const backupWithReminders = () => ({
  name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    version: 3, exportedAt: 1700000000000,
    shops: [{ id: 'r1', name: '복원된 이용권', kind: 'count', totalCoupons: 5, expiresAt: inDays(30), createdAt: 1, updatedAt: 2 }],
    logs: [],
    settings: [{ key: 'remindersEnabled', value: true }, { key: 'remindersOffered', value: true }, { key: 'reminderDays', value: [7, 3, 1] }]
  }))
});

const remindersEnabled = (page) => page.evaluate(async () => (await (await import('/js/data/repo.js')).Settings.getAll()).remindersEnabled);

test('S3: reminders restored on a shell that cannot notify are switched off after a denied prompt', async ({ page }) => {
  await page.addInitScript(denyingShell);
  await openApp(page, app.base, { shops: [] });
  await page.locator('[data-nav="settings"]').click();
  await page.setInputFiles('#s-import', backupWithReminders());
  await page.getByRole('dialog').getByRole('button', { name: '복원하기' }).click();
  await expect(page.locator('#toast')).toContainText('알림 권한이 없어 만료 알림을 껐어요');
  expect(await page.evaluate(() => window.__prompts)).toBe(1);
  expect(await remindersEnabled(page)).toBe(false);
  expect(await armed(page)).toBe(0);
});

// A 2.0.9 install whose user switched reminders on with notifications off: the
// designed in-app-only mode. Launching this version must not ask or switch it off.
test('S4: an existing install with reminders on and notifications off is left alone at launch', async ({ page }) => {
  await page.addInitScript(denyingShell);
  await openApp(page, app.base, { settings, shops: [{ name: '만료 예정 이용권', kind: 'count', totalCoupons: 5, expiresAt: inDays(30) }] });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__prompts || 0)).toBe(0);
  expect(await remindersEnabled(page)).toBe(true);
  expect(await page.evaluate(() => document.querySelector('#toast')?.innerText || '')).not.toContain('알림 권한이 없어');
});
