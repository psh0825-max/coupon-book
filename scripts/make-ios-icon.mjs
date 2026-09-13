#!/usr/bin/env node
// scripts/make-ios-icon.mjs — render static/icon.svg to the App Store icon
// (1024×1024, RGB, no alpha) with headless Chromium (honours the SVG gradients),
// then derive the launch/splash art. No ImageMagick needed.
//   node scripts/make-ios-icon.mjs
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const svg = readFileSync(path.join(ROOT, 'static/icon.svg'), 'utf8');
const OUT = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#2563eb">${svg.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`);
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1024, height: 1024 }, omitBackground: false, type: 'png' });
writeFileSync(path.join(OUT, 'AppIcon-1024.png'), png);
await browser.close();
console.log('wrote', path.join(OUT, 'AppIcon-1024.png'));
