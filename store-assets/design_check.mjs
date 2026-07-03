import { chromium } from 'playwright';
const browser = await chromium.launch();
// mobile
const m = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await m.goto('http://127.0.0.1:7789', { waitUntil: 'networkidle' });
await m.getByRole('button', { name: '건너뛰기' }).click();
await m.locator('[data-nav="settings"]').click();
await m.getByRole('button', { name: '샘플 업체 추가' }).click();
await m.waitForTimeout(3500);
await m.locator('[data-nav="home"]').click();
await m.waitForTimeout(600);
await m.screenshot({ path: 'store-assets/check-mobile-home.png' });
await m.locator('[data-fab]').click();
await m.waitForTimeout(500);
await m.screenshot({ path: 'store-assets/check-mobile-add.png' });
// desktop shell
const d = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await d.goto('http://127.0.0.1:7789', { waitUntil: 'networkidle' });
await d.waitForTimeout(800);
await d.screenshot({ path: 'store-assets/check-desktop.png' });
await browser.close();
console.log('done');
