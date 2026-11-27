import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../../static/js/core/router.js';
import { takeOwnPop } from '../../static/js/core/history-queue.js';

const savedHistory = Object.getOwnPropertyDescriptor(globalThis, 'history');
afterEach(() => {
  if (savedHistory) Object.defineProperty(globalThis, 'history', savedHistory);
  else delete globalThis.history;
});

// Session history with asynchronous go(), like the browser's. Pops are fed to
// the router the way app.js's popstate handler does.
function installHistory(onPop) {
  const h = { entries: [{}], index: 0 };
  const api = {
    get state() { return h.entries[h.index]; },
    pushState(state) { h.entries.splice(h.index + 1); h.entries.push(structuredClone(state)); h.index += 1; },
    replaceState(state) { h.entries[h.index] = structuredClone(state); },
    go(n) {
      setTimeout(() => {
        h.index = Math.max(0, Math.min(h.entries.length - 1, h.index + n));
        onPop(api.state);
      }, 0);
    },
    back() { api.go(-1); }
  };
  Object.defineProperty(globalThis, 'history', { value: api, configurable: true, writable: true });
  return h;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test('R1 a view that redirects while it is built leaves no entry for itself', async () => {
  let router;
  const h = installHistory((state) => { if (!takeOwnPop()) router.restore(state); });
  router = createRouter({
    outlet: null,
    getCtx: () => ({}),
    routes: {
      home: () => ({}),
      detail: (ctx, params) => { if (params.id === 'gone') router.navigate('home'); return {}; }
    }
  });
  router.navigate('home');
  router.navigate('detail', { id: 'gone' });
  await settle();
  assert.equal(router.current().name, 'home');
  assert.equal(h.entries.length, 1);
  assert.equal(h.entries[h.index].name, 'home');
  assert.equal(h.entries[h.index].depth, 0);
});

test('R2 a normal sub page still gets its own entry', async () => {
  let router;
  const h = installHistory((state) => { if (!takeOwnPop()) router.restore(state); });
  router = createRouter({ outlet: null, getCtx: () => ({}), routes: { home: () => ({}), detail: () => ({}) } });
  router.navigate('home');
  router.navigate('detail', { id: 'a' });
  await settle();
  assert.deepEqual(h.entries.map((e) => [e.name, e.depth]), [['home', 0], ['detail', 1]]);
});
