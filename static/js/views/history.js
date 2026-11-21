import { t as tr } from '../core/i18n.js';
// views/history.js — all usage logs timeline, empty state.

import { h } from '../core/h.js';
import { timelineItem, emptyState } from '../ui/components.js';
import { isCollectMode } from '../domain.js';

export function render(ctx) {
  const { store } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const logs = [...(st.logs || [])].sort((a, b) => b.usedAt - a.usedAt);

  const root = h('div');

  if (logs.length === 0) {
    root.appendChild(emptyState({
      icon: 'history',
      title: tr("내역이 없어요"),
      desc: tr("이용권을 사용하면 여기에 기록됩니다")
    }));
    return root;
  }

  const timeline = h('div', { class: 'timeline' });
  logs.forEach((log) => {
    const shop = shops.find((s) => s.id === log.shopId);
    timeline.appendChild(timelineItem(log, shop ? shop.name : tr("알 수 없는 업체"), { collect: isCollectMode(shop) }));
  });
  root.appendChild(timeline);
  return root;
}
