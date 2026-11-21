import { t as tr } from '../core/i18n.js';
// views/home.js — landing page: hero, summary stats, ad, priority panel,
// nearby (if location on), horizontal shop rail, empty state.

import { h } from '../core/h.js';
import { shopCard, summaryCard, adBanner, nearbyCard, emptyState } from '../ui/components.js';
import { stats, priorityShop, usableShops, couponStatus, progressPercent, isArchived, isRewardReady, needsBackupNudge } from '../domain.js';
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
  const usable = usableShops(shops);
  const activeShops = shops.filter((shop) => !isArchived(shop));
  const archivedCount = shops.length - activeShops.length;

  const root = h('div');
  const hasShops = activeShops.length > 0;

  // The marketing hero earns its space only while the wallet is empty. Once there
  // are passes, that is what the user opened the app to see, so a compact head
  // takes over and the rail moves above the fold.
  const head = hasShops
    ? h('div', { class: 'home-head' },
        h('div', null,
          h('h1', null, tr("내 이용권")),
          h('p', null, !usable.length
            ? tr("잔액과 만료일을 한눈에 확인하세요.")
            : isRewardReady(usable[0])
              ? tr("{0} 도장판이 다 찼어요. 보상을 받으세요.", (usable[0].name))
              : tr("{0} 이용권을 가장 먼저 챙기세요.", (usable[0].name)))
        ),
        h('button', {
          class: 'btn btn-primary btn-sm',
          attrs: { type: 'button' },
          on: { click: () => router.navigate('add') }
        }, tr("추가"))
      )
    : h('div', { class: 'product-hero' },
        h('div', null,
          h('div', { class: 'eyebrow' }, 'MEMBERSHIP & PASS WALLET'),
          h('h1', null, tr("내 이용권을 한곳에서")),
          h('p', null, tr("가지고 있는 횟수권·금액권을 등록해 잔액과 만료일을 한눈에 관리해요."))
        ),
        h('button', {
          class: 'btn btn-primary',
          attrs: { type: 'button' },
          on: { click: () => router.navigate('add') }
        }, tr("이용권 추가"))
      );

  const summaryRow = hasShops
    ? h('div', { class: 'summary-row' },
        summaryCard(s.totalShops, tr("이용권"), 'var(--text-primary)'),
        summaryCard(tr("{0}회", (s.monthUses)), tr("이번 달 사용"), 'var(--accent)'),
        summaryCard(s.expiringCount, tr("만료 임박"), 'var(--warning)'),
        summaryCard(s.completedCount, tr("완료"), 'var(--success)')
      )
    : null;

  // Backup nudge: shown once data is worth protecting and no recent backup exists.
  const nudge = needsBackupNudge(shops, settings)
    ? h('div', { class: 'nudge-banner', attrs: { role: 'status' } },
        h('div', { class: 'nudge-text' },
          h('strong', null, settings.lastBackupAt ? tr("백업한 지 오래됐어요") : tr("아직 백업하지 않았어요")),
          h('p', null, tr("이용권 정보는 이 기기에만 저장돼요. 기기를 바꾸면 사라질 수 있어요."))
        ),
        h('div', { class: 'nudge-actions' },
          h('button', { class: 'btn btn-warning', attrs: { type: 'button' }, on: { click: () => actions.exportData() } }, tr("지금 백업")),
          h('button', { class: 'btn btn-ghost', attrs: { type: 'button', 'aria-label': tr("백업 안내 닫기") }, on: { click: () => actions.dismissBackupNudge() } }, tr("나중에"))
        )
      )
    : null;

  const ad = adBanner({ slotId: 'home-ad' });

  // An expired pass is not a recommendation, so the eyebrow states the reason it
  // is surfaced rather than always claiming it is the best one to use next.
  let priorityPanel = null;
  if (priority) {
    const status = couponStatus(priority);
    const percent = progressPercent(priority);
    const expired = status.key === 'expired';
    priorityPanel = h('button', {
      class: `priority-panel${expired ? ' is-expired' : ''}`,
      attrs: { type: 'button' },
      on: { click: () => router.navigate('detail', { id: priority.id }) }
    },
      h('div', null,
        h('div', { class: 'eyebrow' }, expired ? tr("확인이 필요해요") : 'NEXT BEST PASS'),
        h('strong', null, priority.name),
        h('span', null, tr("{0} · {1}% 진행", (status.label), (percent)))
      ),
      h('div', { class: 'priority-meter', attrs: { 'aria-hidden': 'true' } },
        h('span', { style: { height: `${Math.max(8, percent)}%` } })
      )
    );
  }

  const nearbyArea = h('div', { id: 'nearby-area' });

  const railHeader = hasShops
    ? h('div', { class: 'rail-header' },
        h('div', null, h('h2', null, tr("바로 쓸 수 있는 이용권")), h('p', null, tr("옆으로 넘기며 확인하세요"))),
        h('button', { class: 'rail-more', attrs: { type: 'button' }, on: { click: () => router.navigate('list') } }, tr("모두보기 ›"))
      )
    : null;

  let rail;
  if (!hasShops) {
    rail = h('div', { class: 'shop-rail is-empty' });
    rail.appendChild(emptyState({
      art: 'ticket',
      title: tr("등록된 이용권이 없어요"),
      desc: tr("+ 버튼을 눌러 첫 이용권을 등록해 보세요"),
      actions: [
        { label: tr("이용권 추가"), className: 'btn-primary', onClick: () => router.navigate('add') },
        { label: tr("샘플 보기"), className: 'btn-secondary', onClick: async () => {
          const added = await actions.seedDemo();
          showToast(added ? tr("{0}개 샘플 업체를 추가했어요", (added)) : tr("이미 샘플 업체가 있어요"));
        } }
      ].concat(archivedCount ? [{ label: tr("보관함 보기 ({0})", (archivedCount)), className: 'btn-secondary', onClick: () => {
        actions.setFilter({ status: 'archived' });
        router.navigate('list');
      } }] : [])
    }));
  } else {
    rail = h('div', { class: 'shop-rail' });
    if (!usable.length) {
      rail.classList.add('is-empty');
      rail.appendChild(emptyState({
        art: 'ticket',
        title: tr("바로 쓸 수 있는 이용권이 없어요"),
        desc: tr("만료되거나 다 쓴 이용권은 모두보기에서 확인하세요"),
        actions: [
          { label: tr("모두보기"), className: 'btn-secondary', onClick: () => router.navigate('list') }
        ]
      }));
    }
    usable.slice(0, 10).forEach((shop) => {
      rail.appendChild(shopCard(shop, {
        onOpen: () => router.navigate('detail', { id: shop.id }),
        // Amount passes need an entry sheet; count passes fast-path one session;
        // a collect board takes one stamp (or offers a new board when full).
        onQuickUse: (sh) => actions.quickUse(sh, { note: tr("홈에서 빠른 사용") })
      }));
    });
  }

  // Passes first, then the things that comment on them. On an empty wallet the
  // hero and the empty state lead instead.
  const order = hasShops
    ? [head, railHeader, rail, priorityPanel, nearbyArea, summaryRow, nudge, ad]
    : [head, rail, nearbyArea, ad];
  order.filter(Boolean).forEach((node) => root.appendChild(node));

  if (settings.notifyEnabled && activeShops.some(hasCoords)) {
    populateNearby(nearbyArea, activeShops, router);
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
      h('h2', null, tr("지금 근처")),
      h('p', null, tr("반경 500m 이내 가게"))
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
