// views/detail.js — skinned header, quick actions (전화/지도/길찾기), memo,
// balance + progress, stamp board, use/edit/undo actions, usage timeline.

import { h, icon } from '../core/h.js';
import { stampBoard, timelineItem, progressBar } from '../ui/components.js';
import {
  couponStatus, remainingValue, progressPercent, formatExpiry,
  isAmountKind, isStampKind, passTotal, passUsed, totalLabel, usedLabel, remainingLabel, kindLabel
} from '../domain.js';
import { mapViewUrl, mapsDirectionsUrl, openShopMap, openShopDirections } from '../services/maps.js';
import { renderQR, renderBarcode, copyCode } from '../services/codes.js';
import { getCategoryIcon } from '../data/skins.js';
import { openExternal } from '../platform.js';
import { haptic } from '../services/fx.js';
import { showToast } from '../ui/toast.js';

export function render(ctx, params = {}) {
  const { store, router, actions } = ctx;
  const st = store.getState();
  const shop = (st.shops || []).find((s) => s.id === params.id);
  if (!shop) { router.navigate('home'); return h('div'); }

  const logs = (st.logs || []).filter((l) => l.shopId === shop.id).sort((a, b) => b.usedAt - a.usedAt);
  const remaining = remainingValue(shop);
  const percent = progressPercent(shop);
  const status = couponStatus(shop);
  const amount = isAmountKind(shop);
  const stamp = isStampKind(shop);
  const depleted = remaining <= 0;

  const stat = (value, label) => h('div', { class: 'stat' },
    h('div', { class: 'num' }, String(value)),
    h('div', { class: 'lbl' }, label)
  );

  const root = h('div');

  const metaParts = [shop.category, kindLabel(shop.kind), shop.expiresAt ? `만료 ${formatExpiry(shop.expiresAt)}` : '만료 없음'];
  root.appendChild(h('div', { class: 'detail-header', dataset: { skin: shop.skin || 'midnight' } },
    h('div', { class: 'hero' },
      h('div', { class: 'hero-top' },
        h('div', { class: 'card-icon', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'category-icon' }, getCategoryIcon(shop.category))),
        h('div', { class: `detail-status ${status.className}` }, status.label)
      ),
      h('h2', null, shop.name),
      h('div', { class: 'meta' }, metaParts.join(' · ')),
      shop.address ? h('div', { class: 'address' }, shop.address) : null
    ),
    h('div', { class: 'stats' },
      stat(totalLabel(shop), amount ? '총 금액' : stamp ? '도장 칸' : '총 횟수'),
      stat(usedLabel(shop), stamp ? '적립' : '사용'),
      stat(remainingLabel(shop), '남음')
    )
  ));

  // ── quick actions ──
  const quick = (label, iconName, enabled, onClick) => h('button', {
    class: `quick-action${enabled ? '' : ' disabled'}`,
    attrs: { type: 'button', disabled: enabled ? null : '', 'aria-label': label },
    on: enabled ? { click: onClick } : null
  }, icon(iconName, { size: 18 }), h('span', null, label));
  root.appendChild(h('div', { class: 'detail-meta-grid' },
    quick('전화', 'phone', !!shop.phone, () => openExternal(`tel:${String(shop.phone).replace(/[^\d+]/g, '')}`)),
    quick('지도', 'location', !!mapViewUrl(shop), () => openShopMap(shop)),
    quick('길찾기', 'navigation', !!mapsDirectionsUrl(shop), () => openShopDirections(shop))
  ));

  if (shop.memo) root.appendChild(h('div', { class: 'note-panel' }, shop.memo));

  // ── balance block ──
  const balanceTitle = amount ? '남은 금액' : stamp ? '보상까지' : '남은 횟수';
  const balanceMain = stamp
    ? (depleted ? '완성!' : `${remaining}개`)
    : remainingLabel(shop);
  root.appendChild(h('div', { class: 'pass-balance' },
    h('div', { class: 'pass-balance-head' },
      h('div', { class: 'sub' }, balanceTitle),
      h('div', { class: 'sub' }, `${percent}%`)
    ),
    h('div', { class: 'amt' }, balanceMain),
    progressBar(percent),
    h('div', { class: 'sub' }, stamp
      ? (depleted ? `도장 ${passTotal(shop)}개를 모두 모았어요 — 가게에서 보상을 받으세요` : `총 ${passTotal(shop)}칸 · 적립 ${passUsed(shop)}개`)
      : `총 ${totalLabel(shop)} · 사용 ${usedLabel(shop)}`)
  ));

  // Board: stamp cards always (that's the product), count passes when countable.
  if (stamp || (!amount && passTotal(shop) <= 30)) {
    root.appendChild(h('div', { class: 'stamp-panel' },
      h('div', { class: 'stamp-head' },
        h('span', null, stamp ? '도장판' : '이용 현황'),
        h('strong', null, `${passUsed(shop)} `, h('em', null, `/ ${passTotal(shop)}`))
      ),
      stampBoard(passTotal(shop), passUsed(shop), { reward: stamp })
    ));
  }

  if (shop.code) root.appendChild(buildCodePanel(shop.code));

  // ── actions ──
  root.appendChild(h('div', { class: 'detail-actions' },
    h('button', {
      class: 'btn btn-primary btn-block',
      attrs: { type: 'button', disabled: depleted ? '' : null },
      on: { click: () => actions.promptUse(shop) }
    }, icon(stamp ? 'check' : 'sparkle', { size: 18 }), stamp ? '도장 찍기' : '사용하기'),
    h('button', { class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: () => router.navigate('add', { id: shop.id }) } }, '편집'),
    h('button', {
      class: 'btn btn-secondary',
      attrs: { type: 'button', disabled: logs.length === 0 ? '' : null },
      on: { click: () => actions.undoLastCoupon(shop.id) }
    }, stamp ? '도장 취소' : '사용 취소')
  ));

  // Completed/depleted pass → offer re-registration carrying the setup but not usage/period.
  if (depleted) {
    root.appendChild(h('div', { class: 'detail-actions single' },
      h('button', {
        class: 'btn btn-primary btn-block',
        attrs: { type: 'button' },
        on: { click: () => router.navigate('add', { prefill: renewPrefill(shop) }) }
      }, stamp ? '새 도장판으로 다시 시작' : '다시 등록 (재구매)')
    ));
  }

  root.appendChild(h('div', { class: 'page-header compact' }, h('h2', null, stamp ? '적립 내역' : '사용 내역')));
  const timeline = h('div', { class: 'timeline' });
  if (logs.length === 0) {
    timeline.appendChild(h('div', { class: 'field-hint' }, stamp ? '아직 적립 내역이 없어요' : '아직 사용 내역이 없어요'));
  } else {
    logs.forEach((log) => timeline.appendChild(timelineItem(log, shop.name)));
  }
  root.appendChild(timeline);

  return root;
}

