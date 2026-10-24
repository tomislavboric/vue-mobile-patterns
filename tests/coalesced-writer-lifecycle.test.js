// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoalescedWriter } from '../src/core/coalescedWriter.js'

// In a browser the debounce window must not swallow the last change when the
// tab is hidden or the page unloads.

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('createCoalescedWriter — page lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('flushes the pending batch when the tab is hidden', async () => {
    const flush = vi.fn(async () => true)
    const writer = createCoalescedWriter({ flush })
    writer.write({ a: 1 })
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(flush).toHaveBeenCalledWith({ a: 1 })
  })

  it('flushes on pagehide', async () => {
    const flush = vi.fn(async () => true)
    const writer = createCoalescedWriter({ flush })
    writer.write({ a: 1 })
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushOnHide: false leaves the batch to its timers', async () => {
    const flush = vi.fn(async () => true)
    const writer = createCoalescedWriter({ flush, flushOnHide: false })
    writer.write({ a: 1 })
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(flush).not.toHaveBeenCalled()
    writer.abandon()
  })

  it('dispose detaches the lifecycle listeners', async () => {
    const flush = vi.fn(async () => true)
    const writer = createCoalescedWriter({ flush })
    writer.write({ a: 1 })
    await writer.dispose()
    expect(flush).toHaveBeenCalledTimes(1)
    // A later batch is no longer pushed out by the page lifecycle…
    writer.write({ b: 2 })
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(flush).toHaveBeenCalledTimes(1)
    writer.abandon()
  })
})
