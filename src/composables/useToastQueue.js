import { shallowRef, onScopeDispose, getCurrentScope } from 'vue'
import { createToastQueue } from '../core/toastQueue.js'

/**
 * The toast queue as Vue state: `toasts` is a shallowRef holding the current
 * snapshot, ready for <ToastStack :toasts="toasts" @dismiss="dismiss" />.
 * Pending timers are cleared when the owning scope (component, store) is
 * disposed.
 *
 * Create it once (e.g. in your root component or a store) and share it — one
 * queue is what makes dedupe and the cap work across the whole app.
 *
 * @param {Parameters<typeof createToastQueue>[0]} [options]  same as createToastQueue, minus onChange
 */
export function useToastQueue(options = {}) {
  const toasts = shallowRef([])
  const queue = createToastQueue({ ...options, onChange: (items) => { toasts.value = items } })
  if (getCurrentScope()) onScopeDispose(() => queue.clear())
  return {
    toasts,
    show: queue.show,
    dismiss: queue.dismiss,
    clear: queue.clear,
  }
}
