// views/history.js — all usage logs, grouped by day (오늘 / 어제 / 날짜).

import { h } from '../core/h.js';
import { timelineItem, emptyState } from '../ui/components.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date(Date.now());
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${WEEKDAYS[d.getDay()]})`;
}

export function render(ctx) {
  const { store } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const logs = [...(st.logs || [])].sort((a, b) => b.usedAt - a.usedAt);

  const root = h('div');
  root.appendChild(h('div', { class: 'page-header' },
    h('h2', null, '사용 내역'), h('p', null, logs.length ? `총 ${logs.length}건` : '모든 쿠폰의 사용·적립 기록')));

  if (logs.length === 0) {
    root.appendChild(emptyState({
      icon: 'history',
      title: '아직 내역이 없어요',
      desc: '이용권을 사용하거나 도장을 찍으면 여기에 기록돼요'
    }));
    return root;
  }

  let currentKey = null;
  let group = null;
  logs.forEach((log) => {
    const key = dayKey(log.usedAt);
    if (key !== currentKey) {
      currentKey = key;
      root.appendChild(h('h3', { class: 'timeline-day' }, dayLabel(log.usedAt)));
      group = h('div', { class: 'timeline' });
      root.appendChild(group);
    }
    const shop = shops.find((s) => s.id === log.shopId);
    group.appendChild(timelineItem(log, shop ? shop.name : '삭제된 업체'));
  });
  return root;
}
