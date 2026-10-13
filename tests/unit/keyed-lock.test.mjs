import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyedLock } from '../../static/js/core/keyed-lock.js';

test('same-key concurrent runs call fn once and ignore the duplicate', async () => {
  const lock = createKeyedLock();
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const first = lock.run('pass-1', async () => { calls += 1; await pending; return 'used'; });
  const second = lock.run('pass-1', () => { calls += 1; });
  assert.equal(await second, undefined);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, 'used');
});

test('different keys run concurrently', async () => {
  const lock = createKeyedLock();
  let calls = 0;
  const [a, b] = await Promise.all([
    lock.run('a', async () => { calls += 1; return 'a'; }),
    lock.run('b', async () => { calls += 1; return 'b'; })
  ]);
  assert.equal(calls, 2);
  assert.deepEqual([a, b], ['a', 'b']);
});

test('a key can run again after its first run settles', async () => {
  const lock = createKeyedLock();
  assert.equal(await lock.run('pass-1', () => 1), 1);
  assert.equal(await lock.run('pass-1', () => 2), 2);
});

test('a thrown error rejects and releases its key', async () => {
  const lock = createKeyedLock();
  const error = new Error('write failed');
  await assert.rejects(lock.run('pass-1', () => { throw error; }), error);
  assert.equal(await lock.run('pass-1', () => 'recovered'), 'recovered');
});

test('isBusy is true during a run and false afterwards', async () => {
  const lock = createKeyedLock();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const running = lock.run('pass-1', () => pending);
  assert.equal(lock.isBusy('pass-1'), true);
  release();
  await running;
  assert.equal(lock.isBusy('pass-1'), false);
});

test('run resolves with fn return value', async () => {
  const lock = createKeyedLock();
  assert.deepEqual(await lock.run('pass-1', async () => ({ used: 1 })), { used: 1 });
});
