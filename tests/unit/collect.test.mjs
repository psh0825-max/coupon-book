// 적립형 도장판 (mode 'collect'): a count pass whose usedCoupons counts stamps
// collected. The stored arithmetic is the count pass's; these tests pin the
// wording, ordering and data-layer rules that make it read as collecting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCollectMode, isRewardReady, boardLogs, couponStatus, usableShops, isCompleted,
  remainingLabel, totalLabel, usedLabel, remainingValue
} from '../../static/js/domain.js';
import { normalizeShop, demoShops } from '../../static/js/data/repo.js';
import { parseBackup } from '../../static/js/services/backup.js';

const board = (over = {}) => ({
  id: 'b', name: '카페', kind: 'count', mode: 'collect', totalCoupons: 10, usedCoupons: 3, ...over
});

test('isCollectMode: only a count pass marked collect', () => {
  assert.equal(isCollectMode(board()), true);
  assert.equal(isCollectMode({ totalCoupons: 10, mode: 'collect' }), true); // legacy record without kind
  assert.equal(isCollectMode(board({ mode: null })), false);
  assert.equal(isCollectMode(board({ kind: 'amount' })), false);
  assert.equal(isCollectMode(board({ kind: 'coupon' })), false);
  assert.equal(isCollectMode(null), false);
});

test('normalizeShop: keeps collect mode and board fields', () => {
  const s = normalizeShop(board({ boardStartedAt: 1234, completedBoards: 2 }));
  assert.equal(s.mode, 'collect');
  assert.equal(s.boardStartedAt, 1234);
  assert.equal(s.completedBoards, 2);
  // The stored counts are the plain count-pass counts.
  assert.equal(s.totalCoupons, 10);
  assert.equal(s.usedCoupons, 3);
});

test('normalizeShop: existing passes stay depletion passes', () => {
  const legacy = normalizeShop({ name: '마사지', totalCoupons: 10, usedCoupons: 4 });
  assert.equal(legacy.mode, null);
  assert.equal(legacy.boardStartedAt, null);
  assert.equal(legacy.completedBoards, 0);
  assert.equal(isCollectMode(legacy), false);
});

test('normalizeShop: collect is dropped on amount, coupon and unknown modes', () => {
  assert.equal(normalizeShop({ kind: 'amount', mode: 'collect' }).mode, null);
  assert.equal(normalizeShop({ kind: 'coupon', mode: 'collect' }).mode, null);
  assert.equal(normalizeShop({ kind: 'count', mode: 'fill' }).mode, null);
});

test('normalizeShop: bad board fields fall back safely', () => {
  const s = normalizeShop(board({ boardStartedAt: 'yesterday', completedBoards: -3 }));
  assert.equal(s.boardStartedAt, null);
  assert.equal(s.completedBoards, 0);
});

test('normalizeShop: an iOS stamp card (kind stamp) reads as a collect board', () => {
  const s = normalizeShop({ name: '허브', kind: 'stamp', totalCoupons: 10, usedCoupons: 7 });
  assert.equal(s.kind, 'count');
  assert.equal(s.mode, 'collect');
  assert.equal(s.usedCoupons, 7);
  assert.equal(isCollectMode(s), true);
});

test('backup from the iOS build restores its stamp card as a collect board', () => {
  const parsed = parseBackup(JSON.stringify({
    version: 3, app: 'coupon-book',
    shops: [{ id: 'ios-1', name: '허브', kind: 'stamp', totalCoupons: 10, usedCoupons: 7, createdAt: 1, updatedAt: 2 }],
    logs: []
  }));
  assert.equal(parsed.shops[0].mode, 'collect');
  assert.equal(remainingLabel(parsed.shops[0]), '3칸');
});

test('backup round trip keeps a collect board', () => {
  const parsed = parseBackup(JSON.stringify({
    shops: [{ ...board({ id: 'shop-c', boardStartedAt: 500, completedBoards: 1 }), createdAt: 1, updatedAt: 2 }],
    logs: []
  }));
  assert.equal(parsed.shops[0].mode, 'collect');
  assert.equal(parsed.shops[0].boardStartedAt, 500);
  assert.equal(parsed.shops[0].completedBoards, 1);
});

