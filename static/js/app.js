import { getAllShops, addShop, updateShop, deleteShop, getLogs, getAllLogs, addLog, deleteLog, getSettings, getSettingsEntries, setSetting, seedDemoData, clearAllData } from './db.js';
import { SKINS, CATEGORIES, getCategoryIcon, getDefaultSkin, renderSkinSelector } from './skins.js';
import { showToast, showPopup, showConfirm, closePopup, createCard, createStampBoard, createTimelineItem, createSummaryCard, escapeHtml, createNearbyCard, showRewardModal, adBannerHTML } from './ui.js';
import { haversine, getCurrentPosition, startLocationWatch, stopLocationWatch, setNotifySettings } from './location.js';
import { mountAds } from './ads.js';
import { haptic, celebrate } from './fx.js';
import * as Leaflet from '../vendor/leaflet/leaflet-src.esm.js';

/* ===== State ===== */
let _currentPage = 'home';
let _settings = {};
let _shops = [];
let _currentShopId = null;
let _homeFilter = { query: '', category: 'all', status: 'all', sort: 'smart' };
let _leafletMap = null;
let _leafletLayer = null;

/* ===== Router ===== */
const router = {
  navigate(page, params = {}) {
    _currentPage = page;
    _currentShopId = params.id || null;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(page)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    const titles = { home: 'Coupon Book', list: '내 쿠폰', map: '주변 지도', add: '업체 추가', detail: '상세', settings: '설정', history: '사용 내역' };
    document.getElementById('page-title').textContent = titles[page] || 'Coupon Book';
    const isRoot = ['home', 'map', 'history', 'settings'].includes(page);
    document.getElementById('btn-back').style.display = isRoot ? 'none' : 'flex';
    document.getElementById('fab').style.display = (page === 'home' || page === 'list') ? 'flex' : 'none';
    window.scrollTo(0, 0);
    renderPage(params);
  }
};

/* ===== Init ===== */
async function init() {
  _settings = await getSettings();
  applyTheme();
  setNotifySettings({ radius: _settings.notifyRadius, delay: _settings.notifyDelay, enabled: _settings.notifyEnabled });
  router.navigate('home');
  setupNav();
  setupBackBtn();
  setupFAB();
  startLocWatch();
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => { haptic('light'); router.navigate(btn.dataset.page); });
  });
}
function setupBackBtn() {
  document.getElementById('btn-back').addEventListener('click', () => router.navigate('home'));
}
function setupFAB() {
  document.getElementById('fab').addEventListener('click', () => router.navigate('add'));
}

function applyTheme() {
  // Light-only app: theme is fixed.
  document.body.dataset.theme = 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f7f9fb');
}

async function refreshShops() {
  _shops = await getAllShops();
  return _shops;
}

async function startLocWatch() {
  await refreshShops();
  startLocationWatch(_shops, handleLocationNotify);
}

/* ===== Page Renderers ===== */
async function renderPage(params) {
  await refreshShops();
  if (_currentPage === 'home') renderHome();
  else if (_currentPage === 'list') renderList();
  else if (_currentPage === 'map') renderMap();
  else if (_currentPage === 'add') renderAdd(params.id);
  else if (_currentPage === 'detail') renderDetail(params.id);
  else if (_currentPage === 'settings') renderSettings();
  else if (_currentPage === 'history') renderHistory();
}

/* --- Home --- */
async function renderHome() {
  const el = document.getElementById('home');
  const totalShops = _shops.length;
  const totalCoupons = _shops.reduce((s, sh) => s + sh.totalCoupons, 0);
  const usedCoupons = _shops.reduce((s, sh) => s + sh.usedCoupons, 0);
  const completionRate = totalCoupons ? Math.round((usedCoupons / totalCoupons) * 100) : 0;
  const priorityShop = getPriorityShop(_shops);
  const expiringCount = _shops.filter(isExpiringSoon).length;
  const completedCount = _shops.filter(isCompleted).length;

  el.innerHTML = `
    <div class="product-hero">
      <div>
        <div class="eyebrow">LOCAL COUPON WALLET</div>
        <h1>내 쿠폰을 한곳에서</h1>
        <p>${priorityShop ? `${escapeHtml(priorityShop.name)} 쿠폰이 가장 먼저 챙길 대상이에요.` : '가지고 있는 도장판·쿠폰을 등록해 진행률과 만료일을 한눈에 관리해요.'}</p>
      </div>
      <button class="btn btn-primary" id="hero-add">내 쿠폰 추가</button>
    </div>

    <div class="summary-row">
      ${wrap(createSummaryCard(totalShops, '업체', 'var(--text-primary)'))}
      ${wrap(createSummaryCard(`${completionRate}%`, '진행률', 'var(--accent)'))}
      ${wrap(createSummaryCard(expiringCount, '만료 임박', 'var(--warning)'))}
      ${wrap(createSummaryCard(completedCount, '완성', 'var(--success)'))}
    </div>

    ${adBannerHTML({ slotId: 'home-ad' })}

    ${priorityShop ? renderPriorityPanel(priorityShop) : ''}

    <div id="nearby-area"></div>

    <div class="rail-header">
      <div><h2>내 쿠폰</h2><p>옆으로 넘기며 확인하세요</p></div>
      <button class="rail-more" id="see-all">모두보기 ›</button>
    </div>
    <div class="shop-rail" id="shop-rail"></div>
  `;
  el.querySelector('#hero-add')?.addEventListener('click', () => router.navigate('add'));
  el.querySelector('.priority-panel')?.addEventListener('click', () => router.navigate('detail', { id: priorityShop.id }));
  el.querySelector('#see-all')?.addEventListener('click', () => router.navigate('list'));
  mountAds(el);

  const rail = el.querySelector('#shop-rail');
  if (_shops.length === 0) {
    rail.classList.add('is-empty');
    rail.innerHTML = `<div class="empty-state wide">
      <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      <h3>등록된 쿠폰이 없어요</h3><p>+ 버튼을 눌러 첫 쿠폰을 등록해 보세요</p>
      <div class="empty-actions">
        <button class="btn btn-primary" data-empty-action="add">내 쿠폰 추가</button>
        <button class="btn btn-secondary" data-empty-action="demo">샘플 보기</button>
      </div>
    </div>`;
    rail.querySelector('[data-empty-action="add"]')?.addEventListener('click', () => router.navigate('add'));
    rail.querySelector('[data-empty-action="demo"]')?.addEventListener('click', async () => {
      const added = await seedDemoData();
      await refreshShops();
      showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
      renderHome();
    });
  } else {
    const railShops = _shops.slice().sort((a, b) =>
      (isCompleted(a) - isCompleted(b))
      || (getShopStatus(a).score - getShopStatus(b).score)
      || (b.updatedAt || 0) - (a.updatedAt || 0)
    ).slice(0, 10);
    railShops.forEach((shop, i) => rail.appendChild(buildShopCard(shop, i, '홈에서 빠른 사용')));
  }

  if (_settings.notifyEnabled && _shops.some(sh => sh.lat && sh.lng)) {
    try {
      const pos = await getCurrentPosition();
      const nearby = _shops.map(sh => {
        if (!sh.lat || !sh.lng) return null;
        const d = haversine(pos.lat, pos.lng, sh.lat, sh.lng);
        return d <= 500 ? { shop: sh, distance: d } : null;
      }).filter(Boolean).sort((a, b) => a.distance - b.distance);
      const area = el.querySelector('#nearby-area');
      if (area && nearby.length > 0) {
        area.innerHTML = `
          <div class="page-header" style="margin-top:4px"><h2>지금 근처</h2><p>반경 500m 이내 가게</p></div>
          <div id="nearby-list"></div>
        `;
        const list = area.querySelector('#nearby-list');
        nearby.forEach(({ shop, distance }) => {
          list.appendChild(createNearbyCard(shop, distance, () => router.navigate('detail', { id: shop.id })));
        });
      }
    } catch (e) {
      // ignore location errors on home
    }
  }
}

