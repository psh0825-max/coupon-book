// ui/components.js — reusable presentational pieces. Return DOM Nodes built via h.
// All status/expiry/progress math comes from domain.js (never recomputed here).

import { h, icon } from '../core/h.js';
import {
  couponStatus, remainingValue, progressPercent, formatExpiry, isCompleted,
  isAmountKind, isStampKind, passTotal, passUsed, remainingLabel, totalLabel, usedLabel, kindLabel
} from '../domain.js';
import { formatDate, formatRelative, formatWon, formatDistance } from '../services/format.js';
import { SKINS, getCategoryIcon } from '../data/skins.js';
import { illust } from './art.js';

/**
 * stampBoard(total, used, { reward }) — collect model: filled cells are stamps
 * already collected / sessions already used, empty cells are still to come, the
 * next cell pulses. With `reward` the last cell shows a gift (도장판 완성 보상).
 */
export function stampBoard(total, used, { reward = false } = {}) {
  const cells = [];
  const cols = total <= 5 ? total : total % 6 === 0 && total <= 12 ? 6 : 5;
  for (let i = 0; i < total; i++) {
    const filled = i < used;
    const isLast = i === total - 1;
    const classes = ['stamp', filled ? 'filled' : 'empty'];
    if (!filled && i === used) classes.push('next');
    if (reward && isLast) classes.push('reward');
    const content = filled
      ? icon('check')
      : (reward && isLast ? icon('gift') : h('span', { class: 'stamp-n' }, String(i + 1)));
    cells.push(h('div', { class: classes.join(' '), attrs: { 'aria-hidden': 'true' } }, content));
  }
  return h('div', {
    class: 'stamp-board',
    style: { '--cols': String(cols) },
    attrs: { role: 'img', 'aria-label': `${total}개 중 ${used}개 ${reward ? '적립' : '사용'}` }
  }, cells);
}

/** Small progress bar (0..100) with success tint when full. */
export function progressBar(percent) {
  return h('div', { class: 'progress-bar', attrs: { 'aria-hidden': 'true' } },
    h('div', { class: `progress-fill${percent >= 100 ? ' success' : ''}`, style: { width: `${percent}%` } })
  );
}

/** shopCard(shop, { onOpen, onQuickUse }) — keyboard-activatable card. */
export function shopCard(shop, { onOpen, onQuickUse } = {}) {
  const status = couponStatus(shop);
  const percent = progressPercent(shop);
  const remaining = remainingValue(shop);
  const complete = isCompleted(shop) || remaining <= 0;
  const stamp = isStampKind(shop);
  const amount = isAmountKind(shop);
  const subParts = [shop.category, kindLabel(shop.kind)];
  if (shop.expiresAt) subParts.push(formatExpiry(shop.expiresAt));

  const quickLabel = stamp ? '도장' : '사용';
  const quickUse = h('button', {
    class: 'card-quick-use',
    attrs: {
      type: 'button', 'data-action': 'quick-use',
      'aria-label': `${shop.name} ${stamp ? '도장 찍기' : '이용권 사용'}`,
      disabled: complete ? '' : null
    },
    on: { click: () => { if (!complete) onQuickUse?.(shop); } }
  }, complete ? (stamp ? '완성' : '소진') : quickLabel);

  let body;
  if (stamp) {
    const hint = complete
      ? '도장판 완성! 보상을 받으세요'
      : `${remaining}개 더 모으면 보상`;
    body = h('div', { class: 'card-body' },
      stampBoard(passTotal(shop), passUsed(shop), { reward: true }),
      h('div', { class: 'card-meta' },
        h('span', { class: `reward-hint${complete ? ' done' : ''}` }, hint),
        h('span', { class: 'card-count' }, `${passUsed(shop)} / ${passTotal(shop)}`)
      )
    );
  } else {
    body = h('div', { class: 'card-body' },
      h('div', { class: 'card-balance' },
        h('strong', null, complete ? (amount ? '0원' : '0회') : remainingLabel(shop)),
        h('span', null, complete ? '모두 사용했어요' : '남음')
      ),
      progressBar(percent),
      h('div', { class: 'card-meta' },
        h('span', null, `총 ${totalLabel(shop)}`),
        h('span', null, `사용 ${usedLabel(shop)}`)
      )
    );
  }

  const cardMain = h('button', {
    class: 'card-main',
    attrs: { type: 'button', 'aria-label': `${shop.name}, ${status.label}, 상세 보기` },
    on: { click: () => onOpen?.(shop) }
  },
    h('div', { class: 'card-top' },
      h('div', { class: 'card-icon', attrs: { 'aria-hidden': 'true' } },
        h('span', { class: 'category-icon' }, getCategoryIcon(shop.category))
      ),
      h('div', { class: 'card-info' },
        h('h3', null, shop.name),
        h('div', { class: 'card-sub' }, subParts.join(' · '))
      ),
      h('span', { class: `badge badge-${status.className}` }, status.label)
    ),
    body
  );

  const footerText = shop.memo ? shop.memo : (shop.address || shop.phone || '');
  return h('div', {
    class: `card${complete ? ' is-complete' : ''}`,
    dataset: { skin: shop.skin || 'midnight', id: shop.id, kind: shop.kind || 'count' }
  },
    cardMain,
    h('div', { class: 'card-footer' },
      h('span', null, footerText),
      quickUse
    )
  );
}

