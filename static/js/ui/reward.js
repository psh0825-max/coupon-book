// ui/reward.js — full-screen reward modal (reduced-motion aware, focus-managed).

import { h, icon, frag } from '../core/h.js';

/** showReward({ shopName, total }) — celebratory completion modal. */
export function showReward({ shopName, total } = {}) {
  const prevFocus = document.activeElement;

  const closeBtn = h('button', {
    class: 'btn btn-primary btn-block',
    id: 'reward-close',
    attrs: { type: 'button' }
  }, '보상 받기');

  const card = h('div', { class: 'reward-card' },
    h('div', { class: 'reward-badge' }, icon('trophy')),
    h('div', { class: 'reward-eyebrow' }, 'REWARD UNLOCKED'),
    h('h2', null, '완성! 🎉'),
    h('p', null, frag(
      h('strong', null, shopName),
      ` 쿠폰 ${total}개를`,
      h('br'),
      '모두 모았어요'
    )),
    closeBtn
  );

  const modal = h('div', {
    id: 'reward-modal',
    class: 'reward-modal',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '보상 획득' }
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

  const onKeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKeydown, true);

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  requestAnimationFrame(() => {
    modal.classList.add('active');
    closeBtn.focus();
  });

  return modal;
}
