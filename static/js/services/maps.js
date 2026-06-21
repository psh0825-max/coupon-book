// services/maps.js — single maps provider (Google Maps) for both "지도" view and
// "길찾기" directions. Prefer precise lat/lng, fall back to address then name.

// Resolve a usable destination string, or '' when the shop has neither finite
// coordinates nor a non-empty address. Name alone is not enough — too ambiguous
// to map reliably, so it no longer counts as a destination.
function hasCoord(v) {
  return v != null && v !== '' && Number.isFinite(Number(v));
}
function destination(shop) {
  if (shop && hasCoord(shop.lat) && hasCoord(shop.lng)) {
    return `${shop.lat},${shop.lng}`;
  }
  const address = shop && shop.address ? String(shop.address).trim() : '';
  return address || '';
}

/** Open the shop location on the map. Returns '' when there is no destination. */
export function mapViewUrl(shop) {
  const query = destination(shop);
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Open turn-by-turn directions to the shop. Returns '' when there is no destination. */
export function mapsDirectionsUrl(shop) {
  const dest = destination(shop);
  if (!dest) return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
