import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  _checkLocation,
  _visited,
  getCurrentPosition,
  getPositionIfGranted,
  haversine,
  setNotifySettings,
  startLocationWatch,
  stopLocationWatch
} from '../../static/js/services/location.js';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

function setGlobals(navigator, localStorage) {
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true, writable: true });
}

function restoreGlobal(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

afterEach(() => {
  stopLocationWatch();
  setNotifySettings({ radius: 100, delay: 5, enabled: true });
  restoreGlobal('navigator', originalNavigator);
  restoreGlobal('localStorage', originalLocalStorage);
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function geolocationFake() {
  const pending = [];
  const watches = new Map();
  let nextWatchId = 1;
  return {
    geolocation: {
      getCurrentPosition: (ok, fail) => pending.push({ ok, fail }),
      watchPosition: (ok, fail, options) => {
        const id = nextWatchId++;
        watches.set(id, { ok, fail, options });
        return id;
      },
      clearWatch: (id) => watches.delete(id)
    },
    resolveNext(lat = 37.5, lng = 127.1, accuracy = 5) {
      const request = pending.shift();
      assert.ok(request, 'expected a pending position request');
      request.ok({ coords: { latitude: lat, longitude: lng, accuracy } });
    },
    get positionCalls() { return pending.length; },
    get activeWatches() { return watches.size; }
  };
}

function fakeTimers() {
  const active = new Map();
  let nextId = 1;
  globalThis.setInterval = (callback, delay) => {
    const id = nextId++;
    active.set(id, { callback, delay });
    return id;
  };
  globalThis.clearInterval = (id) => active.delete(id);
  return { get activeIntervals() { return active.size; } };
}

const activeShop = { id: 'active', lat: 37.5, lng: 127.1, totalCoupons: 10, usedCoupons: 0 };

test('getPositionIfGranted: does not call geolocation without permission', async () => {
  let called = false;
  setGlobals({ geolocation: { getCurrentPosition: () => { called = true; } } }, storage());
  await assert.rejects(getPositionIfGranted(), /location-not-granted/);
  assert.equal(called, false);
});

test('getPositionIfGranted: uses a remembered grant', async () => {
  setGlobals({ geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 37.5, longitude: 127.1, accuracy: 5 } }) } }, storage({ 'cb:geo-granted': '1' }));
  assert.deepEqual(await getPositionIfGranted(), { lat: 37.5, lng: 127.1, accuracy: 5 });
});

test('getPositionIfGranted: uses granted Permissions API state', async () => {
  setGlobals({
    permissions: { query: async () => ({ state: 'granted' }) },
    geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 37.5, longitude: 127.1, accuracy: 5 } }) }
  }, storage());
  assert.equal((await getPositionIfGranted()).lat, 37.5);
});

test('getCurrentPosition: successful lookup remembers permission', async () => {
  const localStorage = storage();
  setGlobals({ geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 1, longitude: 2, accuracy: 3 } }) } }, localStorage);
  await getCurrentPosition();
  assert.equal(localStorage.getItem('cb:geo-granted'), '1');
});

test('getCurrentPosition: permission denial clears remembered permission', async () => {
  const localStorage = storage({ 'cb:geo-granted': '1' });
  setGlobals({ geolocation: { getCurrentPosition: (ok, fail) => fail({ code: 1 }) } }, localStorage);
  await assert.rejects(getCurrentPosition());
  assert.equal(localStorage.getItem('cb:geo-granted'), null);
});

test('getCurrentPosition: throwing localStorage does not break lookup', async () => {
  const throwingStorage = { setItem: () => { throw new Error('blocked'); } };
  setGlobals({ geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 1, longitude: 2, accuracy: 3 } }) } }, throwingStorage);
  assert.equal((await getCurrentPosition()).lng, 2);
});