export function renewPrefill(shop) {
  return {
    name: shop.name,
    category: shop.category,
    code: shop.code || '',
    address: shop.address || '',
    phone: shop.phone || '',
    memo: shop.memo || '',
    lat: shop.lat ?? null,
    lng: shop.lng ?? null,
    skin: shop.skin || 'midnight',
    kind: shop.kind || 'count',
    totalCoupons: shop.totalCoupons,
    totalAmount: shop.totalAmount
  };
}

// Coupon code panel: scannable QR + Code128 barcode + copyable text. Each renderer
// degrades to null when its vendored library is unavailable; text + copy always show.
function buildCodePanel(code) {
  const qr = renderQR(code, { size: 180 });
  const barcode = renderBarcode(code);

  const media = h('div', { class: 'coupon-code-media' }, qr, barcode);

  const copyBtn = h('button', {
    class: 'btn btn-secondary', attrs: { type: 'button' },
    on: { click: async () => {
      const ok = await copyCode(code);
      haptic(ok ? 'light' : 'warning');
      showToast(ok ? '코드를 복사했어요' : '복사를 지원하지 않는 환경이에요', ok ? 'success' : 'danger');
    } }
  }, '코드 복사');

  return h('div', { class: 'coupon-code' },
    h('h3', null, '쿠폰/멤버십 코드'),
    (qr || barcode) ? media : null,
    h('div', { class: 'coupon-code-text' }, code),
    copyBtn
  );
}
