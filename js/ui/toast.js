// ui/toast.js — single reusable, accessible toast.

import { h, icon, clear } from '../core/h.js';

const COLORS = {
  success: 'var(--success)',
  danger: 'var(--danger)',
  accent: 'var(--accent)'
};

let dismissTimer = null;

/** showToast(msg, type='success') — aria-live status region, auto-dismiss. */
export function showToast(msg, type = 'success') {
  const color = COLORS[type] || COLORS.success;
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', {
      id: 'toast',
      class: 'toast',
      attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }
    });
    document.body.appendChild(el);
  }
  const check = icon('check');
  check.style.setProperty('stroke', color);
  clear(el);
  el.appendChild(check);
  el.appendChild(h('span', null, msg));
  el.classList.add('active');
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => el.classList.remove('active'), 2200);
}