test('L1: stopping while the immediate check is pending does not revive the watch', async () => {
  const geo = geolocationFake();
  const timers = fakeTimers();
  let notifications = 0;
  setGlobals({ geolocation: geo.geolocation }, storage());

  const starting = startLocationWatch([activeShop], () => { notifications += 1; });
  stopLocationWatch();
  geo.resolveNext();
  await starting;

  assert.equal(timers.activeIntervals, 0);
  assert.equal(geo.activeWatches, 0);
  assert.equal(notifications, 0);
});

test('L2: overlapping starts leave exactly one interval and watch', async () => {
  const geo = geolocationFake();
  const timers = fakeTimers();
  setGlobals({ geolocation: geo.geolocation }, storage());

  const first = startLocationWatch([activeShop], () => {});
  const second = startLocationWatch([activeShop], () => {});
  geo.resolveNext();
  geo.resolveNext();
  await Promise.all([first, second]);

  assert.equal(timers.activeIntervals, 1);
  assert.equal(geo.activeWatches, 1);
});

test('L3: disabled settings prevent _checkLocation from asking geolocation', async () => {
  let calls = 0;
  setGlobals({ geolocation: { getCurrentPosition: () => { calls += 1; } } }, storage());
  setNotifySettings({ enabled: false });

  await _checkLocation([activeShop]);
  assert.equal(calls, 0);
});

test('L4: dwell state survives a watch restart', async () => {
  const geo = geolocationFake();
  fakeTimers();
  const notifications = [];
  setGlobals({ geolocation: geo.geolocation }, storage());
  setNotifySettings({ radius: 100, delay: 0, enabled: true });

  const firstStart = startLocationWatch([activeShop], (items) => notifications.push(items));
  geo.resolveNext();
  await firstStart;

  const secondCheck = _checkLocation([activeShop]);
  geo.resolveNext();
  await secondCheck;
  assert.equal(notifications.length, 1);

  const restart = startLocationWatch([activeShop], (items) => notifications.push(items));
  geo.resolveNext();
  await restart;
  assert.equal(notifications.length, 1);
});

test('L5: only active passes can trigger location notifications', async () => {
  const geo = geolocationFake();
  fakeTimers();
  const notifications = [];
  const usedUp = { id: 'used', lat: 37.5, lng: 127.1, totalCoupons: 1, usedCoupons: 1 };
  const expired = { id: 'expired', lat: 37.5, lng: 127.1, totalCoupons: 1, usedCoupons: 0, expiresAt: '2000-01-01' };
  setGlobals({ geolocation: geo.geolocation }, storage());
  setNotifySettings({ radius: 100, delay: 0, enabled: true });

  const start = startLocationWatch([usedUp, expired, activeShop], (items) => notifications.push(items));
  geo.resolveNext();
  await start;
  // This mirrors the interval/watch callbacks: startLocationWatch has already
  // reduced its monitored list to usable passes.
  const confirm = _checkLocation([activeShop]);
  geo.resolveNext();
  await confirm;

  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0].map(({ shop }) => shop.id), ['active']);
  assert.deepEqual([..._visited.keys()], ['active']);
});

// Seoul City Hall -> Gangnam Station: real-world straight-line distance ~8.5 km.
test('haversine: Seoul City Hall to Gangnam is roughly 8-9 km', () => {
  const meters = haversine(37.5663, 126.9779, 37.4979, 127.0276);
  const km = meters / 1000;
  assert.ok(km > 8 && km < 9, `expected 8-9 km, got ${km.toFixed(3)} km`);
});

test('haversine: distance to self is 0', () => {
  const meters = haversine(37.5663, 126.9779, 37.5663, 126.9779);
  assert.equal(meters, 0);
});

test('haversine: symmetric (a->b equals b->a)', () => {
  const ab = haversine(37.5663, 126.9779, 37.4979, 127.0276);
  const ba = haversine(37.4979, 127.0276, 37.5663, 126.9779);
  assert.ok(Math.abs(ab - ba) < 1e-6);
});
