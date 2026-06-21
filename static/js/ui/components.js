// ui/components.js — reusable presentational pieces. Return DOM Nodes built via h.
// All status/expiry/progress math comes from domain.js (never recomputed here).

import { h, icon, frag } from '../core/h.js';
import {
  couponStatus, remainingCount, progressPercent, formatExpiry, isCompleted
} from '../domain.js';
import { formatDate, formatRelative } from '../services/format.js';
import { SKINS, getCategoryIcon } from '../data/skins.js';

/** stampBoard(total, used) — grid of stamps; gift icon on the final unreached prize. */
export function stampBoard(total, used) {
  const stamps = [];
  for (let i = 0; i < total; i++) {
    const isReward = i === total - 1 && i >= used; // final prize, not yet reached
    const classes = ['stamp'];
    if (i < used) classes.push('used');
    if (i === used) classes.push('current');
    if (isReward) classes.push('reward');
    stamps.push(h('div', { class: classes.join(' ') }, icon(isReward ? 'gift' : 'check')));
  }
  return h('div', { class: 'stamp-board' }, stamps);
}

/** shopCard(shop, { onOpen, onQuickUse }) — keyboard-activatable card. */
export function shopCard(shop, { onOpen, onQuickUse } = {}) {
  const status = couponStatus(shop);
  const remaining = remainingCount(shop);
  const percent = progressPercent(shop);
  const complete = isCompleted(shop) || remaining <= 0;
  const categoryText = shop.category + (shop.expiresAt ? ` · ${formatExpiry(shop.expiresAt)}` : '');

  const quickUse = h('button', {
    class: 'card-quick-use',
    attrs: {
      type: 'button', 'data-action': 'quick-use',
      'aria-label': `${shop.name} 쿠폰 사용`,
      disabled: complete ? '' : null
    },
    on: {
      click: () => { if (!complete) onQuickUse?.(shop); }
    }
  }, '사용');

  const cardMain = h('button', {
    class: 'card-main',
    attrs: { type: 'button', 'aria-label': `${shop.name} ${status.label}, 상세 보기` },
    on: { click: () => onOpen?.(shop) }
  },
    h('div', { class: 'card-header' },
      h('div', { class: 'card-icon' },
        shop.photo
          ? h('img', { class: 'card-photo', attrs: { src: shop.photo, alt: '' } })
          : h('span', { class: 'category-icon' }, getCategoryIcon(shop.category))
      ),
      h('div', { class: 'card-info' },
        h('h3', null, shop.name),
        h('div', { class: 'category' }, categoryText)
      ),
      h('div', { class: `badge badge-${status.className}` }, status.label)
    ),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-progress-meta' },
        h('span', null, `${percent}%`),
        h('span', null, `${remaining} / ${shop.totalCoupons}`)
      ),
      h('div', { class: 'progress-bar' },
        h('div', {
          class: `progress-fill${percent >= 100 ? ' success' : ''}`,
          style: { width: `${percent}%` }
        })
      ),
      h('div', { class: `reward-hint${remaining <= 0 ? ' done' : ''}` },
        remaining <= 0 ? '완성! 사장님께 보여주세요 ✨' : `${remaining}개 더 모으면 완성 🎉`
      ),
      stampBoard(shop.totalCoupons, shop.usedCoupons || 0)
    )
  );

  const card = h('div', {
    class: `card${complete ? ' is-complete' : ''}`,
    dataset: { skin: shop.skin || 'midnight', id: shop.id }
  },
    cardMain,
    h('div', { class: 'card-footer' },
      h('span', null, shop.phone ? shop.phone : `${shop.usedCoupons || 0} / ${shop.totalCoupons} 사용`),
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

/** timelineItem(log, shopName) — usage history row. */
export function timelineItem(log, shopName) {
  return h('div', { class: 'timeline-item success' },
    h('div', { class: 'timeline-dot' }),
    h('div', { class: 'timeline-time' }, `${formatDate(log.usedAt)} · ${formatRelative(log.usedAt)}`),
    h('div', { class: 'timeline-title' }, shopName),
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
    h('div', { class: 'badge badge-accent' }, `${remainingCount(shop)}개 남음`)
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
export function emptyState({ icon: iconName, title, desc, actions = [] } = {}) {
  const iconEl = icon(iconName || 'gift', { size: 48 });
  iconEl.classList.add('empty-icon');
  return h('div', { class: 'empty-state wide' },
    iconEl,
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