function wrap(el) {
  const d = document.createElement('div');
  d.appendChild(el);
  return d.innerHTML;
}

function isCompleted(shop) {
  return (shop.usedCoupons || 0) >= shop.totalCoupons;
}

function isExpiringSoon(shop) {
  if (!shop.expiresAt || isCompleted(shop)) return false;
  const days = daysUntil(shop.expiresAt);
  return days !== null && days >= 0 && days <= 30;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(`${dateValue}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function formatExpiry(dateValue) {
  const days = daysUntil(dateValue);
  if (days === null) return '만료 없음';
  if (days < 0) return '만료됨';
  if (days === 0) return '오늘 만료';
  return `D-${days}`;
}

function getShopStatus(shop) {
  const remaining = shop.totalCoupons - (shop.usedCoupons || 0);
  const days = daysUntil(shop.expiresAt);
  if (isCompleted(shop)) return { label: '완성', className: 'success', score: 0 };
  if (days !== null && days < 0) return { label: '만료됨', className: 'danger', score: 10 };
  if (days !== null && days <= 7) return { label: `만료 ${formatExpiry(shop.expiresAt)}`, className: 'danger', score: 20 + days };
  if (remaining <= 2) return { label: `${remaining}개 남음`, className: 'warning', score: 40 + remaining };
  if (days !== null && days <= 30) return { label: `만료 ${formatExpiry(shop.expiresAt)}`, className: 'warning', score: 60 + days };
  return { label: '진행 중', className: 'neutral', score: 100 + remaining };
}

function matchesStatusFilter(shop) {
  if (_homeFilter.status === 'all') return true;
  if (_homeFilter.status === 'active') return !isCompleted(shop) && getShopStatus(shop).className === 'neutral';
  if (_homeFilter.status === 'expiring') return isExpiringSoon(shop);
  if (_homeFilter.status === 'completed') return isCompleted(shop);
  if (_homeFilter.status === 'expired') {
    const days = daysUntil(shop.expiresAt);
    return days !== null && days < 0;
  }
  return true;
}

function getPriorityShop(shops) {
  return shops
    .filter(shop => !isCompleted(shop))
    .slice()
    .sort((a, b) => getShopStatus(a).score - getShopStatus(b).score || (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
}

function sortShops(a, b) {
  if (_homeFilter.sort === 'name') return a.name.localeCompare(b.name, 'ko');
  if (_homeFilter.sort === 'updated') return (b.updatedAt || 0) - (a.updatedAt || 0);
  const aRemain = a.totalCoupons - (a.usedCoupons || 0);
  const bRemain = b.totalCoupons - (b.usedCoupons || 0);
  if (_homeFilter.sort === 'remaining') return aRemain - bRemain || (b.updatedAt || 0) - (a.updatedAt || 0);
  return getShopStatus(a).score - getShopStatus(b).score || aRemain - bRemain || (b.updatedAt || 0) - (a.updatedAt || 0);
}

function renderPriorityPanel(shop) {
  const status = getShopStatus(shop);
  const percent = shop.totalCoupons ? Math.round(((shop.usedCoupons || 0) / shop.totalCoupons) * 100) : 0;
  return `
    <button class="priority-panel" type="button">
      <div>
        <div class="eyebrow">NEXT BEST COUPON</div>
        <strong>${escapeHtml(shop.name)}</strong>
        <span>${status.label} · ${percent}% 진행</span>
      </div>
      <div class="priority-meter" aria-hidden="true">
        <span style="height:${Math.max(8, percent)}%"></span>
      </div>
    </button>
  `;
}

/* --- Shared shop card + filter helpers --- */
function buildShopCard(shop, i, quickUseNote = '') {
  const card = createCard(shop);
  if (typeof i === 'number') card.style.animationDelay = Math.min(i, 12) * 40 + 'ms';
  const open = () => router.navigate('detail', { id: shop.id });
  card.addEventListener('click', open);
  card.querySelector('[data-action="quick-use"]')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await useCoupon(shop, quickUseNote);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  return card;
}

function getFilteredShops() {
  const text = (_homeFilter.query || '').toLowerCase();
  return _shops.filter(sh => {
    const matchText = !text || [sh.name, sh.address, sh.category, sh.memo, sh.phone].some(v => String(v || '').toLowerCase().includes(text));
    const matchCat = _homeFilter.category === 'all' || sh.category === _homeFilter.category;
    return matchText && matchCat && matchesStatusFilter(sh);
  }).sort(sortShops);
}

/* --- Full list (전체보기) --- */
function renderList() {
  const el = document.getElementById('list');
  el.innerHTML = `
    <div class="page-header"><h2>내 쿠폰</h2><p>등록한 모든 가게</p></div>
    <div class="status-tabs" id="status-tabs">
      ${[['all', '전체'], ['active', '진행'], ['expiring', '임박'], ['completed', '완성'], ['expired', '만료']]
        .map(([key, label]) => `<button class="status-tab ${_homeFilter.status === key ? 'active' : ''}" data-status="${key}">${label}</button>`).join('')}
    </div>
    <div class="filter-chips" id="filter-chips">
      <button class="chip ${_homeFilter.category === 'all' ? 'active' : ''}" data-cat="all">전체</button>
      ${Object.keys(CATEGORIES).map(c => `<button class="chip ${_homeFilter.category === c ? 'active' : ''}" data-cat="${c}">${getCategoryIcon(c)} ${c}</button>`).join('')}
    </div>
    <div class="home-tools">
      <input type="search" id="home-search" placeholder="업체 이름, 주소, 메모 검색" value="${escapeHtml(_homeFilter.query)}">
      <select id="home-sort" aria-label="정렬">
        <option value="smart" ${_homeFilter.sort === 'smart' ? 'selected' : ''}>추천순</option>
        <option value="remaining" ${_homeFilter.sort === 'remaining' ? 'selected' : ''}>완성 임박</option>
        <option value="updated" ${_homeFilter.sort === 'updated' ? 'selected' : ''}>최근 수정</option>
        <option value="name" ${_homeFilter.sort === 'name' ? 'selected' : ''}>이름순</option>
      </select>
    </div>
    <div class="grid grid-2" id="shop-grid"></div>
  `;

  function renderShopGrid() {
    const grid = el.querySelector('#shop-grid');
    grid.innerHTML = '';
    const filtered = getFilteredShops();
    if (_shops.length === 0) {
      grid.innerHTML = `<div class="empty-state wide">
        <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        <h3>등록된 업체가 없어요</h3><p>하단 + 버튼을 눌러 처음 업체를 등록해 보세요</p>
        <div class="empty-actions">
          <button class="btn btn-primary" data-empty-action="add">처음 업체 등록</button>
          <button class="btn btn-secondary" data-empty-action="demo">샘플 보기</button>
        </div>
      </div>`;
    } else if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state wide">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <h3>검색 결과가 없어요</h3><p>다른 키워드나 카테고리를 선택해 보세요</p>
      </div>`;
    } else {
      filtered.forEach((shop, i) => grid.appendChild(buildShopCard(shop, i, '목록에서 빠른 사용')));
    }
    grid.querySelector('[data-empty-action="add"]')?.addEventListener('click', () => router.navigate('add'));
    grid.querySelector('[data-empty-action="demo"]')?.addEventListener('click', async () => {
      const added = await seedDemoData();
      await refreshShops();
      showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
      renderList();
    });
  }

  el.querySelector('#home-search').addEventListener('input', (e) => { _homeFilter.query = e.target.value.trim(); renderShopGrid(); });
  el.querySelector('#home-sort').addEventListener('change', (e) => { _homeFilter.sort = e.target.value; renderShopGrid(); });
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      el.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      _homeFilter.category = chip.dataset.cat;
      renderShopGrid();
    });
  });
  el.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _homeFilter.status = tab.dataset.status;
      renderShopGrid();
    });
  });

  renderShopGrid();
}

