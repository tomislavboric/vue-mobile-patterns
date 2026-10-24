import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createToastQueue, DEFAULT_TOAST_DURATION, PROBLEM_TOAST_DURATION } from '../src/core/toastQueue.js'

// The toast stack refuses bursts itself (dedupe / keyed replace / cap), so a
// call site reporting the same thing twice cannot stack copies on screen.

describe('createToastQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeQueue(opts = {}) {
    let snapshot = []
    const queue = createToastQueue({ onChange: (items) => { snapshot = items }, ...opts })
    return { queue, visible: () => snapshot }
  }

  it('shows a toast and auto-dismisses it after the default duration', () => {
    const { queue, visible } = makeQueue()
    queue.show('Saved', 'success')
    expect(visible()).toHaveLength(1)
    vi.advanceTimersByTime(DEFAULT_TOAST_DURATION - 1)
    expect(visible()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(visible()).toHaveLength(0)
  })

  it('keeps a warning or error up longer than a confirmation', () => {
    const { queue, visible } = makeQueue()
    queue.show('Saved', 'success')
    queue.show('Could not save', 'error')
    vi.advanceTimersByTime(DEFAULT_TOAST_DURATION)
    expect(visible().map(t => t.kind)).toEqual(['error'])
    vi.advanceTimersByTime(PROBLEM_TOAST_DURATION - DEFAULT_TOAST_DURATION)
    expect(visible()).toHaveLength(0)
  })

  it('accepts a bare duration as shorthand for the third argument', () => {
    const { queue, visible } = makeQueue()
    queue.show('x', 'warn', 1000)
    vi.advanceTimersByTime(1000)
    expect(visible()).toHaveLength(0)
  })

  it('honours custom default durations', () => {
    const { queue, visible } = makeQueue({ defaultDuration: 100, problemDuration: 200 })
    queue.show('ok', 'success')
    queue.show('bad', 'error')
    vi.advanceTimersByTime(100)
    expect(visible().map(t => t.text)).toEqual(['bad'])
    vi.advanceTimersByTime(100)
    expect(visible()).toHaveLength(0)
  })

  it('collapses an identical kind+text into one toast with a counter and a fresh timer', () => {
    const { queue, visible } = makeQueue()
    queue.show('Could not save', 'error')
    vi.advanceTimersByTime(4000)
    queue.show('Could not save', 'error')
    queue.show('Could not save', 'error')
    expect(visible()).toHaveLength(1)
    expect(visible()[0].count).toBe(3)
    vi.advanceTimersByTime(4000) // the first timer would have fired by now
    expect(visible()).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(visible()).toHaveLength(0)
  })

  it('returns the same id for a deduped toast', () => {
    const { queue } = makeQueue()
    expect(queue.show('A', 'info')).toBe(queue.show('A', 'info'))
  })

  it('does not merge the same text under a different kind', () => {
    const { queue, visible } = makeQueue()
    queue.show('A', 'success')
    queue.show('A', 'error')
    expect(visible()).toHaveLength(2)
  })

  it('replaces a keyed toast in place (latest wins) instead of stacking', () => {
    const { queue, visible } = makeQueue()
    const first = queue.show('Sync failed', 'warn', { key: 'sync' })
    const second = queue.show('Changes synced', 'success', { key: 'sync' })
    expect(second).toBe(first)
    expect(visible()).toHaveLength(1)
    expect(visible()[0]).toMatchObject({ text: 'Changes synced', kind: 'success', count: 1 })
  })

  it('caps the visible stack and evicts the oldest non-error first', () => {
    const { queue, visible } = makeQueue({ maxVisible: 3 })
    queue.show('err 1', 'error')
    queue.show('ok 1', 'success')
    queue.show('ok 2', 'success')
    queue.show('ok 3', 'success')
    expect(visible().map(t => t.text)).toEqual(['err 1', 'ok 2', 'ok 3'])
  })

  it('evicts the oldest error when every visible toast is an error', () => {
    const { queue, visible } = makeQueue({ maxVisible: 2 })
    queue.show('e1', 'error')
    queue.show('e2', 'error')
    queue.show('e3', 'error')
    expect(visible().map(t => t.text)).toEqual(['e2', 'e3'])
  })

  it('an evicted toast leaves no timer behind', () => {
    const { queue } = makeQueue({ maxVisible: 1 })
    queue.show('a', 'success')
    queue.show('b', 'success')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('ignores empty text and maps an unknown kind to info', () => {
    const { queue, visible } = makeQueue()
    expect(queue.show('', 'success')).toBeNull()
    queue.show('x', 'nope')
    expect(visible()).toEqual([expect.objectContaining({ text: 'x', kind: 'info' })])
  })

  it('manual dismiss clears the pending timer', () => {
    const { queue, visible } = makeQueue()
    const id = queue.show('x', 'success')
    queue.dismiss(id)
    expect(visible()).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clear() empties the stack and every timer', () => {
    const { queue, visible } = makeQueue()
    queue.show('a', 'success')
    queue.show('b', 'error')
    queue.clear()
    expect(visible()).toEqual([])
    expect(queue.items).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('works with injected timers (no global setTimeout needed)', () => {
    const scheduled = []
    const queue = createToastQueue({
      setTimer: (fn, ms) => { scheduled.push({ fn, ms }); return scheduled.length },
      clearTimer: () => {},
    })
    queue.show('hi', 'info')
    expect(scheduled[0].ms).toBe(DEFAULT_TOAST_DURATION)
    scheduled[0].fn()
    expect(queue.items).toEqual([])
  })
})
