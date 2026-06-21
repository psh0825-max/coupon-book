// services/backup.js — JSON export/import. Import upserts via repo normalizers and
// PRESERVES original ids (does not regenerate via Shops.add).

import { generateId, put } from '../data/db.js';
import { Shops, Logs, Settings, normalizeShop, normalizeLog } from '../data/repo.js';

function dateStamp() {
  const d = new Date(Date.now());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function exportData() {
  const [shops, logs, settings] = await Promise.all([
    Shops.all(), Logs.all(), Settings.entries()
  ]);
  const payload = { version: 3, shops, logs, settings, exportedAt: Date.now() };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coupon-backup-${dateStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data.shops) || !Array.isArray(data.logs)) {
    throw new Error('올바른 백업 파일이 아니에요');
  }

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
      await Settings.set(key, value);
    }
  }

  return { shops: data.shops.length, logs: data.logs.length };
}
