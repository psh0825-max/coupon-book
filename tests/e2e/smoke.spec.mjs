import { test, expect } from '@playwright/test';
const PORT = 7810;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const consoleErrors = [];

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
});

test('smoke: onboarding, seed sample, use coupon, chrome, navigate tabs', async ({ page }) => {
  // Start from a fully clean slate so the first-run onboarding appears.
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('CouponBookDB');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
  await page.reload();

  // First run → onboarding is the active section, header reflects it.
  await expect(page.locator('#onboarding')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('[data-page-title]')).toHaveText('시작하기');

  // Step through onboarding: 다음 → 샘플로 둘러보기 (seeds demo + advances) → 시작하기.
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '샘플로 둘러보기' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();

  // Home: shop rail has cards and the header shows the app name.
  await expect(page.locator('.shop-rail .card').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-page-title]')).toHaveText('쿠폰북');

  // Use the first card's pass. Stamp/count passes add or deduct one unit
  // immediately; amount passes open an entry sheet — fill an amount and confirm.
  // Either way we end with a success toast.
  await page.locator('.shop-rail [data-action="quick-use"]').first().click();
  const amountInput = page.locator('#use-amount');
  const sheetOpened = await amountInput
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (sheetOpened) {
    await amountInput.fill('10000');
    await page.locator('.popup-footer').getByRole('button', { name: '사용' }).click();
  }
  await expect(page.locator('#toast.active')).toBeVisible({ timeout: 5000 });

  // Chrome visibility fix: back hidden on home, FAB visible on home.
  await expect(page.locator('[data-back]')).toBeHidden();
  await expect(page.locator('[data-fab]')).toBeVisible();

  // Navigate tabs: 지도 (map) then 설정 (settings).
  await page.locator('.nav-item[data-nav="map"]').click();
  await expect(page.locator('#map')).toHaveClass(/active/);

  await page.locator('.nav-item[data-nav="settings"]').click();
  await expect(page.locator('#settings')).toHaveClass(/active/);
  await expect(page.getByText('만료 임박 알림')).toBeVisible();
  await expect(page.getByText('자동 보관')).toBeVisible();

  // Stamp card: complete it and expect the reward modal.
  await page.locator('.nav-item[data-nav="home"]').click();
  await page.getByRole('button', { name: /모두보기/ }).click();
  await page.locator('#list .card[data-kind="stamp"] .card-main').first().click();
  await expect(page.locator('#detail')).toHaveClass(/active/);
  await page.getByRole('button', { name: '도장 찍기' }).first().click();
  await page.locator('.stepper-btn[aria-label="하나 늘리기"]').click();
  await page.locator('.stepper-btn[aria-label="하나 늘리기"]').click();
  await page.locator('.popup-footer').getByRole('button', { name: '도장 찍기' }).click();
  await expect(page.locator('#reward-modal.active')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '보상 받으러 가기' }).click();

  // Add form: inline validation blocks an empty name.
  await page.locator('[data-fab]').click();
  await expect(page.locator('#add')).toHaveClass(/active/);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.locator('#f-name-error')).toBeVisible();
  await page.locator('#f-name').fill('테스트 카페');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  await expect(page.locator('.shop-rail .card', { hasText: '테스트 카페' })).toBeVisible();

  // No console errors during the flow (tile/network/sw/favicon/geolocation noise excluded).
  const realErrors = consoleErrors.filter(e =>
    !/tile|favicon|sw\.js|ERR_INTERNET|net::|manifest|geolocation/i.test(e));
  expect(realErrors, `console errors: ${realErrors.join(' | ')}`).toHaveLength(0);
});
