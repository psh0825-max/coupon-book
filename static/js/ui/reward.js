// ui/reward.js — full-screen reward modal for a completed stamp card
// (reduced-motion aware, focus-managed).

import { h, icon, frag } from '../core/h.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** showReward({ shopName, total, onRenew }) — celebratory completion modal. */
export function showReward({ shopName, total, onRenew } = {}) {
  const prevFocus = document.activeElement;

  const closeBtn = h('button', {
    class: 'btn btn-primary btn-block',
    id: 'reward-close',
    attrs: { type: 'button' }
  }, '보상 받으러 가기');

  const renewBtn = typeof onRenew === 'function'
    ? h('button', { class: 'btn btn-ghost btn-block', attrs: { type: 'button' } }, '새 도장판으로 다시 시작')
    : null;

  const card = h('div', { class: 'reward-card' },
    h('div', { class: 'reward-badge', attrs: { 'aria-hidden': 'true' } }, icon('trophy')),
    h('div', { class: 'reward-eyebrow' }, '도장판 완성'),
    h('h2', null, '축하해요! 🎉'),
    h('p', null, frag(
      h('strong', null, shopName),
      ` 도장 ${total}개를`,
      h('br'),
      '모두 모았어요. 가게에서 보상을 받으세요.'
    )),
    closeBtn,
    renewBtn
  );

  const modal = h('div', {
    id: 'reward-modal',
    class: 'reward-modal',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '도장판 완성' }
  }, card);

  const existing = document.getElementById('reward-modal');
  if (existing) existing.remove();
  document.body.appendChild(modal);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    }, 320);
  };

  const trapFocus = (e) => {
    const items = Array.from(card.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !card.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onKeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') trapFocus(e);
  };
  document.addEventListener('keydown', onKeydown, true);

  closeBtn.addEventListener('click', close);
  if (renewBtn) renewBtn.addEventListener('click', () => { close(); onRenew(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  requestAnimationFrame(() => {
    modal.classList.add('active');
    closeBtn.focus();
  });

  return modal;
}
