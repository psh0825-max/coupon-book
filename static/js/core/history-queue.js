// core/history-queue.js — orders the app's own history writes.
// history.go()/back() are asynchronous: a pushState/replaceState issued before
// their popstate lands is applied to the entry that is about to be left, and the
// late pop then takes the user off the page they just opened. Every history
// write the app makes runs through afterOwnPops(), and every pop it starts goes
// through goBackBy() so app.js can tell it apart from the hardware back button.

let pendingPops = 0;
let fallbackTimer = null;
const queue = [];

function flush() {
  while (queue.length && !pendingPops) queue.shift()();
}

/** Pop `steps` entries; the resulting popstate is ours (see takeOwnPop). */
export function goBackBy(steps) {
  if (!(steps > 0)) return;
  pendingPops += 1;
  history.go(-steps);
  // A pop that cannot happen fires no popstate; never leave the queue stuck.
  clearTimeout(fallbackTimer);
  fallbackTimer = setTimeout(() => {
    if (!pendingPops) return;
    pendingPops = 0;
    flush();
  }, 1500);
}

/** popstate handler: true when this pop was started by goBackBy (nothing to render). */
export function takeOwnPop() {
  if (!pendingPops) return false;
  pendingPops -= 1;
  if (!pendingPops) {
    clearTimeout(fallbackTimer);
    flush();
  }
  return true;
}

/** Run a history write now, or right after the app's own pending pops land. */
export function afterOwnPops(fn) {
  if (pendingPops) queue.push(fn);
  else fn();
}
