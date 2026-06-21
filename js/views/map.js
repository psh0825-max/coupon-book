// views/map.js — Leaflet map of located shops: user marker + accuracy circle,
// status-colored pins, floating selected-shop card, summary, nearby list.

import * as Leaflet from '../../vendor/leaflet/leaflet-src.esm.js';
import { h, clear } from '../core/h.js';
import { emptyState } from '../ui/components.js';
import { couponStatus } from '../domain.js';
import { getCurrentPosition, haversine } from '../services/location.js';
import { mapsDirectionsUrl } from '../services/maps.js';
import { formatDistance } from '../services/format.js';
import { getCategoryIcon } from '../data/skins.js';
import { showToast } from '../ui/toast.js';

let _map = null;
let _layer = null;

export function render(ctx) {
  const { store, router } = ctx;
  const st = store.getState();
  const located = (st.shops || []).filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));

  const root = h('div', { class: 'map-page' });

  const locateBtn = h('button', { class: 'btn btn-primary', attrs: { type: 'button' } }, '내 위치');
  root.appendChild(h('div', { class: 'map-toolbar' },
    h('div', null,
      h('div', { class: 'eyebrow' }, 'NEARBY SHOPS'),
      h('h2', null, '내 주변 업체 지도'),
      h('p', null, '위치가 저장된 쿠폰 업체를 현재 위치 기준으로 보여줘요.')
    ),
    locateBtn
  ));

  const mapEl = h('div', { id: 'coupon-map', class: 'coupon-map' }, h('div', { class: 'map-loading' }, '지도를 준비하는 중...'));
  const floatEl = h('div', { id: 'map-float', class: 'map-float', attrs: { hidden: '' } });
  root.appendChild(h('div', { class: 'coupon-map-wrap' }, mapEl, floatEl));

  const summaryEl = h('div', { class: 'map-summary', id: 'map-summary' });
  const listEl = h('div', { class: 'nearby-shop-list', id: 'map-shop-list' });
  root.appendChild(summaryEl);
  root.appendChild(listEl);

  if (located.length === 0) {
    clear(mapEl);
    mapEl.appendChild(emptyState({
      icon: 'map',
      title: '지도에 표시할 업체가 없어요',
      desc: '업체 편집 화면에서 현재 위치를 저장하면 지도에 표시됩니다',
      actions: [{ label: '업체 추가', className: 'btn-primary', onClick: () => router.navigate('add') }]
    }));
    return root;
  }

  drawMap({ mapEl, floatEl, summaryEl, listEl, located, router });
  locateBtn.addEventListener('click', () => drawMap({ mapEl, floatEl, summaryEl, listEl, located, router, forceLocate: true }));
  return root;
}

async function drawMap({ mapEl, floatEl, summaryEl, listEl, located, router, forceLocate = false }) {
  let userPos = null;
  let center = getShopsCenter(located);
  let locationMessage = '등록 업체 중심으로 표시 중';

  try {
    userPos = await getCurrentPosition();
    center = [userPos.lat, userPos.lng];
    locationMessage = '현재 위치 기준';
  } catch (e) {
    if (forceLocate) showToast('현재 위치를 가져올 수 없어요', 'danger');
  }

  if (_map) { _map.remove(); _map = null; _layer = null; }
  clear(mapEl);
  _map = Leaflet.map(mapEl, { zoomControl: true, attributionControl: true }).setView(center, userPos ? 15 : 13);
  Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(_map);
  _layer = Leaflet.layerGroup().addTo(_map);

  if (userPos) {
    Leaflet.circle([userPos.lat, userPos.lng], {
      radius: Math.max(35, userPos.accuracy || 60),
      color: '#77a8d8', fillColor: '#77a8d8', fillOpacity: 0.14, weight: 1
    }).addTo(_layer);
    Leaflet.marker([userPos.lat, userPos.lng], { icon: createMapIcon('me') }).addTo(_layer).bindPopup('현재 위치');
  }

  const nearby = located.map((shop) => {
    const distance = userPos ? haversine(userPos.lat, userPos.lng, Number(shop.lat), Number(shop.lng)) : null;
    return { shop, distance };
  }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  function showFloat(shop, distance) {
    const dir = mapsDirectionsUrl(shop);
    const remaining = shop.totalCoupons - (shop.usedCoupons || 0);
    floatEl.hidden = false;
    clear(floatEl);
    floatEl.appendChild(h('div', { class: 'map-float-info' },
      h('div', { class: 'map-float-ico', dataset: { skin: shop.skin || 'midnight' } },
        h('span', { class: 'category-icon' }, getCategoryIcon(shop.category))
      ),
      h('div', { class: 'map-float-text' },
        h('strong', null, shop.name),
        h('span', null, `${distance !== null ? formatDistance(distance) + ' · ' : ''}${remaining}개 남음`)
      )
    ));
    floatEl.appendChild(h('div', { class: 'map-float-actions' },
      h('button', { class: 'btn btn-secondary', attrs: { type: 'button' }, on: { click: () => router.navigate('detail', { id: shop.id }) } }, '상세'),
      dir ? h('a', { class: 'btn btn-primary', attrs: { href: dir, target: '_blank', rel: 'noopener' } }, '길찾기') : null
    ));
  }

  nearby.forEach(({ shop, distance }) => {
    Leaflet.marker([Number(shop.lat), Number(shop.lng)], { icon: createMapIcon(couponStatus(shop).className) })
      .addTo(_layer).on('click', () => showFloat(shop, distance));
  });
  if (nearby.length) showFloat(nearby[0].shop, nearby[0].distance);

  const bounds = Leaflet.latLngBounds(located.map((shop) => [Number(shop.lat), Number(shop.lng)]));
  if (userPos) bounds.extend([userPos.lat, userPos.lng]);
  _map.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
  setTimeout(() => _map?.invalidateSize(), 80);

  const visibleNearby = nearby.filter((item) => item.distance === null || item.distance <= 3000);
  clear(summaryEl);
  summaryEl.appendChild(h('div', null, h('strong', null, String(nearby.length)), h('span', null, '지도 표시 업체')));
  summaryEl.appendChild(h('div', null, h('strong', null, String(visibleNearby.length)), h('span', null, userPos ? '3km 이내' : '목록 표시')));
  summaryEl.appendChild(h('div', null, h('strong', null, locationMessage), h('span', null, userPos ? '위치 권한 허용됨' : '위치 권한 필요')));

  renderNearbyList(listEl, nearby, router);
}

function getShopsCenter(shops) {
  const lat = shops.reduce((sum, sh) => sum + Number(sh.lat), 0) / shops.length;
  const lng = shops.reduce((sum, sh) => sum + Number(sh.lng), 0) / shops.length;
  return [lat, lng];
}

function createMapIcon(type) {
  const safe = ['me', 'success', 'warning', 'danger', 'neutral'].includes(type) ? type : 'neutral';
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
    listEl.appendChild(h('div', { class: 'nearby-shop-row' },
      main,
      dir ? h('a', { class: 'nearby-dir', attrs: { href: dir, target: '_blank', rel: 'noopener', 'aria-label': '길찾기' } }, '길찾기') : null
    ));
  });
}
