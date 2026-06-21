// data/db.js — IndexedDB primitives (schema compatible). Generic helpers only;
// validation/normalization lives in data/repo.js.

export const DB_NAME = 'CouponBookDB';
export const DB_VERSION = 2;

let _db = null;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => migrate(e.target.result, e.target.transaction);
  });
}

// Idempotent: creates any missing store/index, never drops existing data.
function migrate(db, tx) {
  let shops;
  if (!db.objectStoreNames.contains('shops')) {
    shops = db.createObjectStore('shops', { keyPath: 'id' });
  } else {
    shops = tx.objectStore('shops');
  }
  if (!shops.indexNames.contains('category')) {
    shops.createIndex('category', 'category', { unique: false });
  }

  let logs;
  if (!db.objectStoreNames.contains('logs')) {
    logs = db.createObjectStore('logs', { keyPath: 'id' });
  } else {
    logs = tx.objectStore('logs');
  }
  if (!logs.indexNames.contains('shopId')) logs.createIndex('shopId', 'shopId', { unique: false });
  if (!logs.indexNames.contains('usedAt')) logs.createIndex('usedAt', 'usedAt', { unique: false });

  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }
}

export async function getDB() {
  if (_db) return _db;
  _db = await open();
  return _db;
}

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function reqAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Generic helpers ──────────────────────────────────────────────────────────
export async function getAll(store) {
  const db = await getDB();
  return reqAsPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await getDB();
  return reqAsPromise(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function put(store, rec) {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await reqAsPromise(tx.objectStore(store).put(rec));
  return rec;
}

export async function del(store, key) {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  return reqAsPromise(tx.objectStore(store).delete(key));
}

export async function getAllByIndex(store, index, key) {
  const db = await getDB();
  const idx = db.transaction(store, 'readonly').objectStore(store).index(index);
  return reqAsPromise(idx.getAll(key));
}

export async function clearStores(names) {
  const list = Array.isArray(names) ? names : [names];
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(list, 'readwrite');
    list.forEach((name) => tx.objectStore(name).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
