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

test('N1: Back after deleting a pass from its edit form never shows a blank Home', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('지울 이용권'), pass('남길 이용권')] });
  await openDetail(page, '지울 이용권');
  await page.locator('.detail-actions').getByRole('button', { name: '편집' }).click();
  await expect(page.locator('#add')).toHaveClass(/active/);
  await page.locator('#shop-form .btn-danger').click();
  await page.locator('.popup-footer .btn-danger').click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  await expect(page.locator('#home .card-main', { hasText: '남길 이용권' })).toBeVisible();

  // Back either leaves the app (no stale entries left) or shows a filled Home.
  await page.evaluate(() => history.back()).catch(() => {});
  await page.waitForTimeout(600);
  if (page.url() === 'about:blank') return;
  expect(await activeSection(page)).toBe('home');
  await expect(page.locator('#home .card-main', { hasText: '남길 이용권' })).toBeVisible();
});

test('N1b: Back onto the entry of a pass that no longer exists lands on a filled Home', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('남길 이용권')] });
  // A detail entry left behind for a pass deleted since, with a page above it.
  await page.evaluate(() => {
    history.pushState({ name: 'detail', params: { id: 'deleted-pass' }, depth: 1 }, '');
    history.pushState({ name: 'list', params: {}, depth: 2 }, '');
  });
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

// openApp starts from about:blank, so one Back past the app's first entry
// leaves the app — what the Android shell does when the WebView cannot go back.
async function backLeavesApp(page) {
  // Leaving the document tears down the evaluate's context; that is the pass case.
  await page.evaluate(() => history.back()).catch(() => {});
  await page.waitForTimeout(600);
  return page.url() === 'about:blank';
}

test('N3: after adding passes, one Back from Home leaves the app', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('기존 이용권')] });
  for (const name of ['새 이용권 1', '새 이용권 2', '새 이용권 3']) {
    await page.locator('[data-fab]').click();
    await page.locator('#f-name').fill(name);
    await page.locator('#shop-form button[type=submit]').click();
    await expect(page.locator('#home .card-main', { hasText: name })).toBeVisible();
  }
  expect(await page.evaluate(() => history.state.depth)).toBe(0);
  expect(await backLeavesApp(page)).toBe(true);
});

test('N4: after saving an edit, Back from Home leaves the app instead of reopening the pass', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('편집할 이용권')] });
  await openDetail(page, '편집할 이용권');
  await page.locator('.detail-actions').getByRole('button', { name: '편집' }).click();
  await page.locator('#f-name').fill('편집한 이용권');
  await page.locator('#shop-form button[type=submit]').click();
  await expect(page.locator('#home .card-main', { hasText: '편집한 이용권' })).toBeVisible();
  expect(await backLeavesApp(page)).toBe(true);
});

test('N5: a bottom tab from a sub page unwinds it, so Back from that tab leaves the app', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('탭 이용권')] });
  await openDetail(page, '탭 이용권');
  await page.locator('[data-nav="settings"]').click();
  await expect(page.locator('#settings')).toHaveClass(/active/);
  expect(await backLeavesApp(page)).toBe(true);
});

test('N6: Back on a form with unsaved input asks before discarding it', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('기존 이용권')] });
  await page.locator('[data-fab]').click();
  await page.locator('#f-name').fill('쓰다 만 이용권');

  await page.evaluate(() => history.back());
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('저장하지 않은 내용은 사라져요');
  await sheet.getByRole('button', { name: '취소' }).click();
  await page.waitForTimeout(600);
  expect(await activeSection(page)).toBe('add');
  await expect(page.locator('#f-name')).toHaveValue('쓰다 만 이용권');

  await page.locator('[data-back]').click();
  await page.getByRole('dialog').getByRole('button', { name: '나가기' }).click();
  await page.waitForTimeout(800);
  expect(await activeSection(page)).toBe('home');
  expect(await page.evaluate(() => history.state.depth)).toBe(0);
  expect(await page.locator('#overlay').count()).toBe(0);
});

test('N7: Back on an untouched form leaves without asking', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('기존 이용권')] });
  await page.locator('[data-fab]').click();
  await expect(page.locator('#add')).toHaveClass(/active/);
  await page.evaluate(() => history.back());
  await page.waitForTimeout(600);
  expect(await activeSection(page)).toBe('home');
  expect(await page.locator('#overlay').count()).toBe(0);
});

test('N8: leaving a dirty form through the bottom tabs, the add button or a template asks first', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('기존 이용권')] });
  await page.locator('[data-fab]').click();
  await page.locator('#f-name').fill('쓰다 만 이용권');

  for (const leave of [
    () => page.locator('[data-nav="settings"]').click(),
    () => page.locator('[data-fab]').click(),
    () => page.locator('.use-chips .chip').first().click()
  ]) {
    await leave();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('저장하지 않은 내용은 사라져요');
    await sheet.getByRole('button', { name: '취소' }).click();
    await page.waitForTimeout(500);
    expect(await activeSection(page)).toBe('add');
    await expect(page.locator('#f-name')).toHaveValue('쓰다 만 이용권');
  }

  await page.locator('[data-nav="settings"]').click();
  await page.getByRole('dialog').getByRole('button', { name: '나가기' }).click();
  await expect(page.locator('#settings')).toHaveClass(/active/);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => history.state.depth)).toBe(0);
});

test('N9: deleting a pass from an edited form asks only the delete question', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('지울 이용권'), pass('남길 이용권')] });
  await openDetail(page, '지울 이용권');
  await page.locator('.detail-actions').getByRole('button', { name: '편집' }).click();
  await page.locator('#f-name').fill('바꾼 이름');
  await page.locator('#shop-form .btn-danger').click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  await page.waitForTimeout(600);
  expect(await page.locator('#overlay').count()).toBe(0);
  await expect(page.locator('#home .card-main', { hasText: '지울 이용권' })).toHaveCount(0);
});

// The Android shell calls window.__cbBack() before walking WebView history
// back; true means the page is handling Back itself.
test('N10: the shell back hook asks about a dirty form without touching history first', async ({ page }) => {
  await openApp(page, app.base, { shops: [pass('기존 이용권')] });
  await page.locator('[data-fab]').click();
  expect(await page.evaluate(() => window.__cbBack?.() ?? null)).toBe(false); // clean form: shell goes back
  await page.locator('#f-name').fill('쓰다 만 이용권');
  const before = await page.evaluate(() => [history.length, history.state.name]);

  expect(await page.evaluate(() => window.__cbBack())).toBe(true);
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('저장하지 않은 내용은 사라져요');
  // Only the sheet's own entry was added; the form's entry was not popped and re-pushed.
  expect(await page.evaluate(() => [history.length, history.state.name, !!history.state.overlay])).toEqual([before[0] + 1, 'add', true]);
  // With the sheet open the shell's own back closes it.
  expect(await page.evaluate(() => window.__cbBack())).toBe(false);

  await sheet.getByRole('button', { name: '나가기' }).click();
  await expect(page.locator('#home')).toHaveClass(/active/);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => history.state.depth)).toBe(0);
});
