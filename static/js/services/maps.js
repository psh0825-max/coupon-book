// services/maps.js — map links for a shop. The provider follows the runtime
// (Apple Maps on iOS, Google Maps elsewhere — see platform.js) so "지도" and
// "길찾기" always open the same app. Prefer precise lat/lng, fall back to the
// address; a name alone is too ambiguous to be a destination.

import { mapViewUrl as viewUrl, directionsUrl, openExternal } from '../platform.js';

function hasCoord(v) {
  return v != null && v !== '' && Number.isFinite(Number(v));
}

function target(shop) {
  if (!shop) return { lat: null, lng: null, label: '' };
  const address = shop.address ? String(shop.address).trim() : '';
  if (hasCoord(shop.lat) && hasCoord(shop.lng)) {
    return { lat: Number(shop.lat), lng: Number(shop.lng), label: shop.name || address };
  }
  return { lat: null, lng: null, label: address };
}

/** URL to view the shop on the map, or '' when there is no destination. */
export function mapViewUrl(shop) {
  const t = target(shop);
  return viewUrl(t.lat, t.lng, t.label);
}

/** URL for turn-by-turn directions to the shop, or '' when there is no destination. */
export function mapsDirectionsUrl(shop) {
  const t = target(shop);
  return directionsUrl(t.lat, t.lng, t.label);
}

export function openShopMap(shop) {
  const url = mapViewUrl(shop);
  return url ? openExternal(url) : Promise.resolve(false);
}

export function openShopDirections(shop) {
  const url = mapsDirectionsUrl(shop);
  return url ? openExternal(url) : Promise.resolve(false);
}
