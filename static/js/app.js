// app.js — bootstrap. Wires store + router + actions and injects them as ctx into
// every view. The only module that knows about all layers at once.

import { createStore } from './core/store.js';
import { createRouter } from './core/router.js';
import { h } from './core/h.js';

import { Shops, Logs, Settings, seedDemoData, clearAll } from './data/repo.js';
import { remainingCount } from './domain.js';

import {
  setNotifySettings, startLocationWatch, stopLocationWatch, getCurrentPosition
} from './services/location.js';
import { syncReminders, ensurePermission } from './services/reminders.js';
import {
  registerSW, applyUpdate, initInstallPrompt, canInstall, promptInstall, isStandalone, isIos
} from './services/pwa.js';
import { exportData as backupExport, importData as backupImport } from './services/backup.js';
import { requestPersistentStorage } from './services/storage.js';
import { haptic, celebrate } from './services/fx.js';
import { mountAds } from './services/ads.js';

import { showToast } from './ui/toast.js';
import { showSheet, showConfirm, closeOverlay } from './ui/overlay.js';
import { showReward } from './ui/reward.js';

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

function onReminderDue(shop, days) {
  showToast(`${shop.name} · ${days === 0 ? '오늘 만료' : 'D-' + days} 만료 임박`, 'danger');
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

// ── Actions ──────────────────────────────────────────────────────────────────
const actions = {
  async useCoupon(shopId, note) {
    const shop = store.getState().shops.find((s) => s.id === shopId);
    if (!shop) return;
    if (remainingCount(shop) <= 0) {
      showToast('남은 쿠폰이 없어요', 'danger');
      return;
    }
    let pos = null;
    try { pos = await getCurrentPosition(); } catch { /* location optional */ }
    const updated = { ...shop, usedCoupons: (shop.usedCoupons || 0) + 1 };
    await Shops.update(updated);
    await Logs.add({
      shopId,
      note: note || undefined,
      location: pos ? { lat: pos.lat, lng: pos.lng } : undefined
    });
    await refresh();
    const done = remainingCount(updated) <= 0;
    if (done) {
      haptic('heavy');
      celebrate();
      showReward({ shopName: shop.name, total: shop.totalCoupons });
    } else {
      haptic('medium');
      showToast('쿠폰이 사용되었어요!');
    }
    resyncServices();
  },

  async undoLastCoupon(shopId) {
    const ok = await showConfirm({
      title: '사용 기록 취소',
      message: '마지막 쿠폰 사용 기록을 취소하고 스탬프를 하나 되돌릴까요?',
      confirmLabel: '되돌리기'
    });
    if (!ok) return;
    const shop = store.getState().shops.find((s) => s.id === shopId);
    if (!shop) return;
    const logs = (store.getState().logs || [])
      .filter((l) => l.shopId === shopId)
      .sort((a, b) => b.usedAt - a.usedAt);
    if (!logs.length) return;
    await Shops.update({ ...shop, usedCoupons: Math.max(0, (shop.usedCoupons || 0) - 1) });
    await Logs.remove(logs[0].id);
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
