// views/onboarding.js — accessible 3-step first-run intro. Local step state with
// re-render of the card subtree. Skippable.

import { h, clear } from '../core/h.js';
import { showToast } from '../ui/toast.js';

export function render(ctx) {
  const { router, actions } = ctx;
  let step = 0;

  const root = h('div', { class: 'onboarding' });

  root.appendChild(h('div', { class: 'onboarding-top' },
    h('button', {
      class: 'btn btn-ghost onboarding-skip',
      attrs: { type: 'button' },
      on: { click: () => { actions.completeOnboarding(); router.navigate('home'); } }
    }, '건너뛰기')
  ));

  const card = h('div', { class: 'card onboarding-card' });
  root.appendChild(card);

  const hero = (eyebrow, heading, body, level = 'h2') => h('div', { class: 'product-hero' },
    h('div', null,
      h('div', { class: 'eyebrow' }, eyebrow),
      h(level, null, heading),
      h('p', null, body)
    )
  );

  function renderFooter() {
    const footer = h('div', { class: 'onboarding-footer' });
    if (step > 0) {
      footer.appendChild(h('button', { class: 'btn btn-ghost', attrs: { type: 'button' }, on: { click: () => { step -= 1; renderStep(); } } }, '이전'));
    }
    if (step < 2) {
      footer.appendChild(h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => { step += 1; renderStep(); } } }, '다음'));
    } else {
      footer.appendChild(h('button', {
        class: 'btn btn-primary',
        attrs: { type: 'button' },
        on: { click: () => { actions.completeOnboarding(); router.navigate('home'); } }
      }, '시작하기'));
    }
    return footer;
  }

  function renderStep() {
    clear(card);
    if (step === 0) {
      card.appendChild(hero('WELCOME', '쿠폰북에 오신 걸 환영해요',
        '도장판과 쿠폰을 한곳에서 관리하세요. 모든 정보는 이 기기에만 저장돼요.', 'h1'));
    } else if (step === 1) {
      card.appendChild(hero('GET STARTED', '어떻게 시작할까요?',
        '샘플 업체로 둘러보거나, 바로 내 쿠폰을 추가할 수 있어요.'));
      const sampleBtn = h('button', { class: 'btn btn-secondary btn-block', attrs: { type: 'button' } }, '샘플 보기');
      sampleBtn.addEventListener('click', async () => { await actions.seedDemo(); step = 2; renderStep(); });
      const addBtn = h('button', { class: 'btn btn-primary btn-block', attrs: { type: 'button' } }, '직접 추가');
      addBtn.addEventListener('click', () => { actions.completeOnboarding(); router.navigate('add'); });
      card.appendChild(h('div', { class: 'onboarding-choices' }, sampleBtn, addBtn));
    } else {
      card.appendChild(hero('STAY ON TRACK', '만료 알림을 받아보세요',
        '쿠폰 만료가 다가오면 D-7 / D-3 / D-1 에 미리 알려드려요.'));
      const remindBtn = h('button', {
        class: 'btn btn-secondary btn-block',
        attrs: { type: 'button' }
      }, '만료 알림 켜기');
      remindBtn.addEventListener('click', async () => {
        const { permission } = await actions.toggleReminders(true);
        if (permission === 'granted') {
          remindBtn.textContent = '만료 알림 켜짐';
          showToast('만료 알림이 켜졌어요');
        } else {
          showToast('알림 권한이 차단돼 앱 실행 중에만 알려드려요', 'danger');
        }
      });
      card.appendChild(remindBtn);
    }
    card.appendChild(renderFooter());
  }

  renderStep();
  return root;
}
