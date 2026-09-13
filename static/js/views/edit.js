// views/edit.js — add/edit form. Short by default (name → category → kind →
// amount/count → expiry → save); everything else lives under "추가 정보".
// Inline validation, sensible defaults, live preview. All inputs are labelled.

import { h, clear, icon } from '../core/h.js';
import { stampBoard, skinSelector, chipRow } from '../ui/components.js';
import { getCurrentPosition } from '../services/location.js';
import { CATEGORIES, getCategoryIcon, getDefaultSkin } from '../data/skins.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/overlay.js';
import { formatWon, formatDistance, groupDigits, parseNumber } from '../services/format.js';
import { isAvailable as placesAvailable, searchPlaces } from '../services/places.js';
import { normalizeKind } from '../domain.js';
import { haptic } from '../services/fx.js';

const TEMPLATES = [
  { label: '☕ 카페 도장판 10칸', prefill: { category: '카페', kind: 'stamp', totalCoupons: 10 } },
  { label: '💆 마사지 10회권', prefill: { category: '마사지', kind: 'count', totalCoupons: 10 } },
  { label: '🧘 찜질방 회수권', prefill: { category: '찜질방', kind: 'count', totalCoupons: 10 } },
  { label: '💳 금액권 10만원', prefill: { category: '기타', kind: 'amount', totalAmount: 100000 } }
];

const TOTAL_CHIPS = [5, 8, 10, 12, 20];
const AMOUNT_CHIPS = [50000, 100000, 300000, 500000, 1000000];
const EXPIRY_CHIPS = [['', '없음'], ['1', '1개월'], ['3', '3개월'], ['6', '6개월'], ['12', '1년']];

