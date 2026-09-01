// core/router.js — view registry + browser-history-backed back stack. Owns
// section visibility, nav active state, page title, back-button + FAB
// visibility, scroll reset. Navigation pushes history state objects (URL never
// changes) so the Android/TWA hardware back button navigates in-app instead of
// exiting; app.js feeds popstate back in via restore().

const ROOT_PAGES = ['home', 'history', 'map', 'settings'];

const TITLES = {
  home: 'Coupon Book',
  list: '내 이용권',
  map: '주변 지도',
  add: (p) => (p && p.id ? '이용권 편집' : '이용권 추가'),
  detail: '상세',
  settings: '설정',
  history: '사용 내역',
  onboarding: '시작하기'
};

/**
 * createRouter({ outlet, routes, onChange, getCtx, closeOverlays })
 *   routes: { name: render(ctx, params) -> Element }
 *   getCtx: () -> ctx supplied by app.js at navigate time
 *   closeOverlays: () -> void — tears down an open sheet without popping
 *     history (its entry is reused by the navigation below)
 */
export function createRouter({ outlet, routes, onChange, getCtx, closeOverlays } = {}) {
  let currentName = null;
  let currentParams = {};
  let hasNavigated = false;

  function navigate(name, params = {}) {
    if (!routes || !routes[name]) return;
    const wasOverlay = !!(history.state && history.state.overlay);
    if (wasOverlay) closeOverlays?.();
    currentName = name;
    currentParams = params || {};
    render();
    // History sync: roots replace (depth 0, so back exits from a root); an open
    // sheet's entry is reused in place; everything else pushes one level deeper.
    if (!hasNavigated || ROOT_PAGES.includes(name)) {
      history.replaceState({ name, params, depth: 0 }, '');
      hasNavigated = true;
    } else if (wasOverlay) {
      history.replaceState({ name, params, depth: (history.state.depth || 0) }, '');
    } else {
      history.pushState({ name, params, depth: ((history.state && history.state.depth) || 0) + 1 }, '');
    }
  }

  function back() {
    if (history.state && history.state.depth > 0) history.back();
    else navigate('home');
  }

  // Render a popped history entry without touching history. No-op when the
  // entry matches the current view (e.g. the back() an overlay close issues)
  // so scroll position survives.
  function restore(state) {
    const s = (state && state.name && routes[state.name]) ? state : { name: 'home', params: {} };
    if (s.name === currentName
      && JSON.stringify(s.params || {}) === JSON.stringify(currentParams || {})) return;
    currentName = s.name;
    currentParams = s.params || {};
    render();
  }

  function current() {
    return { name: currentName, params: currentParams };
  }

  // Re-render the current route in place without resetting scroll. Used after a
  // data change so list/detail keep their scroll position.
  function reload() {
    if (currentName === null) return;
    const top = outlet ? outlet.scrollTop : 0;
    render({ keepScroll: true });
    if (outlet) outlet.scrollTop = top;
  }

  function render({ keepScroll = false } = {}) {
    const ctx = getCtx ? getCtx() : {};
    const view = routes[currentName](ctx, currentParams);
    mountView(currentName, view);
    syncChrome(currentName, keepScroll);
    if (typeof onChange === 'function') {
      onChange({ name: currentName, params: currentParams });
    }
  }

  function mountView(name, view) {
    if (!outlet) return;
    const section = outlet.querySelector('#' + name);
    if (section && view != null) replaceChildren(section, view);
    const sections = outlet.querySelectorAll('section');
    sections.forEach((s) => s.classList.toggle('active', s.id === name));
  }

  function syncChrome(name, keepScroll = false) {
    const doc = outlet && outlet.ownerDocument;
    if (!doc) return;
    // bottom-nav active state
    doc.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === name);
      if (el.getAttribute('role') === 'tab') el.setAttribute('aria-selected', String(el.dataset.nav === name));
    });
    // page title
    const titleEl = doc.querySelector('[data-page-title]');
    const title = TITLES[name] || TITLES.home;
    if (titleEl) titleEl.textContent = typeof title === 'function' ? title(currentParams) : title;
    // back button: hidden on root pages
    const backEl = doc.querySelector('[data-back]');
    if (backEl) backEl.hidden = ROOT_PAGES.includes(name);
    // Center add button lives in the nav bar (always visible); highlight on add.
    const fabEl = doc.querySelector('[data-fab]');
    if (fabEl) fabEl.classList.toggle('active', name === 'add');
    // scroll reset — #main is the scroll container, not the window. reload()
    // skips this to preserve position across a data-driven re-render.
    if (!keepScroll) {
      if (outlet && typeof outlet.scrollTo === 'function') outlet.scrollTo(0, 0);
      else if (outlet) outlet.scrollTop = 0;
    }
  }

  return { navigate, back, current, reload, restore };
}

function replaceChildren(parent, node) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  parent.appendChild(node);
}

export { ROOT_PAGES, TITLES };
