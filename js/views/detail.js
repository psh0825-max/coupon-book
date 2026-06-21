// views/detail.js — skinned header, quick actions, memo, progress, stamp board,
// use/edit/undo actions, usage timeline, ad.

import { h } from '../core/h.js';
import { stampBoard, timelineItem, adBanner } from '../ui/components.js';
import { couponStatus, remainingCount, progressPercent, formatExpiry } from '../domain.js';
import { mapViewUrl } from '../services/maps.js';
import { renderQR, renderBarcode, copyCode } from '../services/codes.js';
import { showSheet } from '../ui/overlay.js';
import { showToast } from '../ui/toast.js';

export function render(ctx, params = {}) {
  const { store, router, actions } = ctx;
  const st = store.getState();
  const shop = (st.shops || []).find((s) => s.id === params.id);
  if (!shop) { router.navigate('home'); return h('div'); }

  const logs = (st.logs || []).filter((l) => l.shopId === shop.id).sort((a, b) => b.usedAt - a.usedAt);
  const remaining = remainingCount(shop);
  const percent = progressPercent(shop);
  const status = couponStatus(shop);

  const stat = (value, label) => h('div', { class: 'stat' },
    h('div', { class: 'num' }, String(value)),
    h('div', { class: 'lbl' }, label)
  );

  const root = h('div');

  root.appendChild(h('div', { class: 'detail-header', dataset: { skin: shop.skin || 'midnight' } },
    h('div', { class: 'hero' },
      h('div', { class: `detail-status ${status.className}` }, status.label),
      h('h2', null, shop.name),
      h('div', { class: 'address' }, `${shop.address || '주소 없음'} · ${shop.category}`)
    ),
    h('div', { class: 'stats' },
      stat(shop.totalCoupons, '총 쿠폰'),
      stat(shop.usedCoupons || 0, '사용'),
      stat(remaining, '남음')
    )
  ));

  const phoneEl = shop.phone
    ? h('a', { class: 'quick-action', attrs: { href: `tel:${shop.phone}` } }, '전화')
    : h('span', { class: 'quick-action disabled' }, '전화');
  root.appendChild(h('div', { class: 'detail-meta-grid' },
    phoneEl,
    h('a', { class: 'quick-action', attrs: { href: mapViewUrl(shop), target: '_blank', rel: 'noopener' } }, '지도'),
    h('div', { class: 'quick-action readonly' }, shop.expiresAt ? formatExpiry(shop.expiresAt) : '만료 없음')
  ));

  if (shop.memo) root.appendChild(h('div', { class: 'note-panel' }, shop.memo));

  root.appendChild(h('div', { class: 'progress-wrap' },
    h('div', { class: 'progress-meta' },
      h('span', null, `${percent}% 사용`),
      h('span', null, `${remaining}개 남음`)
    ),
    h('div', { class: 'progress-bar' },
      h('div', { class: `progress-fill${percent >= 100 ? ' success' : ''}`, style: { width: `${percent}%` } })
    ),
    h('div', { class: `reward-hint${remaining <= 0 ? ' done' : ''}` },
      remaining <= 0 ? '완성! 사장님께 보여주세요 ✨' : `${remaining}개 더 모으면 완성 🎉`)
  ));

  if (shop.code) root.appendChild(buildCodePanel(shop.code));

  root.appendChild(h('div', { class: 'stamp-head' },
    h('span', null, '스탬프 적립 현황'),
    h('strong', null, `${shop.usedCoupons || 0} `, h('em', null, `/ ${shop.totalCoupons}`))
  ));
  root.appendChild(stampBoard(shop.totalCoupons, shop.usedCoupons || 0));

  const openUseSheet = () => {
    if (remaining <= 0) return;
    const memoInput = h('textarea', {
      class: 'memo-input', id: 'use-memo',
      attrs: { rows: '3', placeholder: '예: 60분 마사지' }
    });
    showSheet({
      title: '쿠폰 사용',
      body: h('div', null,
        h('p', { class: 'field-hint' }, '사용 내역에 남길 메모가 있다면 입력하세요.'),
        memoInput
      ),
      actions: [
        { id: 'cancel', label: '취소', className: 'btn-secondary' },
        { id: 'confirm', label: '사용하기', className: 'btn-primary', onClick: () => actions.useCoupon(shop.id, memoInput.value.trim()) }
      ]
    });
  };

  root.appendChild(h('div', { class: 'detail-actions' },
    h('button', {
      class: 'btn btn-primary btn-block',
      attrs: { type: 'button', disabled: remaining <= 0 ? '' : null },
      on: { click: openUseSheet }
    }, '쿠폰 사용하기'),
    h('button', { class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: () => router.navigate('add', { id: shop.id }) } }, '편집'),
    h('button', {
      class: 'btn btn-secondary',
      attrs: { type: 'button', disabled: logs.length === 0 ? '' : null },
      on: { click: () => actions.undoLastCoupon(shop.id) }
    }, '사용 취소')
  ));

  root.appendChild(h('div', { class: 'page-header', style: { 'margin-top': '24px' } }, h('h2', null, '사용 내역')));
  const timeline = h('div', { class: 'timeline' });
  if (logs.length === 0) {
    timeline.appendChild(h('div', { class: 'field-hint' }, '아직 사용 내역이 없어요'));
  } else {
    logs.forEach((log) => timeline.appendChild(timelineItem(log, shop.name)));
  }
  root.appendChild(timeline);

  root.appendChild(adBanner({ slotId: 'detail-ad' }));
  return root;
}

// Coupon code panel: scannable QR + Code128 barcode + copyable text. Each renderer
// degrades to null when its vendored library is unavailable; text + copy always show.
function buildCodePanel(code) {
  const qr = renderQR(code, { size: 180 });
  const barcode = renderBarcode(code);

  const media = h('div', { class: 'coupon-code-media' }, qr, barcode);

  const copyBtn = h('button', {
    class: 'btn btn-secondary', attrs: { type: 'button' },
    on: { click: async () => { await copyCode(code); showToast('코드를 복사했어요'); } }
  }, '코드 복사');

  return h('div', { class: 'coupon-code' },
    h('h3', null, '쿠폰 코드'),
    (qr || barcode) ? media : null,
    h('div', { class: 'coupon-code-text' }, code),
    copyBtn
  );
}