/* --- Map --- */
async function renderMap() {
  const el = document.getElementById('map');
  const shopsWithLocation = _shops.filter(shop => Number.isFinite(Number(shop.lat)) && Number.isFinite(Number(shop.lng)));

  el.innerHTML = `
    <div class="map-page">
      <div class="map-toolbar">
        <div>
          <div class="eyebrow">NEARBY SHOPS</div>
          <h2>내 주변 업체 지도</h2>
          <p>위치가 저장된 쿠폰 업체를 현재 위치 기준으로 보여줘요.</p>
        </div>
        <button class="btn btn-primary" id="btn-map-locate">내 위치</button>
      </div>
      <div class="coupon-map-wrap">
        <div id="coupon-map" class="coupon-map">
          <div class="map-loading">지도를 준비하는 중...</div>
        </div>
        <div id="map-float" class="map-float" hidden></div>
      </div>
      <div class="map-summary" id="map-summary"></div>
      <div class="nearby-shop-list" id="map-shop-list"></div>
    </div>
  `;

  const mapEl = el.querySelector('#coupon-map');
  const summaryEl = el.querySelector('#map-summary');
  const listEl = el.querySelector('#map-shop-list');

  if (shopsWithLocation.length === 0) {
    mapEl.innerHTML = `
      <div class="empty-state map-empty">
        <svg viewBox="0 0 24 24"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>
        <h3>지도에 표시할 업체가 없어요</h3>
        <p>업체 편집 화면에서 현재 위치를 저장하면 지도에 표시됩니다</p>
        <div class="empty-actions"><button class="btn btn-primary" id="map-add-shop">업체 추가</button></div>
      </div>
    `;
    el.querySelector('#map-add-shop')?.addEventListener('click', () => router.navigate('add'));
    summaryEl.textContent = '';
    listEl.innerHTML = '';
    return;
  }

  await drawMap({ mapEl, summaryEl, listEl, shopsWithLocation });
  el.querySelector('#btn-map-locate').addEventListener('click', async () => {
    await drawMap({ mapEl, summaryEl, listEl, shopsWithLocation, forceLocate: true });
  });
}

