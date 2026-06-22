// data/repo.js — repositories. All validation/normalization happens here so the
// rest of the app can trust the shapes coming out of the data layer.

import {
  generateId, getAll, get, put, del, getAllByIndex, clearStores
} from './db.js';
import { CATEGORIES, SKINS, getDefaultSkin } from './skins.js';

export const DEFAULTS = {
  notifyEnabled: false,
  notifyRadius: 100,
  notifyDelay: 5,
  remindersEnabled: false,
  reminderDays: [7, 3, 1],
  onboarded: false,
  backupHinted: false
};

// ── Normalization (pure) ─────────────────────────────────────────────────────
function clampInt(value, min, max, fallback) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value, max) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeShop(raw = {}) {
  // Records predating the pass-kind concept have no `kind`; treat them as 'count'.
  const kind = raw.kind === 'amount' ? 'amount' : 'count';
  const total = clampInt(raw.totalCoupons, 1, 1000, 10);
  const used = clampInt(raw.usedCoupons, 0, total, 0);
  const totalAmount = clampInt(raw.totalAmount, 0, 100000000, 0); // up to 1억 KRW
  const usedAmount = clampInt(raw.usedAmount, 0, totalAmount, 0);
  const rawCat = str(raw.category, 20);
  const category = CATEGORIES[rawCat] ? rawCat : '기타';
  const skin = raw.skin && SKINS[raw.skin] ? raw.skin : getDefaultSkin(category);
  // Photo is a downscaled JPEG data URL; never run it through str() (the generic
  // length limiter would corrupt it). Keep only valid image data URLs.
  const photo = (typeof raw.photo === 'string' && raw.photo.startsWith('data:image/')) ? raw.photo : '';
  const shop = {
    name: str(raw.name, 60),
    category,
    address: str(raw.address, 120),
    phone: str(raw.phone, 30),
    expiresAt: raw.expiresAt ? str(raw.expiresAt, 20) : null,
    memo: str(raw.memo, 500),
    code: str(raw.code, 120),
    photo,
    lat: numOrNull(raw.lat),
    lng: numOrNull(raw.lng),
    kind,
    // Both pairs are always stored so toggling kind never loses the other's value.
    totalCoupons: total,
    usedCoupons: used,
    totalAmount,
    usedAmount,
    skin
  };
  if (raw.id != null) shop.id = raw.id;
  if (raw.createdAt != null) shop.createdAt = raw.createdAt;
  if (raw.updatedAt != null) shop.updatedAt = raw.updatedAt;
  return shop;
}

export function normalizeLog(raw = {}) {
  const log = {
    shopId: raw.shopId,
    note: str(raw.note, 200),
    usedAt: Number(raw.usedAt) || Date.now()
  };
  if (raw.location && typeof raw.location === 'object') {
    log.location = { lat: numOrNull(raw.location.lat), lng: numOrNull(raw.location.lng) };
  }
  // Optional per-use deduction record (how much this use consumed): won for an
  // amount pass, sessions for a count pass. Used to undo the exact amount.
  const amount = Number(raw.amount);
  if (Number.isFinite(amount) && amount >= 0) log.amount = amount;
  const count = Number(raw.count);
  if (Number.isFinite(count) && count >= 1) log.count = Math.round(count);
  if (raw.id != null) log.id = raw.id;
  return log;
}

// ── Shops ────────────────────────────────────────────────────────────────────
export const Shops = {
  all() { return getAll('shops'); },
  get(id) { return get('shops', id); },
  async add(partial) {
    const now = Date.now();
    const rec = { ...normalizeShop(partial), id: generateId(), createdAt: now, updatedAt: now };
    await put('shops', rec);
    return rec;
  },
  async update(shop) {
    const rec = {
      ...normalizeShop(shop),
      id: shop.id,
      createdAt: shop.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await put('shops', rec);
    return rec;
  },
  async remove(id) {
    await del('shops', id);
    const logs = await getAllByIndex('logs', 'shopId', id);
    await Promise.all(logs.map((l) => del('logs', l.id)));
  }
};

// ── Logs ─────────────────────────────────────────────────────────────────────
export const Logs = {
  byShop(id) { return getAllByIndex('logs', 'shopId', id); },
  all() { return getAll('logs'); },
  async add(log) {
    const rec = { ...normalizeLog(log), id: generateId() };
    await put('logs', rec);
    return rec;
  },
  remove(id) { return del('logs', id); }
};

// ── Settings ─────────────────────────────────────────────────────────────────
export const Settings = {
  DEFAULTS,
  async getAll() {
    const rows = await getAll('settings');
    const out = { ...DEFAULTS };
    for (const row of rows) {
      if (row && row.key != null) out[row.key] = row.value;
    }
    return out;
  },
  async set(key, value) {
    await put('settings', { key, value });
    return value;
  },
  async entries() {
    const obj = await this.getAll();
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }
};

// ── Demo / bulk ──────────────────────────────────────────────────────────────
const DEMO_SHOPS = [
  { name: '안양 스타 마사지', category: '마사지', address: '경기도 안양시 동안구 시민대로 1234', phone: '031-000-1200', expiresAt: '2026-12-31', memo: '100만원 충전권, 15만원 사용', lat: 37.4012, lng: 126.9523, kind: 'amount', totalAmount: 1000000, usedAmount: 150000, skin: 'sage' },
  { name: '허브 커피 로스터스', category: '카페', address: '경기도 안양시 동안구 관악로 56', phone: '031-000-3400', expiresAt: '2026-09-30', memo: '원두 구매도 스탬프 적립 가능', lat: 37.4025, lng: 126.9530, totalCoupons: 12, skin: 'espresso' },
  { name: '태양 찜질방', category: '찜질방', address: '경기도 안양시 만안구 성남대로 789', phone: '031-000-5600', expiresAt: '2026-08-31', memo: '주말 입장권은 쿠폰 제외 여부 확인', lat: 37.4000, lng: 126.9510, totalCoupons: 8, skin: 'sage' }
];

export async function seedDemoData() {
  const existing = await Shops.all();
  const names = new Set(existing.map((s) => s.name));
  const missing = DEMO_SHOPS.filter((s) => !names.has(s.name));
  for (const s of missing) await Shops.add(s);
  return missing.length;
}

export async function clearAll() {
  await clearStores(['shops', 'logs']);
}
