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
  const glyph = icon(type === 'danger' ? 'alert' : 'check');
  glyph.style.setProperty('stroke', color);
  clear(el);
  el.appendChild(glyph);
  el.appendChild(h('span', null, msg));
  el.classList.add('active');
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => el.classList.remove('active'), 2200);
}
