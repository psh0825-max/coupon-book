// views/settings.js — stats panel; 위치 알림 + 만료 알림 toggles; radius/delay;
// reminderDays selector; install app; backup/restore; demo; clear-all; about.

import { h, clear } from '../core/h.js';
import { stats } from '../domain.js';
import * as pwa from '../services/pwa.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/overlay.js';

export function render(ctx) {
  const { store, actions } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const logs = st.logs || [];
  const settings = st.settings || {};
  const s = stats(shops, logs);

  const metric = (v, l) => h('div', { class: 'metric' }, h('strong', null, String(v)), h('span', null, l));
  const card = (...children) => h('div', { class: 'card settings-card' }, h('div', { class: 'card-body' }, ...children));

  const makeToggle = (initial, onToggle) => {
    let state = !!initial;
    const el = h('div', {
      class: `toggle-switch${state ? ' active' : ''}`,
      attrs: { role: 'switch', 'aria-checked': state ? 'true' : 'false', tabindex: '0' }
    });
    const toggle = () => {
      state = !state;
      el.classList.toggle('active', state);
      el.setAttribute('aria-checked', state ? 'true' : 'false');
      onToggle(state);
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    return el;
  };

  const root = h('div');
  root.appendChild(h('div', { class: 'page-header' }, h('h2', null, '설정')));

  // ── stats panel ──
  root.appendChild(h('section', { class: 'settings-panel' },
    h('div', { class: 'section-title' },
      h('h3', null, '운영 통계'),
      h('span', null, `이번 달 사용 ${s.monthUses}회`)
    ),
    h('div', { class: 'metric-grid' },
      metric(s.totalShops, '업체'),
      metric(s.totalCoupons, '쿠폰 총'),
      metric(s.usedCoupons, '사용'),
      metric(s.completedCount, '완성')
    )
  ));

  // ── (a) 위치 알림 ──
  root.appendChild(card(
    h('div', { class: 'toggle-row' },
      h('div', { class: 'info' }, h('h4', null, '위치 알림'), h('p', null, '가게 근처에 가면 팝업 띄우기')),
      makeToggle(settings.notifyEnabled, async (next) => {
        await actions.toggleNotify(next);
        showToast(next ? '알림이 켜졌어요' : '알림이 꺼졌어요');
      })
    )
  ));

  // ── (b) 만료 알림 + reminderDays ──
  const reminderDays = Array.isArray(settings.reminderDays) ? [...settings.reminderDays] : [7, 3, 1];
  const daysWrap = h('div', { class: 'reminder-days' });
  const buildDayChips = () => {
    clear(daysWrap);
    [7, 3, 1].forEach((d) => {
      const on = reminderDays.includes(d);
      daysWrap.appendChild(h('button', {
        class: `chip${on ? ' active' : ''}`,
        attrs: { type: 'button', role: 'checkbox', 'aria-checked': on ? 'true' : 'false' },
        on: { click: () => {
          const idx = reminderDays.indexOf(d);
          if (idx >= 0) reminderDays.splice(idx, 1); else reminderDays.push(d);
          const sorted = [...reminderDays].sort((a, b) => b - a);
          reminderDays.length = 0;
          reminderDays.push(...sorted);
          actions.setReminderDays(sorted);
          buildDayChips();
        } }
      }, `D-${d}`));
    });
  };
  buildDayChips();
  root.appendChild(card(
    h('div', { class: 'toggle-row' },
      h('div', { class: 'info' }, h('h4', null, '만료 임박 알림'), h('p', null, 'D-7 / D-3 / D-1 에 만료 알림')),
      makeToggle(settings.remindersEnabled, async (next) => {
        await actions.toggleReminders(next);
        showToast(next ? '만료 알림이 켜졌어요' : '만료 알림이 꺼졌어요');
      })
    ),
    daysWrap
  ));

  // ── (c) radius / delay ──
  const radiusInput = h('input', { id: 's-radius', attrs: { type: 'number', value: String(settings.notifyRadius ?? 100), min: '10', max: '1000' } });
  const delayInput = h('input', { id: 's-delay', attrs: { type: 'number', value: String(settings.notifyDelay ?? 5), min: '0', max: '60' } });
  const saveBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' } }, '알림 설정 저장');
  saveBtn.addEventListener('click', async () => {
    const radius = parseInt(radiusInput.value) || 100;
    const delay = parseInt(delayInput.value) || 5;
    await actions.saveNotifySettings({ radius, delay });
    showToast('알림 설정 저장 완료');
  });
  root.appendChild(card(
    h('div', { class: 'form-group' }, h('label', { attrs: { for: 's-radius' } }, '알림 반경 (미터)'), radiusInput),
    h('div', { class: 'form-group' }, h('label', { attrs: { for: 's-delay' } }, '체류 시간 (분)'), delayInput),
    saveBtn
  ));

  // ── (d) 앱 설치 ──
  if (!pwa.isStandalone()) {
    if (pwa.canInstall()) {
      root.appendChild(card(
        h('div', { class: 'form-group' },
          h('label', null, '앱 설치'),
          h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' }, on: { click: () => actions.requestInstall() } }, '앱 설치')
        )
      ));
    } else if (pwa.isIos()) {
      root.appendChild(card(
        h('div', { class: 'form-group' },
          h('label', null, '앱 설치'),
          h('p', { class: 'field-hint' }, '공유 버튼 → 홈 화면에 추가 로 설치할 수 있어요')
        )
      ));
    }
  }

  // ── (e) 백업 / 복원 ──
  const importInput = h('input', { id: 's-import', attrs: { type: 'file', accept: '.json' } });
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await actions.importData(file);
      showToast('복원 완료!');
    } catch (err) {
      showToast('복원 실패: ' + (err?.message || err), 'danger');
    }
  });
  root.appendChild(card(
    h('div', { class: 'form-group' },
      h('label', null, '백업 데이터'),
      h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' }, on: { click: () => actions.exportData() } }, 'JSON 파일로 백업')
    ),
    h('div', { class: 'form-group' },
      h('label', { attrs: { for: 's-import' } }, '복원 데이터'),
      importInput
    )
  ));

  // ── (f) 데모 / 초기화 ──
  const demoBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' } }, '샘플 업체 추가');
  demoBtn.addEventListener('click', async () => {
    const added = await actions.seedDemo();
    showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
  });
  const clearBtn = h('button', { class: 'btn btn-danger btn-block', attrs: { type: 'button' } }, '모든 업체와 내역 삭제');
  clearBtn.addEventListener('click', async () => {
    const ok = await showConfirm({
      title: '전체 초기화',
      message: '모든 업체와 사용 내역을 삭제할까요? 먼저 백업하는 걸 권장해요.',
      confirmLabel: '초기화',
      danger: true
    });
    if (!ok) return;
    await actions.clearAll();
    showToast('전체 데이터를 초기화했어요');
  });
  root.appendChild(card(
    h('div', { class: 'form-group' }, h('label', null, '데모 데이터'), demoBtn),
    h('div', { class: 'form-group' }, h('label', null, '전체 초기화'), clearBtn)
  ));

  // ── (g) about ──
  root.appendChild(h('p', { class: 'field-hint', style: { 'text-align': 'center', 'margin-top': '8px' } },
    '쿠폰북 v3 · 로컬에 저장되는 개인 쿠폰 지갑'));

  return root;
}
