// views/history.js — all usage logs timeline, empty state.

import { h } from '../core/h.js';
import { timelineItem, emptyState } from '../ui/components.js';

export function render(ctx) {
  const { store } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const logs = [...(st.logs || [])].sort((a, b) => b.usedAt - a.usedAt);

  const root = h('div');
  root.appendChild(h('div', { class: 'page-header' },
    h('h2', null, '전체 사용 내역'), h('p', null, '모든 쿠폰 사용 기록')));

  if (logs.length === 0) {
    root.appendChild(emptyState({
      icon: 'history',
      title: '내역이 없어요',
      desc: '쿠폰을 사용하면 여기에 기록됩니다'
    }));
    return root;
  }

  const timeline = h('div', { class: 'timeline' });
  logs.forEach((log) => {
    const shop = shops.find((s) => s.id === log.shopId);
    timeline.appendChild(timelineItem(log, shop ? shop.name : '알 수 없는 업체'));
  });
  root.appendChild(timeline);
  return root;
}
