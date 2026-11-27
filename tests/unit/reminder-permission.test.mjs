// F3: reminders switched on by a restored backup on a shell that cannot notify.
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyReminderPermission, markRemindersConfirmed, flagRemindersForCheck } from '../../static/js/services/reminders.js';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const setGlobal = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const restoreGlobal = (name, descriptor) => { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; };

afterEach(() => {
  restoreGlobal('window', originalWindow);
  restoreGlobal('localStorage', originalLocalStorage);
});

function fakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

// canNotify: the shell's current state; answer: what the OS prompt returns.
function shell({ canNotify, answer }) {
  const win = { requests: 0 };
  win.AndroidBridge = {
    canNotify: () => canNotify,
    requestNotificationPermission: () => { win.requests += 1; queueMicrotask(() => win.__cbNotifyPermission?.(answer)); }
  };
  setGlobal('window', win);
  setGlobal('localStorage', fakeStorage());
  return win;
}

// Only data that came from a restore is checked.
function restoredShell(options) {
  const win = shell(options);
  flagRemindersForCheck();
  return win;
}

const on = { remindersEnabled: true };

test('P1 restored reminders on a shell that cannot notify ask once and report denied', async () => {
  const win = restoredShell({ canNotify: false, answer: false });
  assert.equal(await verifyReminderPermission(on), 'denied');
  assert.equal(win.requests, 1);
  // The check is done; a later launch does not ask again.
  assert.equal(await verifyReminderPermission(on), 'skip');
  assert.equal(win.requests, 1);
});

test('P2 a granted prompt keeps reminders on', async () => {
  const win = restoredShell({ canNotify: false, answer: true });
  assert.equal(await verifyReminderPermission(on), 'granted');
  assert.equal(win.requests, 1);
  assert.equal(await verifyReminderPermission(on), 'skip');
});

test('P3 a shell that can already notify is not prompted', async () => {
  const win = restoredShell({ canNotify: true, answer: false });
  assert.equal(await verifyReminderPermission(on), 'granted');
  assert.equal(win.requests, 0);
});

test('P4 an install whose reminders did not come from a restore is never asked (in-app-only mode stays)', async () => {
  const win = shell({ canNotify: false, answer: false });
  assert.equal(await verifyReminderPermission(on), 'skip');
  assert.equal(win.requests, 0);
});

test('P4b switching reminders on in this install settles a pending restore check', async () => {
  const win = restoredShell({ canNotify: false, answer: false });
  markRemindersConfirmed();
  assert.equal(await verifyReminderPermission(on), 'skip');
  assert.equal(win.requests, 0);
});

test('P5 nothing is asked when reminders are off or there is no app shell', async () => {
  const win = restoredShell({ canNotify: false, answer: false });
  assert.equal(await verifyReminderPermission({ remindersEnabled: false }), 'skip');
  assert.equal(win.requests, 0);
  setGlobal('window', {});
  flagRemindersForCheck();
  assert.equal(await verifyReminderPermission(on), 'skip');
});
