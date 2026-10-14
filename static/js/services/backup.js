// services/backup.js — JSON export and validate-then-replace restore.

import { generateId, runTx } from '../data/db.js';
import { Shops, Logs, Settings, normalizeShop, normalizeLog, DEFAULTS } from '../data/repo.js';

function dateStamp() {
  const d = new Date(Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isValidSettingValue(key, value) {
  const def = DEFAULTS[key];
  if (Array.isArray(def)) return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
  if (isPlainObject(def)) return isPlainObject(value);
  if (typeof def === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === typeof def;
}

// Parse all input before opening an IndexedDB transaction. This ensures a bad file
// can never leave a partially restored coupon book.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('백업 파일을 읽을 수 없어요. JSON 백업 파일인지 확인해 주세요.');
  }
  if (!isPlainObject(data) || !Array.isArray(data.shops) || !Array.isArray(data.logs)) {
    throw new Error('쿠폰북 백업 파일이 아니에요.');
  }
  if (data.shops.length > 5000 || data.logs.length > 20000) {
    throw new Error('백업 파일이 너무 커요.');
  }

  const now = Date.now();
  let skippedShops = 0;
  let skippedLogs = 0;
  const shopsById = new Map();
  for (const raw of data.shops) {
    if (!isPlainObject(raw)) {
      skippedShops += 1;
      continue;
    }
    const id = typeof raw.id === 'string' && raw.id ? raw.id : generateId();
    shopsById.set(id, {
      ...normalizeShop(raw),
      id,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now
    });
  }

  const logs = [];
  for (const raw of data.logs) {
    if (!isPlainObject(raw)) {
      skippedLogs += 1;
      continue;
    }
    if (!shopsById.has(raw.shopId)) {
      skippedLogs += 1;
      continue;
    }
    const id = typeof raw.id === 'string' && raw.id ? raw.id : generateId();
    logs.push({ ...normalizeLog(raw), id });
  }

  const settings = [];
  if (Array.isArray(data.settings)) {
    for (const entry of data.settings) {
      if (!isPlainObject(entry) || !Object.prototype.hasOwnProperty.call(DEFAULTS, entry.key)) continue;
      if (isValidSettingValue(entry.key, entry.value)) settings.push({ key: entry.key, value: entry.value });
    }
  }
  return {
    shops: [...shopsById.values()],
    logs,
    settings,
    exportedAt: Number.isFinite(data.exportedAt) ? data.exportedAt : null,
    skipped: { shops: skippedShops, logs: skippedLogs }
  };
}

export async function restoreBackup(parsed) {
  await runTx(['shops', 'logs', 'settings'], ({ shops, logs, settings }) => {
    shops.clear();
    logs.clear();
    parsed.shops.forEach((shop) => shops.put(shop));
    parsed.logs.forEach((log) => logs.put(log));
    parsed.settings.forEach((setting) => settings.put(setting));
  });
  return { shops: parsed.shops.length, logs: parsed.logs.length };
}

export async function exportData() {
  const [shops, logs, settings] = await Promise.all([Shops.all(), Logs.all(), Settings.entries()]);
  const json = JSON.stringify({ version: 3, shops, logs, settings, exportedAt: Date.now() }, null, 2);
  const filename = `coupon-backup-${dateStamp()}.json`;
  const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
  if (bridge && typeof bridge.saveText === 'function') {
    bridge.saveText(filename, json);
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function importData(file) {
  return restoreBackup(parseBackup(await file.text()));
}