async function drawMap({ mapEl, summaryEl, listEl, shopsWithLocation, forceLocate = false }) {
  const fallbackCenter = getShopsCenter(shopsWithLocation);
  let userPos = null;
  let center = fallbackCenter;
  let locationMessage = '등록 업체 중심으로 표시 중';

  try {
    userPos = await getCurrentPosition();
    center = [userPos.lat, userPos.lng];
    locationMessage = '현재 위치 기준';
  } catch (e) {
    if (forceLocate) showToast('현재 위치를 가져올 수 없어요', 'danger');
  }

  if (_leafletMap) {
    _leafletMap.remove();
    _leafletMap = null;
    _leafletLayer = null;
  }

  mapEl.innerHTML = '';
  _leafletMap = Leaflet.map(mapEl, { zoomControl: true, attributionControl: true }).setView(center, userPos ? 15 : 13);
  Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(_leafletMap);
  _leafletLayer = Leaflet.layerGroup().addTo(_leafletMap);

  if (userPos) {
    Leaflet.circle([userPos.lat, userPos.lng], {
      radius: Math.max(35, userPos.accuracy || 60),
      color: '#77a8d8',
      fillColor: '#77a8d8',
      fillOpacity: 0.14,
      weight: 1
    }).addTo(_leafletLayer);
    Leaflet.marker([userPos.lat, userPos.lng], {
      icon: createMapIcon('me')
    }).addTo(_leafletLayer).bindPopup('현재 위치');
  }

  const nearby = shopsWithLocation.map(shop => {
    const distance = userPos ? haversine(userPos.lat, userPos.lng, Number(shop.lat), Number(shop.lng)) : null;
    return { shop, distance };
  }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  const floatEl = document.getElementById('map-float');
  function showFloat(shop, distance) {
    if (!floatEl) return;
    const dir = mapsDirectionsUrl(shop);
    const remaining = shop.totalCoupons - (shop.usedCoupons || 0);
    floatEl.hidden = false;
    floatEl.innerHTML = `
      <div class="map-float-info">
        <div class="map-float-ico" data-skin="${shop.skin || 'midnight'}"><span class="category-icon">${getCategoryIcon(shop.category)}</span></div>
        <div class="map-float-text">
          <strong>${escapeHtml(shop.name)}</strong>
          <span>${distance !== null ? formatDistance(distance) + ' · ' : ''}${remaining}개 남음</span>
        </div>
      </div>
      <div class="map-float-actions">
        <button class="btn btn-secondary" data-act="detail">상세</button>
        ${dir ? `<a class="btn btn-primary" href="${dir}" target="_blank" rel="noopener">길찾기</a>` : ''}
      </div>
    `;
    floatEl.querySelector('[data-act="detail"]').onclick = () => router.navigate('detail', { id: shop.id });
  }

  nearby.forEach(({ shop, distance }) => {
    Leaflet.marker([Number(shop.lat), Number(shop.lng)], {
      icon: createMapIcon(getShopStatus(shop).className)
    }).addTo(_leafletLayer).on('click', () => showFloat(shop, distance));
  });

  if (nearby.length) showFloat(nearby[0].shop, nearby[0].distance);

  const bounds = Leaflet.latLngBounds(shopsWithLocation.map(shop => [Number(shop.lat), Number(shop.lng)]));
  if (userPos) bounds.extend([userPos.lat, userPos.lng]);
  _leafletMap.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
  setTimeout(() => _leafletMap?.invalidateSize(), 80);

  const visibleNearby = nearby.filter(item => item.distance === null || item.distance <= 3000);
  summaryEl.innerHTML = `
    <div><strong>${nearby.length}</strong><span>지도 표시 업체</span></div>
    <div><strong>${visibleNearby.length}</strong><span>${userPos ? '3km 이내' : '목록 표시'}</span></div>
    <div><strong>${locationMessage}</strong><span>${userPos ? '위치 권한 허용됨' : '위치 권한 필요'}</span></div>
  `;
  renderNearbyList(listEl, nearby);
}

function getShopsCenter(shops) {
  const lat = shops.reduce((sum, shop) => sum + Number(shop.lat), 0) / shops.length;
  const lng = shops.reduce((sum, shop) => sum + Number(shop.lng), 0) / shops.length;
  return [lat, lng];
}

function createMapIcon(type) {
  const safeType = ['me', 'success', 'warning', 'danger', 'neutral'].includes(type) ? type : 'neutral';
  return Leaflet.divIcon({
    className: `coupon-map-pin ${safeType}`,
    html: `<span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function renderNearbyList(listEl, nearby) {
  listEl.innerHTML = nearby.map(({ shop, distance }) => {
    const status = getShopStatus(shop);
    const dir = mapsDirectionsUrl(shop);
    return `
      <div class="nearby-shop-row">
        <button class="nearby-shop-main" data-shop-id="${shop.id}">
          <div>
            <strong>${escapeHtml(shop.name)}</strong>
            <span>${escapeHtml(shop.address || shop.category)}</span>
          </div>
          <em>${distance !== null ? formatDistance(distance) : status.label}</em>
        </button>
        ${dir ? `<a class="nearby-dir" href="${dir}" target="_blank" rel="noopener" aria-label="길찾기">
          <svg viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>길찾기
        </a>` : ''}
      </div>
    `;
  }).join('');
  listEl.querySelectorAll('.nearby-shop-main').forEach(row => {
    row.addEventListener('click', () => router.navigate('detail', { id: row.dataset.shopId }));
  });
}

function mapsDirectionsUrl(shop) {
  if (Number.isFinite(Number(shop.lat)) && Number.isFinite(Number(shop.lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
  }
  if (shop.address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.address)}`;
  return '';
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/* --- Add / Edit --- */
async function renderAdd(shopId) {
  const el = document.getElementById('add');
  const isEdit = !!shopId;
  let shop = isEdit ? _shops.find(s => s.id === shopId) : null;
  if (isEdit && !shop) {
    showToast('업체를 찾을 수 없어요', 'danger');
    router.navigate('home');
    return;
  }

  el.innerHTML = `
    <div class="page-header"><h2>${isEdit ? '업체 편집' : '업체 추가'}</h2></div>
    <form id="shop-form">
      <div class="form-group">
        <label>업체 이름</label>
        <input type="text" name="name" required placeholder="예: 안양 스타 마사지" value="${isEdit ? escapeHtml(shop.name) : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>카테고리</label>
          <select name="category">
            ${Object.keys(CATEGORIES).map(c => `<option value="${c}" ${isEdit && shop.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>쿠폰 총 개수</label>
          <input type="number" name="totalCoupons" min="1" max="100" required value="${isEdit ? shop.totalCoupons : '10'}">
        </div>
      </div>
      <div class="form-group">
        <div class="stamp-preview-head">
          <label style="margin:0">현재 적립 개수</label>
          <span class="stamp-counter" id="add-stamp-counter">0 / 10</span>
        </div>
        <input type="number" name="usedCoupons" min="0" max="100" value="${isEdit ? (shop.usedCoupons || 0) : 0}">
        <p class="field-hint">이미 도장을 찍은 종이 쿠폰이라면 현재 개수를 입력하세요.</p>
        <div class="stamp-board stamp-preview" id="add-stamp-preview"></div>
      </div>
      <div class="form-group">
        <label>주소</label>
        <input type="text" name="address" placeholder="주소를 입력하세요" value="${isEdit ? escapeHtml(shop.address || '') : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>전화번호</label>
          <input type="tel" name="phone" placeholder="예: 031-000-0000" value="${isEdit ? escapeHtml(shop.phone || '') : ''}">
        </div>
        <div class="form-group">
          <label>만료일</label>
          <input type="date" name="expiresAt" value="${isEdit ? escapeHtml(shop.expiresAt || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>위치</label>
        <div class="form-row">
          <input type="text" name="lat" placeholder="위도" readonly value="${isEdit && shop.lat ? shop.lat : ''}">
          <input type="text" name="lng" placeholder="경도" readonly value="${isEdit && shop.lng ? shop.lng : ''}">
        </div>
        <button type="button" class="btn btn-secondary btn-block" id="btn-set-loc" style="margin-top:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          현재 위치로 설정
        </button>
      </div>
      <div class="form-group">
        <label>스킨 테마</label>
        <div id="skin-selector"></div>
      </div>
      <div class="form-group">
        <label>메모</label>
        <textarea name="memo" rows="3" placeholder="예: 평일 오전 할인, 주차 가능">${isEdit ? escapeHtml(shop.memo || '') : ''}</textarea>
      </div>
      <div class="form-spacer"></div>
      <button type="submit" class="btn btn-primary btn-block">${isEdit ? '저장하기' : '추가하기'}</button>
      ${isEdit ? `<button type="button" class="btn btn-danger btn-block subtle-danger" id="btn-delete">업체 삭제</button>` : ''}
    </form>
  `;

  const selectedSkin = isEdit ? (shop.skin || 'midnight') : getDefaultSkin(el.querySelector('select[name="category"]').value);
  let currentSkin = selectedSkin;
  const skinContainer = el.querySelector('#skin-selector');
  const mountSkinSelector = (selected) => {
    skinContainer.innerHTML = '';
    skinContainer.appendChild(renderSkinSelector(selected, (sk) => { currentSkin = sk; }));
  };
  mountSkinSelector(selectedSkin);

  el.querySelector('select[name="category"]').addEventListener('change', (e) => {
    if (isEdit) return;
    currentSkin = getDefaultSkin(e.target.value);
    mountSkinSelector(currentSkin);
  });

  // Live stamp preview: reflects 총 개수 / 현재 적립 개수 as a stamp board
  const totalInput = el.querySelector('input[name="totalCoupons"]');
  const usedInput = el.querySelector('input[name="usedCoupons"]');
  const previewBoard = el.querySelector('#add-stamp-preview');
  const previewCounter = el.querySelector('#add-stamp-counter');
  function renderStampPreview() {
    const total = Math.max(1, Math.min(100, parseInt(totalInput.value) || 0));
    const used = Math.max(0, Math.min(parseInt(usedInput.value) || 0, total));
    previewCounter.textContent = `${used} / ${total}`;
    previewBoard.innerHTML = '';
    previewBoard.appendChild(createStampBoard(total, used));
  }
  totalInput.addEventListener('input', renderStampPreview);
  usedInput.addEventListener('input', renderStampPreview);
  renderStampPreview();

  el.querySelector('#btn-set-loc').addEventListener('click', async () => {
    try {
      const pos = await getCurrentPosition();
      el.querySelector('input[name="lat"]').value = pos.lat.toFixed(6);
      el.querySelector('input[name="lng"]').value = pos.lng.toFixed(6);
      showToast('현재 위치가 설정되었어요');
    } catch (e) {
      showToast('위치 정보를 가져올 수 없어요', 'danger');
    }
  });

  if (isEdit) {
    el.querySelector('#btn-delete').addEventListener('click', async () => {
      const ok = await showConfirm({
        title: '업체 삭제',
        message: '이 업체와 연결된 사용 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.',
        confirmLabel: '삭제',
        danger: true
      });
      if (!ok) return;
      await deleteShop(shopId);
      showToast('삭제되었어요');
      router.navigate('home');
    });
  }

  el.querySelector('#shop-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name').trim(),
      category: fd.get('category'),
      totalCoupons: parseInt(fd.get('totalCoupons')) || 10,
      address: fd.get('address').trim(),
      phone: fd.get('phone').trim(),
      expiresAt: fd.get('expiresAt') || '',
      memo: fd.get('memo').trim(),
      lat: parseFloat(fd.get('lat')) || null,
      lng: parseFloat(fd.get('lng')) || null,
      usedCoupons: parseInt(fd.get('usedCoupons')) || 0,
      skin: currentSkin
    };
    data.totalCoupons = Math.max(1, Math.min(100, data.totalCoupons));
    data.usedCoupons = Math.max(0, Math.min(data.usedCoupons || 0, data.totalCoupons));
    if (isEdit) {
      Object.assign(shop, data);
      shop.updatedAt = Date.now();
      await updateShop(shop);
      showToast('저장되었어요');
    } else {
      await addShop(data);
      showToast('추가되었어요');
    }
    router.navigate('home');
  });
}

/* --- Detail --- */
async function renderDetail(shopId) {
  const el = document.getElementById('detail');
  const shop = _shops.find(s => s.id === shopId);
  if (!shop) { router.navigate('home'); return; }

  const remaining = shop.totalCoupons - shop.usedCoupons;
  const percent = shop.totalCoupons > 0 ? (shop.usedCoupons / shop.totalCoupons) * 100 : 0;
  const logs = await getLogs(shopId);
  const sortedLogs = logs.sort((a, b) => b.usedAt - a.usedAt);
  const status = getShopStatus(shop);
  const mapQuery = encodeURIComponent(shop.address || shop.name);

  el.innerHTML = `
    <div class="detail-header" data-skin="${shop.skin || 'midnight'}">
      <div class="hero">
        <div class="detail-status ${status.className}">${status.label}</div>
        <h2>${escapeHtml(shop.name)}</h2>
        <div class="address">${escapeHtml(shop.address || '주소 없음')} · ${escapeHtml(shop.category)}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="num">${shop.totalCoupons}</div><div class="lbl">총 쿠폰</div></div>
        <div class="stat"><div class="num">${shop.usedCoupons}</div><div class="lbl">사용</div></div>
        <div class="stat"><div class="num">${remaining}</div><div class="lbl">남음</div></div>
      </div>
    </div>
    <div class="detail-meta-grid">
      <a class="quick-action ${shop.phone ? '' : 'disabled'}" ${shop.phone ? `href="tel:${escapeHtml(shop.phone)}"` : ''}>전화</a>
      <a class="quick-action" href="https://map.naver.com/v5/search/${mapQuery}" target="_blank" rel="noopener">지도</a>
      <div class="quick-action readonly">${shop.expiresAt ? formatExpiry(shop.expiresAt) : '만료 없음'}</div>
    </div>
    ${shop.memo ? `<div class="note-panel">${escapeHtml(shop.memo)}</div>` : ''}
    <div class="progress-wrap">
      <div class="progress-meta"><span>${Math.round(percent)}% 사용</span><span>${remaining}개 남음</span></div>
      <div class="progress-bar">
        <div class="progress-fill ${percent >= 100 ? 'success' : ''}" style="width:${percent}%"></div>
      </div>
      <div class="reward-hint ${remaining <= 0 ? 'done' : ''}">${remaining <= 0 ? '완성! 사장님께 보여주세요 ✨' : `${remaining}개 더 모으면 완성 🎉`}</div>
    </div>
    <div class="stamp-head">
      <span>스탬프 적립 현황</span>
      <strong>${shop.usedCoupons} <em>/ ${shop.totalCoupons}</em></strong>
    </div>
    <div class="stamp-board" id="detail-stamps"></div>
    <div class="detail-actions">
      <button class="btn btn-primary btn-block" id="btn-use" ${remaining <= 0 ? 'disabled style="opacity:0.5"' : ''}>쿠폰 사용하기</button>
      <button class="btn btn-secondary" id="btn-edit">편집</button>
      <button class="btn btn-secondary" id="btn-undo" ${sortedLogs.length === 0 ? 'disabled style="opacity:0.5"' : ''}>사용 취소</button>
    </div>
    <div class="page-header" style="margin-top:24px"><h2>사용 내역</h2></div>
    <div class="timeline" id="detail-timeline"></div>
    ${adBannerHTML({ slotId: 'detail-ad' })}
    <div style="height:40px"></div>
  `;

  mountAds(el);

  // Apply skin to header
  const header = el.querySelector('.detail-header');
  const skin = SKINS[shop.skin || 'midnight'];
  if (skin && header) {
    header.style.borderColor = 'var(--border)';
  }

  const stampBoard = el.querySelector('#detail-stamps');
  stampBoard.appendChild(createStampBoard(shop.totalCoupons, shop.usedCoupons));

  const timeline = el.querySelector('#detail-timeline');
  if (sortedLogs.length === 0) {
    timeline.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem">아직 사용 내역이 없어요</div>';
  } else {
    sortedLogs.forEach(log => {
      timeline.appendChild(createTimelineItem(log, shop.name));
    });
  }

  el.querySelector('#btn-use').addEventListener('click', async () => {
    if (remaining <= 0) return;
    const memoBody = document.createElement('div');
    memoBody.innerHTML = `
      <p style="margin-bottom:10px;color:var(--text-muted);font-size:0.9rem">사용 내역에 남길 메모가 있다면 입력하세요.</p>
      <textarea id="use-memo" class="memo-input" rows="3" placeholder="예: 60분 마사지"></textarea>
    `;
    showPopup({
      title: '쿠폰 사용',
      body: memoBody.innerHTML,
      actions: [
        { id: 'cancel', label: '취소', className: 'btn-secondary', close: true },
        { id: 'confirm', label: '사용하기', className: 'btn-primary', onClick: async () => {
          const memo = document.getElementById('use-memo')?.value.trim() || '';
          await useCoupon(shop, memo);
        }}
      ]
    });
  });
  el.querySelector('#btn-edit').addEventListener('click', () => router.navigate('add', { id: shop.id }));
  el.querySelector('#btn-undo').addEventListener('click', async () => {
    if (sortedLogs.length === 0) return;
    await undoLastCoupon(shop, sortedLogs[0]);
  });
}

async function useCoupon(shop, note = '') {
  if ((shop.usedCoupons || 0) >= shop.totalCoupons) {
    showToast('남은 쿠폰이 없어요', 'danger');
    return;
  }
  let pos = null;
  try { pos = await getCurrentPosition(); } catch (e) {}
  shop.usedCoupons += 1;
  await updateShop(shop);
  await addLog({
    shopId: shop.id,
    note: note || undefined,
    location: pos ? { lat: pos.lat, lng: pos.lng } : undefined
  });
  if (shop.usedCoupons >= shop.totalCoupons) {
    haptic('heavy');
    celebrate();
    showRewardModal({ shopName: shop.name, total: shop.totalCoupons });
  } else {
    haptic('medium');
    showToast('쿠폰이 사용되었어요!');
  }
  await refreshShops();
  if (_currentPage === 'detail') {
    renderDetail(shop.id);
  } else if (_currentPage === 'home') {
    renderHome();
  }
  startLocationWatch(_shops, handleLocationNotify);
}

async function undoLastCoupon(shop, log) {
  const ok = await showConfirm({
    title: '사용 기록 취소',
    message: '마지막 쿠폰 사용 기록을 취소하고 스탬프를 하나 되돌릴까요?',
    confirmLabel: '되돌리기'
  });
  if (!ok) return;
  shop.usedCoupons = Math.max(0, (shop.usedCoupons || 0) - 1);
  await updateShop(shop);
  await deleteLog(log.id);
  showToast('마지막 사용 기록을 취소했어요');
  await refreshShops();
  renderDetail(shop.id);
}

/* --- History --- */
async function renderHistory() {
  const el = document.getElementById('history');
  const allLogs = await getAllLogs();
  const sorted = allLogs.sort((a, b) => b.usedAt - a.usedAt);

  el.innerHTML = `
    <div class="page-header"><h2>전체 사용 내역</h2><p>모든 쿠폰 사용 기록</p></div>
    <div class="timeline" id="history-timeline"></div>
  `;
  const timeline = el.querySelector('#history-timeline');
  if (sorted.length === 0) {
    timeline.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      <h3>내역이 없어요</h3><p>쿠폰을 사용하면 여기에 기록됩니다</p>
    </div>`;
    return;
  }
  for (const log of sorted) {
    const shop = _shops.find(s => s.id === log.shopId);
    const name = shop ? shop.name : '알 수 없는 업체';
    timeline.appendChild(createTimelineItem(log, name));
  }
}

/* --- Settings --- */
async function renderSettings() {
  const el = document.getElementById('settings');
  const allLogs = await getAllLogs();
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthLogs = allLogs.filter(l => {
    const d = new Date(l.usedAt);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  });
  const totalShops = _shops.length;
  const totalCoupons = _shops.reduce((s, sh) => s + sh.totalCoupons, 0);
  const usedCoupons = _shops.reduce((s, sh) => s + sh.usedCoupons, 0);
  const completedShops = _shops.filter(sh => sh.usedCoupons >= sh.totalCoupons).length;

  el.innerHTML = `
    <div class="page-header"><h2>설정</h2></div>

    <section class="settings-panel">
      <div class="section-title">
        <h3>운영 통계</h3>
        <span>이번 달 사용 ${monthLogs.length}회</span>
      </div>
      <div class="metric-grid">
        <div class="metric"><strong>${totalShops}</strong><span>업체</span></div>
        <div class="metric"><strong>${totalCoupons}</strong><span>쿠폰 총</span></div>
        <div class="metric"><strong>${usedCoupons}</strong><span>사용</span></div>
        <div class="metric"><strong>${completedShops}</strong><span>완성</span></div>
      </div>
    </section>

    <div class="card settings-card">
      <div class="card-body">
        <div class="toggle-row">
          <div class="info"><h4>위치 알림</h4><p>가게 근처에 가면 팝업 띄우기</p></div>
          <div class="toggle-switch ${_settings.notifyEnabled ? 'active' : ''}" id="toggle-notify"></div>
        </div>
      </div>
    </div>

    <div class="card settings-card">
      <div class="card-body">
        <div class="form-group">
          <label>알림 반경 (미터)</label>
          <input type="number" id="input-radius" value="${_settings.notifyRadius}" min="10" max="1000">
        </div>
        <div class="form-group">
          <label>체류 시간 (분)</label>
          <input type="number" id="input-delay" value="${_settings.notifyDelay}" min="0" max="60">
        </div>
        <button class="btn btn-secondary btn-block" id="btn-save-settings">알림 설정 저장</button>
      </div>
    </div>

    <div class="card settings-card">
      <div class="card-body">
        <div class="form-group">
          <label>백업 데이터</label>
          <button class="btn btn-secondary btn-block" id="btn-export">JSON 파일로 백업</button>
        </div>
        <div class="form-group">
          <label>복원 데이터</label>
          <input type="file" id="input-import" accept=".json">
        </div>
      </div>
    </div>

    <div class="card settings-card">
      <div class="card-body">
        <div class="form-group">
          <label>데모 데이터</label>
          <button class="btn btn-secondary btn-block" id="btn-demo">샘플 업체 추가</button>
        </div>
        <div class="form-group">
          <label>전체 초기화</label>
          <button class="btn btn-danger btn-block" id="btn-clear">모든 업체와 내역 삭제</button>
        </div>
      </div>
    </div>
  `;

  el.querySelector('#toggle-notify').addEventListener('click', async () => {
    _settings.notifyEnabled = !_settings.notifyEnabled;
    await setSetting('notifyEnabled', _settings.notifyEnabled);
    setNotifySettings({ radius: _settings.notifyRadius, delay: _settings.notifyDelay, enabled: _settings.notifyEnabled });
    el.querySelector('#toggle-notify').classList.toggle('active', _settings.notifyEnabled);
    showToast(_settings.notifyEnabled ? '알림이 켜졌어요' : '알림이 꺼졌어요');
  });

  el.querySelector('#btn-save-settings').addEventListener('click', async () => {
    const r = parseInt(el.querySelector('#input-radius').value) || 100;
    const d = parseInt(el.querySelector('#input-delay').value) || 5;
    _settings.notifyRadius = r;
    _settings.notifyDelay = d;
    await setSetting('notifyRadius', r);
    await setSetting('notifyDelay', d);
    setNotifySettings({ radius: r, delay: d, enabled: _settings.notifyEnabled });
    showToast('알림 설정 저장 완료');
  });

  el.querySelector('#btn-export').addEventListener('click', async () => {
    const shops = await getAllShops();
    const logs = await getAllLogs();
    const settings = await getSettingsEntries();
    const payload = JSON.stringify({ version: 2, shops, logs, settings, exportedAt: Date.now() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coupon-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일이 다운로드되었어요');
  });

  el.querySelector('#input-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.shops) || !Array.isArray(data.logs)) throw new Error('올바른 백업 파일이 아니에요');
      for (const s of data.shops) await updateShop(normalizeShop(s));
      for (const l of data.logs) await addLog(normalizeLog(l));
      if (Array.isArray(data.settings)) {
        for (const item of data.settings) {
          if (item && typeof item.key === 'string') await setSetting(item.key, item.value);
        }
        _settings = await getSettings();
        applyTheme();
        setNotifySettings({ radius: _settings.notifyRadius, delay: _settings.notifyDelay, enabled: _settings.notifyEnabled });
      }
      showToast('복원 완료!');
      await refreshShops();
      router.navigate('home');
    } catch (err) {
      showToast('복원 실패: ' + err.message, 'danger');
    }
  });

  el.querySelector('#btn-demo').addEventListener('click', async () => {
    const added = await seedDemoData();
    await refreshShops();
    showToast(added ? `${added}개 샘플 업체를 추가했어요` : '이미 샘플 업체가 있어요');
    router.navigate('home');
  });

  el.querySelector('#btn-clear').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: '전체 초기화',
      message: '모든 업체와 사용 내역을 삭제할까요? 먼저 백업하는 걸 권장해요.',
      confirmLabel: '초기화',
      danger: true
    });
    if (!ok) return;
    await clearAllData();
    await refreshShops();
    stopLocationWatch();
    showToast('전체 데이터를 초기화했어요');
    router.navigate('home');
  });
}

