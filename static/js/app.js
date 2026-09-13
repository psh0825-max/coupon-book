// app.js — bootstrap. Wires store + router + actions and injects them as ctx into
// every view. The only module that knows about all layers at once.

import { createStore } from './core/store.js';
import { createRouter } from './core/router.js';
import { h } from './core/h.js';

import { Shops, Logs, Settings, seedDemoData, clearAll } from './data/repo.js';
import {
  remainingValue, remainingLabel, isAmountKind, isStampKind, passTotal, isCompleted
} from './domain.js';
import { formatWon, groupDigits, parseNumber } from './services/format.js';

import {
  setNotifySettings, startLocationWatch, stopLocationWatch, getCurrentPosition, hasPermission as hasLocationPermission
} from './services/location.js';
import { syncReminders, checkDueNow, ensurePermission, expiryLabel } from './services/reminders.js';
import {
  registerSW, applyUpdate, initInstallPrompt, canInstall, promptInstall, isStandalone, isIos
} from './services/pwa.js';
import { exportData as backupExport, importData as backupImport } from './services/backup.js';
import { scheduleSnapshot, flushSnapshot, restoreIfEmpty } from './services/snapshot.js';
import { requestPersistentStorage } from './services/storage.js';
import { haptic, celebrate } from './services/fx.js';
import { initAds, retryAds } from './services/ads.js';
import * as platform from './platform.js';

import { showToast } from './ui/toast.js';
import { showSheet, showConfirm, closeOverlay, closeOverlayFromPop } from './ui/overlay.js';
import { showReward } from './ui/reward.js';

import * as Home from './views/home.js';
import * as List from './views/list.js';
import * as Detail from './views/detail.js';
import { renewPrefill } from './views/detail.js';
import * as Edit from './views/edit.js';
import * as MapView from './views/map.js';
import * as History from './views/history.js';
import * as SettingsView from './views/settings.js';
import * as Onboarding from './views/onboarding.js';

// ── Store ────────────────────────────────────────────────────────────────────
const store = createStore({
  shops: [],
  logs: [],
  settings: { ...Settings.DEFAULTS },
  ui: { filter: { query: '', category: 'all', status: 'all', sort: 'smart' } },
  ready: false
});

let booted = false;

async function refresh() {
  const [shops, logs, settings] = await Promise.all([
    Shops.all(), Logs.all(), Settings.getAll()
  ]);
  store.setState({ shops, logs, settings });
  // Every persisted change flows through here → keep the durability snapshot fresh.
  if (booted) scheduleSnapshot();
}

// ── Service resync ───────────────────────────────────────────────────────────
function resyncServices() {
  const { shops, settings } = store.getState();
  setNotifySettings({
    radius: settings.notifyRadius,
    delay: settings.notifyDelay,
    enabled: settings.notifyEnabled
  });
  if (settings.notifyEnabled) startLocationWatch(shops, onGeofence);
  else stopLocationWatch();
  syncReminders(shops, settings, onReminderDue);
}

function onGeofence(notifyList) {
  const list = h('div', { class: 'nearby-sheet' },
    (notifyList || []).map(({ shop, distance }) => h('button', {
      class: 'nearby-card',
      attrs: { type: 'button' },
      on: {
        click: () => {
          closeOverlay();
          router.navigate('detail', { id: shop.id });
        }
      }
    },
      h('div', { class: 'info' },
        h('h4', null, shop.name),
        h('p', null, `${shop.address || ''}${distance != null ? ` · ${Math.round(distance)}m` : ''}`)
      ),
      h('div', { class: 'badge badge-accent' }, `${remainingLabel(shop)} 남음`)
    ))
  );
  haptic('medium');
  showSheet({ title: '근처에 쿠폰이 있어요', body: list });
}

function onReminderDue(shop, info) {
  if (info.type === 'lowbalance') {
    showToast(`${shop.name} · 잔액 ${formatWon(info.remaining)} 남음`, 'danger');
  } else {
    showToast(`${shop.name} · ${expiryLabel(info.days)} 만료 임박`, 'danger');
  }
}

