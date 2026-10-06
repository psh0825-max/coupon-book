import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { ensurePermission } from '../../static/js/services/reminders.js';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification');

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function restoreGlobal(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

afterEach(() => {
  mock.timers.reset();
  restoreGlobal('window', originalWindow);
  restoreGlobal('Notification', originalNotification);
});

test('ensurePermission: new shell resolves granted after native callback', async () => {
  let requests = 0;
  const window = { AndroidBridge: { requestNotificationPermission: () => { requests++; } } };
  setGlobal('window', window);

  const permission = ensurePermission();
  assert.equal(requests, 1);
  window.__cbNotifyPermission(true);
  assert.equal(await permission, 'granted');
  assert.notEqual(typeof window.__cbNotifyPermission, 'function');
});

test('ensurePermission: new shell resolves denied after native callback', async () => {
  const window = { AndroidBridge: { requestNotificationPermission: () => {} } };
  setGlobal('window', window);

  const permission = ensurePermission();
  window.__cbNotifyPermission(false);
  assert.equal(await permission, 'denied');
});

test('ensurePermission: new shell uses canNotify when native callback times out', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const window = {
    AndroidBridge: {
      requestNotificationPermission: () => {},
      canNotify: () => true
    }
  };
  setGlobal('window', window);

  const permission = ensurePermission();
  mock.timers.tick(60000);
  assert.equal(await permission, 'granted');
  assert.notEqual(typeof window.__cbNotifyPermission, 'function');
});

test('ensurePermission: new shell falls back to canNotify when request throws', async () => {
  const window = {
    AndroidBridge: {
      requestNotificationPermission: () => { throw new Error('bridge unavailable'); },
      canNotify: () => true
    }
  };
  setGlobal('window', window);

  assert.equal(await ensurePermission(), 'granted');
});

test('ensurePermission: old shell returns canNotify state without requesting', async () => {
  let requested = false;
  setGlobal('window', { AndroidBridge: { canNotify: () => true } });
  assert.equal(await ensurePermission(), 'granted');
  assert.equal(requested, false);

  setGlobal('window', { AndroidBridge: { canNotify: () => false } });
  assert.equal(await ensurePermission(), 'denied');
});

test('ensurePermission: browser delegates to Notification.requestPermission', async () => {
  let requests = 0;
  setGlobal('window', { Notification: true });
  setGlobal('Notification', {
    requestPermission: async () => {
      requests++;
      return 'default';
    }
  });

  assert.equal(await ensurePermission(), 'default');
  assert.equal(requests, 1);
});
