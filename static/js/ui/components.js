// ui/components.js — reusable presentational pieces. Return DOM Nodes built via h.
// All status/expiry/progress math comes from domain.js (never recomputed here).

import { h, icon, frag } from '../core/h.js';
import {
  couponStatus, remainingValue, progressPercent, formatExpiry, isCompleted,
  isAmountKind, isCountKind, passTotal, passUsed, remainingLabel, totalLabel, usedLabel, isArchived, isCouponKind,
  isCollectMode } from '../domain.js';
import { formatDate, formatRelative, formatWon } from '../services/format.js';
import { SKINS, getCategoryIcon } from '../data/skins.js';
import { illust } from './art.js';

/** stampBoard(total, used, { collect }) — two readings of the same counts.
 *  Depletion (default): VALID tickets cluster at the start and disappear
 *  (become SPENT) as `used` grows; the next ticket to be torn off is highlighted.
 *  Collect: `used` stamps are filled from the start and the board fills up; the
 *  next empty slot is highlighted. */
export function stampBoard(total, used, { collect = false } = {}) {
  const stamps = [];
  if (collect) {
    const filled = Math.min(total, Math.max(0, used));
    for (let i = 0; i < total; i++) {
      const on = i < filled;
      const classes = ['stamp', on ? 'valid' : 'empty'];
      if (i === filled) classes.push('next'); // next slot to be stamped
      stamps.push(h('div', { class: classes.join(' ') }, on ? icon('check') : null));
    }
    return h('div', {
      class: 'stamp-board collect',
      attrs: { role: 'img', 'aria-label': `도장 ${filled}/${total}` }
    }, stamps);
  }
  const remaining = Math.max(0, total - used);
  for (let i = 0; i < total; i++) {
    const valid = i < remaining;
    const classes = ['stamp', valid ? 'valid' : 'spent'];
    if (valid && i === remaining - 1) classes.push('next'); // next ticket to be used
    stamps.push(h('div', { class: classes.join(' ') }, valid ? icon('check') : null));
  }
  return h('div', { class: 'stamp-board' }, stamps);
}

/** shopCard(shop, { onOpen, onQuickUse }) — keyboard-activatable card. */
export function shopCard(shop, { onOpen, onQuickUse } = {}) {
  const status = couponStatus(shop);
  const percent = progressPercent(shop);
  const complete = isCompleted(shop) || remainingValue(shop) <= 0;
  const collect = isCollectMode(shop);
  const categoryText = shop.category + (shop.expiresAt ? ` · ${formatExpiry(shop.expiresAt)}` : '');

  // A full collect board is not a dead end like a spent pass: the button turns
  // into the way to start the next board (the caller confirms first).
  const quickLabel = collect ? (complete ? '새 판' : '도장 찍기') : '사용';
  const quickDisabled = complete && !collect;
  const quickUse = isArchived(shop) ? null : h('button', {
    class: 'card-quick-use',
    attrs: {
      type: 'button', 'data-action': 'quick-use',
      'aria-label': collect
        ? `${shop.name} ${complete ? '새 도장판 시작' : '도장 찍기'}`
        : `${shop.name} 이용권 사용`,
      disabled: quickDisabled ? '' : null
    },
    on: {
      click: () => { if (!quickDisabled) onQuickUse?.(shop); }
    }
  }, quickLabel);

  // A coupon's worth is the benefit it states; the remaining count already sits in
  // the progress row right above, so repeating it here would waste the line.
  const hintText = collect
    ? (complete ? '도장판 완성! 가게에서 보상을 받으세요' : `${remainingValue(shop)}개 더 모으면 완성`)
    : complete
      ? '모두 사용했어요'
      : (isCouponKind(shop) && shop.benefit)
        ? shop.benefit
        : isAmountKind(shop)
          ? `${remainingLabel(shop)} 남아있어요`
          : `${remainingValue(shop)}회 남았어요`;

  // Stamp board only makes sense for a count pass with a small, countable total.
  const showStamps = isCountKind(shop) && passTotal(shop) <= 30;

  const cardMain = h('button', {
    class: 'card-main',
    attrs: { type: 'button', 'aria-label': `${shop.name} ${status.label}, 상세 보기` },
    on: { click: () => onOpen?.(shop) }
  },
    h('div', { class: 'card-header' },
      h('div', { class: 'card-icon' },
        h('span', { class: 'category-icon' }, getCategoryIcon(shop.category))
      ),
      h('div', { class: 'card-info' },
        h('h3', null, shop.name),
        h('div', { class: 'category' }, categoryText)
      ),
      h('div', { class: `badge badge-${status.className}` }, status.label)
    ),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-progress-meta' },
        h('span', null, collect ? `도장 ${passUsed(shop)}/${passTotal(shop)}` : `${percent}%`),
        // The hint below already says how many stamps are left on a collect board.
        h('span', null, collect ? `${percent}%` : `${remainingLabel(shop)} 남음`)
      ),
      h('div', { class: 'progress-bar' },
        h('div', {
          class: `progress-fill${percent >= 100 ? ' success' : ''}`,
          style: { width: `${percent}%` }
        })
      ),
      h('div', { class: `reward-hint${complete ? ' done' : ''}` }, hintText),
      showStamps ? stampBoard(passTotal(shop), passUsed(shop), { collect }) : null
    )
  );

  const card = h('div', {
    class: `card${complete ? ' is-complete' : ''}`,
    dataset: { skin: shop.skin || 'midnight', id: shop.id }
  },
    cardMain,
    h('div', { class: 'card-footer' },
      h('span', null, shop.phone
        ? shop.phone
        : collect
          ? (shop.completedBoards ? `완성한 판 ${shop.completedBoards}개` : '적립형 도장판')
          : `${usedLabel(shop)} / ${totalLabel(shop)} 사용`),
      quickUse
    )
  );
  return card;
}

