import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from '../../static/js/services/backup.js';

const validShop = (extra = {}) => ({
  id: 'shop-a', name: '테스트 가게', kind: 'amount', totalCoupons: 5, usedCoupons: 2,
  totalAmount: 50000, usedAmount: 20000, createdAt: 100, updatedAt: 200,
  image: 'data:image/webp;base64,AAAA', ...extra
});
const validLog = (extra = {}) => ({ id: 'log-a', shopId: 'shop-a', usedAt: 300, amount: 10000, ...extra });
const parse = (value) => parseBackup(JSON.stringify(value));

test('v3 백업을 식별자, 날짜, 금액 및 기프티콘 데이터와 함께 읽는다', () => {
  const result = parse({ version: 3, shops: [validShop()], logs: [validLog()], settings: [{ key: 'onboarded', value: true }], exportedAt: 400 });
  assert.equal(result.shops[0].id, 'shop-a');
  assert.equal(result.shops[0].createdAt, 100);
  assert.equal(result.shops[0].updatedAt, 200);
  assert.equal(result.shops[0].kind, 'amount');
  assert.equal(result.shops[0].totalAmount, 50000);
  assert.equal(result.shops[0].usedAmount, 20000);
  assert.equal(result.shops[0].image, 'data:image/webp;base64,AAAA');
  assert.equal(result.logs[0].id, 'log-a');
  assert.equal(result.logs[0].shopId, 'shop-a');
  assert.equal(result.logs[0].usedAt, 300);
  assert.equal(result.logs[0].amount, 10000);
  assert.deepEqual(result.settings, [{ key: 'onboarded', value: true }]);
  assert.equal(result.exportedAt, 400);
});

test('잘못된 JSON과 백업 형식 오류를 알린다', () => {
  assert.throws(() => parseBackup('{'), /JSON/);
  assert.throws(() => parseBackup('[]'), { message: '쿠폰북 백업 파일이 아니에요.' });
  assert.throws(() => parse({ shops: [] }), { message: '쿠폰북 백업 파일이 아니에요.' });
});

test('크기가 큰 백업을 거부한다', () => {
  assert.throws(() => parse({ shops: Array.from({ length: 5001 }, () => validShop()), logs: [] }), { message: '백업 파일이 너무 커요.' });
});

test('객체가 아닌 항목과 고아 로그를 건너뛰고 센다', () => {
  const result = parse({
    shops: [validShop(), null, 3, 'x'],
    logs: [validLog(), null, 3, 'x', validLog({ id: 'orphan', shopId: 'missing' })]
  });
  assert.equal(result.shops.length, 1);
  assert.equal(result.logs.length, 1);
  assert.deepEqual(result.skipped, { shops: 3, logs: 4 });
});

test('유효한 설정만 유지하고 중복 가게는 마지막 항목을 사용한다', () => {
  const result = parse({
    shops: [validShop({ name: '처음' }), validShop({ name: '마지막' })], logs: [],
    settings: [
      { key: 'onboarded', value: true }, { key: 'notifyRadius', value: '100' },
      { key: 'unknown', value: true }, null
    ]
  });
  assert.equal(result.shops.length, 1);
  assert.equal(result.shops[0].name, '마지막');
  assert.deepEqual(result.settings, [{ key: 'onboarded', value: true }]);
});

test('설정과 exportedAt이 없는 이전 백업도 허용한다', () => {
  const result = parse({ shops: [validShop()], logs: [validLog()] });
  assert.deepEqual(result.settings, []);
  assert.equal(result.exportedAt, null);
});
