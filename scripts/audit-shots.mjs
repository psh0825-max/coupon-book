#!/usr/bin/env node
// scripts/audit-shots.mjs — capture every screen of the web app at phone size for
// the UX audit (claudedocs/ios-release-audit.md). Runs against scripts/serve.mjs.
//   node scripts/serve.mjs 7791 &
//   node scripts/audit-shots.mjs claudedocs/audit/before [http://127.0.0.1:7791]

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'claudedocs/audit/shots');
const BASE = process.argv[3] || 'http://127.0.0.1:7791';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 440, height: 956 },   // iPhone 17 Pro Max points
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR'
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('CouponBookDB');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  localStorage.clear();
});
await page.reload({ waitUntil: 'networkidle' });

// 1. onboarding
await page.waitForSelector('#onboarding.active', { timeout: 10000 });
await sleep(600);
await shot('01-onboarding-1');
await page.getByRole('button', { name: '다음' }).click();
await sleep(300);
await shot('02-onboarding-2');
await page.getByRole('button', { name: '다음' }).click();
await sleep(300);
await shot('03-onboarding-3');
await page.getByRole('button', { name: '시작하기' }).click();
await sleep(500);

// 2. home empty
await page.waitForSelector('#home.active');
await shot('04-home-empty');

// 3. add form
await page.locator('[data-fab]').click();
await page.waitForSelector('#add.active');
await sleep(300);
await shot('05-add-top');
await page.locator('#main').evaluate((el) => el.scrollTo(0, 900));
await sleep(200);
await shot('06-add-scrolled');
await page.locator('#main').evaluate((el) => el.scrollTo(0, 99999));
await sleep(200);
await shot('07-add-bottom');

// 4. seed samples via settings
await page.locator('[data-nav="settings"]').click();
await page.waitForSelector('#settings.active');
const seed = page.getByRole('button', { name: /샘플/ }).first();
await seed.click();
await sleep(2600);

// 5. home with data
await page.locator('[data-nav="home"]').click();
await page.waitForSelector('#home.active');
await sleep(400);
await shot('08-home');
await page.locator('#main').evaluate((el) => el.scrollTo(0, 99999));
await sleep(200);
await shot('09-home-bottom');

// 6. list
await page.locator('#main').evaluate((el) => el.scrollTo(0, 0));
await page.getByRole('button', { name: /모두보기|전체보기/ }).first().click();
await page.waitForSelector('#list.active');
await sleep(300);
await shot('10-list');

// 7. detail
await page.locator('#list .card-main').first().click();
await page.waitForSelector('#detail.active');
await sleep(300);
await shot('11-detail');
await page.locator('#main').evaluate((el) => el.scrollTo(0, 99999));
await sleep(200);
await shot('12-detail-bottom');

// 8. use sheet
await page.locator('#main').evaluate((el) => el.scrollTo(0, 0));
await page.getByRole('button', { name: /사용하기|도장 찍기/ }).first().click();
await sleep(500);
await shot('13-use-sheet');
await page.keyboard.press('Escape');
await sleep(500);

// 9. history
await page.locator('[data-nav="history"]').click();
await page.waitForSelector('#history.active');
await sleep(300);
await shot('14-history');

// 10. map
await page.locator('[data-nav="map"]').click();
await page.waitForSelector('#map.active');
await sleep(2500);
await shot('15-map');

// 11. settings
await page.locator('[data-nav="settings"]').click();
await page.waitForSelector('#settings.active');
await sleep(400);
await shot('16-settings-top');
await page.locator('#main').evaluate((el) => el.scrollTo(0, 99999));
await sleep(200);
await shot('17-settings-bottom');

await browser.close();
const real = errors.filter((e) => !/tile|favicon|sw\.js|ERR_INTERNET|net::|manifest|geolocation|pretendard|jsdelivr/i.test(e));
console.log('console errors:', real.length ? real : 'none');
console.log('done ->', OUT);