function normalizeShop(raw) {
  const totalCoupons = Math.max(1, Math.min(100, parseInt(raw.totalCoupons) || 10));
  return {
    id: String(raw.id || crypto.randomUUID()),
    name: String(raw.name || '이름 없는 업체').trim().slice(0, 80),
    category: CATEGORIES[raw.category] ? raw.category : '기타',
    address: String(raw.address || '').trim().slice(0, 160),
    phone: String(raw.phone || '').trim().slice(0, 40),
    expiresAt: String(raw.expiresAt || '').trim().slice(0, 20),
    memo: String(raw.memo || '').trim().slice(0, 500),
    lat: Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : null,
    lng: Number.isFinite(Number(raw.lng)) ? Number(raw.lng) : null,
    totalCoupons,
    usedCoupons: Math.max(0, Math.min(totalCoupons, parseInt(raw.usedCoupons) || 0)),
    skin: SKINS[raw.skin] ? raw.skin : getDefaultSkin(raw.category),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now()
  };
}

function normalizeLog(raw) {
  return {
    id: String(raw.id || crypto.randomUUID()),
    shopId: String(raw.shopId || ''),
    note: raw.note ? String(raw.note).slice(0, 200) : undefined,
    location: raw.location || undefined,
    usedAt: Number(raw.usedAt) || Date.now()
  };
}

/* ===== Location Notification ===== */
function handleLocationNotify(notifyList) {
  // Show popup with all shops that have met dwell time
  const body = document.createElement('div');
  body.innerHTML = `<p style="margin-bottom:12px;color:var(--text-muted);font-size:0.9rem">가게에 방문하셨어요! 쿠폰을 사용할 업체를 선택하세요.</p>`;
  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';

  notifyList.forEach(({ shop, distance }) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;background:var(--bg-hover);';
    row.innerHTML = `
      <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.2rem">${getCategoryIcon(shop.category)}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.95rem">${escapeHtml(shop.name)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(shop.address || '')}</div>
      </div>
      <div class="badge badge-accent">${shop.totalCoupons - shop.usedCoupons}개</div>
    `;
    row.addEventListener('click', () => {
      closePopup();
      router.navigate('detail', { id: shop.id });
    });
    list.appendChild(row);
  });
  body.appendChild(list);

  showPopup({
    title: '근처 가게 방문 감지',
    body: body.innerHTML,
    actions: [
      { id: 'close', label: '나중에', className: 'btn-secondary', onClick: () => {}, close: true }
    ]
  });
}

/* ===== Boot ===== */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
