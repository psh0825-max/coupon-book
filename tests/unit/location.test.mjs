import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentPosition, getPositionIfGranted, haversine } from '../../static/js/services/location.js';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function setGlobals(navigator, localStorage) {
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true, writable: true });
}

function restoreGlobal(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

afterEach(() => {
  restoreGlobal('navigator', originalNavigator);
  restoreGlobal('localStorage', originalLocalStorage);
});

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

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
