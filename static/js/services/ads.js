// services/ads.js — free-tier advertising, one product per runtime:
//   web (browser visitors) → Google AdSense Auto Ads (page-level, no slot wiring)
//   ios                    → AdMob adaptive banner anchored to the bottom safe area
//                            (@capacitor-community/admob), ATT prompt before the
//                            first ad request
//   android                → nothing here: the WebView shell renders its own native
//                            AdMob banner beneath the page
// Everything is gated by ADS_ENABLED in config.js and degrades to "no ads, no
// reserved space" when disabled, offline or failing.

import { ADS_ENABLED, ADS } from '../config.js';
import * as platform from '../platform.js';

const RETRY_MIN_MS = 60 * 1000;

let _adsenseLoaded = false;
let _admob = null;
let _bannerShown = false;
let _lastAttempt = 0;
let _onHeight = () => {};

// ── AdSense (web) ────────────────────────────────────────────────────────────
const adsensePlaceholder = () => !ADS.web.client || ADS.web.client.includes('XXXX');

function loadAdSense() {
  if (_adsenseLoaded || adsensePlaceholder()) return;
  _adsenseLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.web.client}`;
  document.head.appendChild(s);
}

// ── AdMob (iOS) ──────────────────────────────────────────────────────────────
async function requestTracking(AdMob) {
  try {
    const { status } = await AdMob.trackingAuthorizationStatus();
    if (status === 'notDetermined') {
      await AdMob.requestTrackingAuthorization();
      return (await AdMob.trackingAuthorizationStatus()).status === 'authorized';
    }
    return status === 'authorized';
  } catch {
    return false;
  }
}

async function showBanner() {
  if (!_admob || _bannerShown) return;
  const now = Date.now();
  if (now - _lastAttempt < RETRY_MIN_MS) return;
  _lastAttempt = now;
  try {
    await _admob.showBanner({
      adId: ADS.ios.bannerId,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: !!ADS.ios.testing,
      npa: !_personalized
    });
    _bannerShown = true;
  } catch {
    _onHeight(0);
  }
}

let _personalized = false;

async function initAdMob() {
  const AdMob = await platform.plugin('AdMob');
  _admob = AdMob;
  _personalized = await requestTracking(AdMob);
  await AdMob.initialize({
    initializeForTesting: !!ADS.ios.testing,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
    maxAdContentRating: 'General'
  });
  AdMob.addListener('bannerAdSizeChanged', ({ height }) => _onHeight(Number(height) || 0));
  AdMob.addListener('bannerAdLoaded', () => { /* height arrives via SizeChanged */ });
  AdMob.addListener('bannerAdFailedToLoad', async () => {
    // Offline or no fill: give the space back and retry on the next foreground.
    _bannerShown = false;
    _onHeight(0);
    try { await AdMob.removeBanner(); } catch { /* noop */ }
  });
  await showBanner();
}

// ── Public API ───────────────────────────────────────────────────────────────
/**
 * initAds({ onBannerHeight }) — call once after the first view is on screen.
 * onBannerHeight(px) reports the space the native banner occupies at the bottom
 * (0 when there is none) so the layout can keep content and the tab bar clear.
 */
export async function initAds({ onBannerHeight } = {}) {
  _onHeight = typeof onBannerHeight === 'function' ? onBannerHeight : () => {};
  if (!ADS_ENABLED) return;
  if (platform.isIOS) {
    try { await initAdMob(); } catch { _onHeight(0); }
    return;
  }
  if (platform.isAppContext()) return;   // Android shell owns its native banner
  loadAdSense();
}

/** retryAds() — foreground/online hook: re-request a banner that failed earlier. */
export function retryAds() {
  if (!ADS_ENABLED || !platform.isIOS || !_admob || _bannerShown) return;
  showBanner().catch(() => {});
}

export const adsEnabled = ADS_ENABLED;
