// views/home.js — landing page: hero, summary stats, ad, priority panel,
// nearby (if location on), horizontal shop rail, empty state.

import { h } from '../core/h.js';
import { shopCard, summaryCard, adBanner, nearbyCard, emptyState } from '../ui/components.js';
import { stats, priorityShop, sortShops, couponStatus, progressPercent } from '../domain.js';
import { getCurrentPosition, haversine } from '../services/location.js';
import { showToast } from '../ui/toast.js';

// A shop is plottable only when both coords are present (not null/'') AND finite.
// Number(null) and Number('') are 0 (finite), so the null/'' checks must come
// first — otherwise no-coordinate shops would count as nearby. A genuine 0 passes.
const hasCoords = (s) =>
  s.lat != null && s.lng != null && s.lat !== '' && s.lng !== '' &&
  Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng));

export function render(ctx) {
  const { store, router, actions } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const logs = st.logs || [];
  const settings = st.settings || {};
  const s = stats(shops, logs);
  const priority = priorityShop(shops);

  const root = h('div');

  root.appendChild(h('div', { class: 'product-hero' },
    h('div', null,
      h('div', { class: 'eyebrow' }, 'LOCAL COUPON WALLET'),
      h('h1', null, '내 쿠폰을 한곳에서'),
      h('p', null, priority
        ? `${priority.name} 쿠폰이 가장 먼저 챙길 대상이에요.`
        : '가지고 있는 도장판·쿠폰을 등록해 진행률과 만료일을 한눈에 관리해요.')
    ),
    h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => router.navigate('add') } }, '내 쿠폰 추가')
  ));

  root.appendChild(h('div', { class: 'summary-row' },
    summaryCard(s.totalShops, '업체', 'var(--text-primary)'),
    summaryCard(`${s.completionRate}%`, '진행률', 'var(--accent)'),
    summaryCard(s.expiringCount, '만료 임박', 'var(--warning)'),
    summaryCard(s.completedCount, '완성', 'var(--success)')
  ));

  root.appendChild(adBanner({ slotId: 'home-ad' }));

  if (priority) {
    const status = couponStatus(priority);
    const percent = progressPercent(priority);
    root.appendChild(h('button', {
      class: 'priority-panel',
      attrs: { type: 'button' },
      on: { click: () => router.navigate('detail', { id: priority.id }) }
    },
      h('div', null,
        h('div', { class: 'eyebrow' }, 'NEXT BEST COUPON'),
        h('strong', null, priority.name),
        h('span', null, `${status.label} · ${percent}% 진행`)
      ),
      h('div', { class: 'priority-meter', attrs: { 'aria-hidden': 'true' } },
        h('span', { style: { height: `${Math.max(8, percent)}%` } })
      )
    ));
  }

  const nearbyArea = h('div', { id: 'nearby-area' });
  root.appendChild(nearbyArea);

  root.appendChild(h('div', { class: 'rail-header' },
    h('div', null, h('h2', null, '내 쿠폰'), h('p', null, '옆으로 넘기며 확인하세요')),
    h('button', { class: 'rail-more', attrs: { type: 'button' }, on: { click: () => router.navigate('list') } }, '모두보기 ›')
  ));

  if (shops.length === 0) {
    const rail = h('div', { class: 'shop-rail is-empty' });
    rail.appendChild(emptyState({
      icon: 'store',
      title: '등록된 쿠폰이 없어요',
      desc: '+ 버튼을 눌러 첫 쿠폰을 등록해 보세요',
      actions: [
        { label: '내 쿠폰 추가', className: 'btn-primary', onClick: () => router.navigate('add') },
        { label: '샘플 보기', className: 'btn-secondary', onClick: async () => {
          const added = await actions.seedDemo();
          showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
        } }
      ]
    }));
    root.appendChild(rail);
  } else {
    const rail = h('div', { class: 'shop-rail' });
    sortShops(shops, 'smart').slice(0, 10).forEach((shop) => {
      rail.appendChild(shopCard(shop, {
        onOpen: () => router.navigate('detail', { id: shop.id }),
        onQuickUse: () => actions.useCoupon(shop.id, '홈에서 빠른 사용')
      }));
    });
    root.appendChild(rail);
  }

  if (settings.notifyEnabled && shops.some(hasCoords)) {
    populateNearby(nearbyArea, shops, router);
  }

  return root;
}

// Populate the nearby container asynchronously (non-blocking) once we have a fix.
async function populateNearby(area, shops, router) {
  try {
    const pos = await getCurrentPosition();
    const nearby = shops.map((sh) => {
      if (!hasCoords(sh)) return null;
      const d = haversine(pos.lat, pos.lng, Number(sh.lat), Number(sh.lng));
      return d <= 500 ? { shop: sh, distance: d } : null;
    }).filter(Boolean).sort((a, b) => a.distance - b.distance);

    if (!nearby.length || !area.isConnected) return;
    area.appendChild(h('div', { class: 'page-header', style: { 'margin-top': '4px' } },
      h('h2', null, '지금 근처'),
      h('p', null, '반경 500m 이내 가게')
    ));
    const list = h('div', { id: 'nearby-list' });
    nearby.forEach(({ shop, distance }) => {
      list.appendChild(nearbyCard(shop, distance, () => router.navigate('detail', { id: shop.id })));
    });
    area.appendChild(list);
  } catch (e) {
    // ignore location errors on home
  }
}
