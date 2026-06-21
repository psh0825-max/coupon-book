// services/pwa.js — service worker registration + install prompt handling.

let _deferredPrompt = null;

export function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
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
