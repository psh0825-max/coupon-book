// Record a smooth app walkthrough for the promo video.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('store-assets/video', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 892 },
  recordVideo: { dir: 'store-assets/video', size: { width: 412, height: 892 } },
  locale: 'ko-KR'
});
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);

await page.goto('http://127.0.0.1:7789', { waitUntil: 'networkidle' });
await pause(1600);                                   // onboarding step 1 (wallet art)
await page.getByRole('button', { name: '다음' }).click();
await pause(1400);                                   // step 2 (stamps art)
await page.getByRole('button', { name: '샘플 보기' }).click();
await pause(1600);                                   // step 3 (bell art)
await page.getByRole('button', { name: '시작하기' }).click();
await pause(1800);                                   // home with sample data

// quick use + undo toast
const useBtn = page.locator('#home .shop-rail button', { hasText: '사용' }).first();
await useBtn.click();
await pause(2200);                                   // toast with 되돌리기 visible

// detail (stamp board)
await page.locator('#home .priority-panel').click();
await pause(1500);
await page.mouse.wheel(0, 500);
await pause(1400);
await page.locator('[data-back]').click();
await pause(900);

// map
await page.locator('[data-nav="map"]').click();
await pause(2600);                                   // tiles + markers

// add with quick templates
await page.locator('[data-fab]').click();
await pause(1300);
await page.locator('#add .use-chips .chip').first().click();
await pause(1800);                                   // prefilled form

await ctx.close();                                   // flush video
await browser.close();
console.log('recorded');
