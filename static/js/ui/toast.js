// ui/toast.js — single reusable, accessible toast. Optional inline action
// button (e.g. one-tap undo after a quick use).

import { h, icon, clear } from '../core/h.js';

const COLORS = {
  success: 'var(--success)',
  danger: 'var(--danger)',
  accent: 'var(--accent)'
};

let dismissTimer = null;

/**
 * showToast(msg, type='success', opts?)
 *   opts.actionLabel + opts.onAction — inline action button; the toast then
 *   lingers longer so the action is reachable. aria-live status region.
 */
export function showToast(msg, type = 'success', opts = {}) {
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
  if (opts.actionLabel && typeof opts.onAction === 'function') {
    el.appendChild(h('button', {
      class: 'toast-action',
      attrs: { type: 'button' },
      on: {
        click: () => {
          el.classList.remove('active');
          if (dismissTimer) clearTimeout(dismissTimer);
          opts.onAction();
        }
      }
    }, opts.actionLabel));
  }
  el.classList.add('active');
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => el.classList.remove('active'), opts.actionLabel ? 4500 : 2200);
}
