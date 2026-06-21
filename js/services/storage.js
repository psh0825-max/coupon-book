// services/storage.js — durable storage helpers. Asks the browser to keep
// IndexedDB persistent (so it won't silently evict the user's coupons) and
// reports persistence/usage. All guarded for browsers without the APIs.

export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return 'unsupported';
  if (navigator.storage.persisted && await navigator.storage.persisted()) return 'persisted';
  try {
    return (await navigator.storage.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function isPersisted() {
  try {
    return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted());
  } catch {
    return false;
  }
}

export async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    }
  } catch { /* unsupported */ }
  return null;
}
