// views/edit.js — add/edit shop form with live stamp preview, set-current-location,
// skin selector, and delete (edit mode). All inputs have associated labels.

import { h, clear } from '../core/h.js';
import { stampBoard, skinSelector } from '../ui/components.js';
import { getCurrentPosition } from '../services/location.js';
import { CATEGORIES, getDefaultSkin } from '../data/skins.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/overlay.js';
import { readAndDownscale, detectCode, supportsBarcodeScan } from '../services/photo.js';

export function render(ctx, params = {}) {
  const { store, router, actions } = ctx;
  const st = store.getState();
  const isEdit = !!params.id;
  const shop = isEdit ? (st.shops || []).find((s) => s.id === params.id) : null;
  if (isEdit && !shop) {
    showToast('업체를 찾을 수 없어요', 'danger');
    router.navigate('home');
    return h('div');
  }

  const field = (labelText, forId, ...controls) => h('div', { class: 'form-group' },
    h('label', { attrs: { for: forId } }, labelText),
    ...controls
  );

  const root = h('div');
  root.appendChild(h('div', { class: 'page-header' }, h('h2', null, isEdit ? '업체 편집' : '업체 추가')));

  const form = h('form', { id: 'shop-form' });
  root.appendChild(form);

  // name
  const nameInput = h('input', { id: 'f-name', attrs: { type: 'text', name: 'name', required: '', placeholder: '예: 안양 스타 마사지', value: isEdit ? shop.name : '' } });
  form.appendChild(field('업체 이름', 'f-name', nameInput));

  // coupon photo — first action so the camera leads. Downscaled JPEG kept locally;
  // on capable devices a barcode/QR in the photo is auto-read into the code field.
  let photo = isEdit ? (shop.photo || '') : '';
  const photoPreview = h('img', { class: 'photo-preview', attrs: { alt: '쿠폰 사진 미리보기' } });
  const clearPhotoBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' }, style: { 'margin-top': '8px' } }, '사진 삭제');
  const renderPhoto = () => {
    if (photo) {
      photoPreview.src = photo;
      photoPreview.hidden = false;
      clearPhotoBtn.hidden = false;
    } else {
      photoPreview.removeAttribute('src');
      photoPreview.hidden = true;
      clearPhotoBtn.hidden = true;
    }
  };
  const photoInput = h('input', { id: 'f-photo', attrs: { type: 'file', name: 'photo', accept: 'image/*', capture: 'environment' } });
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    try {
      photo = await readAndDownscale(file);
      renderPhoto();
      showToast('사진이 추가됐어요');
    } catch (e) {
      showToast('사진을 불러올 수 없어요', 'danger');
      return;
    }
    try {
      const detected = await detectCode(file);
      if (detected && !codeInput.value.trim()) {
        codeInput.value = detected;
        showToast('바코드를 자동 인식했어요');
      }
    } catch (e) { /* code detection is best-effort; photo is already attached */ }
  });
  clearPhotoBtn.addEventListener('click', () => {
    photo = '';
    photoInput.value = '';
    renderPhoto();
  });
  const photoHint = supportsBarcodeScan()
    ? '실물 쿠폰을 촬영하면 사진이 저장돼요 · 바코드/QR는 자동 인식돼요'
    : '실물 쿠폰을 촬영하면 사진이 저장돼요';
  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-photo' } }, '쿠폰 사진'),
    photoInput,
    h('p', { class: 'field-hint' }, photoHint),
    photoPreview,
    clearPhotoBtn
  ));
  renderPhoto();

  // category + total
  const catSelect = h('select', { id: 'f-category', attrs: { name: 'category' } },
    Object.keys(CATEGORIES).map((c) => h('option', {
      attrs: { value: c, selected: isEdit && shop.category === c ? '' : null }
    }, c))
  );
  const totalInput = h('input', { id: 'f-total', attrs: { type: 'number', name: 'totalCoupons', min: '1', max: '100', required: '', value: isEdit ? String(shop.totalCoupons) : '10' } });
  form.appendChild(h('div', { class: 'form-row' },
    field('카테고리', 'f-category', catSelect),
    field('쿠폰 총 개수', 'f-total', totalInput)
  ));

  // used + live stamp preview
  const usedInput = h('input', { id: 'f-used', attrs: { type: 'number', name: 'usedCoupons', min: '0', max: '100', value: isEdit ? String(shop.usedCoupons || 0) : '0' } });
  const counter = h('span', { class: 'stamp-counter', id: 'f-stamp-counter' }, '0 / 10');
  const previewBoard = h('div', { class: 'stamp-board stamp-preview', id: 'f-stamp-preview' });
  form.appendChild(h('div', { class: 'form-group' },
    h('div', { class: 'stamp-preview-head' },
      h('label', { attrs: { for: 'f-used' }, style: { margin: '0' } }, '현재 적립 개수'),
      counter
    ),
    usedInput,
    h('p', { class: 'field-hint' }, '이미 도장을 찍은 종이 쿠폰이라면 현재 개수를 입력하세요.'),
    previewBoard
  ));

  function renderPreview() {
    const total = Math.max(1, Math.min(100, parseInt(totalInput.value) || 0));
    const used = Math.max(0, Math.min(parseInt(usedInput.value) || 0, total));
    counter.textContent = `${used} / ${total}`;
    clear(previewBoard);
    previewBoard.appendChild(stampBoard(total, used));
  }
  totalInput.addEventListener('input', renderPreview);
  usedInput.addEventListener('input', renderPreview);

  // address
  const addressInput = h('input', { id: 'f-address', attrs: { type: 'text', name: 'address', placeholder: '주소를 입력하세요', value: isEdit ? (shop.address || '') : '' } });
  form.appendChild(field('주소', 'f-address', addressInput));

  // phone + expiry
  const phoneInput = h('input', { id: 'f-phone', attrs: { type: 'tel', name: 'phone', placeholder: '예: 031-000-0000', value: isEdit ? (shop.phone || '') : '' } });
  const expiresInput = h('input', { id: 'f-expires', attrs: { type: 'date', name: 'expiresAt', value: isEdit ? (shop.expiresAt || '') : '' } });
  form.appendChild(h('div', { class: 'form-row' },
    field('전화번호', 'f-phone', phoneInput),
    field('만료일', 'f-expires', expiresInput)
  ));

  // location
  const latInput = h('input', { id: 'f-lat', attrs: { type: 'text', name: 'lat', placeholder: '위도', readonly: '', 'aria-label': '위도', value: isEdit && shop.lat != null ? String(shop.lat) : '' } });
  const lngInput = h('input', { id: 'f-lng', attrs: { type: 'text', name: 'lng', placeholder: '경도', readonly: '', 'aria-label': '경도', value: isEdit && shop.lng != null ? String(shop.lng) : '' } });
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
  let currentSkin = isEdit ? (shop.skin || 'midnight') : getDefaultSkin(catSelect.value);
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

  // coupon code (optional) — shown as scannable barcode/QR on the detail page
  const codeInput = h('input', { id: 'f-code', attrs: { type: 'text', name: 'code', placeholder: '예: 1234-5678-9012 (선택)', value: isEdit ? (shop.code || '') : '' } });
  form.appendChild(h('div', { class: 'form-group' },
    h('label', { attrs: { for: 'f-code' } }, '쿠폰 코드'),
    codeInput,
    h('p', { class: 'field-hint' }, '입력하면 상세 화면에서 바코드·QR로 크게 보여줘요.')
  ));

  form.appendChild(h('div', { class: 'form-spacer' }));
  form.appendChild(h('button', { class: 'btn btn-primary btn-block', attrs: { type: 'submit' } }, isEdit ? '저장하기' : '추가하기'));

  if (isEdit) {
    const delBtn = h('button', { class: 'btn btn-danger btn-block subtle-danger', attrs: { type: 'button' } }, '업체 삭제');
    delBtn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: '업체 삭제',
        message: '이 업체와 연결된 사용 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.',
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
    const total = Math.max(1, Math.min(100, parseInt(totalInput.value) || 10));
    const usedRaw = Math.max(0, parseInt(usedInput.value) || 0);
    // If the entered total is below the current stamp count, saving would clamp
    // (and lose) stamps — confirm before proceeding.
    if (usedRaw > total) {
      const proceed = await showConfirm({
        title: '적립 개수 조정',
        message: `총 개수(${total})가 현재 적립(${usedRaw})보다 적어 적립이 ${total}개로 줄어듭니다. 계속할까요?`,
        confirmLabel: '계속',
        danger: true
      });
      if (!proceed) return;
    }
    const used = Math.min(usedRaw, total);
    const data = {
      name: nameInput.value.trim(),
      category: catSelect.value,
      totalCoupons: total,
      address: addressInput.value.trim(),
      phone: phoneInput.value.trim(),
      expiresAt: expiresInput.value || '',
      memo: memoInput.value.trim(),
      code: codeInput.value.trim(),
      photo,
      lat: parseFloat(latInput.value) || null,
      lng: parseFloat(lngInput.value) || null,
      usedCoupons: used,
      skin: currentSkin
    };
    await actions.saveShop(data, params.id);
    showToast(isEdit ? '저장되었어요' : '추가되었어요');
    router.navigate('home');
  });

  renderPreview();
  return root;
}
