/* ===== Ad slots (free-tier monetization) =====
 * The app ships with neutral placeholder banners (see adBannerHTML in ui.js).
 * To serve real Google AdSense ads:
 *   1) Set AD_CONFIG.enabled = true
 *   2) Fill AD_CONFIG.client with your AdSense publisher ID (ca-pub-...)
 *   3) Fill AD_CONFIG.slot with your ad unit slot ID
 * No other code changes are needed — mountAds() swaps every .ad-banner slot
 * for a responsive AdSense unit. While disabled it is a no-op (placeholders stay).
 */
export const AD_CONFIG = {
  enabled: false,
  client: 'ca-pub-XXXXXXXXXXXXXXXX',
  slot: 'XXXXXXXXXX'
};

let _scriptInjected = false;
function injectScript() {
  if (_scriptInjected || !AD_CONFIG.client) return;
  _scriptInjected = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.client}`;
  document.head.appendChild(s);
}

// Replace placeholder ad banners with real AdSense units. Safe to call after every render.
export function mountAds(root = document) {
  if (!AD_CONFIG.enabled || !AD_CONFIG.client) return; // keep placeholders in free/dev mode
  injectScript();
  root.querySelectorAll('.ad-banner:not([data-ad-mounted])').forEach((slot) => {
    slot.dataset.adMounted = '1';
    slot.classList.add('ad-live');
    slot.innerHTML = `<ins class="adsbygoogle" style="display:block;width:100%"
      data-ad-client="${AD_CONFIG.client}"
      data-ad-slot="${AD_CONFIG.slot}"
      data-ad-format="auto"
      data-full-width-responsive="true"></ins>`;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // adsbygoogle not ready yet; the queued push will run when the script loads
    }
  });
}
