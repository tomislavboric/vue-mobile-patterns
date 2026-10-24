// The rules of a toast stack, as plain framework-free JS: no DOM, no Vue, and
// injectable timers, so it can be driven by fake timers in a Node test and
// rendered by any view layer (see ToastStack.vue / useToastQueue for Vue).
//
// Why it exists: the naive show() pushes a new toast on every call, each with
// its own timer — no dedupe, no cap. One event reported from two layers, a
// background sync that fails on every retry, or a loop over N items stacks N
// copies of the same line on a phone screen. This queue makes "more toasts than
// the user can read" something the stack refuses, instead of something every
// call site has to remember to avoid:
//
//   • dedupe — an identical kind+text that is still on screen is not stacked
//     again; it bumps a ×N counter and restarts its timer.
//   • key    — show(text, kind, { key }) REPLACES the visible toast with that
//     key (latest wins): one ongoing state reported with changing copy
//     ("Connection lost" → "Back online", "Sync failing" → "Synced").
//   • cap    — at most maxVisible at once; the oldest non-error goes first, so
//     a failure is never pushed off screen by a success.

export const TOAST_KINDS = Object.freeze(['success', 'info', 'warn', 'error'])

// A confirmation ("Saved") only has to register. Something that went wrong
// carries a sentence the user may need to read and act on, so it stays longer.
// An explicit per-call duration always wins.
export const DEFAULT_TOAST_DURATION = 3500
export const PROBLEM_TOAST_DURATION = 5000
export const DEFAULT_MAX_VISIBLE = 3

const PROBLEM_KINDS = new Set(['warn', 'error'])

// The third argument of show() is either an options object or, as shorthand,
// a bare duration in ms.
function normalizeOptions(opts) {
  if (typeof opts === 'number') return { duration: opts }
  return opts && typeof opts === 'object' ? opts : {}
}

/**
 * @typedef {'success' | 'info' | 'warn' | 'error'} ToastKind
 * @typedef {{ id: number, text: string, kind: ToastKind, key: string | null, count: number }} Toast
 *
 * @param {object} [options]
 * @param {number} [options.maxVisible=3]          most toasts on screen at once
 * @param {number} [options.defaultDuration=3500]  ms for success / info
 * @param {number} [options.problemDuration=5000]  ms for warn / error
 * @param {(items: Toast[]) => void} [options.onChange] called with a fresh snapshot after every change
 * @param {(fn: () => void, ms: number) => any} [options.setTimer]   defaults to setTimeout
 * @param {(handle: any) => void} [options.clearTimer]               defaults to clearTimeout
 */
export function createToastQueue({
  maxVisible = DEFAULT_MAX_VISIBLE,
  defaultDuration = DEFAULT_TOAST_DURATION,
  problemDuration = PROBLEM_TOAST_DURATION,
  onChange = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
} = {}) {
  let items = []
  let seq = 0
  const timers = new Map()

  function emit() { onChange(items.slice()) }

  function arm(id, duration) {
    if (timers.has(id)) clearTimer(timers.get(id))
    timers.set(id, setTimer(() => dismiss(id), duration))
  }

  function drop(id) {
    if (timers.has(id)) clearTimer(timers.get(id))
    timers.delete(id)
    items = items.filter(item => item.id !== id)
  }

  function enforceCap() {
    while (items.length > maxVisible) {
      const victim = items.find(item => item.kind !== 'error') || items[0]
      drop(victim.id)
    }
  }

  /**
   * @param {string} text
   * @param {ToastKind} [kind='success']  an unknown kind falls back to 'info'
   * @param {number | { duration?: number, key?: string }} [opts]
   * @returns {number | null} the id of the toast now showing the text, or null for empty text
   */
  function show(text, kind = 'success', opts) {
    if (!text) return null
    const safeKind = TOAST_KINDS.includes(kind) ? kind : 'info'
    const {
      duration = PROBLEM_KINDS.has(safeKind) ? problemDuration : defaultDuration,
      key = null,
    } = normalizeOptions(opts)

    const keyed = key ? items.find(item => item.key === key) : null
    if (keyed) {
      // A keyed toast is one ongoing state, not a tally — a repeat of the same
      // state just keeps it up longer; new copy replaces it in place.
      Object.assign(keyed, { text, kind: safeKind, count: 1 })
      arm(keyed.id, duration)
      items = items.slice()
      emit()
      return keyed.id
    }

    const same = items.find(item => item.text === text && item.kind === safeKind)
    if (same) {
      same.count += 1
      arm(same.id, duration)
      items = items.slice()
      emit()
      return same.id
    }

    const id = ++seq
    items = [...items, { id, text, kind: safeKind, key, count: 1 }]
    arm(id, duration)
    enforceCap()
    emit()
    return id
  }

  function dismiss(id) {
    if (!items.some(item => item.id === id)) return
    drop(id)
    emit()
  }

  function clear() {
    for (const handle of timers.values()) clearTimer(handle)
    timers.clear()
    items = []
    emit()
  }

  return { show, dismiss, clear, get items() { return items.slice() } }
}
