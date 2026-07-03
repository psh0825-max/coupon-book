// Capture Play-store screenshots (1080x1920 raw) from the local dev server.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:7789';
const OUT = 'C:/PROJECT/coupon-book/store-assets/raw';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  locale: 'ko-KR'
});

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. onboarding welcome
await page.waitForSelector('#onboarding button', { timeout: 10000 });
await sleep(400);
await shot('1-onboarding');

// skip onboarding, seed sample data
await page.getByRole('button', { name: '건너뛰기' }).click();
await page.locator('[data-nav="settings"]').click();
await page.getByRole('button', { name: '샘플 업체 추가' }).click();
await sleep(3500); // let the toast disappear

// 2. home dashboard
await page.locator('[data-nav="home"]').click();
await page.waitForSelector('#home .priority-panel');
await sleep(400);
await shot('2-home');

// 3. detail (stamp board)
await page.locator('#home .priority-panel').click();
await page.waitForSelector('#detail');
await sleep(500);
await shot('3-detail');

// 4. list (전체보기)
await page.locator('[data-nav="home"]').click();
await sleep(300);
await page.getByText('모두보기').click();
await page.waitForSelector('#list');
await sleep(500);
await shot('4-list');

// 5. map (wait for OSM tiles)
await page.locator('[data-nav="map"]').click();
await sleep(3000);
await shot('5-map');

// 6. settings (backup / privacy angle)
await page.locator('[data-nav="settings"]').click();
await sleep(400);
await shot('6-settings');

await browser.close();
console.log('done ->', OUT);
