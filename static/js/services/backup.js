// services/backup.js — JSON export/import. Import upserts via repo normalizers and
// PRESERVES original ids (does not regenerate via Shops.add). The same payload
// format backs the automatic durability snapshot (services/snapshot.js).

import { generateId, put } from '../data/db.js';
import { Shops, Logs, Settings, normalizeShop, normalizeLog, DEFAULTS } from '../data/repo.js';
import { saveTextFile } from '../platform.js';

export const BACKUP_VERSION = 3;

function dateStamp() {
  const d = new Date(Date.now());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Full database as a plain object: { version, app, shops, logs, settings, exportedAt } */
export async function buildPayload() {
  const [shops, logs, settings] = await Promise.all([
    Shops.all(), Logs.all(), Settings.entries()
  ]);
  return { version: BACKUP_VERSION, app: 'coupon-book', shops, logs, settings, exportedAt: Date.now() };
}

/**
 * exportData() -> Promise<{ ok, where, shared?, toasted? }> — hands the JSON to the
 * platform (share sheet on iOS, Downloads on Android, browser download on the web).
 */
export async function exportData() {
  const payload = await buildPayload();
  const json = JSON.stringify(payload, null, 2);
  return saveTextFile(`coupon-backup-${dateStamp()}.json`, json, { mime: 'application/json' });
}

// Validate an imported setting value against the type of its repo default.
function isValidSettingValue(key, value) {
  const def = DEFAULTS[key];
  if (Array.isArray(def)) {
    return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
  }
  if (typeof def === 'boolean') return typeof value === 'boolean';
  if (typeof def === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (def === null) return value === null || typeof value === 'number' || typeof value === 'boolean';
  return typeof value === typeof def;
}

/** parsePayload(text) -> validated payload; throws a user-facing Error otherwise. */
export function parsePayload(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('올바른 백업 파일이 아니에요');
  }
  if (!data || !Array.isArray(data.shops) || !Array.isArray(data.logs)) {
    throw new Error('올바른 백업 파일이 아니에요');
  }
  if (data.shops.length > 5000 || data.logs.length > 20000) {
    throw new Error('백업 파일이 너무 큽니다');
  }
  return data;
}

/** importPayload(data) -> { shops, logs } — upsert everything, keeping ids. */
export async function importPayload(data) {
  const now = Date.now();
  for (const s of data.shops) {
    const norm = normalizeShop(s);
    const rec = {
      ...norm,
      id: s.id || generateId(),
      createdAt: s.createdAt != null ? s.createdAt : now,
      updatedAt: s.updatedAt != null ? s.updatedAt : now
    };
    await put('shops', rec);
  }

  for (const l of data.logs) {
    const rec = { ...normalizeLog(l), id: l.id || generateId() };
    await put('logs', rec);
  }

  if (Array.isArray(data.settings)) {
    for (const { key, value } of data.settings) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) continue;
      if (!isValidSettingValue(key, value)) continue;
      await Settings.set(key, value);
    }
  }

  return { shops: data.shops.length, logs: data.logs.length };
}

/** importData(File|string) -> { shops, logs } */
export async function importData(fileOrText) {
  const text = typeof fileOrText === 'string' ? fileOrText : await fileOrText.text();
  return importPayload(parsePayload(text));
}
