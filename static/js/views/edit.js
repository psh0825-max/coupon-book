// views/edit.js — add/edit shop form with live stamp preview, set-current-location,
// skin selector, and delete (edit mode). All inputs have associated labels.

import { h, clear } from '../core/h.js';
import { stampBoard, skinSelector } from '../ui/components.js';
import { getCurrentPosition } from '../services/location.js';
import { CATEGORIES, getDefaultSkin } from '../data/skins.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/overlay.js';
import { formatWon, formatDistance, groupDigits, parseNumber } from '../services/format.js';
import { isConfigured as placesConfigured, searchPlaces } from '../services/places.js';
import { readGifticon, detectCode, supportsBarcodeScan } from '../services/gifticon.js';

export function render(ctx, params = {}) {
  const { store, router, actions } = ctx;
  const st = store.getState();
  const isEdit = !!params.id;
  const shop = isEdit ? (st.shops || []).find((s) => s.id === params.id) : null;
  if (isEdit && !shop) {
    showToast('이용권을 찾을 수 없어요', 'danger');
    router.navigate('home');
    return h('div');
  }
  // Initial field values come from the shop (edit) or a renew prefill (new). A
  // prefill carries the pass setup but NOT usage/period — those reset to empty.
  const src = isEdit ? shop : (params.prefill || null);
  const hasInit = !!src;

  const field = (labelText, forId, ...controls) => h('div', { class: 'form-group' },
    h('label', { attrs: { for: forId } }, labelText),
    ...controls
  );

  const root = h('div');

  // Quick-start templates: prefill the common pass shapes so a first entry takes
  // seconds. Pristine add form only — hidden once a template/renew prefill is set.
  if (!isEdit && !params.prefill) {
    const TEMPLATES = [
      { label: '☕ 카페 도장판 10칸', prefill: { category: '카페', kind: 'count', totalCoupons: 10 } },
      { label: '💆 마사지 10회권', prefill: { category: '마사지', kind: 'count', totalCoupons: 10 } },
      { label: '🧘 찜질방 회수권', prefill: { category: '찜질방', kind: 'count', totalCoupons: 10 } },
      { label: '💳 금액권 10만원', prefill: { category: '기타', kind: 'amount', totalAmount: 100000 } },
      // The app is named 쿠폰북 but had no one-tap path to a coupon: you had to pick
      // 횟수권 and change the count to 1 every time.
      { label: '🎟️ 모바일 쿠폰 · 기프티콘', prefill: { category: '기타', kind: 'coupon', totalCoupons: 1 } }
    ];
    root.appendChild(h('div', { class: 'form-group' },
      h('label', null, '빠른 시작'),
      h('div', { class: 'use-chips', attrs: { role: 'group', 'aria-label': '빠른 시작 템플릿' } },
        TEMPLATES.map((t) => h('button', {
          class: 'chip', attrs: { type: 'button' },
          on: { click: () => router.navigate('add', { prefill: t.prefill }) }
        }, t.label))
      )
    ));
  }

  const form = h('form', { id: 'shop-form' });
  root.appendChild(form);

  // ── 매장 검색 (Kakao keyword search → auto-fill). Only when configured;
  // manual entry always works even if search is unavailable. ──
  if (placesConfigured()) {
    const searchInput = h('input', { id: 'f-place-search', attrs: { type: 'search', name: 'placeSearch', autocomplete: 'off', placeholder: '예: 마사지, 스타벅스 — 내 주변 검색' } });
    const results = h('div', { class: 'place-results', hidden: true });

    const showMessage = (cls, text) => {
      clear(results);
      results.appendChild(h('p', { class: cls }, text));
      results.hidden = false;
    };
    const hideResults = () => { clear(results); results.hidden = true; };

    const renderResults = (places) => {
      clear(results);
      if (!places.length) { showMessage('place-empty', '검색 결과가 없어요'); return; }
      for (const p of places) {
        const top = h('div', null,
          h('span', { class: 'pname' }, p.name),
          p.category ? h('span', { class: 'pcat' }, p.category) : null
        );
        const where = p.road || p.address;
        const meta = [];
        if (p.phone) meta.push(h('span', null, p.phone));
        if (p.phone && p.distance != null) meta.push(' · ');
        if (p.distance != null) meta.push(h('span', { class: 'pdist' }, formatDistance(p.distance)));
        const row = h('button', { class: 'place-row', attrs: { type: 'button' } },
          top,
          where ? h('div', { class: 'pmeta' }, where) : null,
          meta.length ? h('div', { class: 'pmeta' }, ...meta) : null
        );
        row.addEventListener('click', () => {
          nameInput.value = p.name;
          addressInput.value = p.road || p.address;
          phoneInput.value = p.phone;
          if (Number.isFinite(p.lat)) latInput.value = p.lat.toFixed(6);
          if (Number.isFinite(p.lng)) lngInput.value = p.lng.toFixed(6);
          hideResults();
          searchInput.value = '';
          showToast('매장 정보를 불러왔어요');
        });
        results.appendChild(row);
      }
      results.hidden = false;
    };

    let latestQuery = '';
    let debounceTimer = null;
    const runSearch = async (query) => {
      showMessage('place-empty', '검색 중…');
      let pos;
      try { pos = await getCurrentPosition(); } catch (e) { pos = undefined; }
      try {
        const places = await searchPlaces(query, pos || {});
        if (query !== latestQuery) return; // out-of-order guard
        renderResults(places);
      } catch (e) {
        if (query !== latestQuery) return;
        showMessage('place-empty', '검색을 사용할 수 없어요 (네트워크/도메인 확인)');
      }
    };
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      latestQuery = query;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (query.length < 2) { hideResults(); return; }
      debounceTimer = setTimeout(() => runSearch(query), 400);
    });

    form.appendChild(h('div', { class: 'form-group place-search' },
      h('label', { attrs: { for: 'f-place-search' } }, '매장 검색'),
      searchInput,
      h('p', { class: 'place-hint' }, '이름으로 검색하면 주소·전화·위치를 자동으로 채워요. (내 위치 기준 가까운 순)'),
      results
    ));
  }

  // name
  const nameInput = h('input', { id: 'f-name', attrs: { type: 'text', name: 'name', required: '', placeholder: '예: 안양 스타 마사지', value: hasInit ? (src.name || '') : '' } });
  form.appendChild(field('매장 이름', 'f-name', nameInput));

  // category (shared across kinds)
  const catSelect = h('select', { id: 'f-category', attrs: { name: 'category' } },
    Object.keys(CATEGORIES).map((c) => h('option', {
      attrs: { value: c, selected: hasInit && src.category === c ? '' : null }
    }, c))
  );
  form.appendChild(field('카테고리', 'f-category', catSelect));

  // ── pass kind: 횟수권 (count) vs 금액권 (amount) ──
  let kind = src && (src.kind === 'amount' || src.kind === 'coupon') ? src.kind : 'count';
  const segCount = h('button', { class: kind === 'count' ? 'active' : '', attrs: { type: 'button', 'aria-pressed': kind === 'count' ? 'true' : 'false' } }, '횟수권');
  const segAmount = h('button', { class: kind === 'amount' ? 'active' : '', attrs: { type: 'button', 'aria-pressed': kind === 'amount' ? 'true' : 'false' } }, '금액권');
  const segCoupon = h('button', { class: kind === 'coupon' ? 'active' : '', attrs: { type: 'button', 'aria-pressed': kind === 'coupon' ? 'true' : 'false' } }, '쿠폰');
  const seg = h('div', { class: 'seg', attrs: { role: 'group', 'aria-label': '이용권 종류' } }, segCount, segAmount, segCoupon);
  form.appendChild(h('div', { class: 'form-group' },
    h('label', null, '이용권 종류'),
    seg
  ));

  // ── COUNT fields: 총 횟수 + 현재 사용 횟수 + live stamp preview ──
  const totalInput = h('input', { id: 'f-total', attrs: { type: 'number', name: 'totalCoupons', min: '1', max: '1000', value: hasInit && src.totalCoupons != null ? String(src.totalCoupons) : '10' } });
  const usedInput = h('input', { id: 'f-used', attrs: { type: 'number', name: 'usedCoupons', min: '0', max: '1000', value: isEdit ? String(shop.usedCoupons || 0) : '0' } });
  const counter = h('span', { class: 'stamp-counter', id: 'f-stamp-counter' }, '0 / 10');
  const previewBoard = h('div', { class: 'stamp-board stamp-preview', id: 'f-stamp-preview' });
  const countGroup = h('div', { id: 'count-fields' },
    field('총 횟수(회)', 'f-total', totalInput),
    h('div', { class: 'form-group' },
      h('div', { class: 'stamp-preview-head' },
        h('label', { attrs: { for: 'f-used' }, style: { margin: '0' } }, '현재 사용 횟수'),
        counter
      ),
      usedInput,
      h('p', { class: 'field-hint' }, '이미 사용한 횟수가 있다면 현재 사용 횟수를 입력하세요.'),
      previewBoard
    )
  );
  form.appendChild(countGroup);

  // ── AMOUNT fields: 총 금액 + 현재 사용 금액 + live 남은 금액 preview ──
  const totalAmountInput = h('input', { id: 'f-total-amount', attrs: { type: 'text', name: 'totalAmount', inputmode: 'numeric', placeholder: '예: 1,000,000', value: hasInit && src.totalAmount ? groupDigits(src.totalAmount) : '' } });
  const usedAmountInput = h('input', { id: 'f-used-amount', attrs: { type: 'text', name: 'usedAmount', inputmode: 'numeric', value: isEdit ? groupDigits(shop.usedAmount || 0) : '0' } });
  const amountPreview = h('p', { class: 'amount-preview', id: 'f-amount-preview' }, '남은 금액: 0원');
  const amountGroup = h('div', { id: 'amount-fields' },
    field('총 금액(원)', 'f-total-amount', totalAmountInput),
    field('현재 사용 금액(원)', 'f-used-amount', usedAmountInput),
    amountPreview
  );
  form.appendChild(amountGroup);

  // ── COUPON fields: 혜택 문구 + 매수 ──
  // A discount coupon's value is a stated benefit, not a balance, so the number
  // that matters is how many of them you hold.
  const benefitInput = h('input', {
    id: 'f-benefit',
    attrs: { type: 'text', name: 'benefit', maxlength: '60',
             placeholder: '예: 10% 할인, 아메리카노 1잔, 3,000원 할인',
             value: hasInit ? (src.benefit || '') : '' }
  });
  const couponTotalInput = h('input', {
    id: 'f-coupon-total',
    attrs: { type: 'number', name: 'couponTotal', min: '1', max: '100',
             value: hasInit && src.totalCoupons != null ? String(src.totalCoupons) : '1' }
  });
  const couponGroup = h('div', { id: 'coupon-fields' },
    h('div', { class: 'form-group' },
      h('label', { attrs: { for: 'f-benefit' } }, '혜택'),
      benefitInput,
      h('p', { class: 'field-hint' }, '쿠폰을 쓰면 무엇을 받는지 적어 두세요. 목록과 상세에 그대로 표시돼요.')
    ),
    field('매수', 'f-coupon-total', couponTotalInput)
  );
  form.appendChild(couponGroup);

  function renderPreview() {
    const total = Math.max(1, Math.min(1000, parseInt(totalInput.value) || 0));
    const used = Math.max(0, Math.min(parseInt(usedInput.value) || 0, total));
    counter.textContent = `${used} / ${total}`;
    clear(previewBoard);
    previewBoard.appendChild(stampBoard(total, used));
  }
  totalInput.addEventListener('input', renderPreview);
  usedInput.addEventListener('input', renderPreview);

  function renderAmountPreview() {
    const total = parseNumber(totalAmountInput.value);
    const used = Math.min(parseNumber(usedAmountInput.value), total);
    amountPreview.textContent = `남은 금액: ${formatWon(total - used)}`;
  }
  // Reformat with thousands separators live; caret stays at end (acceptable for numeric entry).
  const liveGroup = (input) => {
    input.value = groupDigits(input.value);
    renderAmountPreview();
  };
  totalAmountInput.addEventListener('input', () => liveGroup(totalAmountInput));
  usedAmountInput.addEventListener('input', () => liveGroup(usedAmountInput));

  function applyKind() {
    [[segCount, 'count'], [segAmount, 'amount'], [segCoupon, 'coupon']].forEach(([el, k]) => {
      el.classList.toggle('active', kind === k);
      el.setAttribute('aria-pressed', kind === k ? 'true' : 'false');
    });
    countGroup.hidden = kind !== 'count';
    amountGroup.hidden = kind !== 'amount';
    couponGroup.hidden = kind !== 'coupon';
    if (kind === 'count') renderPreview();
    else if (kind === 'amount') renderAmountPreview();
  }
  segCount.addEventListener('click', () => { kind = 'count'; applyKind(); });
  segAmount.addEventListener('click', () => { kind = 'amount'; applyKind(); });
  segCoupon.addEventListener('click', () => { kind = 'coupon'; applyKind(); });

  // address
  const addressInput = h('input', { id: 'f-address', attrs: { type: 'text', name: 'address', placeholder: '주소를 입력하세요', value: hasInit ? (src.address || '') : '' } });
  form.appendChild(field('주소', 'f-address', addressInput));

  // phone + expiry
  const phoneInput = h('input', { id: 'f-phone', attrs: { type: 'tel', name: 'phone', placeholder: '예: 031-000-0000', value: hasInit ? (src.phone || '') : '' } });
  const expiresInput = h('input', { id: 'f-expires', attrs: { type: 'date', name: 'expiresAt', value: isEdit ? (shop.expiresAt || '') : '' } });
  form.appendChild(h('div', { class: 'form-row' },
    field('전화번호', 'f-phone', phoneInput),
    field('만료일', 'f-expires', expiresInput)
  ));

  // location
  const latInput = h('input', { id: 'f-lat', attrs: { type: 'text', name: 'lat', placeholder: '위도', readonly: '', 'aria-label': '위도', value: hasInit && src.lat != null ? String(src.lat) : '' } });
  const lngInput = h('input', { id: 'f-lng', attrs: { type: 'text', name: 'lng', placeholder: '경도', readonly: '', 'aria-label': '경도', value: hasInit && src.lng != null ? String(src.lng) : '' } });
  const locBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' }, style: { 'margin-top': '8px' } }, '현재 위치로 설정');
  locBtn.addEventListener('click', async () => {
    try {
      const pos = await getCurrentPosition();
      latInput.value = pos.lat.toFixed(6);
      lngInput.value = pos.lng.toFixed(6);
      showToast('현재 위치가 설정되었어요');
    } catch (e) {
      showToast('위치 정보를 가져올 수 없어요', 'danger');
    }
  });
  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-lat' } }, '위치'),
    h('div', { class: 'form-row' }, latInput, lngInput),
    locBtn
  ));

  // skin selector — default by category for new shops, by shop.skin for edit
  let currentSkin = hasInit ? (src.skin || getDefaultSkin(src.category)) : getDefaultSkin(catSelect.value);
  const skinContainer = h('div', { id: 'skin-selector' });
  const mountSkin = (selected) => {
    clear(skinContainer);
    skinContainer.appendChild(skinSelector(selected, (sk) => { currentSkin = sk; }));
  };
  mountSkin(currentSkin);
  catSelect.addEventListener('change', () => {
    if (isEdit) return;
    currentSkin = getDefaultSkin(catSelect.value);
    mountSkin(currentSkin);
  });
  form.appendChild(h('div', { class: 'form-group' },
    h('label', null, '스킨 테마'),
    skinContainer
  ));

  // memo
  const memoInput = h('textarea', { id: 'f-memo', attrs: { name: 'memo', rows: '3', placeholder: '예: 평일 오전 할인, 주차 가능' } }, isEdit ? (shop.memo || '') : '');
  form.appendChild(field('메모', 'f-memo', memoInput));

  // ── gifticon image (optional) ──
  // Event gifticons arrive as a screenshot; keeping it here means one place to
  // look at the counter. Attaching also tries to read the barcode out of the
  // image so the detail view can render a sharp one instead of the screenshot.
  let imageData = hasInit ? (src.image || '') : '';
  const imgPreview = h('img', { class: 'gifticon-thumb', attrs: { alt: '첨부한 기프티콘 미리보기' } });
  const imgClear = h('button', { class: 'btn btn-ghost btn-sm', attrs: { type: 'button' } }, '이미지 제거');
  const imgWrap = h('div', { class: 'gifticon-preview' }, imgPreview, imgClear);
  const imgInput = h('input', {
    id: 'f-gifticon', class: 'gifticon-input', attrs: { type: 'file', accept: 'image/*' }
  });
  // The native file control renders an OS widget with browser-locale text
  // ('선택된 파일 없음' / 'No file chosen'), the only such widget in the form.
  // A label styled as a button opens the same picker and keeps the app's language.
  const imgPick = h('label', {
    class: 'btn btn-secondary btn-block gifticon-pick', attrs: { for: 'f-gifticon' }
  }, '이미지 선택');
  const imgHint = h('p', { class: 'field-hint' }, supportsBarcodeScan()
    ? '카카오톡 등에서 받은 기프티콘 캡처를 넣어 두세요. 바코드를 읽어 코드도 자동으로 채웁니다.'
    : '카카오톡 등에서 받은 기프티콘 캡처를 넣어 두세요. 상세 화면에서 크게 볼 수 있어요.');

  const syncImage = () => {
    const has = !!imageData;
    imgWrap.hidden = !has;
    if (has) imgPreview.src = imageData;
  };
  imgClear.addEventListener('click', () => { imageData = ''; imgInput.value = ''; syncImage(); });
  imgInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    imgHint.textContent = '이미지를 처리하는 중...';
    try {
      const [data, found] = await Promise.all([readGifticon(file), detectCode(file)]);
      imageData = data;
      syncImage();
      // Never overwrite a code the user typed — only fill an empty field.
      if (found && !codeInput.value.trim()) {
        codeInput.value = found;
        showToast('바코드를 읽어 코드를 채웠어요');
      }
      imgHint.textContent = '첨부했어요. 상세 화면에서 크게 볼 수 있어요.';
    } catch (err) {
      imgInput.value = '';
      imgHint.textContent = '이미지를 읽을 수 없어요. 다른 파일로 시도해 주세요.';
    }
  });
  syncImage();

  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-gifticon' } }, '기프티콘 이미지'),
    imgInput,
    imgPick,
    imgWrap,
    imgHint
  ));

  // coupon code (optional) — shown as scannable barcode/QR on the detail page
  const codeInput = h('input', { id: 'f-code', attrs: { type: 'text', name: 'code', placeholder: '예: 1234-5678-9012 (선택)', value: hasInit ? (src.code || '') : '' } });
  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-code' } }, '쿠폰/멤버십 코드'),
    codeInput,
    h('p', { class: 'field-hint' }, '이용권·멤버십 코드를 입력하면 상세 화면에서 바코드·QR로 크게 보여줘요.')
  ));

  form.appendChild(h('div', { class: 'form-spacer' }));
  form.appendChild(h('button', { class: 'btn btn-primary btn-block', attrs: { type: 'submit' } }, isEdit ? '저장하기' : '추가하기'));

  if (isEdit) {
    const delBtn = h('button', { class: 'btn btn-danger btn-block subtle-danger', attrs: { type: 'button' } }, '이용권 삭제');
    delBtn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: '이용권 삭제',
        message: '이 이용권과 연결된 사용 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.',
        confirmLabel: '삭제',
        danger: true
      });
      if (!ok) return;
      await actions.deleteShop(shop.id);
      showToast('삭제되었어요');
      router.navigate('home');
    });
    form.appendChild(delBtn);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const total = kind === 'coupon'
      ? Math.max(1, Math.min(100, parseInt(couponTotalInput.value) || 1))
      : Math.max(1, Math.min(1000, parseInt(totalInput.value) || 10));
    const usedRaw = Math.max(0, parseInt(usedInput.value) || 0);
    // Count mode only: if the entered total is below the current used count,
    // saving would clamp (and lose) sessions — confirm before proceeding.
    if (kind !== 'amount' && usedRaw > total) {
      const proceed = await showConfirm({
        title: '사용 횟수 조정',
        message: `총 횟수(${total})가 현재 사용(${usedRaw})보다 적어 사용 횟수가 ${total}회로 줄어듭니다. 계속할까요?`,
        confirmLabel: '계속',
        danger: true
      });
      if (!proceed) return;
    }
    const used = Math.min(usedRaw, total);
    const totalAmount = Math.max(0, Math.min(100000000, parseNumber(totalAmountInput.value)));
    const usedAmount = Math.min(Math.max(0, parseNumber(usedAmountInput.value)), totalAmount);
    // Always persist BOTH kinds' fields so toggling kind never loses data.
    const data = {
      name: nameInput.value.trim(),
      category: catSelect.value,
      kind,
      totalCoupons: total,
      usedCoupons: used,
      totalAmount,
      usedAmount,
      address: addressInput.value.trim(),
      phone: phoneInput.value.trim(),
      expiresAt: expiresInput.value || '',
      memo: memoInput.value.trim(),
      code: codeInput.value.trim(),
      lat: parseFloat(latInput.value) || null,
      lng: parseFloat(lngInput.value) || null,
      skin: currentSkin,
      benefit: benefitInput.value.trim(),
      image: imageData
    };
    await actions.saveShop(data, params.id);
    showToast(isEdit ? '저장되었어요' : '추가되었어요');
    router.navigate('home');
  });

  applyKind();
  return root;
}
