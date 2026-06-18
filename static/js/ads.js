/* ===== Ads (Google AdSense — Auto Ads) =====
 * The app ships with neutral placeholder banners (see adBannerHTML in ui.js)
 * while ads are OFF. To turn on real ads (Auto Ads):
 *   1) Sign up at https://adsense.google.com and add the site
 *      (psh0825-max.github.io). Get your publisher ID: ca-pub-XXXXXXXXXXXXXXXX
 *   2) Set AD_CONFIG.enabled = true and paste your ID into AD_CONFIG.client below.
 *   3) Redeploy, then in the AdSense dashboard turn ON "Auto ads" for the site.
 * That's it — Google then places ads automatically (anchor / in-content).
 * Also update ads.txt at the site root with the same publisher ID.
 */
export const AD_CONFIG = {
  enabled: false,                          // flip to true once you have a publisher ID
  client: 'ca-pub-XXXXXXXXXXXXXXXX'        // your AdSense publisher ID (ca-pub-…)
};

let _loaded = false;
function injectLoader() {
  if (_loaded || !AD_CONFIG.client || AD_CONFIG.client.includes('XXXX')) return;
  _loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.client}`;
  document.head.appendChild(s);
}

// Auto Ads is page-level: load the script once; Google handles placement.
// While ads are off (or no real ID yet), keep the neutral placeholder banners.
export function mountAds() {
  if (!AD_CONFIG.enabled || !AD_CONFIG.client || AD_CONFIG.client.includes('XXXX')) return;
  injectLoader();
  // Auto Ads injects its own placements — hide our in-app placeholder banners.
  document.querySelectorAll('.ad-banner').forEach((el) => { el.style.display = 'none'; });
}
