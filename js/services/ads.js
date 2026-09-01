// services/ads.js — Google AdSense (Auto Ads) integration.
//
// The app ships with neutral placeholder banners (see adBanner in ui/components.js)
// while ads are OFF. To turn on real ads (Auto Ads):
//   AdSense site (lightonpluslab.com, covers coupon.lightonpluslab.com) is APPROVED
//   under publisher ID ca-pub-7180935400084577. Ads are ON below; the loader script is
//   injected and the neutral placeholder banners are hidden. Google's Auto Ads must
//   also be turned ON for the site in the AdSense dashboard to place ads.
// Google then places ads automatically (anchor / in-content) — no slot wiring.

export const AD_CONFIG = {
  enabled: true,                           // ON — AdSense approved
  client: 'ca-pub-7180935400084577'        // LightOn Plus Lab AdSense publisher ID
};

const isPlaceholder = () => !AD_CONFIG.client || AD_CONFIG.client.includes('XXXX');

let _loaded = false;
// Inject the async AdSense loader once. No-op without a real publisher ID.
function injectLoader() {
  if (_loaded || isPlaceholder()) return;
  _loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.client}`;
  document.head.appendChild(s);
}

// True when running inside an installed/native app shell (installed PWA, TWA, or
// the native WebView shell) rather than a plain browser tab. AdSense is a WEBSITE
// product and must stay OUT of the Android app — the native AdMob banner handles
// in-app ads — so serving AdSense there risks invalid-traffic/policy strikes.
export function isAppContext() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true
    || /CouponBookApp/i.test(navigator.userAgent || '')
    || window.__COUPONBOOK_APP__ === true
    || (document.referrer || '').startsWith('android-app://');
}

// Auto Ads is page-level: load the script once; Google handles placement.
// In app context we never load AdSense (native AdMob handles in-app ads).
// While ads are off (or no real ID yet), keep the neutral placeholder banners.
export function mountAds() {
  if (isAppContext()) {
    // Native shell owns ads (AdMob). Hide web placeholders; never load AdSense.
    document.querySelectorAll('.ad-banner').forEach((el) => { el.style.display = 'none'; });
    return;
  }
  if (!AD_CONFIG.enabled || isPlaceholder()) return;
  injectLoader();
  // Auto Ads injects its own placements — hide our in-app placeholder banners.
  document.querySelectorAll('.ad-banner').forEach((el) => { el.style.display = 'none'; });
}
