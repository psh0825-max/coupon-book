// services/places.js — Kakao Maps keyword place search for add/edit auto-fill.
// The SDK is loaded dynamically on first use (no <script> tag in index.html) and
// is intentionally NOT precached (cross-origin). Results are returned domain-side
// only on registered origins (coupon.lightonpluslab.com + localhost); elsewhere
// search rejects and callers must degrade gracefully.

export const KAKAO_CONFIG = { jsKey: 'a96a80050b4933a9409ca5a797ec765b' };

export function isConfigured() {
  return !!KAKAO_CONFIG.jsKey && !KAKAO_CONFIG.jsKey.includes('XXXX');
}

let _loadPromise = null;

export function loadKakao() {
  if (_loadPromise) return _loadPromise;
  if (!isConfigured()) return Promise.reject(new Error('kakao key missing'));
  _loadPromise = new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) { resolve(); return; }
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_CONFIG.jsKey}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve());
    s.onerror = () => reject(new Error('kakao sdk load failed'));
    document.head.appendChild(s);
  });
  return _loadPromise;
}

// searchPlaces(query, {lat,lng}) -> Promise<Array<{name,category,road,address,phone,lat,lng,distance,url}>>
export async function searchPlaces(query, { lat, lng } = {}) {
  await loadKakao();
  return new Promise((resolve, reject) => {
    const ps = new window.kakao.maps.services.Places();
    const opts = {};
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      opts.x = String(lng); opts.y = String(lat); opts.radius = 20000;
      opts.sort = window.kakao.maps.services.SortBy.DISTANCE;
    }
    ps.keywordSearch(query, (data, status) => {
      const S = window.kakao.maps.services.Status;
      if (status === S.OK) {
        resolve(data.map((d) => ({
          name: d.place_name,
          category: d.category_group_name || (d.category_name ? d.category_name.split('>').pop().trim() : ''),
          road: d.road_address_name || '',
          address: d.address_name || '',
          phone: d.phone || '',
          lat: Number(d.y), lng: Number(d.x),
          distance: d.distance ? Number(d.distance) : null,
          url: d.place_url || ''
        })));
      } else if (status === S.ZERO_RESULT) { resolve([]); }
      else { reject(new Error('kakao search failed: ' + status)); }
    }, opts);
  });
}
