import { t as tr } from './i18n.js';
import { afterOwnPops, goBackBy } from './history-queue.js';
// core/router.js — view registry + browser-history-backed back stack. Owns
// section visibility, nav active state, page title, back-button + FAB
// visibility, scroll reset. Navigation pushes history state objects (URL never
// changes) so the Android/TWA hardware back button navigates in-app instead of
// exiting; app.js feeds popstate back in via restore().

const ROOT_PAGES = ['home', 'history', 'map', 'settings'];

const TITLES = {
  home: tr("쿠폰북"),
  list: tr("내 이용권"),
  map: tr("주변 지도"),
  add: (p) => (p && p.id ? tr("이용권 편집") : tr("이용권 추가")),
  detail: tr("상세"),
  settings: tr("설정"),
  history: tr("사용 내역"),
  onboarding: tr("시작하기")
};

/**
 * createRouter({ outlet, routes, onChange, getCtx, closeOverlays })
 *   routes: { name: render(ctx, params) -> Element }
 *   getCtx: () -> ctx supplied by app.js at navigate time
 *   closeOverlays: () -> void — tears down an open sheet without popping
 *     history (its entry is reused by the navigation below)
 *   isAvailable: ({ name, params }) -> bool — false when a history entry points
 *     at something that no longer exists (a deleted pass); restore() then goes home
 */
export function createRouter({ outlet, routes, onChange, getCtx, closeOverlays, isAvailable } = {}) {
  let currentName = null;
  let currentParams = {};
  let hasNavigated = false;
  let currentEntry = null; // history state of the page on screen
  let leaveGuard = null;   // { isDirty(), confirm() -> Promise<bool> } set by a form view

  function navigate(name, params = {}) {
    if (!routes || !routes[name]) return;
    closeOverlays?.();
    currentName = name;
    currentParams = params || {};
    render();
    // Written after any pop the app already started (a sheet closing right
    // before this navigation), or it would land on the entry being popped.
    afterOwnPops(() => syncHistory(name, params));
  }

  // Roots live at depth 0, so back exits from a root: going to one from deeper
  // first pops back to the first entry, or every sub page passed on the way
  // would stay behind as an entry Back walks through (or reopens). An open
  // sheet's entry is reused in place; sub pages push one level deeper.
  function syncHistory(name, params) {
    const state = history.state || {};
    const depth = state.depth || 0;
    if (!hasNavigated) {
      // Boot: entries left by an earlier page load are not ours to walk.
      hasNavigated = true;
      writeEntry('replaceState', { name, params, depth: 0 });
    } else if (ROOT_PAGES.includes(name)) {
      goBackBy(depth);
      afterOwnPops(() => writeEntry('replaceState', { name, params, depth: 0 }));
    } else if (state.overlay) {
      writeEntry('replaceState', { name, params, depth });
    } else {
      writeEntry('pushState', { name, params, depth: depth + 1 });
    }
  }

  function writeEntry(method, entry) {
    history[method](entry, '');
    currentEntry = entry;
  }

  function setLeaveGuard(guard) {
    leaveGuard = guard || null;
  }

  // The pop already happened, so put the form's entry back while asking; leaving
  // then goes back for real.
  function holdForGuard() {
    const guard = leaveGuard;
    if (!guard || !currentEntry || !guard.isDirty()) return false;
    history.pushState(currentEntry, '');
    guard.confirm().then((leave) => {
      if (!leave || leaveGuard !== guard) return;
      leaveGuard = null;
      afterOwnPops(() => history.back());
    });
    return true;
  }

  function back() {
    afterOwnPops(() => {
      if (history.state && history.state.depth > 0) history.back();
      else navigate('home');
    });
  }

  // Render a popped history entry without touching history. No-op when the
  // entry matches the current view (e.g. the back() an overlay close issues)
  // so scroll position survives.
  function restore(state) {
    if (holdForGuard()) return;
    const s = (state && state.name && routes[state.name]) ? state : { name: 'home', params: {} };
    if (isAvailable && !isAvailable({ name: s.name, params: s.params || {} })) {
      navigate('home');
      return;
    }
    if (s.name === currentName
      && JSON.stringify(s.params || {}) === JSON.stringify(currentParams || {})) return;
    currentName = s.name;
    currentParams = s.params || {};
    if (s.depth != null) currentEntry = { name: s.name, params: currentParams, depth: s.depth };
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
    const name = currentName;
    const params = currentParams;
    leaveGuard = null; // the view being built sets its own
    const view = routes[name](ctx, params);
    // A view may redirect while it is being built (the detail of a deleted pass
    // navigates home). That nested navigate already rendered its own target;
    // mounting this view now would put a stale empty element into it.
    if (name !== currentName || params !== currentParams) return;
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

  return { navigate, back, current, reload, restore, setLeaveGuard };
}

function replaceChildren(parent, node) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  parent.appendChild(node);
}

export { ROOT_PAGES, TITLES };
