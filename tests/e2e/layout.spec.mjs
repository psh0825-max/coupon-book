import { test, expect } from '@playwright/test';
import { startAppServer, openApp } from './support/app.mjs';

let app;
test.beforeAll(async () => { app = await startAppServer(7823); });
test.afterAll(() => { app?.server.kill(); });

test.describe('English at 360px', () => {
  test.use({ locale: 'en-US', viewport: { width: 360, height: 780 } });

  test('L1: a used-up pass detail does not scroll sideways', async ({ page }) => {
    await openApp(page, app.base, { shops: [{ name: 'Used up pass', kind: 'count', totalCoupons: 5, usedCoupons: 5 }] });
    // Used-up passes are not on the home rail; open it from the full list.
    await page.locator('.rail-more, .empty-state .btn-secondary').first().click();
    await page.locator('#list .card-main', { hasText: 'Used up pass' }).first().click();
    await expect(page.locator('#detail .depleted-actions')).toBeVisible();
    const box = await page.evaluate(() => {
      const main = document.getElementById('main');
      const buttons = [...document.querySelectorAll('#detail .detail-actions .btn')].map((b) => b.getBoundingClientRect());
      return {
        scroll: main.scrollWidth, client: main.clientWidth,
        right: Math.max(...buttons.map((r) => r.right)), left: Math.min(...buttons.map((r) => r.left))
      };
    });
    expect(box.scroll).toBeLessThanOrEqual(box.client);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(360);
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 800, height: 1280 } });

  // The shell stays a 480px phone column on large screens, so the cards must
  // keep their phone width instead of splitting that column in two.
  test('L2: home rail and list cards keep their phone width inside the 480px column', async ({ page }) => {
    const shops = ['첫 번째 이용권', '두 번째 이용권', '세 번째 이용권'].map((name) => ({ name, kind: 'count', totalCoupons: 10, usedCoupons: 2 }));
    await openApp(page, app.base, { shops });
    const railWidth = await page.locator('#home .shop-rail > .card').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(railWidth).toBeGreaterThan(300);

    await page.locator('.rail-more').first().click();
    await expect(page.locator('#list')).toHaveClass(/active/);
    const listWidth = await page.locator('#shop-grid > *').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(listWidth).toBeGreaterThan(300);
  });
});
