// core/router.js — view registry + back stack. Owns section visibility, nav
// active state, page title, back-button + FAB visibility, scroll reset.

const ROOT_PAGES = ['home', 'history', 'map', 'settings'];
const FAB_PAGES = ['home', 'list'];

const TITLES = {
  home: 'Coupon Book',
  list: '내 쿠폰',
  map: '주변 지도',
  add: '이용권',
  detail: '상세',
  settings: '설정',
  history: '사용 내역',
  onboarding: '시작하기'
};

/**
 * createRouter({ outlet, routes, onChange, getCtx })
 *   routes: { name: render(ctx, params) -> Element }
 *   getCtx: () -> ctx supplied by app.js at navigate time
 */
export function createRouter({ outlet, routes, onChange, getCtx } = {}) {
  const stack = [];
  let currentName = null;
  let currentParams = {};

  function navigate(name, params = {}) {
    if (!routes || !routes[name]) return;
    if (currentName !== null && currentName !== name) {
      stack.push({ name: currentName, params: currentParams });
    }
    if (ROOT_PAGES.includes(name)) stack.length = 0; // roots reset history
    currentName = name;
    currentParams = params || {};
    render();
  }

  function back() {
    const prev = stack.pop();
    if (prev) {
      currentName = prev.name;
      currentParams = prev.params;
    } else {
      currentName = 'home';
      currentParams = {};
    }
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
    if (titleEl) titleEl.textContent = TITLES[name] || TITLES.home;
    // back button: hidden on root pages
    const backEl = doc.querySelector('[data-back]');
    if (backEl) backEl.hidden = ROOT_PAGES.includes(name);
    // FAB: visible only on home + list
    const fabEl = doc.querySelector('[data-fab]');
    if (fabEl) fabEl.hidden = !FAB_PAGES.includes(name);
    // scroll reset — #main is the scroll container, not the window. reload()
    // skips this to preserve position across a data-driven re-render.
    if (!keepScroll) {
      if (outlet && typeof outlet.scrollTo === 'function') outlet.scrollTo(0, 0);
      else if (outlet) outlet.scrollTop = 0;
    }
  }

  return { navigate, back, current, reload };
}

function replaceChildren(parent, node) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  parent.appendChild(node);
}

export { ROOT_PAGES, FAB_PAGES, TITLES };
