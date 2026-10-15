import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { ensurePermission, checkDueNow, syncReminders, nativeReminderPlan, reminderId, pruneReminderMarkers } from '../../static/js/services/reminders.js';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

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
  restoreGlobal('localStorage', originalLocalStorage);
});

function fakeStorage() {
  const values = new Map();
  return { values, getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)) };
}

function bridge() {
  const calls = { scheduled: [], cancelled: [], shown: [] };
  return { calls, api: {
    scheduleReminder: (...args) => calls.scheduled.push(args),
    cancelReminder: (id) => calls.cancelled.push(id),
    showNotification: (...args) => calls.shown.push(args)
  } };
}

const far = (id, extra = {}) => ({ id, name: `가게 ${id}`, expiresAt: '2099-01-10', totalCoupons: 10, usedCoupons: 0, ...extra });
const enabled = (days = [7, 3, 1]) => ({ remindersEnabled: true, reminderDays: days, reminderMarkers: {} });
function localDate(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('N1 schedules one native alarm per active pass and future threshold', () => {
  const storage = fakeStorage(); const b = bridge();
  setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a'), far('done', { usedCoupons: 10 })], enabled());
  assert.equal(b.calls.scheduled.length, 3);
  assert.deepEqual(JSON.parse(storage.getItem('cb_native_reminder_ids')).sort((a, z) => a - z), [1, 3, 7].map((d) => reminderId('a', d)).sort((a, z) => a - z));
});

test('N2 removed pass alarms are cancelled without touching retained alarms', () => {
  const storage = fakeStorage(); const b = bridge(); setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a'), far('b')], enabled()); b.calls.cancelled.length = 0;
  syncReminders([far('b')], enabled());
  assert.deepEqual(b.calls.cancelled.sort((a, z) => a - z), [1, 3, 7].map((d) => reminderId('a', d)).sort((a, z) => a - z));
});

test('N3 turning reminders off cancels stored alarms and stores an empty list', () => {
  const storage = fakeStorage(); const b = bridge(); setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a')], enabled()); b.calls.cancelled.length = 0; b.calls.scheduled.length = 0;
  syncReminders([far('a')], { ...enabled(), remindersEnabled: false });
  assert.equal(b.calls.scheduled.length, 0); assert.equal(b.calls.cancelled.length, 3); assert.equal(storage.getItem('cb_native_reminder_ids'), '[]');
});

test('N4 removing D-7 cancels only its alarm', () => {
  const storage = fakeStorage(); const b = bridge(); setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a')], enabled()); b.calls.cancelled.length = 0;
  syncReminders([far('a')], enabled([3, 1]));
  assert.deepEqual(b.calls.cancelled, [reminderId('a', 7)]);
});

test('N5 completed passes have their alarms cancelled', () => {
  const storage = fakeStorage(); const b = bridge(); setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a')], enabled()); b.calls.cancelled.length = 0;
  syncReminders([far('a', { usedCoupons: 10 })], enabled());
  assert.equal(b.calls.cancelled.length, 3);
});

test('N5a archived passes have their alarms cancelled', () => {
  const storage = fakeStorage(); const b = bridge(); setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a')], enabled()); b.calls.cancelled.length = 0;
  syncReminders([far('a', { archivedAt: Date.now() })], enabled());
  assert.equal(b.calls.cancelled.length, 3);
});

test('N5b nativeReminderPlan skips archived passes', () => {
  assert.deepEqual(nativeReminderPlan([far('a', { archivedAt: Date.now() })], enabled()), {});
});

test('N6 first reconciliation sweeps all known digit ids except desired alarms', () => {
  const storage = fakeStorage(); const b = bridge(); setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  syncReminders([far('a')], enabled());
  const desired = new Set([1, 3, 7].map((d) => reminderId('a', d)));
  assert.deepEqual(new Set(b.calls.cancelled), new Set(Array.from({ length: 10 }, (_, d) => reminderId('a', d)).filter((id) => !desired.has(id))));
});

test('N7 app shell still calls onDue once but never duplicates the OS notification', () => {
  const storage = fakeStorage(); const b = bridge(); const due = far('a', { expiresAt: localDate(1) }); let calls = 0;
  setGlobal('localStorage', storage); setGlobal('window', { AndroidBridge: b.api });
  checkDueNow([due], enabled(), () => { calls++; }); checkDueNow([due], enabled(), () => { calls++; });
  assert.equal(calls, 1); assert.equal(b.calls.shown.length, 0);
});

test('N8 settings markers from the service worker suppress the same expiry window', () => {
  const storage = fakeStorage(); const due = far('a', { expiresAt: localDate(1) }); let calls = 0;
  setGlobal('localStorage', storage); setGlobal('window', {});
  checkDueNow([due], { ...enabled(), reminderMarkers: { [`cb_reminder:a:${due.expiresAt}:t1`]: Date.now() } }, () => { calls++; });
  assert.equal(calls, 0);
});

test('N9 persists merged markers and prunes old expiry and no-date markers', () => {
  const storage = fakeStorage(); const due = far('a', { expiresAt: localDate(1) }); let saved;
  setGlobal('localStorage', storage); setGlobal('window', {});
  syncReminders([due], { ...enabled(), reminderMarkers: { 'cb_reminder:old:2000-01-01:t1': 1, 'cb_reminder:none:none:t1': 1, 'cb_reminder:future:2099-01-01:t1': 1 } }, () => {}, { persistMarkers: (m) => { saved = m; } });
  assert.ok(saved[`cb_reminder:a:${due.expiresAt}:t1`]); assert.ok(saved['cb_reminder:future:2099-01-01:t1']); assert.equal(saved['cb_reminder:old:2000-01-01:t1'], undefined); assert.equal(saved['cb_reminder:none:none:t1'], undefined);
  assert.deepEqual(pruneReminderMarkers(null, Date.now()), {});
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
