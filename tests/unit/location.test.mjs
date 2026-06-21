import test from 'node:test';
import assert from 'node:assert/strict';
import { haversine } from '../../static/js/services/location.js';

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
