// services/maps.js — Kakao Map URL links for both "지도" view and "길찾기".
// Prefer precise lat/lng, then fall back to address search.

function hasCoord(v) {
  return v != null && v !== '' && Number.isFinite(Number(v));
}

function placeName(shop) {
  const name = String(shop?.name || '').replaceAll(',', ' ').trim();
  return name || '목적지';
}

function address(shop) {
  return shop?.address ? String(shop.address).trim() : '';
}

/** Open the shop location in Kakao Map. Returns '' when there is no destination. */
export function mapViewUrl(shop) {
  if (shop && hasCoord(shop.lat) && hasCoord(shop.lng)) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(placeName(shop))},${shop.lat},${shop.lng}`;
  }
  const query = address(shop);
  return query ? `https://map.kakao.com/link/search/${encodeURIComponent(query)}` : '';
}

/** Open Kakao Map directions. Returns '' when there is no destination. */
export function mapsDirectionsUrl(shop) {
  if (shop && hasCoord(shop.lat) && hasCoord(shop.lng)) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(placeName(shop))},${shop.lat},${shop.lng}`;
  }
  const query = address(shop);
  return query ? `https://map.kakao.com/link/search/${encodeURIComponent(query)}` : '';
}
