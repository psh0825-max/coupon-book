export const DB_NAME = 'CouponBookDB';
export const DB_VERSION = 1;

export let _db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('shops')) {
        const shopStore = db.createObjectStore('shops', { keyPath: 'id' });
        shopStore.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('shopId', 'shopId', { unique: false });
        logStore.createIndex('usedAt', 'usedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

export async function getDB() {
  if (_db) return _db;
  _db = await openDB();
  return _db;
}

export function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* === Shops === */
export async function getAllShops() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shops', 'readonly');
    const store = tx.objectStore('shops');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getShop(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shops', 'readonly');
    const store = tx.objectStore('shops');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addShop(shop) {
  const db = await getDB();
  const now = Date.now();
  const record = { id: generateId(), usedCoupons: 0, ...shop, createdAt: now, updatedAt: now };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shops', 'readwrite');
    const store = tx.objectStore('shops');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function updateShop(shop) {
  const db = await getDB();
  shop.updatedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shops', 'readwrite');
    const store = tx.objectStore('shops');
    const req = store.put(shop);
    req.onsuccess = () => resolve(shop);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteShop(id) {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('shops', 'readwrite');
    const store = tx.objectStore('shops');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  // delete logs
  const logs = await getLogs(id);
  await Promise.all(logs.map(l => deleteLog(l.id)));
}

/* === Logs === */
export async function getLogs(shopId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const idx = tx.objectStore('logs').index('shopId');
    const req = idx.getAll(shopId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLogs() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const req = tx.objectStore('logs').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addLog(log) {
  const db = await getDB();
  const record = { id: generateId(), ...log, usedAt: log.usedAt || Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLog(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* === Settings === */
export async function getSettings() {
  const db = await getDB();
  const keys = ['notifyRadius', 'notifyDelay', 'notifyEnabled'];
  const result = { notifyRadius: 100, notifyDelay: 5, notifyEnabled: false };
  const dbValues = await Promise.all(keys.map(k => new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(k);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => resolve(undefined);
  })));
  keys.forEach((k, i) => { if (dbValues[i] !== undefined) result[k] = dbValues[i]; });
  return result;
}

export async function setSetting(key, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSettingsEntries() {
  const settings = await getSettings();
  return Object.entries(settings).map(([key, value]) => ({ key, value }));
}

export async function clearAllData() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['shops', 'logs'], 'readwrite');
    tx.objectStore('shops').clear();
    tx.objectStore('logs').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* === Demo Data === */
export async function seedDemoData() {
  const shops = await getAllShops();
  const existingNames = new Set(shops.map((shop) => shop.name));
  const demo = [
    { name: '안양 스타 마사지', category: '마사지', address: '경기도 안양시 동안구 시민대로 1234', phone: '031-000-1200', expiresAt: '2026-12-31', memo: '평일 오전 예약 시 적립 확인', lat: 37.4012, lng: 126.9523, totalCoupons: 10, skin: 'sage' },
    { name: '허브 커피 로스터스', category: '카페', address: '경기도 안양시 동안구 관악로 56', phone: '031-000-3400', expiresAt: '2026-09-30', memo: '원두 구매도 스탬프 적립 가능', lat: 37.4025, lng: 126.9530, totalCoupons: 12, skin: 'espresso' },
    { name: '태양 찜질방', category: '찜질방', address: '경기도 안양시 만안구 성남대로 789', phone: '031-000-5600', expiresAt: '2026-08-31', memo: '주말 입장권은 쿠폰 제외 여부 확인', lat: 37.4000, lng: 126.9510, totalCoupons: 8, skin: 'sage' }
  ];
  const missing = demo.filter((shop) => !existingNames.has(shop.name));
  for (const s of missing) await addShop(s);
  return missing.length;
}