/** summaryCard(value, label, tone) — stat tile. tone: 'accent'|'warning'|'success'|'' */
export function summaryCard(value, label, tone = '') {
  return h('div', { class: `summary-card${tone ? ' tone-' + tone : ''}` },
    h('div', { class: 'value' }, String(value)),
    h('div', { class: 'label' }, label)
  );
}

/** timelineItem(log, shopName) — usage history row. */
export function timelineItem(log, shopName) {
  const deduct = log.amount != null
    ? `${formatWon(log.amount)} 사용`
    : log.count != null ? `${log.count}회` : null;
  return h('div', { class: 'timeline-item success' },
    h('div', { class: 'timeline-dot', attrs: { 'aria-hidden': 'true' } }),
    h('div', { class: 'timeline-time' }, `${formatDate(log.usedAt)} · ${formatRelative(log.usedAt)}`),
    h('div', { class: 'timeline-title' }, shopName),
    deduct ? h('div', { class: 'timeline-deduct' }, deduct) : null,
    log.note ? h('div', { class: 'timeline-note' }, log.note) : null
  );
}

/** nearbyCard(shop, distance, onClick) — geofence proximity entry. */
export function nearbyCard(shop, distance, onClick) {
  return h('button', {
    class: 'nearby-card',
    attrs: { type: 'button' },
    on: onClick ? { click: onClick } : null
  },
    h('div', { class: 'icon', attrs: { 'aria-hidden': 'true' } }, icon('location')),
    h('div', { class: 'info' },
      h('h4', null, shop.name),
      h('p', null, `${shop.address || shop.category} · ${formatDistance(distance)}`)
    ),
    h('div', { class: 'badge badge-accent' }, `${remainingLabel(shop)} 남음`)
  );
}

/** skinSelector(currentSkin, onSelect) — horizontal swatch row (role=radiogroup). */
export function skinSelector(currentSkin, onSelect) {
  const row = h('div', { class: 'skin-row', attrs: { role: 'radiogroup', 'aria-label': '카드 색상' } });
  Object.entries(SKINS).forEach(([key, skin]) => {
    const option = h('button', {
      class: `skin-option${key === currentSkin ? ' selected' : ''}`,
      dataset: { skin: key },
      attrs: { type: 'button', role: 'radio', 'aria-checked': key === currentSkin ? 'true' : 'false', 'aria-label': skin.name },
      on: {
        click: () => {
          row.querySelectorAll('.skin-option').forEach((el) => {
            el.classList.remove('selected');
            el.setAttribute('aria-checked', 'false');
          });
          option.classList.add('selected');
          option.setAttribute('aria-checked', 'true');
          onSelect?.(key);
        }
      }
    },
      h('span', { class: 'swatch', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'name' }, skin.name)
    );
    row.appendChild(option);
  });
  return row;
}

