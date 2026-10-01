// config.js — the ONE place for per-deployment values (ad ids, URLs, version).
// Swap ids here without touching any other module.
//
// AdMob (iOS) — how the ids are resolved (services/ads.js):
//   ios.useTestAds = true   → Google's official iOS TEST banner is requested
//                             (ADMOB_TEST_BANNER_ID_IOS; safe to tap, no revenue).
//                             Development builds only.
//   ios.useTestAds = false  → ios.bannerId is requested. When it is EMPTY, ads stay
//                             completely off: no SDK init, no ATT prompt, no reserved
//                             banner space. This is the state of the release archive
//                             until the real banner unit exists in the AdMob console.
// iOS 2.0.0 (build 2) ships WITHOUT the AdMob plugin: capacitor.config.json
// `ios.includePlugins` leaves out @capacitor-community/admob, and Info.plist has
// no GADApplicationIdentifier / NSUserTrackingUsageDescription / SKAdNetworkItems
// (App Review 2.1: a binary that links ATT must show the prompt). To turn iOS ads
// on (2.0.1): set ios.bannerId, add the plugin back to ios.includePlugins, restore
// those three Info.plist keys (git show 5286496:ios/App/App/Info.plist), then
// `npx cap sync ios` — scripts/ios-archive.sh refuses a half-enabled archive.

export const APP_VERSION = '2.0.0';

export const URLS = {
  site: 'https://coupon.lightonpluslab.com',
  privacy: 'https://coupon.lightonpluslab.com/privacy.html',
  studio: 'https://lightonpluslab.com',
  support: 'support@lightonpluslab.com'
};

export const ADS_ENABLED = true;

/** Google's official iOS banner test unit (https://developers.google.com/admob/ios/test-ads). */
export const ADMOB_TEST_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';

export const ADS = {
  // Web (browser visitors): Google AdSense Auto Ads. Never loaded inside the
  // native shells (Android WebView / iOS) — those use AdMob.
  web: {
    client: 'ca-pub-7180935400084577'
  },
  // iOS: AdMob adaptive banner via @capacitor-community/admob.
  ios: {
    appId: 'ca-app-pub-7180935400084577~3984818286',   // AdMob app "쿠폰북 iOS"
    bannerId: '',                                       // banner ad unit id — '' = ads off
    useTestAds: false                                   // true only while developing
  }
  // Android: the WebView shell owns its own AdMob banner natively
  // (webview-app/app/build.gradle + MainActivity.java); nothing to configure here.
};

/** The banner unit the iOS app should request right now ('' → ads disabled). */
export function iosBannerId() {
  if (ADS.ios.useTestAds) return ADMOB_TEST_BANNER_ID_IOS;
  return (ADS.ios.bannerId || '').trim();
}

// Kakao Maps keyword search (add/edit auto-fill). Works only on origins
// registered for this JavaScript key.
export const KAKAO = {
  jsKey: 'a96a80050b4933a9409ca5a797ec765b',
  allowedHosts: ['coupon.lightonpluslab.com', 'localhost', '127.0.0.1']
};
