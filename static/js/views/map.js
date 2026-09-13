// views/map.js — Leaflet map of located shops: user marker + accuracy circle,
// status-colored pins, floating selected-shop card, summary, nearby list.
// Robust offline: tile failures show a friendly notice while pins and the list
// keep working; tiles retry when the network returns.

import * as Leaflet from '../../vendor/leaflet/leaflet-src.esm.js';
import { h, clear, icon } from '../core/h.js';
import { emptyState } from '../ui/components.js';
import { couponStatus, remainingLabel } from '../domain.js';
import { getCurrentPosition, haversine } from '../services/location.js';
import { mapsDirectionsUrl, openShopDirections } from '../services/maps.js';
import { formatDistance } from '../services/format.js';
import { getCategoryIcon } from '../data/skins.js';
import { showToast } from '../ui/toast.js';
import { haptic } from '../services/fx.js';

let _map = null;
let _layer = null;
let _tiles = null;
let _onlineHandler = null;

// A shop is plottable only when both coords are present (not null/'') AND finite.
// Number(null) and Number('') are 0 (finite), so the null/'' checks must come
// first — otherwise no-coordinate shops would plot at (0,0). A genuine 0 passes.
const hasCoords = (s) =>
  s.lat != null && s.lng != null && s.lat !== '' && s.lng !== '' &&
  Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng));

function teardown() {
  if (_map) {
    try { _map.remove(); } catch { /* already detached */ }
  }
  _map = null;
  _layer = null;
  _tiles = null;
  if (_onlineHandler) {
    window.removeEventListener('online', _onlineHandler);
    _onlineHandler = null;
  }
}

export function render(ctx) {
  // Tear down any prior map instance so navigating away and back never leaks it
  // (including the no-located-shops early-return path below).
  teardown();

  const { store, router } = ctx;
  const st = store.getState();
  const located = (st.shops || []).filter(hasCoords);

  const root = h('div', { class: 'map-page' });

  const locateBtn = h('button', { class: 'btn btn-primary', attrs: { type: 'button', 'aria-label': '내 위치로 이동' } }, icon('target', { size: 18 }), '내 위치');
  root.appendChild(h('div', { class: 'map-toolbar' },
    h('div', null,
      h('div', { class: 'eyebrow' }, '내 주변'),
      h('h2', null, '가게 지도'),
      h('p', null, located.length ? `위치가 저장된 가게 ${located.length}곳` : '위치를 저장한 가게가 여기에 표시돼요')
    ),
    located.length ? locateBtn : null
  ));

  const mapEl = h('div', { id: 'coupon-map', class: 'coupon-map', attrs: { role: 'region', 'aria-label': '지도' } }, h('div', { class: 'map-loading' }, '지도를 준비하는 중…'));
  const offlineEl = h('div', { class: 'map-offline', attrs: { hidden: '', role: 'status' } },
    icon('alert', { size: 20 }),
    h('div', null,
      h('strong', null, '지도 타일을 불러올 수 없어요'),
      h('span', null, '오프라인이거나 연결이 불안정해요. 가게 목록과 길찾기는 계속 쓸 수 있어요.')
    )
  );
  const floatEl = h('div', { id: 'map-float', class: 'map-float', attrs: { hidden: '' } });
  root.appendChild(h('div', { class: 'coupon-map-wrap' }, mapEl, offlineEl, floatEl));

  const summaryEl = h('div', { class: 'map-summary', id: 'map-summary' });
  const listEl = h('div', { class: 'nearby-shop-list', id: 'map-shop-list', attrs: { role: 'list' } });
  root.appendChild(summaryEl);
  root.appendChild(listEl);

  if (located.length === 0) {
    clear(mapEl);
    mapEl.classList.add('is-empty');
    mapEl.appendChild(emptyState({
      icon: 'map',
      title: '지도에 표시할 가게가 없어요',
      desc: '이용권을 추가하거나 편집할 때 "현재 위치로 저장"을 누르면 여기에 표시돼요',
      actions: [{ label: '이용권 추가', className: 'btn-primary', onClick: () => router.navigate('add') }]
    }));
    return root;
  }

  const args = { mapEl, offlineEl, floatEl, summaryEl, listEl, located, router };
  drawMap(args);
  locateBtn.addEventListener('click', () => { haptic('light'); drawMap({ ...args, forceLocate: true }); });
  return root;
}

