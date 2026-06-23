// app.js — bootstrap. Wires store + router + actions and injects them as ctx into
// every view. The only module that knows about all layers at once.

import { createStore } from './core/store.js';
import { createRouter } from './core/router.js';
import { h } from './core/h.js';

import { Shops, Logs, Settings, seedDemoData, clearAll } from './data/repo.js';
import { remainingCount, remainingValue, remainingLabel, isAmountKind } from './domain.js';
import { formatWon, groupDigits, parseNumber } from './services/format.js';

import {
  setNotifySettings, startLocationWatch, stopLocationWatch, getCurrentPosition
} from './services/location.js';
import { syncReminders, ensurePermission } from './services/reminders.js';
import {
  registerSW, applyUpdate, initInstallPrompt, canInstall, promptInstall, isStandalone, isIos
} from './services/pwa.js';
import { exportData as backupExport, importData as backupImport } from './services/backup.js';
import { requestPersistentStorage } from './services/storage.js';
import { haptic } from './services/fx.js';
import { mountAds } from './services/ads.js';

import { showToast } from './ui/toast.js';
import { showSheet, showConfirm, closeOverlay } from './ui/overlay.js';

import * as Home from './views/home.js';
import * as List from './views/list.js';
import * as Detail from './views/detail.js';
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

async function refresh() {
  const [shops, logs, settings] = await Promise.all([
    Shops.all(), Logs.all(), Settings.getAll()
  ]);
  store.setState({ shops, logs, settings });
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
      h('div', { class: 'badge badge-accent' }, `${remainingCount(shop)}개 남음`)
    ))
  );
  showSheet({ title: '근처 가게 방문 감지', body: list });
}

function onReminderDue(shop, info) {
  if (info.type === 'lowbalance') {
    showToast(`${shop.name} · 잔액 ${formatWon(info.remaining)} 남음`, 'danger');
  } else {
    showToast(`${shop.name} · ${info.days === 0 ? '오늘 만료' : 'D-' + info.days} 만료 임박`, 'danger');
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

// ── Actions ──────────────────────────────────────────────────────────────────
const actions = {
  // Kind-aware "use": deduct won (amount pass) or sessions (count pass). A used-up
  // paid pass is depleted, not a prize — no confetti/reward here.
  async usePass(shopId, opts = {}) {
    const shop = store.getState().shops.find((s) => s.id === shopId);
    if (!shop) return;
    if (remainingValue(shop) <= 0) {
      showToast('남은 이용권이 없어요', 'danger');
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
    let pos = null;
    try { pos = await getCurrentPosition(); } catch { /* location optional */ }
    await Shops.update(updated);
    await Logs.add({
      shopId,
      note: opts.note || undefined,
      location: pos ? { lat: pos.lat, lng: pos.lng } : undefined,
      ...logFields
    });
    await refresh();
    const depleted = remainingValue(updated) <= 0;
    if (depleted) {
      haptic('medium');
      showToast('이용권을 모두 사용했어요');
    } else {
      haptic('light');
      showToast(`사용 완료 · ${remainingLabel(updated)} 남음`);
    }
    resyncServices();
  },

  // Opens an accessible use-entry sheet, then delegates to usePass.
  promptUse(shop) {
    if (!shop) return;
    if (remainingValue(shop) <= 0) {
      showToast('남은 이용권이 없어요', 'danger');
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
        attrs: { type: 'text', inputmode: 'numeric', placeholder: '예: 30,000' }
      });
      amountInput.addEventListener('input', () => { amountInput.value = groupDigits(amountInput.value); });
      const chipValues = [10000, 30000, 50000, 100000];
      const chips = h('div', { class: 'use-chips' },
        chipValues.map((v) => h('button', {
          class: 'chip', attrs: { type: 'button' },
          on: { click: () => { amountInput.value = groupDigits(Math.min(v, remaining)); } }
        }, formatWon(v))),
        h('button', {
          class: 'chip', attrs: { type: 'button' },
          on: { click: () => { amountInput.value = groupDigits(remaining); } }
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
        attrs: { type: 'number', inputmode: 'numeric', min: '1', max: String(remaining), value: '1' }
      });
      showSheet({
        title: '횟수 사용',
        body: h('div', null,
          h('label', { class: 'field-label', attrs: { for: 'use-count' } }, '사용 횟수'),
          countInput,
          memoInput
        ),
        actions: [
          { id: 'cancel', label: '취소', className: 'btn-secondary' },
          {
            id: 'confirm', label: '사용', className: 'btn-primary',
            onClick: () => actions.usePass(shop.id, { count: Number(countInput.value) || 1, note: memoInput.value.trim() })
          }
        ]
      });
    }
  },

  async undoLastCoupon(shopId) {
    const ok = await showConfirm({
      title: '사용 기록 취소',
      message: '마지막 이용권 사용 기록을 취소하고 사용량을 되돌릴까요?',
      confirmLabel: '되돌리기'
    });
    if (!ok) return;
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
    showToast('마지막 사용 기록을 취소했어요');
    await refresh();
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
          body: h('p', null, '쿠폰은 이 기기에만 저장돼요. 기기를 바꾸거나 앱을 지우면 사라질 수 있어요. JSON으로 백업해 두면 안전해요.'),
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

  async toggleNotify(on) {
    await Settings.set('notifyEnabled', on);
    await refresh();
    resyncServices();
  },

  async saveNotifySettings({ radius, delay }) {
    await Settings.set('notifyRadius', radius);
    await Settings.set('notifyDelay', delay);
    await refresh();
    resyncServices();
  },

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
  },

  async exportData() {
    await backupExport();
    showToast('백업 파일이 다운로드되었어요');
  },

  async importData(file) {
    const sum = await backupImport(file);
    await refresh();
    resyncServices();
    return sum;
  },

  async completeOnboarding() {
    await Settings.set('onboarded', true);
    store.setState((s) => ({ settings: { ...s.settings, onboarded: true } }));
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
  onChange: () => mountAds() // page-level Auto Ads; no-op while ads are off
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

// ── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  document.body.dataset.theme = 'light';
  registerSW(onUpdateAvailable);
  initInstallPrompt();

  await refresh();
  store.setState({ ready: true });
  resyncServices();

  // Best-effort: ask the browser to keep IndexedDB durable so coupons aren't
  // silently evicted under storage pressure. Never await-block boot.
  requestPersistentStorage().catch(() => {});

  // Chrome wiring (header back, bottom-nav, FAB).
  const backEl = document.querySelector('[data-back]');
  if (backEl) backEl.addEventListener('click', () => router.back());

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => { haptic('light'); router.navigate(el.dataset.nav); });
  });

  const fabEl = document.querySelector('[data-fab]');
  if (fabEl) fabEl.addEventListener('click', () => router.navigate('add'));

  const onboarded = store.getState().settings.onboarded;
  router.navigate(onboarded ? 'home' : 'onboarding');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