/** emptyState({ icon, art, title, desc, actions }) — placeholder with optional CTAs. */
export function emptyState({ icon: iconName, art, title, desc, actions = [] } = {}) {
  let visual = art ? illust(art) : null;
  if (!visual) {
    visual = icon(iconName || 'gift', { size: 48 });
    visual.classList.add('empty-icon');
  }
  return h('div', { class: 'empty-state wide' },
    visual,
    h('h3', null, title),
    desc ? h('p', null, desc) : null,
    actions.length
      ? h('div', { class: 'empty-actions' },
          actions.map((a) => h('button', {
            class: `btn ${a.className || 'btn-secondary'}`,
            attrs: { type: 'button' },
            on: a.onClick ? { click: a.onClick } : null
          }, a.label))
        )
      : null
  );
}

/** sectionHeader(title, subtitle?, action?) — action: { label, onClick } */
export function sectionHeader(title, subtitle, action) {
  return h('div', { class: 'section-head' },
    h('div', null,
      h('h2', null, title),
      subtitle ? h('p', null, subtitle) : null
    ),
    action ? h('button', {
      class: 'section-action', attrs: { type: 'button' }, on: { click: action.onClick }
    }, action.label, icon('chevron-right', { size: 16 })) : null
  );
}

/**
 * chipRow(items, { value, onChange, ariaLabel, multiple }) — single-select chip
 * group (aria-pressed). items: [{ value, label }]. Returns the row element with a
 * `.setValue(v)` helper for external updates.
 */
export function chipRow(items, { value, onChange, ariaLabel } = {}) {
  let current = value;
  const row = h('div', { class: 'chip-row', attrs: { role: 'group', 'aria-label': ariaLabel || '' } });
  const buttons = items.map((it) => h('button', {
    class: `chip${it.value === current ? ' active' : ''}`,
    dataset: { value: String(it.value) },
    attrs: { type: 'button', 'aria-pressed': it.value === current ? 'true' : 'false' },
    on: { click: () => { row.setValue(it.value); onChange?.(it.value); } }
  }, it.label));
  buttons.forEach((b) => row.appendChild(b));
  row.setValue = (v) => {
    current = v;
    buttons.forEach((b) => {
      const on = b.dataset.value === String(v);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };
  return row;
}

/** toggle(initial, onToggle) — accessible switch (role=switch). */
export function toggle(initial, onToggle, { label } = {}) {
  let state = !!initial;
  const el = h('button', {
    class: `toggle-switch${state ? ' active' : ''}`,
    attrs: { type: 'button', role: 'switch', 'aria-checked': state ? 'true' : 'false', 'aria-label': label || null }
  });
  el.addEventListener('click', () => {
    state = !state;
    el.classList.toggle('active', state);
    el.setAttribute('aria-checked', state ? 'true' : 'false');
    onToggle?.(state);
  });
  el.setState = (next) => {
    state = !!next;
    el.classList.toggle('active', state);
    el.setAttribute('aria-checked', state ? 'true' : 'false');
  };
  return el;
}

/**
 * listRow({ title, subtitle, icon, trailing, onClick, danger, disabled }) — iOS-style
 * grouped-list row. `trailing` is a Node (e.g. a toggle) or text; rows with onClick
 * render as buttons with a chevron.
 */
export function listRow({ title, subtitle, icon: iconName, trailing, onClick, danger = false, disabled = false } = {}) {
  const inner = [
    iconName ? h('span', { class: 'row-icon', attrs: { 'aria-hidden': 'true' } }, icon(iconName, { size: 20 })) : null,
    h('span', { class: 'row-text' },
      h('span', { class: 'row-title' }, title),
      subtitle ? h('span', { class: 'row-sub' }, subtitle) : null
    ),
    trailing instanceof Node ? trailing : (trailing ? h('span', { class: 'row-trailing' }, String(trailing)) : null),
    onClick ? icon('chevron-right', { size: 18, class: 'row-chevron' }) : null
  ];
  if (onClick) {
    return h('button', {
      class: `list-row${danger ? ' danger' : ''}`,
      attrs: { type: 'button', disabled: disabled ? '' : null },
      on: { click: onClick }
    }, inner);
  }
  return h('div', { class: `list-row${danger ? ' danger' : ''}` }, inner);
}

/** listGroup(title?, ...rows) — rounded container for listRow items. */
export function listGroup(title, ...rows) {
  return h('section', { class: 'list-group' },
    title ? h('h3', { class: 'list-group-title' }, title) : null,
    h('div', { class: 'list-group-body' }, rows)
  );
}
