// Keeps a code visible at the counter. Native shells can also raise brightness.

let presenting = false;
let sentinel = null;

function androidBridge() {
  return typeof window !== 'undefined'
    && window.AndroidBridge
    && typeof window.AndroidBridge.setPresentationMode === 'function'
    ? window.AndroidBridge
    : null;
}

function canWakeLock() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function acquireWakeLock() {
  if (!presenting || !canWakeLock()) return;
  try {
    const next = await navigator.wakeLock.request('screen');
    if (!presenting) {
      await next.release?.();
      return;
    }
    sentinel = next;
  } catch {
    // Screen locks may be unavailable during battery saver or browser policy.
  }
}

async function onVisibilityChange() {
  if (presenting && document.visibilityState === 'visible') await acquireWakeLock();
}

export function controlsBrightness() {
  return !!androidBridge();
}

export async function resetPresentation() {
  presenting = false;
  const current = sentinel;
  sentinel = null;
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange);
  try { await current?.release?.(); } catch { /* best effort */ }
  try { await androidBridge()?.setPresentationMode(false); } catch { /* best effort */ }
}

export async function startPresenting() {
  if (presenting) return;
  presenting = true;
  const bridge = androidBridge();
  if (bridge) {
    await bridge.setPresentationMode(true);
    return;
  }
  if (!canWakeLock()) return;
  document.addEventListener('visibilitychange', onVisibilityChange);
  await acquireWakeLock();
}

export async function stopPresenting() {
  if (!presenting) return;
  presenting = false;
  const bridge = androidBridge();
  if (bridge) {
    await bridge.setPresentationMode(false);
    return;
  }
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange);
  const current = sentinel;
  sentinel = null;
  try { await current?.release?.(); } catch { /* best effort */ }
}