/** summaryCard(value, label, accent) — stat tile. */
export function summaryCard(value, label, accent) {
  return h('div', {
    class: 'summary-card',
    style: accent ? { '--accent': accent } : null
  },
    h('div', { class: 'value', style: accent ? { color: accent } : null }, value),
    h('div', { class: 'label' }, label)
  );
}

/** timelineItem(log, shopName, { collect }) — usage history row. A stamp on a
 *  collect board is recorded like a use (count) but reads as a stamp. */
export function timelineItem(log, shopName, { collect = false } = {}) {
  const deduct = log.amount != null
    ? `${formatWon(log.amount)} 사용`
    : log.count != null ? (collect ? `도장 ${log.count}개` : `${log.count}회 사용`) : null;
  return h('div', { class: 'timeline-item success' },
    h('div', { class: 'timeline-dot' }),
    h('div', { class: 'timeline-time' }, `${formatDate(log.usedAt)} · ${formatRelative(log.usedAt)}`),
    h('div', { class: 'timeline-title' }, shopName),
    deduct ? h('div', { class: 'timeline-deduct' }, deduct) : null,
    log.note ? h('div', { class: 'timeline-note' }, log.note) : null
  );
}

/** nearbyCard(shop, distance, onClick) — geofence proximity entry. */
export function nearbyCard(shop, distance, onClick) {
  return h('div', {
    class: 'nearby-card',
    on: onClick ? { click: onClick } : null
  },
    h('div', { class: 'icon', style: { background: 'var(--accent)' } }, icon('location')),
    h('div', { class: 'info' },
      h('h4', null, shop.name),
      h('p', null, `${shop.address || ''} · ${Math.round(distance)}m`)
    ),
    h('div', { class: 'badge badge-accent' }, `${remainingLabel(shop)} 남음`)
  );
}

/** adBanner({ slotId }) — free-tier ad placeholder slot. */
export function adBanner({ slotId } = {}) {
  return h('div', {
    class: 'ad-banner',
    id: slotId || null,
    attrs: { role: 'complementary', 'aria-label': '광고' }
  },
    h('span', { class: 'ad-badge' }, 'AD'),
    h('div', { class: 'ad-ico' }, icon('megaphone')),
    h('div', { class: 'ad-body' },
      h('h4', null, '광고 영역'),
      h('p', null, '무료 버전을 지원하는 광고가 표시됩니다')
    ),
    icon('chevron-right', { class: 'ad-chevron' })
  );
}

/** skinSelector(currentSkin, onSelect) — swatch grid; selecting updates highlight. */
export function skinSelector(currentSkin, onSelect) {
  const grid = h('div', { class: 'skin-grid' });
  Object.entries(SKINS).forEach(([key, skin]) => {
    const option = h('div', {
      class: `skin-option${key === currentSkin ? ' selected' : ''}`,
      dataset: { skin: key },
      on: {
        click: () => {
          grid.querySelectorAll('.skin-option').forEach((el) => el.classList.remove('selected'));
          option.classList.add('selected');
          onSelect?.(key);
        }
      }
    },
      h('div', { class: 'swatch', style: { background: skin.color } }),
      h('div', { class: 'name' }, skin.name),
      h('div', { class: 'desc' }, skin.desc)
    );
    grid.appendChild(option);
  });
  return grid;
}

/** emptyState({ icon, title, desc, actions }) — placeholder with optional CTAs. */
export function emptyState({ icon: iconName, art, title, desc, actions = [] } = {}) {
  // Prefer a brand illustration when the caller names one; icon is the fallback.
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