// A new service worker is waiting. Offer an accessible refresh prompt; applying it
// posts SKIP_WAITING and the controllerchange handler reloads the page once.
function onUpdateAvailable(reg) {
  showSheet({
    title: '업데이트',
    body: '새 버전이 준비됐어요. 새로고침하면 적용돼요.',
    actions: [
      { id: 'later', label: '나중에', className: 'btn-secondary' },
      { id: 'reload', label: '새로고침', className: 'btn-primary', onClick: () => applyUpdate(reg) }
    ]
  });
}

// clamp to an integer range; NaN propagates so callers can guard with `if (!v)`.
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Attach a position to a usage log only when location alerts are on AND the OS
// permission is already granted — using a coupon must never trigger the prompt.
async function optionalPosition() {
  try {
    if (!store.getState().settings.notifyEnabled) return null;
    if (!(await hasLocationPermission())) return null;
    const pos = await getCurrentPosition();
    return { lat: pos.lat, lng: pos.lng };
  } catch {
    return null;
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
const actions = {
  // Kind-aware "use": add a stamp (stamp card), deduct sessions (count pass) or
  // won (amount pass). Completing a stamp card is a reward moment; a used-up
  // paid pass is just depleted.
  async usePass(shopId, opts = {}) {
    const shop = store.getState().shops.find((s) => s.id === shopId);
    if (!shop) return;
    const stamp = isStampKind(shop);
    if (remainingValue(shop) <= 0) {
      showToast(stamp ? '도장판이 이미 가득 찼어요' : '남은 이용권이 없어요', 'danger');
      return;
    }
    const updated = { ...shop };
    let logFields;
    if (isAmountKind(shop)) {
      const amt = clamp(Math.round(opts.amount), 1, remainingValue(shop));
      if (!amt) return;
      updated.usedAmount = (shop.usedAmount || 0) + amt;
      logFields = { amount: amt };
    } else {
      const n = clamp(Math.round(opts.count || 1), 1, remainingValue(shop));
      updated.usedCoupons = (shop.usedCoupons || 0) + n;
      logFields = { count: n };
    }
    const location = await optionalPosition();
    await Shops.update(updated);
    await Logs.add({
      shopId,
      note: opts.note || undefined,
      location: location || undefined,
      ...logFields
    });
    await refresh();
    const depleted = remainingValue(updated) <= 0;
    // One-tap undo on the toast: quick uses shouldn't need detail + confirm.
    const undo = { actionLabel: '되돌리기', onAction: () => actions.undoLastCoupon(shopId, { confirm: false }) };
    if (stamp && depleted) {
      haptic('success');
      celebrate();
      showReward({
        shopName: updated.name,
        total: passTotal(updated),
        onRenew: () => router.navigate('add', { prefill: renewPrefill(updated) })
      });
    } else if (depleted) {
      haptic('medium');
      showToast('이용권을 모두 사용했어요', 'success', undo);
    } else if (stamp) {
      haptic('light');
      showToast(`도장 완료 · ${remainingValue(updated)}개 더 모으면 보상`, 'success', undo);
    } else {
      haptic('light');
      showToast(`사용 완료 · ${remainingLabel(updated)} 남음`, 'success', undo);
    }
    resyncServices();
  },

  // Opens an accessible use-entry sheet, then delegates to usePass.
  promptUse(shop) {
    if (!shop) return;
    const stamp = isStampKind(shop);
    if (remainingValue(shop) <= 0) {
      showToast(stamp ? '도장판이 이미 가득 찼어요' : '남은 이용권이 없어요', 'danger');
      return;
    }
    const remaining = remainingValue(shop);
    const memoInput = h('textarea', {
      class: 'memo-input', id: 'use-memo',
      attrs: { rows: '2', placeholder: '메모 (선택)' }
    });

    if (isAmountKind(shop)) {
      const amountInput = h('input', {
        id: 'use-amount',
        attrs: { type: 'text', inputmode: 'numeric', placeholder: '예: 30,000', enterkeyhint: 'done' }
      });
      amountInput.addEventListener('input', () => { amountInput.value = groupDigits(amountInput.value); });
      const chipValues = [10000, 30000, 50000, 100000];
      const chips = h('div', { class: 'chip-row' },
        chipValues.map((v) => h('button', {
          class: 'chip', attrs: { type: 'button' },
          on: { click: () => { amountInput.value = groupDigits(Math.min(v, remaining)); haptic('selection'); } }
        }, formatWon(v))),
        h('button', {
          class: 'chip', attrs: { type: 'button' },
          on: { click: () => { amountInput.value = groupDigits(remaining); haptic('selection'); } }
        }, '전액')
      );
      showSheet({
        title: '금액 사용',
        body: h('div', null,
          h('label', { class: 'field-label', attrs: { for: 'use-amount' } }, '사용 금액(원)'),
          amountInput,
          chips,
          h('div', { class: 'amount-preview' }, `남은 금액: ${formatWon(remaining)}`),
          memoInput
        ),
        actions: [
          { id: 'cancel', label: '취소', className: 'btn-secondary' },
          {
            id: 'confirm', label: '사용', className: 'btn-primary',
            onClick: () => actions.usePass(shop.id, { amount: parseNumber(amountInput.value), note: memoInput.value.trim() })
          }
        ]
      });
    } else {
      const countInput = h('input', {
        id: 'use-count',
        attrs: { type: 'number', inputmode: 'numeric', min: '1', max: String(remaining), value: '1', 'aria-label': stamp ? '도장 개수' : '사용 횟수' }
      });
      const step = (delta) => {
        countInput.value = String(clamp((parseInt(countInput.value) || 1) + delta, 1, remaining));
        haptic('selection');
      };
      const stepper = h('div', { class: 'stepper' },
        h('button', { class: 'stepper-btn', attrs: { type: 'button', 'aria-label': '하나 줄이기' }, on: { click: () => step(-1) } }, '−'),
        countInput,
        h('button', { class: 'stepper-btn', attrs: { type: 'button', 'aria-label': '하나 늘리기' }, on: { click: () => step(1) } }, '+')
      );
      showSheet({
        title: stamp ? '도장 찍기' : '횟수 사용',
        body: h('div', null,
          h('span', { class: 'field-label' }, stamp ? `도장 개수 (남은 칸 ${remaining}개)` : `사용 횟수 (남은 ${remaining}회)`),
          stepper,
          memoInput
        ),
        actions: [
          { id: 'cancel', label: '취소', className: 'btn-secondary' },
          {
            id: 'confirm', label: stamp ? '도장 찍기' : '사용', className: 'btn-primary',
            onClick: () => actions.usePass(shop.id, { count: Number(countInput.value) || 1, note: memoInput.value.trim() })
          }
        ]
      });
    }
  },

  async undoLastCoupon(shopId, { confirm = true } = {}) {
    const shopNow = store.getState().shops.find((s) => s.id === shopId);
    const stamp = isStampKind(shopNow);
    if (confirm) {
      const ok = await showConfirm({
        title: stamp ? '도장 취소' : '사용 기록 취소',
        message: stamp ? '마지막으로 찍은 도장을 취소할까요?' : '마지막 이용권 사용 기록을 취소하고 사용량을 되돌릴까요?',
        confirmLabel: '되돌리기'
      });
      if (!ok) return;
    }
    const shop = store.getState().shops.find((s) => s.id === shopId);
    if (!shop) return;
    const logs = (store.getState().logs || [])
      .filter((l) => l.shopId === shopId)
      .sort((a, b) => b.usedAt - a.usedAt);
    if (!logs.length) return;
    const last = logs[0];
    // Restore exactly what the last use deducted (falls back to one session for
    // legacy logs that predate per-use amount/count fields).
    const restored = last.amount != null
      ? { ...shop, usedAmount: Math.max(0, (shop.usedAmount || 0) - last.amount) }
      : { ...shop, usedCoupons: Math.max(0, (shop.usedCoupons || 0) - (last.count || 1)) };
    await Shops.update(restored);
    await Logs.remove(last.id);
    haptic('light');
    showToast(stamp ? '마지막 도장을 취소했어요' : '마지막 사용 기록을 취소했어요');
    await refresh();
    resyncServices();
  },

  async saveShop(data, id) {
    if (id) {
      const cur = store.getState().shops.find((s) => s.id === id);
      await Shops.update({ ...cur, ...data, id });
    } else {
      await Shops.add(data);
    }
    await refresh();
    resyncServices();

    // First-backup nudge: one time only, right after the user's very first shop.
    if (!id) {
      const st = store.getState();
      if ((st.shops || []).length === 1 && !st.settings.backupHinted) {
        await Settings.set('backupHinted', true);
        store.setState((s) => ({ settings: { ...s.settings, backupHinted: true } }));
        showSheet({
          title: '백업을 권장해요',
          body: h('p', null, platform.isIOS
            ? '쿠폰은 이 기기에만 저장되고 앱 안에 자동 보관돼요. 기기를 바꿀 때를 대비해 파일로도 백업해 두면 안전해요.'
            : '쿠폰은 이 기기에만 저장돼요. 기기를 바꾸거나 앱을 지우면 사라질 수 있어요. 파일로 백업해 두면 안전해요.'),
          actions: [
            { id: 'later', label: '나중에', className: 'btn-secondary' },
            { id: 'backup', label: '지금 백업', className: 'btn-primary', onClick: () => actions.exportData() }
          ]
        });
      }
    }
  },

  async deleteShop(id) {
    await Shops.remove(id);
    await refresh();
    resyncServices();
  },

  setFilter(patch) {
    store.setState((s) => ({ ui: { ...s.ui, filter: { ...s.ui.filter, ...patch } } }));
  },

  // Location alerts need the OS permission: request it here (user gesture) and
  // refuse to enable when it is denied so the switch never lies.
  async toggleNotify(on) {
    let permission = 'granted';
    if (on) {
      try { await getCurrentPosition(); } catch { permission = 'denied'; }
      if (permission === 'denied') return { enabled: false, permission };
    }
    await Settings.set('notifyEnabled', on);
    await refresh();
    resyncServices();
    return { enabled: on, permission };
  },

  async saveNotifySettings({ radius, delay }) {
    await Settings.set('notifyRadius', radius);
    await Settings.set('notifyDelay', delay);
    await refresh();
    resyncServices();
  },

  // Notification permission is requested only here — i.e. only when the user
  // turns reminders on (onboarding step 3 or settings), never at launch.
  async toggleReminders(on) {
    let permission = 'granted';
    if (on) permission = await ensurePermission();
    await Settings.set('remindersEnabled', on);
    await refresh();
    resyncServices();
    return { enabled: on, permission };
  },

  async setReminderDays(days) {
    await Settings.set('reminderDays', days);
    await refresh();
    resyncServices();
  },

  async seedDemo() {
    const n = await seedDemoData();
    await refresh();
    resyncServices();
    return n;
  },

  async clearAll() {
    await clearAll();
    await refresh();
    stopLocationWatch();
    resyncServices();
    // Write the (now empty) snapshot immediately so a deliberate wipe is never
    // "restored" on the next launch.
    await flushSnapshot();
  },

  async exportData() {
    try {
      const r = await backupExport();
      await Settings.set('lastBackupAt', Date.now());
      await refresh();
      haptic('success');
      if (!r.toasted) {
        showToast(r.where === 'documents'
          ? (r.shared ? '백업 파일을 내보냈어요' : '백업 파일을 저장했어요 · 파일 앱 › 쿠폰북')
          : '백업 파일이 다운로드되었어요');
      }
    } catch (e) {
      haptic('error');
      showToast('백업에 실패했어요: ' + (e?.message || e), 'danger');
    }
  },

  // Snooze the home backup banner (domain.needsBackupNudge honors the timestamp).
  async dismissBackupNudge() {
    await Settings.set('backupNudgeDismissedAt', Date.now());
    await refresh();
  },

  async importData(file) {
    const sum = await backupImport(file);
    await refresh();
    resyncServices();
    return sum;
  },

  async importFromPicker() {
    const file = await platform.pickTextFile();
    if (!file) return null;
    try {
      const sum = await actions.importData(file);
      haptic('success');
      showToast(`복원 완료 · 업체 ${sum.shops}개, 내역 ${sum.logs}건`);
      return sum;
    } catch (err) {
      haptic('error');
      showToast('복원 실패: ' + (err?.message || err), 'danger');
      return null;
    }
  },

  async completeOnboarding() {
    await Settings.set('onboarded', true);
    store.setState((s) => ({ settings: { ...s.settings, onboarded: true } }));
    scheduleSnapshot();
    startAds();
  },

  async requestInstall() {
    const o = await promptInstall();
    if (o === 'accepted') showToast('앱이 설치되었어요');
    else if (o === 'unavailable') showToast('이미 설치되었거나 설치를 지원하지 않아요');
    return o;
  },

  refresh
};

// ── Router + context ─────────────────────────────────────────────────────────
const routes = {
  home: Home.render,
  list: List.render,
  detail: Detail.render,
  add: Edit.render,
  map: MapView.render,
  history: History.render,
  settings: SettingsView.render,
  onboarding: Onboarding.render
};

const ctx = { store, router: null, actions, services: { canInstall, isStandalone, isIos } };
const router = createRouter({
  outlet: document.getElementById('main'),
  routes,
  getCtx: () => ctx,
  closeOverlays: () => closeOverlay(true, { keepHistory: true })
});
ctx.router = router; // views read ctx.router at render time — must be set before any navigate

// Re-render the current data-driven view whenever a DATA slice changes. Skip
// onboarding/add (they own local form state that a re-render would clobber).
store.select(
  (s) => ({ shops: s.shops, logs: s.logs, settings: s.settings }),
  () => {
    const c = router.current();
    if (c.name && !['onboarding', 'add'].includes(c.name)) router.reload();
  }
);

// Space reserved for the native ad banner (iOS): content and the tab bar sit
// above it, and the safe-area padding moves from the tab bar to the banner.
function onBannerHeight(px) {
  const height = Math.max(0, Math.round(Number(px) || 0));
  document.documentElement.style.setProperty('--ad-h', `${height}px`);
  document.body.classList.toggle('has-ad', height > 0);
}

// Ads (and, on iOS, the App Tracking Transparency prompt that precedes the first
// ad request) start only once onboarding is behind the user and a real view is
// on screen — never over the welcome flow. Idempotent.
let adsStarted = false;
function startAds() {
  if (adsStarted) return;
  adsStarted = true;
  setTimeout(() => { initAds({ onBannerHeight }).catch(() => {}); }, 700);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  document.body.dataset.theme = 'light';
  document.body.dataset.platform = platform.platform;
  platform.applyNativeChrome();
  registerSW(onUpdateAvailable);
  initInstallPrompt();

  await refresh();

  // Durability: an empty database next to a non-empty snapshot means the
  // WebView storage was evicted — bring everything back before the first paint.
  let restored = null;
  try {
    restored = await restoreIfEmpty(store.getState());
    if (restored) await refresh();
  } catch { restored = null; }

  store.setState({ ready: true });
  resyncServices();

  // Best-effort: ask the browser to keep IndexedDB durable so coupons aren't
  // silently evicted under storage pressure. Never await-block boot.
  requestPersistentStorage().catch(() => {});

  // Chrome wiring (header back, bottom-nav, FAB).
  const backEl = document.querySelector('[data-back]');
  if (backEl) backEl.addEventListener('click', () => { haptic('selection'); router.back(); });

  // Hardware/browser back (Android): close an open sheet first, then restore the
  // popped route.
  window.addEventListener('popstate', (e) => {
    if (closeOverlayFromPop()) return;
    router.restore(e.state);
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => { haptic('selection'); router.navigate(el.dataset.nav); });
  });

  const fabEl = document.querySelector('[data-fab]');
  if (fabEl) fabEl.addEventListener('click', () => { haptic('light'); router.navigate('add'); });

  // Manifest shortcut deep-links (long-press app icon → 이용권 추가 / 지도).
  // Consume the query so history/bookmarks stay clean.
  const shortcut = new URLSearchParams(window.location.search).get('action');
  if (shortcut) window.history.replaceState(null, '', window.location.pathname);

  const onboarded = store.getState().settings.onboarded;
  if (onboarded && (shortcut === 'add' || shortcut === 'map')) {
    router.navigate('home');       // sensible back target under the shortcut view
    router.navigate(shortcut);
  } else {
    router.navigate(onboarded ? 'home' : 'onboarding');
  }

  booted = true;
  document.body.dataset.booted = '1';
  platform.hideSplash();
  if (restored) {
    setTimeout(() => showToast(`저장된 백업에서 복원했어요 · 업체 ${restored.shops}개`), 400);
  }

  // Lifecycle: re-check reminders and ads on foreground, persist on background.
  platform.onAppState({
    onResume: () => {
      const { shops, settings } = store.getState();
      checkDueNow(shops, settings, onReminderDue).catch(() => {});
      retryAds();
    },
    onPause: () => { flushSnapshot().catch(() => {}); }
  });
  window.addEventListener('pagehide', () => { flushSnapshot().catch(() => {}); });
  window.addEventListener('online', () => retryAds());

  if (onboarded) startAds();   // otherwise completeOnboarding() starts them
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
