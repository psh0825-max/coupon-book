import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

class RequestShim {
  constructor(url, init) {
    this.url = url;
    this.cache = init?.cache ?? 'default';
  }
}

async function loadServiceWorker({ rejectAddAll = false } = {}) {
  const source = await readFile(new URL('../../static/sw.js', import.meta.url), 'utf8');
  const listeners = new Map();
  const record = {};
  const sandbox = {
    self: {
      addEventListener(type, listener) { listeners.set(type, listener); },
      location: { origin: 'https://example.test' },
      registration: {}
    },
    Request: RequestShim,
    caches: {
      open: async (name) => ({
        addAll: async (reqs) => {
          record.name = name;
          record.reqs = reqs;
          if (rejectAddAll) throw new Error('precache failed');
        }
      })
    },
    console,
    Date
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox, listeners, record };
}

async function fireInstall(worker) {
  let promise;
  worker.listeners.get('install')({ waitUntil(p) { promise = p; } });
  return promise;
}

test('service worker install precaches every URL with cache reload', async () => {
  const worker = await loadServiceWorker();
  const expectedUrls = vm.runInContext('URLS_TO_CACHE', worker.sandbox);
  const cacheName = vm.runInContext('CACHE_NAME', worker.sandbox);

  await fireInstall(worker);

  assert.equal(worker.record.name, cacheName);
  assert.match(cacheName, /^coupon-book-v\d+$/);
  assert.deepEqual(worker.record.reqs.map((req) => req.url), expectedUrls);
  assert.equal(new Set(worker.record.reqs.map((req) => req.url)).size, expectedUrls.length);
  assert.ok(worker.record.reqs.every((req) => req.cache === 'reload'));
});

test('service worker install fails when precaching fails', async () => {
  const worker = await loadServiceWorker({ rejectAddAll: true });

  await assert.rejects(fireInstall(worker), /precache failed/);
});
