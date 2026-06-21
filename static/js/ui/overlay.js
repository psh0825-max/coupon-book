// ui/overlay.js — accessible bottom-sheet / modal. No inline onclick.
// Provides: showSheet, showConfirm, closeOverlay.

import { h, icon, clear } from '../core/h.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

let titleSeq = 0;
let activeState = null; // { overlay, onClose, prevFocus, onKeydown }

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function trapFocus(sheet, e) {
  if (e.key !== 'Tab') return;
  const items = getFocusable(sheet);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !sheet.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * showSheet({ title, body, actions, onClose })
 *  - body: Node | string (string rendered as plain text via textContent)
 *  - actions: [{ id, label, className, onClick, close }]
 *    each button runs onClick then closes unless close === false.
 */
export function showSheet({ title, body, actions = [], onClose } = {}) {
  closeOverlay(true); // tear down any previous overlay synchronously

  const titleId = `sheet-title-${++titleSeq}`;
  const prevFocus = document.activeElement;

  const closeBtn = h('button', {
    class: 'btn btn-ghost',
    attrs: { type: 'button', 'aria-label': '닫기' },
    on: { click: () => closeOverlay() }
  }, icon('x', { size: 20 }));

  const bodyNode = body instanceof Node
    ? body
    : h('div', null, body == null ? '' : String(body));

  const footer = h('div', { class: 'popup-footer' },
    actions.map((a) => h('button', {
      class: `btn ${a.className || 'btn-secondary'}`,
      attrs: { type: 'button' },
      on: {
        click: () => {
          a.onClick?.();
          if (a.close !== false) closeOverlay();
        }
      }
    }, a.label))
  );

  const sheet = h('div', {
    class: 'popup-sheet',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }
  },
    h('div', { class: 'popup-header' },
      h('h3', { id: titleId }, title),
      closeBtn
    ),
    h('div', { class: 'popup-body' }, bodyNode),
    actions.length ? footer : null
  );

  const overlay = h('div', {
    id: 'overlay',
    class: 'overlay',
    on: { click: (e) => { if (e.target === overlay) closeOverlay(); } }
  }, sheet);

  document.body.appendChild(overlay);
  document.body.classList.add('overlay-open');

  const onKeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
    else trapFocus(sheet, e);
  };
  document.addEventListener('keydown', onKeydown, true);

  activeState = { overlay, onClose, prevFocus, onKeydown };

  requestAnimationFrame(() => {
    overlay.classList.add('active');
    const focusables = getFocusable(sheet);
    (focusables[0] || closeBtn).focus();
  });

  return overlay;
}

/** showConfirm(...) -> Promise<boolean> built on showSheet. */
export function showConfirm({ title, message, confirmLabel = '확인', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const settle = (value) => { if (!answered) { answered = true; resolve(value); } };
    showSheet({
      title,
      body: h('p', { class: 'confirm-message' }, message),
      onClose: () => settle(false),
      actions: [
        { id: 'cancel', label: '취소', className: 'btn-secondary', onClick: () => settle(false) },
        {
          id: 'confirm',
          label: confirmLabel,
          className: danger ? 'btn-danger' : 'btn-primary',
          onClick: () => settle(true)
        }
      ]
    });
  });
}

/** closeOverlay(immediate?) — animate out, fire onClose, restore focus. */
export function closeOverlay(immediate = false) {
  const state = activeState;
  if (!state) return;
  activeState = null;

  const { overlay, onClose, prevFocus, onKeydown } = state;
  document.removeEventListener('keydown', onKeydown, true);
  document.body.classList.remove('overlay-open');
  overlay.classList.remove('active');

  const finish = () => {
    overlay.remove();
    onClose?.();
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
  };

  if (immediate) {
    clear(overlay);
    finish();
  } else {
    setTimeout(finish, 400);
  }
}
