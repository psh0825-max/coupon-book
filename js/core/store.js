// core/store.js — reactive single source of truth (no dependencies).

/**
 * createStore(initialState) -> { getState, setState, subscribe, select }
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();
  const selectors = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    if (next == null) return state;
    state = { ...state, ...next };
    notify();
    return state;
  }

  function notify() {
    for (const listener of listeners) listener(state);
    for (const sel of selectors) sel(state);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // Fires listener only when selectorFn output changes (shallow compare).
  function select(selectorFn, listener) {
    let current = selectorFn(state);
    const entry = (s) => {
      const nextSel = selectorFn(s);
      if (!shallowEqual(nextSel, current)) {
        current = nextSel;
        listener(nextSel);
      }
    };
    selectors.add(entry);
    return () => selectors.delete(entry);
  }

  return { getState, setState, subscribe, select };
}

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}
