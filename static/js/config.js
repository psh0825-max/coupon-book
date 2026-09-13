// config.js — the ONE place for per-deployment values (ad ids, URLs, version).
// Swap ids here without touching any other module.
//
// AdMob iOS ids below are Google's OFFICIAL TEST ids (safe to click, no revenue).
// Before the App Store release replace them with the real ids issued in the
// AdMob console (app "쿠폰북" iOS → 앱 ID / 배너 광고단위 ID) and set
// `ios.testing` to false. The native side also needs the app id in
// ios/App/App/Info.plist (GADApplicationIdentifier) — see store/ios/listing.md.

export const APP_VERSION = '2.0.0';

export const URLS = {
  site: 'https://coupon.lightonpluslab.com',
  privacy: 'https://coupon.lightonpluslab.com/privacy.html',
  studio: 'https://lightonpluslab.com',
  support: 'support@lightonpluslab.com'
};

export const ADS_ENABLED = true;

export const ADS = {
  // Web (browser visitors): Google AdSense Auto Ads. Never loaded inside the
  // native shells (Android WebView / iOS) — those use AdMob.
  web: {
    client: 'ca-pub-7180935400084577'
  },
  // iOS: AdMob adaptive banner via @capacitor-community/admob.
  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',        // TEST app id
    bannerId: 'ca-app-pub-3940256099942544/2934735716',     // TEST banner unit
    testing: true                                             // false with real ids
  }
  // Android: the WebView shell owns its own AdMob banner natively
  // (webview-app/app/build.gradle + MainActivity.java); nothing to configure here.
};

// Kakao Maps keyword search (add/edit auto-fill). Works only on origins
// registered for this JavaScript key.
export const KAKAO = {
  jsKey: 'a96a80050b4933a9409ca5a797ec765b',
  allowedHosts: ['coupon.lightonpluslab.com', 'localhost', '127.0.0.1']
};
