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
