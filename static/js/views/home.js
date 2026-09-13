// views/home.js — landing page: hero, summary stats, priority panel, nearby
// (if location alerts are on), horizontal shop rail, empty state.

import { h, icon } from '../core/h.js';
import { shopCard, summaryCard, nearbyCard, emptyState, sectionHeader } from '../ui/components.js';
import { stats, priorityShop, sortShops, couponStatus, progressPercent, isAmountKind, needsBackupNudge, remainingLabel, isStampKind } from '../domain.js';
import { getCurrentPosition, haversine, hasPermission } from '../services/location.js';
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

  const heroCopy = priority
    ? `${priority.name} · ${couponStatus(priority).label} — 먼저 챙겨보세요.`
    : '카페 도장판, 마사지 회수권, 금액권을 등록하면 잔액과 만료일을 한눈에 볼 수 있어요.';

  root.appendChild(h('div', { class: 'product-hero' },
    h('div', { class: 'hero-text' },
      h('div', { class: 'eyebrow' }, '내 쿠폰 지갑'),
      h('h1', null, shops.length ? '오늘도 알뜰하게' : '내 쿠폰을 한곳에'),
      h('p', null, heroCopy)
    ),
    h('button', {
      class: 'btn btn-primary hero-cta', attrs: { type: 'button' },
      on: { click: () => router.navigate('add') }
    }, icon('plus', { size: 18 }), shops.length ? '이용권 추가' : '첫 쿠폰 등록')
  ));

  root.appendChild(h('div', { class: 'summary-row', attrs: { role: 'list', 'aria-label': '요약' } },
    summaryCard(s.totalShops, '업체'),
    summaryCard(`${s.completionRate}%`, '사용률', 'accent'),
    summaryCard(s.expiringCount, '만료 임박', s.expiringCount ? 'warning' : ''),
    summaryCard(s.completedCount, '완료', 'success')
  ));

  // Backup nudge: shown once data is worth protecting and no recent backup exists.
  if (needsBackupNudge(shops, settings)) {
    root.appendChild(h('div', { class: 'nudge-banner', attrs: { role: 'status' } },
      h('div', { class: 'nudge-text' },
        h('strong', null, '백업한 지 오래됐어요'),
        h('p', null, '쿠폰은 이 기기에만 저장돼요. 파일로 백업해 두면 기기를 바꿔도 안전해요.')
      ),
      h('div', { class: 'nudge-actions' },
        h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => actions.exportData() } }, '지금 백업'),
        h('button', { class: 'btn btn-ghost', attrs: { type: 'button', 'aria-label': '백업 안내 닫기' }, on: { click: () => actions.dismissBackupNudge() } }, '나중에')
      )
    ));
  }

  if (priority) {
    const status = couponStatus(priority);
    const percent = progressPercent(priority);
    root.appendChild(h('button', {
      class: 'priority-panel',
      attrs: { type: 'button', 'aria-label': `${priority.name} 상세 보기` },
      on: { click: () => router.navigate('detail', { id: priority.id }) }
    },
      h('div', { class: 'priority-text' },
        h('div', { class: 'eyebrow' }, '먼저 챙길 이용권'),
        h('strong', null, priority.name),
        h('span', null, `${status.label} · ${remainingLabel(priority)} 남음 · ${percent}%`)
      ),
      h('div', { class: 'priority-meter', attrs: { 'aria-hidden': 'true' } },
        h('span', { style: { height: `${Math.max(8, percent)}%` } })
      ),
      icon('chevron-right', { size: 20, class: 'priority-chevron' })
    ));
  }

  const nearbyArea = h('div', { id: 'nearby-area' });
  root.appendChild(nearbyArea);

  root.appendChild(sectionHeader('내 이용권', shops.length ? '옆으로 넘기며 확인하세요' : null,
    shops.length ? { label: '모두보기', onClick: () => router.navigate('list') } : null));

  if (shops.length === 0) {
    const rail = h('div', { class: 'shop-rail is-empty' });
    rail.appendChild(emptyState({
      art: 'ticket',
      title: '아직 등록된 쿠폰이 없어요',
      desc: '지갑 속 도장판과 이용권을 옮겨 담아 보세요. 30초면 충분해요.',
      actions: [
        { label: '첫 쿠폰 등록', className: 'btn-primary', onClick: () => router.navigate('add') },
        { label: '샘플로 둘러보기', className: 'btn-secondary', onClick: async () => {
          const added = await actions.seedDemo();
          showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
        } }
      ]
    }));
    root.appendChild(rail);
  } else {
    const rail = h('div', { class: 'shop-rail', attrs: { role: 'list' } });
    sortShops(shops, 'smart').slice(0, 10).forEach((shop) => {
      rail.appendChild(shopCard(shop, {
        onOpen: () => router.navigate('detail', { id: shop.id }),
        // Amount passes need an entry sheet; stamp/count passes fast-path one unit.
        onQuickUse: (sh) => isAmountKind(sh)
          ? actions.promptUse(sh)
          : actions.usePass(sh.id, { count: 1, note: isStampKind(sh) ? '홈에서 도장 적립' : '홈에서 빠른 사용' })
      }));
    });
    root.appendChild(rail);
  }

  if (settings.notifyEnabled && shops.some(hasCoords)) {
    populateNearby(nearbyArea, shops, router);
  }

  return root;
}

// Populate the nearby container asynchronously (non-blocking) once we have a
// fix. Never triggers the OS permission prompt from the home screen.
async function populateNearby(area, shops, router) {
  try {
    if (!(await hasPermission())) return;
    const pos = await getCurrentPosition();
    const nearby = shops.map((sh) => {
      if (!hasCoords(sh)) return null;
      const d = haversine(pos.lat, pos.lng, Number(sh.lat), Number(sh.lng));
      return d <= 500 ? { shop: sh, distance: d } : null;
    }).filter(Boolean).sort((a, b) => a.distance - b.distance);

    if (!nearby.length || !area.isConnected) return;
    area.appendChild(sectionHeader('지금 근처', '반경 500m 이내 가게'));
    const list = h('div', { id: 'nearby-list', class: 'nearby-list' });
    nearby.forEach(({ shop, distance }) => {
      list.appendChild(nearbyCard(shop, distance, () => router.navigate('detail', { id: shop.id })));
    });
    area.appendChild(list);
  } catch (e) {
    // ignore location errors on home
  }
}
