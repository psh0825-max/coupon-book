// services/location.js — geolocation + dwell-based geofence.

import { isArchived, isCompleted, isExpired } from '../domain.js';

export const EARTH_RADIUS = 6371000; // meters

export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return EARTH_RADIUS * c;
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        try { localStorage.setItem('cb:geo-granted', '1'); } catch { /* storage optional */ }
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      err => {
        if (err?.code === 1) {
          try { localStorage.removeItem('cb:geo-granted'); } catch { /* storage optional */ }
        }
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

export async function getPositionIfGranted() {
  let granted = false;
  try { granted = localStorage.getItem('cb:geo-granted') === '1'; } catch { /* storage optional */ }
  if (!granted) {
    try {
      const permission = await navigator.permissions?.query({ name: 'geolocation' });
      granted = permission?.state === 'granted';
    } catch { /* permission query optional */ }
  }
  if (!granted) throw new Error('location-not-granted');
  return getCurrentPosition();
}

/* ===== Location Watch System ===== */
export let _watchId = null;
export let _checkInterval = null;
export let _visited = new Map(); // shopId -> {enteredAt, lastSeen, confirmed}
export let _callbacks = null;
export let _settings = { radius: 100, delay: 300, enabled: true };
let _warnedLocation = false;
let _generation = 0;

function teardown() {
  if (_checkInterval) { clearInterval(_checkInterval); _checkInterval = null; }
  if (_watchId !== null) { navigator.geolocation?.clearWatch(_watchId); _watchId = null; }
  _generation += 1;
}

export async function startLocationWatch(shops, onNotify) {
  teardown();
  if (!_settings.enabled) return;

  const generation = _generation;
  _callbacks = { onNotify };
  const usableShops = (shops || []).filter((shop) =>
    shop.lat !== '' && shop.lat != null && Number.isFinite(Number(shop.lat))
    && shop.lng !== '' && shop.lng != null && Number.isFinite(Number(shop.lng))
    && !isArchived(shop) && !isCompleted(shop) && !isExpired(shop)
  );
  const usableIds = new Set(usableShops.map((shop) => shop.id));
  for (const shopId of _visited.keys()) {
    if (!usableIds.has(shopId)) _visited.delete(shopId);
  }

  // immediate check
  await _checkLocation(usableShops, generation);
  if (generation !== _generation || !_settings.enabled) return;

  // periodic check every 30s
  _checkInterval = setInterval(() => {
    if (generation !== _generation) return;
    _checkLocation(usableShops, generation);
  }, 30000);

  // also use watchPosition for more responsive updates
  if (navigator.geolocation) {
    _watchId = navigator.geolocation.watchPosition(
      () => {
        if (generation !== _generation) return;
        _checkLocation(usableShops, generation);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
  }
}

export function stopLocationWatch() {
  teardown();
  _visited.clear();
  _callbacks = null;
}

export function setNotifySettings({ radius, delay, enabled }) {
  const d = (delay == null || delay === '') ? 5 : Number(delay);
  _settings = { radius: radius || 100, delay: Math.max(0, d) * 60, enabled: enabled !== false };
}

export async function _checkLocation(shops, generation) {
  if (!_settings.enabled || (generation !== undefined && generation !== _generation)) return;
  try {
    const pos = await getCurrentPosition();
    if (!_settings.enabled || (generation !== undefined && generation !== _generation)) return;
    _warnedLocation = false; // genuine success — let a later real failure warn again
    const now = Date.now();
    const notifyList = [];

    for (const shop of shops) {
      if (!shop.lat || !shop.lng) continue;
      const dist = haversine(pos.lat, pos.lng, shop.lat, shop.lng);
      const inside = dist <= _settings.radius;
      const visited = _visited.get(shop.id);

      if (inside) {
        if (!visited) {
          _visited.set(shop.id, { enteredAt: now, lastSeen: now, confirmed: false });
        } else {
          visited.lastSeen = now;
          const elapsed = (now - visited.enteredAt) / 1000;
          if (!visited.confirmed && elapsed >= _settings.delay) {
            visited.confirmed = true;
            notifyList.push({ shop, distance: dist });
          }
        }
      } else {
        // left the area
        if (visited && (now - visited.lastSeen) > 120000) {
          _visited.delete(shop.id);
        }
      }
    }

    if (notifyList.length > 0 && _callbacks?.onNotify) {
      _callbacks.onNotify(notifyList);
    }
  } catch (e) {
    if (!_warnedLocation) {
      _warnedLocation = true;
      console.warn('위치 확인을 일시적으로 사용할 수 없어요:', e?.message || e);
    }
  }
}
