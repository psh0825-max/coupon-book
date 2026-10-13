// core/keyed-lock.js — non-queuing async lock scoped to a caller-provided key.

/**
 * createKeyedLock() -> { run, isBusy }
 */
export function createKeyedLock() {
  const busy = new Set();

  async function run(key, fn) {
    if (busy.has(key)) return undefined;
    busy.add(key);
    try {
      return await fn();
    } finally {
      busy.delete(key);
    }
  }

  function isBusy(key) {
    return busy.has(key);
  }

  return { run, isBusy };
}
