import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
function restore(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

let visibilityHandler;
function fakeDocument() {
  return {
    visibilityState: 'visible',
    addEventListener: (type, fn) => { if (type === 'visibilitychange') visibilityHandler = fn; },
    removeEventListener: (type) => { if (type === 'visibilitychange') visibilityHandler = null; }
  };
}

const presentation = await import('../../static/js/services/presentation.js');

afterEach(async () => {
  await presentation.stopPresenting();
  visibilityHandler = null;
  restore('navigator', originalNavigator);
  restore('window', originalWindow);
  restore('document', originalDocument);
});

test('Android bridge controls presentation without using Wake Lock', async () => {
  const calls = [];
  setGlobal('window', { AndroidBridge: { setPresentationMode: (value) => calls.push(value) } });
  setGlobal('navigator', { wakeLock: { request: () => { throw new Error('should not run'); } } });
  setGlobal('document', fakeDocument());
  await presentation.startPresenting();
  assert.equal(presentation.controlsBrightness(), true);
  await presentation.stopPresenting();
  assert.deepEqual(calls, [true, false]);
});

test('reset clears native presentation mode before a new presentation starts', async () => {
  const calls = [];
  setGlobal('window', { AndroidBridge: { setPresentationMode: (value) => calls.push(value) } });
  setGlobal('document', fakeDocument());
  setGlobal('navigator', {});
  await presentation.resetPresentation();
  await presentation.startPresenting();
  assert.deepEqual(calls, [false, true]);
});

test('Wake Lock is acquired once, reacquired on visibility, and released on stop', async () => {
  const requests = [];
  const releases = [];
  setGlobal('window', {});
  setGlobal('document', fakeDocument());
  setGlobal('navigator', { wakeLock: { request: async (type) => {
    requests.push(type);
    return { release: async () => releases.push(requests.length) };
  } } });
  await presentation.startPresenting();
  await presentation.startPresenting();
  assert.deepEqual(requests, ['screen']);
  await visibilityHandler();
  assert.deepEqual(requests, ['screen', 'screen']);
  await presentation.stopPresenting();
  assert.deepEqual(releases, [2]);
  assert.equal(presentation.controlsBrightness(), false);
});

test('missing APIs and stop without start are harmless', async () => {
  setGlobal('window', {});
  setGlobal('document', fakeDocument());
  setGlobal('navigator', {});
  await presentation.stopPresenting();
  await presentation.startPresenting();
  await presentation.stopPresenting();
});
