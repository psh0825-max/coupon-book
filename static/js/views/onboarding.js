// views/onboarding.js — accessible 3-step first-run intro. Local step state with
// re-render of the card subtree. Skippable. Permissions are requested only when
// the user taps the matching button (never automatically).

import { h, clear } from '../core/h.js';
import { showToast } from '../ui/toast.js';
import { illust } from '../ui/art.js';
import { haptic } from '../services/fx.js';

const STEPS = 3;

export function render(ctx) {
  const { router, actions } = ctx;
  let step = 0;

  const root = h('div', { class: 'onboarding' });

  const finish = (next = 'home') => {
    actions.completeOnboarding();
    router.navigate(next);
  };

  root.appendChild(h('div', { class: 'onboarding-top' },
    h('div', { class: 'onboarding-dots', attrs: { 'aria-hidden': 'true' } },
      Array.from({ length: STEPS }, (_, i) => h('span', { class: `dot${i === 0 ? ' active' : ''}` }))
    ),
    h('button', {
      class: 'btn btn-ghost onboarding-skip',
      attrs: { type: 'button' },
      on: { click: () => finish('home') }
    }, '건너뛰기')
  ));

  const card = h('div', { class: 'card onboarding-card' });
  root.appendChild(card);

  const hero = (eyebrow, heading, body, level = 'h2', art = null) => h('div', { class: 'onboarding-hero' },
    art ? illust(art) : null,
    h('div', { class: 'eyebrow' }, eyebrow),
    h(level, null, heading),
    h('p', null, body)
  );

  function syncDots() {
    root.querySelectorAll('.onboarding-dots .dot').forEach((d, i) => d.classList.toggle('active', i === step));
    root.setAttribute('aria-label', `시작하기 ${step + 1} / ${STEPS}`);
  }

  function renderFooter() {
    const footer = h('div', { class: 'onboarding-footer' });
    footer.appendChild(step > 0
      ? h('button', { class: 'btn btn-ghost', attrs: { type: 'button' }, on: { click: () => { step -= 1; renderStep(); } } }, '이전')
      : h('span'));
    if (step < STEPS - 1) {
      footer.appendChild(h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => { step += 1; renderStep(); } } }, '다음'));
    } else {
      footer.appendChild(h('button', {
        class: 'btn btn-primary',
        attrs: { type: 'button' },
        on: { click: () => finish('home') }
      }, '시작하기'));
    }
    return footer;
  }

  function renderStep() {
    clear(card);
    syncDots();
    if (step === 0) {
      card.appendChild(hero('환영해요', '쿠폰북에 오신 걸 환영해요',
        '카페 도장판, 마사지 회수권, 금액권을 한곳에 모아 잔액과 만료일을 관리하세요. 계정 없이, 모든 정보는 이 기기에만 저장돼요.', 'h1', 'wallet'));
    } else if (step === 1) {
      card.appendChild(hero('시작하기', '첫 쿠폰을 등록해 볼까요?',
        '지갑 속 도장판부터 옮겨 담아 보세요. 30초면 충분해요. 먼저 둘러보고 싶다면 샘플로 시작할 수도 있어요.', 'h2', 'stamps'));
      const addBtn = h('button', { class: 'btn btn-primary btn-block', attrs: { type: 'button' } }, '첫 쿠폰 등록');
      addBtn.addEventListener('click', () => finish('add'));
      const sampleBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' } }, '샘플로 둘러보기');
      sampleBtn.addEventListener('click', async () => {
        const added = await actions.seedDemo();
        haptic('light');
        showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
        step = 2;
        renderStep();
      });
      card.appendChild(h('div', { class: 'onboarding-choices' }, addBtn, sampleBtn));
    } else {
      card.appendChild(hero('놓치지 않기', '만료 알림을 받아보세요',
        '만료가 다가오면 D-7 · D-3 · D-1에 미리 알려드려요. 알림은 원할 때 설정에서 언제든 끌 수 있어요.', 'h2', 'bell'));
      const remindBtn = h('button', {
        class: 'btn btn-secondary btn-block',
        attrs: { type: 'button' }
      }, '만료 알림 켜기');
      remindBtn.addEventListener('click', async () => {
        const { permission } = await actions.toggleReminders(true);
        if (permission === 'granted') {
          remindBtn.textContent = '만료 알림 켜짐 ✓';
          remindBtn.disabled = true;
          haptic('success');
          showToast('만료 알림이 켜졌어요');
        } else {
          haptic('warning');
          showToast('알림 권한이 없어 앱을 열 때만 알려드려요', 'danger');
        }
      });
      card.appendChild(remindBtn);
    }
    card.appendChild(renderFooter());
  }

  renderStep();
  return root;
}
