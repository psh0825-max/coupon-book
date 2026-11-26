import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { t } from '../../static/js/core/i18n.js';
import { messages } from '../../static/js/core/messages.js';
import { demoShops } from '../../static/js/data/repo.js';
import { usedLabel, remainingLabel } from '../../static/js/domain.js';

const saved = Object.fromEntries(['document', 'navigator', 'localStorage'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
afterEach(() => {
  for (const [name, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

// The app follows navigator.languages when no language is saved.
function speak(language) {
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', {});
  define('navigator', { languages: [language], language });
  define('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
}

test('I1 English counts use singular and plural forms', () => {
  speak('en-US');
  assert.equal(t('{0}회', 1), '1 use');
  assert.equal(t('{0}회', 3), '3 uses');
  assert.equal(t('완성한 판 {0}개', 1), '1 card completed');
  assert.equal(t('완성한 판 {0}개', 2), '2 cards completed');
  assert.equal(t('만료 D-{0}', 1), 'Expires in 1 day');
  assert.equal(usedLabel({ kind: 'count', mode: 'collect', totalCoupons: 10, usedCoupons: 1 }), '1 stamp');
  assert.equal(remainingLabel({ kind: 'count', totalCoupons: 10, usedCoupons: 8 }), '2 uses');
});

test('I2 a context suffix keeps Korean unchanged and gives other languages their own word', () => {
  speak('ko-KR');
  assert.equal(t('사용@@used'), '사용');
  speak('en-US');
  assert.equal(t('사용@@used'), 'Used');
  assert.equal(t('사용'), 'Use');
});

test('I3 archive labels and the stamp progress read naturally', () => {
  speak('en-US');
  assert.equal(t('보관하기'), 'Archive');
  assert.equal(t('꺼내기'), 'Unarchive');
  speak('ja-JP');
  assert.equal(t('{0}% 모음', 70), '70% 達成');
});

test('I4 every translation keeps the placeholders of its Korean key', () => {
  const placeholders = (text) => [...new Set((text.match(/\{\d+(?=[}|])/g) || []).map((p) => p.slice(1)))].sort().join();
  for (const [key, [en, ja]] of Object.entries(messages)) {
    assert.equal(placeholders(en), placeholders(key), `en: ${key}`);
    assert.equal(placeholders(ja), placeholders(key), `ja: ${key}`);
    assert.doesNotMatch(en + ja, /[가-힣]/, `Hangul left in translation of ${key}`);
  }
});

test('I5 sample passes are created in the app language; Korean stays as before', () => {
  speak('en-US');
  assert.deepEqual(demoShops().map((s) => s.name), ['Star Massage Anyang', 'Herb Coffee Roasters', 'Taeyang Korean Spa']);
  assert.match(demoShops()[0].address, /Anyang-si/);
  assert.equal(demoShops()[1].category, '카페');
  speak('ja-JP');
  assert.equal(demoShops()[0].name, 'スターマッサージ 安養店');
  speak('ko-KR');
  assert.equal(demoShops()[0].name, '안양 스타 마사지');
});

test('I6 a missing or non-text key comes back unchanged instead of throwing', () => {
  for (const language of ['ko-KR', 'en-US']) {
    speak(language);
    assert.equal(t(undefined), undefined);
    assert.equal(t(null), null);
    assert.equal(t(5), 5);
  }
});