function isoDateFromNow(months) {
  const d = new Date(Date.now());
  d.setMonth(d.getMonth() + months);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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
  // Initial field values come from the shop (edit) or a prefill (template/renew).
  // A prefill carries the pass setup but NOT usage/period — those start fresh.
  const src = isEdit ? shop : (params.prefill || null);
  const hasInit = !!src;

  const root = h('div', { class: 'edit-page' });
  root.appendChild(h('div', { class: 'page-header' },
    h('h2', null, isEdit ? '이용권 편집' : '이용권 추가'),
    h('p', null, isEdit ? '변경한 내용은 저장을 눌러야 반영돼요' : '이름과 종류만 있으면 바로 등록할 수 있어요')
  ));

  // Quick-start templates — pristine add form only.
  if (!isEdit && !params.prefill) {
    root.appendChild(h('div', { class: 'form-group' },
      h('span', { class: 'field-label' }, '빠른 시작'),
      h('div', { class: 'chip-row', attrs: { role: 'group', 'aria-label': '빠른 시작 템플릿' } },
        TEMPLATES.map((t) => h('button', {
          class: 'chip', attrs: { type: 'button' },
          on: { click: () => { haptic('selection'); router.navigate('add', { prefill: t.prefill }); } }
        }, t.label))
      )
    ));
  }

  const form = h('form', { id: 'shop-form', attrs: { novalidate: '' } });
  root.appendChild(form);

  const field = (labelText, forId, control, hint) => h('div', { class: 'form-group' },
    h('label', { attrs: { for: forId } }, labelText),
    control,
    hint ? h('p', { class: 'field-hint' }, hint) : null
  );

  // ── 매장 검색 (Kakao keyword search → auto-fill). Only where the SDK answers. ──
  let nameInput, addressInput, phoneInput;
  let lat = hasInit && src.lat != null && src.lat !== '' ? Number(src.lat) : null;
  let lng = hasInit && src.lng != null && src.lng !== '' ? Number(src.lng) : null;
  const locationStatus = h('p', { class: 'field-hint location-status' });

  const setLocation = (nextLat, nextLng) => {
    lat = Number.isFinite(nextLat) ? nextLat : null;
    lng = Number.isFinite(nextLng) ? nextLng : null;
    renderLocationStatus();
  };

  if (placesAvailable()) {
    const searchInput = h('input', { id: 'f-place-search', attrs: { type: 'search', name: 'placeSearch', autocomplete: 'off', enterkeyhint: 'search', placeholder: '예: 마사지, 스타벅스' } });
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
          if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) setLocation(p.lat, p.lng);
          details.open = true;
          hideResults();
          searchInput.value = '';
          haptic('light');
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
        showMessage('place-empty', '지금은 검색을 사용할 수 없어요. 직접 입력해 주세요.');
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
      h('label', { attrs: { for: 'f-place-search' } }, '매장 검색 (선택)'),
      searchInput,
      h('p', { class: 'place-hint' }, '이름으로 검색하면 주소·전화·위치를 자동으로 채워요.'),
      results
    ));
  }

  // ── name (required) ──
  nameInput = h('input', { id: 'f-name', attrs: { type: 'text', name: 'name', required: '', autocomplete: 'off', enterkeyhint: 'next', placeholder: '예: 허브 커피 로스터스', value: hasInit ? (src.name || '') : '', 'aria-describedby': 'f-name-error' } });
  const nameError = h('p', { class: 'field-error', id: 'f-name-error', attrs: { role: 'alert' }, hidden: true }, '이름을 입력해 주세요');
  nameInput.addEventListener('input', () => { if (nameInput.value.trim()) { nameError.hidden = true; nameInput.classList.remove('invalid'); } });
  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-name' } }, '이름'),
    nameInput,
    nameError
  ));

  // ── category chips (drives the default skin for new shops) ──
  let category = hasInit && CATEGORIES[src.category] ? src.category : '카페';
  let currentSkin = hasInit ? (src.skin || getDefaultSkin(category)) : getDefaultSkin(category);
  const skinContainer = h('div', { id: 'skin-selector' });
  const mountSkin = (selected) => {
    clear(skinContainer);
    skinContainer.appendChild(skinSelector(selected, (sk) => { currentSkin = sk; haptic('selection'); }));
  };
  const categoryRow = chipRow(
    Object.keys(CATEGORIES).map((c) => ({ value: c, label: `${getCategoryIcon(c)} ${c}` })),
    { value: category, ariaLabel: '카테고리', onChange: (c) => {
      category = c;
      haptic('selection');
      if (!isEdit) { currentSkin = getDefaultSkin(c); mountSkin(currentSkin); }
    } }
  );
  form.appendChild(h('div', { class: 'form-group' },
    h('span', { class: 'field-label' }, '카테고리'),
    categoryRow
  ));

  // ── kind: 도장판 / 횟수권 / 금액권 ──
  let kind = normalizeKind(src && src.kind);
  const segButtons = {};
  const seg = h('div', { class: 'seg', attrs: { role: 'radiogroup', 'aria-label': '이용권 종류' } },
    [['stamp', '도장판'], ['count', '횟수권'], ['amount', '금액권']].map(([k, label]) => {
      const b = h('button', { attrs: { type: 'button', role: 'radio', 'aria-checked': kind === k ? 'true' : 'false' }, class: kind === k ? 'active' : '' }, label);
      b.addEventListener('click', () => { kind = k; haptic('selection'); applyKind(); });
      segButtons[k] = b;
      return b;
    })
  );
  form.appendChild(h('div', { class: 'form-group' },
    h('span', { class: 'field-label' }, '종류'),
    seg,
    h('p', { class: 'field-hint', id: 'kind-hint' })
  ));

  // ── COUNT/STAMP fields ──
  const totalInput = h('input', { id: 'f-total', attrs: { type: 'number', name: 'totalCoupons', inputmode: 'numeric', min: '1', max: '1000', value: hasInit && src.totalCoupons != null ? String(src.totalCoupons) : '10' } });
  const totalChips = chipRow(TOTAL_CHIPS.map((n) => ({ value: n, label: `${n}` })), {
    value: Number(totalInput.value), ariaLabel: '총 칸 수 빠른 선택',
    onChange: (n) => { totalInput.value = String(n); haptic('selection'); renderPreview(); }
  });
  totalInput.addEventListener('input', () => { totalChips.setValue(Number(totalInput.value)); renderPreview(); });

  const usedInput = h('input', { id: 'f-used', attrs: { type: 'number', name: 'usedCoupons', inputmode: 'numeric', min: '0', max: '1000', value: isEdit ? String(shop.usedCoupons || 0) : '0' } });
  const stepBtn = (label, delta) => h('button', {
    class: 'stepper-btn', attrs: { type: 'button', 'aria-label': label },
    on: { click: () => {
      const total = Math.max(1, parseInt(totalInput.value) || 1);
      usedInput.value = String(Math.max(0, Math.min(total, (parseInt(usedInput.value) || 0) + delta)));
      haptic('selection');
      renderPreview();
    } }
  }, delta < 0 ? '−' : '+');
  const usedLabel = h('label', { attrs: { for: 'f-used' } }, '현재 사용 횟수');
  const totalLabelEl = h('label', { attrs: { for: 'f-total' } }, '총 횟수');
  const counter = h('span', { class: 'stamp-counter', id: 'f-stamp-counter', attrs: { 'aria-live': 'polite' } }, '0 / 10');
  const previewBoard = h('div', { class: 'stamp-preview', id: 'f-stamp-preview' });
  const countGroup = h('div', { id: 'count-fields' },
    h('div', { class: 'form-group' },
      totalLabelEl,
      h('div', { class: 'total-row' }, totalInput, totalChips)
    ),
    h('div', { class: 'form-group' },
      h('div', { class: 'stamp-preview-head' }, usedLabel, counter),
      h('div', { class: 'stepper' }, stepBtn('하나 줄이기', -1), usedInput, stepBtn('하나 늘리기', +1)),
      previewBoard
    )
  );
  form.appendChild(countGroup);
  usedInput.addEventListener('input', renderPreview);

  // ── AMOUNT fields ──
  const totalAmountInput = h('input', { id: 'f-total-amount', attrs: { type: 'text', name: 'totalAmount', inputmode: 'numeric', placeholder: '예: 1,000,000', value: hasInit && src.totalAmount ? groupDigits(src.totalAmount) : '', 'aria-describedby': 'f-amount-error' } });
  const amountChips = chipRow(AMOUNT_CHIPS.map((n) => ({ value: n, label: formatWon(n).replace('원', '') })), {
    value: parseNumber(totalAmountInput.value), ariaLabel: '총 금액 빠른 선택',
    onChange: (n) => { totalAmountInput.value = groupDigits(n); haptic('selection'); renderAmountPreview(); }
  });
  const usedAmountInput = h('input', { id: 'f-used-amount', attrs: { type: 'text', name: 'usedAmount', inputmode: 'numeric', value: isEdit ? groupDigits(shop.usedAmount || 0) : '0' } });
  const amountError = h('p', { class: 'field-error', id: 'f-amount-error', attrs: { role: 'alert' }, hidden: true }, '총 금액을 입력해 주세요');
  const amountPreview = h('p', { class: 'amount-preview', id: 'f-amount-preview', attrs: { 'aria-live': 'polite' } }, '남은 금액: 0원');
  const amountGroup = h('div', { id: 'amount-fields' },
    h('div', { class: 'form-group' },
      h('label', { attrs: { for: 'f-total-amount' } }, '총 금액(원)'),
      totalAmountInput,
      amountError,
      amountChips
    ),
    field('현재 사용 금액(원)', 'f-used-amount', usedAmountInput),
    amountPreview
  );
  form.appendChild(amountGroup);

  function renderPreview() {
    const total = Math.max(1, Math.min(1000, parseInt(totalInput.value) || 0));
    const used = Math.max(0, Math.min(parseInt(usedInput.value) || 0, total));
    counter.textContent = `${used} / ${total}`;
    clear(previewBoard);
    if (total <= 30) previewBoard.appendChild(stampBoard(total, used, { reward: kind === 'stamp' }));
  }

  function renderAmountPreview() {
    const total = parseNumber(totalAmountInput.value);
    const used = Math.min(parseNumber(usedAmountInput.value), total);
    amountPreview.textContent = `남은 금액: ${formatWon(total - used)}`;
    if (total > 0) { amountError.hidden = true; totalAmountInput.classList.remove('invalid'); }
    amountChips.setValue(total);
  }
  const liveGroup = (input) => { input.value = groupDigits(input.value); renderAmountPreview(); };
  totalAmountInput.addEventListener('input', () => liveGroup(totalAmountInput));
  usedAmountInput.addEventListener('input', () => liveGroup(usedAmountInput));

  const kindHint = () => form.querySelector('#kind-hint');
  function applyKind() {
    Object.entries(segButtons).forEach(([k, b]) => {
      b.classList.toggle('active', kind === k);
      b.setAttribute('aria-checked', kind === k ? 'true' : 'false');
    });
    countGroup.hidden = kind === 'amount';
    amountGroup.hidden = kind !== 'amount';
    totalLabelEl.textContent = kind === 'stamp' ? '도장판 칸 수' : '총 횟수';
    usedLabel.textContent = kind === 'stamp' ? '지금까지 모은 도장' : '이미 사용한 횟수';
    kindHint().textContent = kind === 'stamp'
      ? '도장을 다 모으면 보상 알림과 함께 축하해 드려요.'
      : kind === 'count' ? '횟수를 하나씩 차감하며 남은 횟수를 관리해요.' : '금액을 차감하며 잔액을 관리해요.';
    if (kind === 'amount') renderAmountPreview(); else renderPreview();
  }

  // ── expiry ──
  const expiresInput = h('input', { id: 'f-expires', attrs: { type: 'date', name: 'expiresAt', value: isEdit ? (shop.expiresAt || '') : '' } });
  const expiryChips = chipRow(EXPIRY_CHIPS.map(([v, label]) => ({ value: v, label })), {
    value: isEdit && shop.expiresAt ? undefined : '', ariaLabel: '만료일 빠른 선택',
    onChange: (v) => { expiresInput.value = v ? isoDateFromNow(Number(v)) : ''; haptic('selection'); }
  });
  expiresInput.addEventListener('input', () => expiryChips.setValue(expiresInput.value ? undefined : ''));
  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-expires' } }, '만료일 (선택)'),
    h('div', { class: 'expiry-row' }, expiresInput),
    expiryChips
  ));

  // ── 추가 정보 (collapsible) ──
  addressInput = h('input', { id: 'f-address', attrs: { type: 'text', name: 'address', autocomplete: 'off', placeholder: '도로명 주소', value: hasInit ? (src.address || '') : '' } });
  phoneInput = h('input', { id: 'f-phone', attrs: { type: 'tel', name: 'phone', autocomplete: 'off', placeholder: '예: 031-000-0000', value: hasInit ? (src.phone || '') : '' } });
  const codeInput = h('input', { id: 'f-code', attrs: { type: 'text', name: 'code', autocomplete: 'off', placeholder: '바코드·QR로 보여줄 코드 (선택)', value: hasInit ? (src.code || '') : '' } });
  const memoInput = h('textarea', { id: 'f-memo', attrs: { name: 'memo', rows: '3', placeholder: '예: 평일 오전 할인, 주차 가능' } }, hasInit ? (src.memo || '') : '');

  const locBtn = h('button', { class: 'btn btn-secondary', attrs: { type: 'button' } }, icon('location', { size: 18 }), '현재 위치로 저장');
  const clearLocBtn = h('button', { class: 'btn btn-ghost', attrs: { type: 'button' } }, '지우기');
  function renderLocationStatus() {
    const has = Number.isFinite(lat) && Number.isFinite(lng);
    locationStatus.textContent = has
      ? `위치 저장됨 · ${lat.toFixed(5)}, ${lng.toFixed(5)} — 지도 탭과 근처 알림에 사용돼요`
      : '위치를 저장하면 지도에 표시되고 가게 근처에서 알림을 받을 수 있어요';
    clearLocBtn.hidden = !has;
  }
  locBtn.addEventListener('click', async () => {
    locBtn.disabled = true;
    try {
      const pos = await getCurrentPosition();
      setLocation(pos.lat, pos.lng);
      haptic('success');
      showToast('현재 위치를 저장했어요');
    } catch (e) {
      haptic('warning');
      showToast('위치를 가져올 수 없어요. 위치 권한을 확인해 주세요.', 'danger');
    } finally {
      locBtn.disabled = false;
    }
  });
  clearLocBtn.addEventListener('click', () => { setLocation(null, null); haptic('selection'); });
  renderLocationStatus();

  const hasExtra = hasInit && !!(src.address || src.phone || src.code || src.memo || lat != null);
  const details = h('details', { class: 'form-details', attrs: { open: hasExtra ? '' : null } },
    h('summary', null, h('span', null, '추가 정보 (선택)'), icon('chevron-right', { size: 18, class: 'details-chevron' })),
    h('div', { class: 'form-details-body' },
      field('주소', 'f-address', addressInput),
      field('전화번호', 'f-phone', phoneInput),
      h('div', { class: 'form-group' },
        h('span', { class: 'field-label' }, '위치'),
        h('div', { class: 'location-row' }, locBtn, clearLocBtn),
        locationStatus
      ),
      field('쿠폰/멤버십 코드', 'f-code', codeInput, '상세 화면에서 바코드·QR로 크게 보여줘요.'),
      field('메모', 'f-memo', memoInput),
      h('div', { class: 'form-group' },
        h('span', { class: 'field-label' }, '카드 색상'),
        skinContainer
      )
    )
  );
  mountSkin(currentSkin);
  form.appendChild(details);

  form.appendChild(h('button', { class: 'btn btn-primary btn-block btn-lg', attrs: { type: 'submit' } }, isEdit ? '저장하기' : '추가하기'));

  if (isEdit) {
    const delBtn = h('button', { class: 'btn btn-ghost btn-block danger-text', attrs: { type: 'button' } }, '이용권 삭제');
    delBtn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: '이용권 삭제',
        message: '이 이용권과 연결된 사용 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.',
        confirmLabel: '삭제',
        danger: true
      });
      if (!ok) return;
      await actions.deleteShop(shop.id);
      haptic('medium');
      showToast('삭제되었어요');
      router.navigate('home');
    });
    form.appendChild(delBtn);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameError.hidden = false;
      nameInput.classList.add('invalid');
      nameInput.focus();
      haptic('error');
      return;
    }
    const total = Math.max(1, Math.min(1000, parseInt(totalInput.value) || 10));
    const usedRaw = Math.max(0, parseInt(usedInput.value) || 0);
    const totalAmount = Math.max(0, Math.min(100000000, parseNumber(totalAmountInput.value)));
    if (kind === 'amount' && totalAmount <= 0) {
      amountError.hidden = false;
      totalAmountInput.classList.add('invalid');
      totalAmountInput.focus();
      haptic('error');
      return;
    }
    // Count/stamp: if the entered total is below the current used count, saving
    // would clamp (and lose) sessions — confirm before proceeding.
    if (kind !== 'amount' && usedRaw > total) {
      const proceed = await showConfirm({
        title: '사용 횟수 조정',
        message: `총 ${total}칸이 현재 사용(${usedRaw})보다 적어 사용 횟수가 ${total}회로 줄어듭니다. 계속할까요?`,
        confirmLabel: '계속',
        danger: true
      });
      if (!proceed) return;
    }
    const used = Math.min(usedRaw, total);
    const usedAmount = Math.min(Math.max(0, parseNumber(usedAmountInput.value)), totalAmount);
    // Always persist BOTH kinds' fields so toggling kind never loses data.
    const data = {
      name,
      category,
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
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      skin: currentSkin
    };
    await actions.saveShop(data, params.id);
    haptic('success');
    showToast(isEdit ? '저장되었어요' : '추가되었어요');
    router.navigate('home');
  });

  applyKind();
  return root;
}
