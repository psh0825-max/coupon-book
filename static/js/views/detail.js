// views/detail.js — skinned header, quick actions, memo, progress, stamp board,
// use/edit/undo actions, usage timeline, ad.

import { h } from '../core/h.js';
import { stampBoard, timelineItem, adBanner } from '../ui/components.js';
import {
  couponStatus, remainingValue, progressPercent, formatExpiry,
  isArchived, isAmountKind, passTotal, passUsed, totalLabel, usedLabel, remainingLabel
} from '../domain.js';
import { mapViewUrl } from '../services/maps.js';
import { renderQR, renderBarcode, copyCode } from '../services/codes.js';
import { showToast } from '../ui/toast.js';
import { showConfirm, showPresenter } from '../ui/overlay.js';
import { startPresenting, stopPresenting, controlsBrightness } from '../services/presentation.js';

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
  const archived = isArchived(shop);

  const stat = (value, label) => {
    const text = String(value);
    const unit = text.endsWith('원') || text.endsWith('회') ? text.slice(-1) : null;
    const number = unit ? text.slice(0, -1) : text;
    return h('div', { class: 'stat' },
      h('div', { class: `num${number.length > 9 ? ' num--long' : ''}` },
        unit ? h('span', { class: 'num-val' }, number) : text,
        unit ? h('span', { class: 'num-unit' }, unit) : null
      ),
      h('div', { class: 'lbl' }, label)
    );
  };

  const root = h('div');

  if (archived) {
    const remove = h('button', {
      class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: async () => {
        const ok = await showConfirm({
          title: '이용권 삭제',
          message: '이 이용권과 연결된 사용 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.',
          confirmLabel: '삭제',
          danger: true
        });
        if (!ok || !await actions.deleteShop(shop.id)) return;
        showToast('삭제되었어요');
        router.navigate('home');
      } }
    }, '삭제');
    root.appendChild(h('div', { class: 'archive-banner', attrs: { role: 'status' } },
      h('p', null, '보관된 이용권이에요 · 사용 내역은 그대로 남아 있어요'),
      h('div', { class: 'archive-banner-actions' },
        h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => actions.unarchiveShop(shop.id) } }, '꺼내기'),
        remove
      )
    ));
  }

  root.appendChild(h('div', { class: 'detail-header', dataset: { skin: shop.skin || 'midnight' } },
    h('div', { class: 'hero' },
      h('div', { class: `detail-status ${status.className}` }, status.label),
      h('h2', null, shop.name),
      shop.benefit ? h('div', { class: 'benefit-line' }, shop.benefit) : null,
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
    depleted ? h('div', { class: 'reward-hint done' }, '모두 사용했어요') : null
  ));

  if (shop.image) root.appendChild(buildGifticonPanel(shop.image, shop.name));
  if (shop.code) root.appendChild(buildCodePanel(shop.code));

  // The header's 총/사용/남음 stats already carry every number on this screen, so
  // neither the balance block nor the board header restates them.
  if (!amount) {
    root.appendChild(h('div', { class: 'stamp-head' }, h('span', null, '이용 현황')));
    // Depleting ticket board only when small/countable; large passes show just the block.
    if (passTotal(shop) <= 30) root.appendChild(stampBoard(passTotal(shop), passUsed(shop)));
  }

  if (!archived) root.appendChild(h('div', { class: 'detail-actions' },
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

  if (!archived && !depleted) root.querySelector('.detail-actions').appendChild(h('button', {
    class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: () => actions.archiveShop(shop.id) }
  }, '보관하기'));

  // A depleted pass has exactly two sensible ends, and which one leads depends on
  // what it is: a punch card gets re-bought at the same shop, a spent gifticon is
  // rubbish. An attached image is the marker — you attach one *because* the item is
  // a gifticon — so it decides the order. Until now only 재구매 was offered and
  // deleting meant 편집 → scroll to the bottom → 이용권 삭제 → 확인.
  if (!archived && depleted) {
    const isGifticon = !!shop.image;
    const discard = h('button', {
      class: `btn ${isGifticon ? 'btn-primary' : 'btn-secondary'} btn-block`,
      attrs: { type: 'button' },
      on: { click: async () => {
        const ok = await showConfirm({
          title: isGifticon ? '기프티콘 삭제' : '이용권 삭제',
          message: isGifticon
            ? '다 쓴 기프티콘과 첨부한 이미지를 삭제할까요? 이 작업은 되돌릴 수 없어요.'
            : '이 이용권과 연결된 사용 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.',
          confirmLabel: '삭제',
          danger: true
        });
        if (!ok) return;
        if (!await actions.deleteShop(shop.id)) return;
        showToast('삭제되었어요');
        router.navigate('home');
      } }
    }, isGifticon ? '삭제' : '이용권 삭제');

    const reRegister = h('button', {
        class: `btn ${isGifticon ? 'btn-secondary' : 'btn-primary'} btn-block`,
        attrs: { type: 'button' },
        on: { click: () => router.navigate('add', { prefill: {
          name: shop.name,
          category: shop.category,
          code: shop.code || '',
          address: shop.address || '',
          phone: shop.phone || '',
          lat: shop.lat ?? null,
          lng: shop.lng ?? null,
          skin: shop.skin || 'midnight',
          kind: shop.kind || 'count',
          totalCoupons: shop.totalCoupons,
          totalAmount: shop.totalAmount
        } }) }
      }, '다시 등록 (재구매)');

    const archive = h('button', {
      class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: () => actions.archiveShop(shop.id) }
    }, '보관하기');
    root.appendChild(h('div', { class: 'detail-actions depleted-actions' },
      ...(isGifticon ? [discard, reRegister, archive] : [reRegister, discard, archive])));
  }

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
// The point of storing a gifticon is showing it at the counter, so the panel is a
// tap target that opens the image full-screen — a thumbnail is never scannable.
function buildGifticonPanel(image, name) {
  const thumb = h('img', { class: 'gifticon-thumb', attrs: { src: image, alt: `${name} 기프티콘` } });
  const open = h('button', {
    class: 'gifticon-open',
    attrs: { type: 'button', 'aria-label': '기프티콘 크게 보기' },
    on: { click: () => openGifticonViewer(image, name) }
  }, thumb, h('span', { class: 'gifticon-open-hint' }, '탭하면 크게 볼 수 있어요'));

  return h('div', { class: 'gifticon-panel' }, h('h3', null, '기프티콘'), open);
}

// Full-screen, dark, focus-trapped viewer. Escape and the close button both exit;
// the backdrop is deliberately not a dismiss target so a mis-tap while the
// cashier scans does not close it.
function openGifticonViewer(image, name) {
  const viewer = h('div', { class: 'gifticon-viewer' },
    h('img', { attrs: { src: image, alt: `${name} 기프티콘` } }),
    !controlsBrightness() ? h('p', { class: 'gifticon-viewer-hint' }, '화면 밝기를 최대로 올리면 더 잘 읽혀요') : null
  );
  showPresenter({ label: `${name} 기프티콘`, body: viewer, onOpen: startPresenting, onClose: stopPresenting });
}

function buildCodePanel(code) {
  const qr = renderQR(code, { size: 180 });
  const barcode = renderBarcode(code);

  const media = h('div', { class: 'coupon-code-media' }, qr, barcode);

  const copyBtn = h('button', {
    class: 'btn btn-secondary', attrs: { type: 'button' },
    on: { click: async () => { await copyCode(code); showToast('코드를 복사했어요'); } }
  }, '코드 복사');
  const presentBtn = h('button', {
    class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => openCodePresenter(code) }
  }, '크게 보기');

  return h('div', { class: 'coupon-code' },
    h('h3', null, '쿠폰/멤버십 코드'),
    (qr || barcode) ? media : null,
    h('div', { class: 'coupon-code-text' }, code),
    h('div', { class: 'coupon-code-actions' }, presentBtn, copyBtn)
  );
}

function openCodePresenter(code) {
  const qr = renderQR(code, { size: 260 });
  const barcode = renderBarcode(code);
  const body = h('div', { class: 'code-presenter' },
    h('h2', null, '쿠폰/멤버십 코드'),
    h('div', { class: 'code-presenter-media' }, qr, barcode),
    h('div', { class: 'code-presenter-text' }, code),
    !controlsBrightness() ? h('p', { class: 'presenter-hint' }, '화면 밝기를 최대로 올리면 더 잘 읽혀요') : null
  );
  showPresenter({ label: '쿠폰 코드 크게 보기', body, onOpen: startPresenting, onClose: stopPresenting });
}
