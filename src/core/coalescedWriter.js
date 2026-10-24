// Trailing-debounce write coalescer for autosave-style controls.
//
// The problem: toggles that persist on every change turn five quick taps into
// five full network writes, back to back. The coalescer merges a burst of
// write(patch) calls into ONE flush after `debounceMs` of quiet, with
// `maxWaitMs` as a hard cap so continuous editing still persists periodically
// instead of deferring forever.
//
// Contract:
//  • write(patch) returns a promise that settles with the result of the batch
//    flush the patch ended up in — every coalesced caller gets the SAME result,
//    so a per-call "Saved" confirmation stays truthful: it only appears once
//    the batch really landed.
//  • Flushes are serialized: a batch opened while a flush is in flight waits
//    for it, so writes reach the backend in order and never race each other.
//  • flushNow() forces the pending batch out immediately (tab hidden, page
//    unload, an explicit "Save" button). abandon(result) drops the pending
//    batch WITHOUT flushing and settles its waiters with `result` — for
//    teardown where the batch's target no longer exists (signed out, switched
//    account).
//
// SSR / Node safe: browser lifecycle hooks are attached lazily inside write()
// and guarded — nothing touches window/document at module top level.

/**
 * @template P, R
 * @param {object} options
 * @param {(patch: P) => Promise<R> | R} options.flush  persists one merged patch
 * @param {number} [options.debounceMs=1000]  quiet time before a batch flushes
 * @param {number} [options.maxWaitMs=4000]   longest a batch may stay open
 * @param {boolean} [options.flushOnHide=true] flush when the tab is hidden or the page unloads
 */
export function createCoalescedWriter({ debounceMs = 1000, maxWaitMs = 4000, flushOnHide = true, flush }) {
  if (typeof flush !== 'function') throw new TypeError('createCoalescedWriter: `flush` must be a function')

  let pending = null // { patch, waiters, debounceTimer, maxWaitTimer }
  // Tail of the flush chain — each new flush awaits the previous one. A settled
  // promise awaits as a microtask no-op, so the tail is never reset to null.
  let chainTail = Promise.resolve()
  let lifecycleHooked = false
  let disposed = false

  // A debounce window would silently swallow the last change when the tab is
  // hidden or the page unloads — push the pending batch out immediately
  // (best effort: `pagehide` can outrun the request; `visibilitychange`
  // usually leaves the page alive long enough for it to land).
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flushNow()
  }
  function onPageHide() { flushNow() }

  function hookLifecycle() {
    if (!flushOnHide || disposed || lifecycleHooked || typeof document === 'undefined') return
    lifecycleHooked = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)
  }

  function unhookLifecycle() {
    if (!lifecycleHooked) return
    lifecycleHooked = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
  }

  function clearTimers(batch) {
    if (batch.debounceTimer) clearTimeout(batch.debounceTimer)
    if (batch.maxWaitTimer) clearTimeout(batch.maxWaitTimer)
    batch.debounceTimer = null
    batch.maxWaitTimer = null
  }

  function startFlush() {
    if (!pending) return
    const batch = pending
    pending = null
    clearTimers(batch)
    const run = chainTail.then(() => flush(batch.patch))
    // The chain itself must never reject — waiters receive the rejection below.
    chainTail = run.then(() => {}, () => {})
    for (const waiter of batch.waiters) run.then(waiter.resolve, waiter.reject)
  }

  /** Queue a partial patch; later keys win inside a batch. */
  function write(patch) {
    hookLifecycle()
    if (!pending) {
      pending = { patch: {}, waiters: [], debounceTimer: null, maxWaitTimer: null }
      // Hard cap: a batch flushes at most maxWaitMs after it opened, no matter
      // how long the caller keeps editing.
      pending.maxWaitTimer = setTimeout(startFlush, maxWaitMs)
    }
    Object.assign(pending.patch, patch)
    if (pending.debounceTimer) clearTimeout(pending.debounceTimer)
    pending.debounceTimer = setTimeout(startFlush, debounceMs)
    const opened = pending
    return new Promise((resolve, reject) => opened.waiters.push({ resolve, reject }))
  }

  /**
   * Force the pending batch out now. Resolves once every flush issued so far
   * (including this one) has finished — never rejects.
   */
  function flushNow() {
    startFlush()
    return chainTail
  }

  /** Drop the pending batch without flushing; its waiters settle with `result`. */
  function abandon(result) {
    if (!pending) return
    const batch = pending
    pending = null
    clearTimers(batch)
    for (const waiter of batch.waiters) waiter.resolve(result)
  }

  function hasPending() {
    return pending !== null
  }

  /**
   * Flush what is pending and detach the page-lifecycle listeners — call it
   * when the owner of the writer goes away (e.g. in onScopeDispose). The
   * writer keeps working afterwards, on its timers alone.
   */
  function dispose() {
    disposed = true
    unhookLifecycle()
    return flushNow()
  }

  return { write, flushNow, abandon, hasPending, dispose }
}
