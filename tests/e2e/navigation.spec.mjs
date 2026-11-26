import { test, expect } from '@playwright/test';
import { startAppServer, openApp, activeSection } from './support/app.mjs';

let app;
test.beforeAll(async () => { app = await startAppServer(7820); });
test.afterAll(() => { app?.server.kill(); });

const pass = (name, extra = {}) => ({ name, kind: 'count', totalCoupons: 5, usedCoupons: 0, ...extra });

async function openDetail(page, name) {
  await page.locator('.card-main', { hasText: name }).first().click();
  await expect(page.locator('#detail')).toHaveClass(/active/);
}

test('N1: Back after deleting a pass from its edit form shows a filled Home', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('지울 이용권'), pass('남길 이용권')] });
  await openDetail(page, '지울 이용권');
  await page.locator('.detail-actions').getByRole('button', { name: '편집' }).click();
  await expect(page.locator('#add')).toHaveClass(/active/);
  await page.locator('#shop-form .btn-danger').click();
  await page.locator('.popup-footer .btn-danger').click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  await expect(page.locator('#home .card-main', { hasText: '남길 이용권' })).toBeVisible();

  await page.evaluate(() => history.back());
  await page.waitForTimeout(600);
  expect(await activeSection(page)).toBe('home');
  await expect(page.locator('#home .card-main', { hasText: '남길 이용권' })).toBeVisible();
});

test.describe('nearby shop sheet', () => {
  test.use({ geolocation: { latitude: 37.5, longitude: 127.0 }, permissions: ['geolocation'] });

  test('N2: tapping a shop in the nearby sheet opens its detail and stays there', async ({ page }) => {
    await openApp(page, app.base, {
      shops: [pass('가까운 가게', { lat: 37.5, lng: 127.0 })],
      settings: { onboarded: true, notifyEnabled: true, notifyDelay: 0 }
    });
    const card = page.locator('.nearby-sheet .nearby-card').first();
    await card.waitFor({ timeout: 45000 });
    await card.click();
    await page.waitForTimeout(800);
    expect(await activeSection(page)).toBe('detail');
    await expect(page.locator('#detail h2').first()).toHaveText('가까운 가게');

    await page.evaluate(() => history.back());
    await page.waitForTimeout(600);
    expect(await activeSection(page)).toBe('home');
  });
});
