#!/usr/bin/env node
// scripts/flow-check.mjs — scripted QA pass over the interactive flows (stamp reward,
// amount sheet, undo, edit, validation, ad-banner layout). Prints console errors.
//   node scripts/serve.mjs 7791 &  →  node scripts/flow-check.mjs claudedocs/audit/flows

import { chromium } from '@playwright/test';
const OUT = process.argv[2] || 'claudedocs/audit/flows';
const BASE = process.argv[3] || 'http://127.0.0.1:7791';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(async () => { await new Promise((r) => { const q = indexedDB.deleteDatabase('CouponBookDB'); q.onsuccess = q.onerror = q.onblocked = () => r(); }); localStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: '건너뛰기' }).click();
await page.locator('[data-nav="settings"]').click();
await page.getByRole('button', { name: /샘플 업체 추가/ }).click();
await page.waitForTimeout(500);
// open cafe stamp card detail via list
await page.locator('[data-nav="home"]').click();
await page.getByRole('button', { name: /모두보기/ }).click();
await page.locator('#list .card[data-kind="stamp"] .card-main').first().click();
await page.waitForSelector('#detail.active');
await shot('01-detail-stamp');
// stamp x3 via sheet with stepper
await page.getByRole('button', { name: '도장 찍기' }).first().click();
await page.waitForTimeout(400);
await page.locator('.stepper-btn[aria-label="하나 늘리기"]').click();
await page.locator('.stepper-btn[aria-label="하나 늘리기"]').click();
await shot('02-stamp-sheet');
await page.locator('.popup-footer').getByRole('button', { name: '도장 찍기' }).click();
await page.waitForTimeout(700);
await shot('03-reward-modal');
const rewardVisible = await page.locator('#reward-modal.active').isVisible();
await page.getByRole('button', { name: '보상 받으러 가기' }).click();
await page.waitForTimeout(500);
await shot('04-detail-complete');
// undo
await page.getByRole('button', { name: '도장 취소' }).click();
await page.waitForTimeout(400);
await page.locator('.popup-footer').getByRole('button', { name: '되돌리기' }).click();
await page.waitForTimeout(500);
await shot('05-detail-after-undo');
// amount sheet
await page.locator('[data-nav="home"]').click();
await page.getByRole('button', { name: /모두보기/ }).click();
await page.locator('#list .card[data-kind="amount"] .card-quick-use').first().click();
await page.waitForTimeout(400);
await shot('06-amount-sheet');
await page.locator('.chip', { hasText: '30,000원' }).click();
await page.locator('.popup-footer').getByRole('button', { name: '사용' }).click();
await page.waitForTimeout(600);
await shot('07-after-amount-use');
// edit existing stamp shop
await page.locator('#list .card[data-kind="stamp"] .card-main').first().click();
await page.getByRole('button', { name: '편집' }).click();
await page.waitForSelector('#add.active');
await page.waitForTimeout(300);
await shot('08-edit-existing');
await page.locator('#main').evaluate((el) => el.scrollTo(0, 99999));
await shot('09-edit-existing-bottom');
// has-ad layout simulation
await page.locator('[data-nav="home"]').click();
await page.evaluate(() => { document.documentElement.style.setProperty('--ad-h', '60px'); document.body.classList.add('has-ad'); });
await page.waitForTimeout(200);
await shot('10-home-has-ad');
await page.locator('#home .card .card-quick-use').first().click();
await page.waitForTimeout(500);
await shot('11-toast-has-ad');
// validation: empty name
await page.locator('[data-fab]').click();
await page.waitForSelector('#add.active');
await page.getByRole('button', { name: '추가하기' }).click();
await page.waitForTimeout(300);
await shot('12-validation');
// history with data
await page.locator('[data-nav="history"]').click();
await page.waitForTimeout(300);
await shot('13-history');
console.log('reward visible:', rewardVisible);
const real = errors.filter((e) => !/tile|favicon|sw\.js|ERR_INTERNET|net::|manifest|geolocation|pretendard|jsdelivr/i.test(e));
console.log('console errors:', real.length ? real : 'none');
await browser.close();
