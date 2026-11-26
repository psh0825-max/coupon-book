import { test, expect } from '@playwright/test';
import { startAppServer, openApp } from './support/app.mjs';

let app;
test.beforeAll(async () => { app = await startAppServer(7824); });
test.afterAll(() => { app?.server.kill(); });

const HANGUL = /[가-힣]/;
// Shop names are user data and stay as typed; everything else must be translated.
const visibleText = (page, selector) => page.locator(selector).evaluate((el) => el.innerText);

for (const locale of ['en-US', 'ja-JP']) {
  test.describe(locale, () => {
    test.use({ locale });

    test(`T1 (${locale}): detail, edit form and restore dialog show no Korean`, async ({ page }) => {
      await openApp(page, app.base, { shops: [{ name: 'Test pass', category: '카페', kind: 'count', totalCoupons: 5, usedCoupons: 1 }] });
      await page.locator('.card-main', { hasText: 'Test pass' }).first().click();
      await expect(page.locator('#detail')).toHaveClass(/active/);
      expect(await visibleText(page, '#detail')).not.toMatch(HANGUL);

      await page.locator('.detail-actions .btn-secondary').first().click();
      await expect(page.locator('#add')).toHaveClass(/active/);
      await page.locator('.form-more summary').click();
      const optionText = await page.locator('#f-category option').allTextContents();
      expect(optionText.join(' ')).not.toMatch(HANGUL);
      expect(await visibleText(page, '#skin-selector')).not.toMatch(HANGUL);

      await page.locator('[data-nav="settings"]').click();
      await page.setInputFiles('#s-import', {
        name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
          version: 3, exportedAt: 1700000000000,
          shops: [{ id: 'r', name: 'Restored pass', totalCoupons: 5, kind: 'count', createdAt: 1, updatedAt: 2 }], logs: []
        }))
      });
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      expect(await dialog.innerText()).not.toMatch(HANGUL);
    });
  });
}

test.describe('English samples', () => {
  test.use({ locale: 'en-US' });

  test('T2: samples added in English get English names and addresses', async ({ page }) => {
    await openApp(page, app.base, { shops: [] });
    await page.locator('#home .empty-state .btn-secondary').first().click();
    await expect(page.locator('#home .card-main', { hasText: 'Herb Coffee Roasters' })).toBeVisible();
    expect(await visibleText(page, '#home')).not.toMatch(HANGUL);
  });
});
