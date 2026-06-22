// views/detail.js — skinned header, quick actions, memo, progress, stamp board,
// use/edit/undo actions, usage timeline, ad.

import { h } from '../core/h.js';
import { stampBoard, timelineItem, adBanner } from '../ui/components.js';
import {
  couponStatus, remainingValue, progressPercent, formatExpiry,
  isAmountKind, passTotal, passUsed, totalLabel, usedLabel, remainingLabel
} from '../domain.js';
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
  const remaining = remainingValue(shop);
  const percent = progressPercent(shop);
  const status = couponStatus(shop);
  const amount = isAmountKind(shop);
  const depleted = remaining <= 0;

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
      stat(totalLabel(shop), amount ? '총 금액' : '총 횟수'),
      stat(usedLabel(shop), '사용'),
      stat(remainingLabel(shop), '남음')
    )
  ));

  const phoneEl = shop.phone
    ? h('a', { class: 'quick-action', attrs: { href: `tel:${shop.phone}` } }, '전화')
    : h('span', { class: 'quick-action disabled' }, '전화');
  const mapUrl = mapViewUrl(shop);
  const mapEl = mapUrl
    ? h('a', { class: 'quick-action', attrs: { href: mapUrl, target: '_blank', rel: 'noopener' } }, '지도')
    : h('span', { class: 'quick-action disabled' }, '지도');
  root.appendChild(h('div', { class: 'detail-meta-grid' },
    phoneEl,
    mapEl,
    h('div', { class: 'quick-action readonly' }, shop.expiresAt ? formatExpiry(shop.expiresAt) : '만료 없음')
  ));

  if (shop.memo) root.appendChild(h('div', { class: 'note-panel' }, shop.memo));

  root.appendChild(h('div', { class: 'progress-wrap' },
    h('div', { class: 'progress-meta' },
      h('span', null, `${percent}% 사용`),
      h('span', null, `${remainingLabel(shop)} 남음`)
    ),
    h('div', { class: 'progress-bar' },
      h('div', { class: `progress-fill${percent >= 100 ? ' success' : ''}`, style: { width: `${percent}%` } })
    ),
    h('div', { class: `reward-hint${depleted ? ' done' : ''}` },
      depleted ? '모두 사용했어요' : `${remainingLabel(shop)} 남아있어요`)
  ));

  if (shop.code) root.appendChild(buildCodePanel(shop.code));

  if (shop.photo) root.appendChild(buildPhotoPanel(shop.photo));

  if (amount) {
    // Amount pass: a prominent balance block reads better than a stamp board.
    root.appendChild(h('div', { class: 'pass-balance' },
      h('div', { class: 'sub' }, '남은 금액'),
      h('div', { class: 'amt' }, remainingLabel(shop)),
      h('div', { class: 'sub' }, `총 ${totalLabel(shop)} · 사용 ${usedLabel(shop)}`)
    ));
  } else if (passTotal(shop) <= 30) {
    root.appendChild(h('div', { class: 'stamp-head' },
      h('span', null, '이용 현황'),
      h('strong', null, `${usedLabel(shop)} `, h('em', null, `/ ${totalLabel(shop)}`))
    ));
    root.appendChild(stampBoard(passTotal(shop), passUsed(shop)));
  } else {
    root.appendChild(h('div', { class: 'stamp-head' },
      h('span', null, '이용 현황'),
      h('strong', null, `${usedLabel(shop)} `, h('em', null, `/ ${totalLabel(shop)}`))
    ));
  }

  root.appendChild(h('div', { class: 'detail-actions' },
    h('button', {
      class: 'btn btn-primary btn-block',
      attrs: { type: 'button', disabled: depleted ? '' : null },
      on: { click: () => actions.promptUse(shop) }
    }, '사용하기'),
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

// Real-coupon photo: tapping opens a larger view in a sheet.
function buildPhotoPanel(photo) {
  const img = h('img', {
    class: 'coupon-photo-img',
    attrs: { src: photo, alt: '실물 쿠폰 사진' }
  });
  img.addEventListener('click', () => {
    showSheet({
      title: '실물 쿠폰',
      body: h('img', { class: 'coupon-photo-full', attrs: { src: photo, alt: '실물 쿠폰 사진' } })
    });
  });
  return h('div', { class: 'coupon-photo' }, img);
}
