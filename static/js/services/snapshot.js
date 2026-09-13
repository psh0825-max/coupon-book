// services/snapshot.js — automatic durability snapshot. IndexedDB inside a
// WKWebView (and, under storage pressure, any browser) can be evicted without
// warning. After every data change the whole database is written, debounced, to
// a place the OS treats as app data (iOS: Library via Capacitor Filesystem;
// elsewhere localStorage as a lightweight mirror). On launch, an empty database
// plus an existing snapshot means eviction happened — restore silently.

import { buildPayload, importPayload, parsePayload } from './backup.js';
import { writeSnapshot, readSnapshot, prefGet, prefSet } from '../platform.js';

const PREF_KEY = 'snapshotAt';
const DEBOUNCE_MS = 1500;

let timer = null;
let dirty = false;
let writing = null;

/** scheduleSnapshot() — mark dirty; the write happens DEBOUNCE_MS later. */
export function scheduleSnapshot(delay = DEBOUNCE_MS) {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { flushSnapshot().catch(() => {}); }, delay);
}

/** flushSnapshot() -> Promise<boolean> — write now if anything changed. */
export async function flushSnapshot() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!dirty) return false;
  if (writing) await writing;      // serialize concurrent flushes
  dirty = false;
  writing = (async () => {
    const payload = await buildPayload();
    const ok = await writeSnapshot(JSON.stringify(payload));
    if (ok) await prefSet(PREF_KEY, String(Date.now()));
    return ok;
  })();
  try {
    return await writing;
  } finally {
    writing = null;
  }
}

/**
 * restoreIfEmpty({ shops, logs }) -> Promise<{shops,logs}|null>
 * Restores the snapshot only when the live database is empty AND the snapshot
 * holds data. A deliberately emptied database is never resurrected because
 * clear-all flushes an empty snapshot first (see app.js).
 */
export async function restoreIfEmpty({ shops = [], logs = [] } = {}) {
  if (shops.length || logs.length) return null;
  const text = await readSnapshot();
  if (!text) return null;
  let data;
  try {
    data = parsePayload(text);
  } catch {
    return null;
  }
  if (!data.shops.length && !data.logs.length) return null;
  return importPayload(data);
}

/** lastSnapshotAt() -> Promise<number|null> */
export async function lastSnapshotAt() {
  const v = Number(await prefGet(PREF_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}
