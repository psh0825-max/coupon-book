import { test, expect } from '@playwright/test';
import { startAppServer, openApp, dbShops, dbLogs } from './support/app.mjs';

let app;
test.beforeAll(async () => { app = await startAppServer(7821); });
test.afterAll(() => { app?.server.kill(); });

const amountPass = { name: '금액 이용권', kind: 'amount', totalAmount: 100000, usedAmount: 0 };

for (const [label, value] of [['empty', ''], ['zero', '0']]) {
  test(`A1 (${label}): confirming an amount use without a positive amount keeps the sheet open and deducts nothing`, async ({ page }) => {
    await openApp(page, app.base, { shops: [amountPass] });
    await page.locator('[data-action="quick-use"]').first().click();
    await page.locator('#use-amount').fill(value);
    await page.locator('.popup-footer').getByRole('button', { name: '사용' }).click();
    await page.waitForTimeout(600);

    await expect(page.getByRole('dialog', { name: '금액 사용' })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('사용할 금액을 입력해 주세요');
    const [shop] = await dbShops(page);
    expect(shop.usedAmount || 0).toBe(0);
    expect(await dbLogs(page)).toHaveLength(0);

    await page.locator('#use-amount').fill('3,000');
    await page.locator('.popup-footer').getByRole('button', { name: '사용' }).click();
    await expect(page.locator('#toast')).toContainText('사용 완료');
    const [after] = await dbShops(page);
    expect(after.usedAmount).toBe(3000);
  });
}
