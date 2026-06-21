// services/maps.js — single maps provider (Google Maps) for both "지도" view and
// "길찾기" directions. Prefer precise lat/lng, fall back to address then name.

function destination(shop) {
  if (shop && shop.lat != null && shop.lng != null) return `${shop.lat},${shop.lng}`;
  return (shop && (shop.address || shop.name)) || '';
}

/** Open the shop location on the map. */
export function mapViewUrl(shop) {
  const query = destination(shop);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Open turn-by-turn directions to the shop. */
export function mapsDirectionsUrl(shop) {
  const dest = destination(shop);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