async function drawMap({ mapEl, offlineEl, floatEl, summaryEl, listEl, located, router, forceLocate = false }) {
  let userPos = null;
  let center = getShopsCenter(located);
  let locationMessage = '등록 가게 중심';

  try {
    userPos = await getCurrentPosition();
    center = [userPos.lat, userPos.lng];
    locationMessage = '현재 위치 기준';
  } catch (e) {
    if (forceLocate) showToast('현재 위치를 가져올 수 없어요. 위치 권한을 확인해 주세요.', 'danger');
  }

  if (!mapEl.isConnected) return; // user navigated away while locating
  teardown();
  clear(mapEl);
  _map = Leaflet.map(mapEl, { zoomControl: true, attributionControl: true }).setView(center, userPos ? 15 : 13);
  _tiles = Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(_map);
  _layer = Leaflet.layerGroup().addTo(_map);

  // Offline-friendly: surface tile failures instead of a silent grey grid.
  let tileErrors = 0;
  let tileLoads = 0;
  const showOffline = (on) => { offlineEl.hidden = !on; };
  _tiles.on('tileerror', () => { tileErrors += 1; if (tileErrors >= 3 && tileLoads === 0) showOffline(true); });
  _tiles.on('tileload', () => { tileLoads += 1; showOffline(false); });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) showOffline(true);
  _onlineHandler = () => { tileErrors = 0; showOffline(false); try { _tiles.redraw(); } catch { /* noop */ } };
  window.addEventListener('online', _onlineHandler);

  let meMarker = null;
  if (userPos) {
    Leaflet.circle([userPos.lat, userPos.lng], {
      radius: Math.max(35, userPos.accuracy || 60),
      color: '#77a8d8', fillColor: '#77a8d8', fillOpacity: 0.14, weight: 1
    }).addTo(_layer);
    meMarker = Leaflet.marker([userPos.lat, userPos.lng], { icon: createMapIcon('me') }).addTo(_layer).bindPopup('현재 위치');
  }

  const nearby = located.map((shop) => {
    const distance = userPos ? haversine(userPos.lat, userPos.lng, Number(shop.lat), Number(shop.lng)) : null;
    return { shop, distance };
  }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  function showFloat(shop, distance) {
    const dir = mapsDirectionsUrl(shop);
    floatEl.hidden = false;
    clear(floatEl);
    floatEl.appendChild(h('div', { class: 'map-float-info' },
      h('div', { class: 'map-float-ico', dataset: { skin: shop.skin || 'midnight' }, attrs: { 'aria-hidden': 'true' } },
        h('span', { class: 'category-icon' }, getCategoryIcon(shop.category))
      ),
      h('div', { class: 'map-float-text' },
        h('strong', null, shop.name),
        h('span', null, `${distance !== null ? formatDistance(distance) + ' · ' : ''}${remainingLabel(shop)} 남음`)
      )
    ));
    floatEl.appendChild(h('div', { class: 'map-float-actions' },
      h('button', { class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: () => router.navigate('detail', { id: shop.id }) } }, '상세'),
      dir ? h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => openShopDirections(shop) } }, '길찾기') : null
    ));
  }

  nearby.forEach(({ shop, distance }) => {
    Leaflet.marker([Number(shop.lat), Number(shop.lng)], { icon: createMapIcon(couponStatus(shop).className), title: shop.name })
      .addTo(_layer).on('click', () => { haptic('selection'); showFloat(shop, distance); });
  });
  if (nearby.length) showFloat(nearby[0].shop, nearby[0].distance);

  // Apply the camera AFTER invalidateSize so fitBounds/setView is computed
  // against the container's real dimensions (not a zero/world-sized box).
  function applyView() {
    if (!_map) return;
    _map.invalidateSize();
    if (forceLocate && userPos) {
      _map.setView([userPos.lat, userPos.lng], 16);
      meMarker?.openPopup();
    } else {
      const bounds = Leaflet.latLngBounds(located.map((shop) => [Number(shop.lat), Number(shop.lng)]));
      if (userPos) bounds.extend([userPos.lat, userPos.lng]);
      _map.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
    }
  }
  applyView();
  setTimeout(applyView, 120);

  const visibleNearby = nearby.filter((item) => item.distance === null || item.distance <= 3000);
  clear(summaryEl);
  summaryEl.appendChild(h('div', null, h('strong', null, String(nearby.length)), h('span', null, '지도 표시')));
  summaryEl.appendChild(h('div', null, h('strong', null, String(visibleNearby.length)), h('span', null, userPos ? '3km 이내' : '목록')));
  summaryEl.appendChild(h('div', null, h('strong', null, locationMessage), h('span', null, userPos ? '위치 허용됨' : '위치 권한 필요')));

  renderNearbyList(listEl, nearby, router);
}

function getShopsCenter(shops) {
  const lat = shops.reduce((sum, sh) => sum + Number(sh.lat), 0) / shops.length;
  const lng = shops.reduce((sum, sh) => sum + Number(sh.lng), 0) / shops.length;
  return [lat, lng];
}

function createMapIcon(type) {
  const safe = ['me', 'success', 'warning', 'danger', 'neutral', 'accent'].includes(type) ? type : 'neutral';
  return Leaflet.divIcon({
    className: `coupon-map-pin ${safe}`,
    html: '<span></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function renderNearbyList(listEl, nearby, router) {
  clear(listEl);
  nearby.forEach(({ shop, distance }) => {
    const status = couponStatus(shop);
    const dir = mapsDirectionsUrl(shop);
    const main = h('button', {
      class: 'nearby-shop-main',
      attrs: { type: 'button' },
      on: { click: () => router.navigate('detail', { id: shop.id }) }
    },
      h('div', null, h('strong', null, shop.name), h('span', null, shop.address || shop.category)),
      h('em', null, distance !== null ? formatDistance(distance) : status.label)
    );
    listEl.appendChild(h('div', { class: 'nearby-shop-row', attrs: { role: 'listitem' } },
      main,
      dir ? h('button', { class: 'nearby-dir', attrs: { type: 'button', 'aria-label': `${shop.name} 길찾기` }, on: { click: () => openShopDirections(shop) } }, icon('navigation', { size: 14 }), '길찾기') : null
    ));
  });
}
