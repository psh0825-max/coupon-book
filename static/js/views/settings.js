// views/settings.js — grouped settings: 알림 (위치/만료), 데이터 (자동 보관, 백업/
// 복원, 샘플, 초기화), 앱 (설치, 정책, 문의, 버전).

import { h, clear } from '../core/h.js';
import { stats } from '../domain.js';
import * as pwa from '../services/pwa.js';
import { isPersisted, storageEstimate, requestPersistentStorage } from '../services/storage.js';
import { lastSnapshotAt } from '../services/snapshot.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/overlay.js';
import { formatDate } from '../services/format.js';
import { toggle, listRow, listGroup } from '../ui/components.js';
import { haptic } from '../services/fx.js';
import * as platform from '../platform.js';
import { APP_VERSION, URLS } from '../config.js';

export function render(ctx) {
  const { store, actions, router } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const logs = st.logs || [];
  const settings = st.settings || {};
  const s = stats(shops, logs);

  const metric = (v, l) => h('div', { class: 'metric' }, h('strong', null, String(v)), h('span', null, l));

  const root = h('div', { class: 'settings-page' });
  root.appendChild(h('div', { class: 'page-header' }, h('h2', null, '설정')));

  // ── stats panel ──
  root.appendChild(h('section', { class: 'settings-panel' },
    h('div', { class: 'section-title' },
      h('h3', null, '나의 기록'),
      h('span', null, `이번 달 ${s.monthUses}회 사용`)
    ),
    h('div', { class: 'metric-grid' },
      metric(s.totalShops, '업체'),
      metric(`${s.completionRate}%`, '사용률'),
      metric(s.expiringCount, '만료 임박'),
      metric(s.completedCount, '완료')
    )
  ));

  // ── 알림 ──
  const radiusInput = h('input', { id: 's-radius', attrs: { type: 'number', inputmode: 'numeric', value: String(settings.notifyRadius ?? 100), min: '10', max: '1000' } });
  const delayInput = h('input', { id: 's-delay', attrs: { type: 'number', inputmode: 'numeric', value: String(settings.notifyDelay ?? 5), min: '0', max: '60' } });
  const saveBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' } }, '반경·체류 시간 저장');
  saveBtn.addEventListener('click', async () => {
    const radius = Math.min(1000, Math.max(10, parseInt(radiusInput.value) || 100));
    const delay = Math.min(60, Math.max(0, parseInt(delayInput.value) || 0));
    await actions.saveNotifySettings({ radius, delay });
    haptic('success');
    showToast('근처 알림 설정을 저장했어요');
  });
  const geoOptions = h('div', { class: 'list-row-detail', hidden: !settings.notifyEnabled },
    h('div', { class: 'form-row' },
      h('div', { class: 'form-group' }, h('label', { attrs: { for: 's-radius' } }, '알림 반경 (m)'), radiusInput),
      h('div', { class: 'form-group' }, h('label', { attrs: { for: 's-delay' } }, '체류 시간 (분)'), delayInput)
    ),
    saveBtn
  );

  const reminderDays = Array.isArray(settings.reminderDays) ? [...settings.reminderDays] : [7, 3, 1];
  const daysWrap = h('div', { class: 'reminder-days list-row-detail', attrs: { role: 'group', 'aria-label': '만료 알림일' }, hidden: !settings.remindersEnabled });
  const buildDayChips = () => {
    clear(daysWrap);
    daysWrap.appendChild(h('span', { class: 'field-label' }, '알림 시점'));
    const row = h('div', { class: 'chip-row' });
    [7, 3, 1].forEach((d) => {
      const on = reminderDays.includes(d);
      row.appendChild(h('button', {
        class: `chip${on ? ' active' : ''}`,
        attrs: { type: 'button', role: 'checkbox', 'aria-checked': on ? 'true' : 'false' },
        on: { click: () => {
          const idx = reminderDays.indexOf(d);
          if (idx >= 0) reminderDays.splice(idx, 1); else reminderDays.push(d);
          const sorted = [...reminderDays].sort((a, b) => b - a);
          reminderDays.length = 0;
          reminderDays.push(...sorted);
          haptic('selection');
          actions.setReminderDays(sorted);
          buildDayChips();
        } }
      }, `D-${d}`));
    });
    daysWrap.appendChild(row);
  };
  buildDayChips();

  const notifyToggle = toggle(settings.notifyEnabled, async (next) => {
    const r = await actions.toggleNotify(next);
    if (next && r && r.permission === 'denied') {
      notifyToggle.setState(false);
      geoOptions.hidden = true;
      haptic('warning');
      showToast('위치 권한이 없어요. 기기 설정에서 허용해 주세요.', 'danger');
      return;
    }
    geoOptions.hidden = !next;
    haptic('light');
    showToast(next ? '근처 알림을 켰어요' : '근처 알림을 껐어요');
  }, { label: '가게 근처 알림' });

  const remindToggle = toggle(settings.remindersEnabled, async (next) => {
    const { permission } = await actions.toggleReminders(next);
    daysWrap.hidden = !next;
    if (!next) { haptic('light'); showToast('만료 알림을 껐어요'); }
    else if (permission === 'granted') { haptic('success'); showToast('만료 알림을 켰어요'); }
    else { haptic('warning'); showToast('알림 권한이 없어 앱을 열 때만 알려드려요', 'danger'); }
  }, { label: '만료 임박 알림' });

  root.appendChild(listGroup('알림',
    listRow({ icon: 'location', title: '가게 근처 알림', subtitle: '저장한 위치 근처에 머물면 알려드려요', trailing: notifyToggle }),
    geoOptions,
    listRow({ icon: 'bell', title: '만료 임박 알림', subtitle: platform.supportsScheduledReminders ? 'D-7 · D-3 · D-1 오전 9시, 금액권 잔액 20% 이하' : 'D-7 · D-3 · D-1, 금액권 잔액 20% 이하 (앱을 열 때 확인)', trailing: remindToggle }),
    daysWrap
  ));

  // ── 데이터 ──
  const snapshotRow = listRow({
    icon: 'check', title: '자동 보관',
    subtitle: platform.isIOS ? '변경할 때마다 앱 안에 자동 저장돼요' : '변경할 때마다 브라우저 안에 자동 저장돼요'
  });
  lastSnapshotAt().then((ts) => {
    if (!ts) return;
    const sub = snapshotRow.querySelector('.row-sub');
    if (sub) sub.textContent = `마지막 자동 저장 ${formatDate(ts)}`;
  });

  const backupSub = settings.lastBackupAt ? `마지막 백업 ${formatDate(settings.lastBackupAt)}` : '아직 백업한 적이 없어요';
  const exportRow = listRow({
    icon: 'share', title: platform.isIOS ? '백업 파일 내보내기' : 'JSON 파일로 백업', subtitle: backupSub,
    onClick: () => actions.exportData()
  });

  const importRow = platform.canPickFiles
    ? listRow({ icon: 'download', title: '백업 파일에서 복원', subtitle: '.json 백업을 불러와 합쳐요', onClick: () => actions.importFromPicker() })
    : listRow({ icon: 'download', title: '백업 파일에서 복원', subtitle: '이 앱에서는 파일 선택을 지원하지 않아요. 웹(coupon.lightonpluslab.com)에서 복원해 주세요.', disabled: true });

  const dataRows = [snapshotRow, exportRow, importRow];

  // Website only: ask the browser to keep IndexedDB durable.
  if (!platform.isNative) {
    const persistRow = listRow({ icon: 'alert', title: '영구 보관', subtitle: '확인 중…' });
    dataRows.push(persistRow);
    (async () => {
      const [persisted, est] = await Promise.all([isPersisted(), storageEstimate()]);
      const usageText = est && est.usage ? ` · 사용 중 ${(est.usage / (1024 * 1024)).toFixed(1)} MB` : '';
      const sub = persistRow.querySelector('.row-sub');
      if (persisted) {
        if (sub) sub.textContent = `켜짐 ✓ 브라우저가 데이터를 지우지 않아요${usageText}`;
      } else {
        if (sub) sub.textContent = `꺼짐 — 저장 공간 부족 시 삭제될 수 있어요${usageText}`;
        const enableBtn = h('button', {
          class: 'btn btn-secondary', attrs: { type: 'button' },
          on: { click: async () => {
            const r = await requestPersistentStorage();
            showToast(
              r === 'persisted' ? '영구 보관이 켜졌어요'
                : r === 'denied' ? '브라우저가 허용하지 않았어요'
                  : '이 브라우저는 지원하지 않아요',
              r === 'persisted' ? 'success' : 'danger'
            );
            router.navigate('settings');
          } }
        }, '켜기');
        persistRow.appendChild(enableBtn);
      }
    })();
  }

  dataRows.push(listRow({
    icon: 'sparkle', title: '샘플 업체 추가', subtitle: '기능을 둘러볼 수 있는 예시 3개',
    onClick: async () => {
      const added = await actions.seedDemo();
      haptic('light');
      showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
    }
  }));
  dataRows.push(listRow({
    icon: 'x', title: '모든 데이터 삭제', subtitle: '업체와 사용 내역을 모두 지워요', danger: true,
    onClick: async () => {
      const ok = await showConfirm({
        title: '전체 초기화',
        message: '모든 업체와 사용 내역을 삭제할까요? 먼저 백업하는 걸 권장해요. 이 작업은 되돌릴 수 없어요.',
        confirmLabel: '모두 삭제',
        danger: true
      });
      if (!ok) return;
      await actions.clearAll();
      haptic('heavy');
      showToast('전체 데이터를 초기화했어요');
    }
  }));
  root.appendChild(listGroup('데이터', ...dataRows));

  // ── 앱 ──
  const appRows = [];
  if (!pwa.isStandalone()) {
    if (pwa.canInstall()) {
      appRows.push(listRow({ icon: 'download', title: '홈 화면에 설치', subtitle: '앱처럼 바로 열 수 있어요', onClick: () => actions.requestInstall() }));
    } else if (pwa.isIos()) {
      appRows.push(listRow({ icon: 'download', title: '홈 화면에 추가', subtitle: 'Safari 공유 버튼 → "홈 화면에 추가"' }));
    }
  }
  appRows.push(listRow({
    icon: 'alert', title: '개인정보처리방침', subtitle: '계정 없음 · 데이터는 내 기기에만',
    onClick: () => platform.openExternal(platform.isNative ? URLS.privacy : 'privacy.html', { inApp: true })
  }));
  appRows.push(listRow({ icon: 'store', title: 'LightOn Plus Lab', subtitle: '만든 곳 · lightonpluslab.com', onClick: () => platform.openExternal(URLS.studio, { inApp: true }) }));
  appRows.push(listRow({ icon: 'megaphone', title: '문의하기', subtitle: URLS.support, onClick: () => platform.openExternal(`mailto:${URLS.support}?subject=${encodeURIComponent('[쿠폰북] 문의')}`) }));
  appRows.push(listRow({ icon: 'sparkle', title: '버전', trailing: `${APP_VERSION}${platform.isNative ? ` · ${platform.platform}` : ''}` }));
  root.appendChild(listGroup('앱', ...appRows));

  root.appendChild(h('p', { class: 'field-hint settings-footer' },
    '쿠폰북 · 계정 없이 내 기기에만 저장되는 개인 쿠폰 지갑',
    h('br'),
    '© LightOn Plus Lab'));

  return root;
}
