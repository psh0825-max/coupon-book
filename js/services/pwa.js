// services/pwa.js — service worker registration + install prompt handling.

let _deferredPrompt = null;
let _updating = false, _reloaded = false;

// Register the SW and detect when a new version is waiting. onUpdate(reg) fires
// only when there is already a controller (i.e. this is an update, not first
// install). controllerchange then reloads once, after applyUpdate() is called.
export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) onUpdate?.(reg);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) onUpdate?.(reg);
      });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_updating && !_reloaded) { _reloaded = true; window.location.reload(); }
  });
}

export function applyUpdate(reg) {
  _updating = true;
  reg?.waiting?.postMessage('SKIP_WAITING');
}

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
  });
}

export function canInstall() {
  return !!_deferredPrompt;
}

export async function promptInstall() {
  if (!_deferredPrompt) return 'unavailable';
  _deferredPrompt.prompt();
  const choice = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  return choice.outcome;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