test('labels: collect reads as stamps and empty slots', () => {
  const b = board();
  assert.equal(usedLabel(b), '3개');
  assert.equal(totalLabel(b), '10칸');
  assert.equal(remainingLabel(b), '7칸');
  const count = board({ mode: null });
  assert.equal(usedLabel(count), '3회');
  assert.equal(totalLabel(count), '10회');
  assert.equal(remainingLabel(count), '7회');
});

test('couponStatus: a full board is 완성, a full pass is 소진', () => {
  const full = board({ usedCoupons: 10 });
  assert.equal(isCompleted(full), true);
  assert.equal(couponStatus(full).key, 'done');
  assert.equal(couponStatus(full).label, '완성');
  assert.equal(couponStatus(board({ mode: null, usedCoupons: 10 })).label, '소진');
});

test('couponStatus: one slot left on a board is not a low-balance warning', () => {
  const almost = board({ usedCoupons: 9 });
  assert.equal(remainingValue(almost), 1);
  assert.equal(couponStatus(almost).key, 'neutral');
  assert.equal(couponStatus(almost).label, '모으는 중');
  assert.equal(couponStatus(board({ mode: null, usedCoupons: 9 })).key, 'low');
});

test('couponStatus: expiry still applies to a collect board', () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const p = (n) => String(n).padStart(2, '0');
  const soon = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  assert.equal(couponStatus(board({ expiresAt: soon })).key, 'urgent');
});

test('isRewardReady: full, collect, not archived', () => {
  assert.equal(isRewardReady(board({ usedCoupons: 10 })), true);
  assert.equal(isRewardReady(board()), false);
  assert.equal(isRewardReady(board({ usedCoupons: 10, mode: null })), false);
  assert.equal(isRewardReady(board({ usedCoupons: 10, archivedAt: 1 })), false);
});

test('usableShops: a full board stays on home and comes first; a spent pass does not', () => {
  const shops = [
    { id: 'p', name: '마사지', totalCoupons: 10, usedCoupons: 2 },
    { id: 'spent', name: '다 쓴 회수권', totalCoupons: 5, usedCoupons: 5 },
    board({ id: 'full', name: '완성 카페', usedCoupons: 10 }),
    board({ id: 'part', name: '모으는 카페', usedCoupons: 4 }),
    board({ id: 'arch', name: '보관 카페', usedCoupons: 10, archivedAt: 1 })
  ];
  const ids = usableShops(shops).map((s) => s.id);
  assert.equal(ids[0], 'full');
  assert.ok(ids.includes('part'));
  assert.ok(ids.includes('p'));
  assert.ok(!ids.includes('spent'));
  assert.ok(!ids.includes('arch'));
});

test('boardLogs: only this shop, only since the current board started, newest first', () => {
  const logs = [
    { id: 'old', shopId: 'b', usedAt: 100, count: 1 },
    { id: 'other', shopId: 'x', usedAt: 300, count: 1 },
    { id: 'new1', shopId: 'b', usedAt: 250, count: 1 },
    { id: 'new2', shopId: 'b', usedAt: 400, count: 1 }
  ];
  assert.deepEqual(boardLogs(board({ boardStartedAt: 200 }), logs).map((l) => l.id), ['new2', 'new1']);
  // No board start recorded: every log of the shop counts (existing behaviour).
  assert.deepEqual(boardLogs(board(), logs).map((l) => l.id), ['new2', 'new1', 'old']);
  assert.deepEqual(boardLogs(board({ boardStartedAt: 500 }), logs), []);
});

test('demoShops: the sample cafe is a collect board part way through', () => {
  const cafe = demoShops().find((s) => s.name === '허브 커피 로스터스');
  const s = normalizeShop(cafe);
  assert.equal(isCollectMode(s), true);
  assert.equal(s.usedCoupons, 7);
  assert.equal(s.totalCoupons, 12);
  // The other samples are unchanged depletion/amount passes.
  assert.equal(demoShops().filter((x) => normalizeShop(x).mode === 'collect').length, 1);
});
