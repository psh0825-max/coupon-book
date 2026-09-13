// views/list.js — full coupon list: status tabs + category chips + search + sort.
// Live filtering re-renders only the grid subtree; the filter is persisted via
// actions.setFilter so it survives navigation.

import { h, clear } from '../core/h.js';
import { shopCard, emptyState } from '../ui/components.js';
import { filterShops, sortShops, isAmountKind, isStampKind } from '../domain.js';
import { CATEGORIES, getCategoryIcon } from '../data/skins.js';
import { showToast } from '../ui/toast.js';

const STATUS_TABS = [
  ['all', '전체'], ['active', '진행'], ['expiring', '임박'],
  ['completed', '완료'], ['expired', '만료']
];
const SORTS = [
  ['smart', '추천순'], ['remaining', '얼마 안 남은 순'], ['updated', '최근 수정순'], ['name', '이름순']
];

export function render(ctx) {
  const { store, router, actions } = ctx;
  const st = store.getState();
  const shops = st.shops || [];
  const filter = { query: '', category: 'all', status: 'all', sort: 'smart', ...st.ui.filter };

  const root = h('div');
  root.appendChild(h('div', { class: 'page-header' },
    h('h2', null, '내 이용권'), h('p', null, `등록한 이용권 ${shops.length}개`)));

  // ── status tabs ──
  const tabs = h('div', { class: 'status-tabs', attrs: { role: 'tablist', 'aria-label': '상태' } });
  STATUS_TABS.forEach(([key, label]) => {
    const active = filter.status === key;
    tabs.appendChild(h('button', {
      class: `status-tab${active ? ' active' : ''}`,
      dataset: { status: key },
      attrs: { type: 'button', role: 'tab', 'aria-selected': active ? 'true' : 'false' },
      on: { click: () => {
        filter.status = key;
        actions.setFilter({ status: key });
        tabs.querySelectorAll('.status-tab').forEach((t) => {
          const on = t.dataset.status === key;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        renderGrid();
      } }
    }, label));
  });
  root.appendChild(tabs);

  // ── category chips ──
  const chips = h('div', { class: 'filter-chips', attrs: { role: 'group', 'aria-label': '카테고리' } });
  const addChip = (cat, label) => {
    const active = filter.category === cat;
    chips.appendChild(h('button', {
      class: `chip${active ? ' active' : ''}`,
      dataset: { cat },
      attrs: { type: 'button', 'aria-pressed': active ? 'true' : 'false' },
      on: { click: () => {
        filter.category = cat;
        actions.setFilter({ category: cat });
        chips.querySelectorAll('.chip').forEach((c) => {
          const on = c.dataset.cat === cat;
          c.classList.toggle('active', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderGrid();
      } }
    }, label));
  };
  addChip('all', '전체');
  Object.keys(CATEGORIES).forEach((c) => addChip(c, `${getCategoryIcon(c)} ${c}`));
  root.appendChild(chips);

  // ── search + sort ──
  const search = h('input', {
    id: 'list-search',
    attrs: { type: 'search', placeholder: '이름, 주소, 메모 검색', value: filter.query || '', enterkeyhint: 'search', autocomplete: 'off' }
  });
  search.addEventListener('input', (e) => {
    filter.query = e.target.value.trim();
    actions.setFilter({ query: filter.query });
    renderGrid();
  });
  const sort = h('select', { id: 'list-sort' },
    SORTS.map(([val, label]) => h('option', {
      attrs: { value: val, selected: filter.sort === val ? '' : null }
    }, label))
  );
  sort.addEventListener('change', (e) => {
    filter.sort = e.target.value;
    actions.setFilter({ sort: filter.sort });
    renderGrid();
  });
  root.appendChild(h('div', { class: 'home-tools' },
    h('label', { class: 'sr-only', attrs: { for: 'list-search' } }, '검색'),
    search,
    h('label', { class: 'sr-only', attrs: { for: 'list-sort' } }, '정렬'),
    sort
  ));

  // ── grid ──
  const grid = h('div', { class: 'grid grid-2', id: 'shop-grid', attrs: { role: 'list' } });
  root.appendChild(grid);

  function renderGrid() {
    clear(grid);
    if (shops.length === 0) {
      grid.appendChild(emptyState({
        art: 'ticket',
        title: '아직 등록된 쿠폰이 없어요',
        desc: '지갑 속 도장판과 이용권을 옮겨 담아 보세요.',
        actions: [
          { label: '첫 쿠폰 등록', className: 'btn-primary', onClick: () => router.navigate('add') },
          { label: '샘플로 둘러보기', className: 'btn-secondary', onClick: async () => {
            const added = await actions.seedDemo();
            showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
          } }
        ]
      }));
      return;
    }
    const filtered = sortShops(filterShops(shops, filter), filter.sort);
    if (filtered.length === 0) {
      grid.appendChild(emptyState({
        icon: 'search',
        title: '조건에 맞는 이용권이 없어요',
        desc: '다른 키워드나 카테고리를 선택해 보세요'
      }));
      return;
    }
    filtered.forEach((shop) => grid.appendChild(shopCard(shop, {
      onOpen: () => router.navigate('detail', { id: shop.id }),
      onQuickUse: (sh) => isAmountKind(sh)
        ? actions.promptUse(sh)
        : actions.usePass(sh.id, { count: 1, note: isStampKind(sh) ? '목록에서 도장 적립' : '목록에서 빠른 사용' })
    })));
  }

  renderGrid();
  return root;
}
