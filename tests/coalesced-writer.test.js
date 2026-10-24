import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoalescedWriter } from '../src/core/coalescedWriter.js'

// Burst of autosave writes → ONE flush. Guards the contract callers rely on:
// bursts merge into a single flush, every coalesced caller resolves with that
// batch's shared result, the maxWait cap prevents indefinite deferral, flushes
// serialize, and abandon() settles waiters without flushing (teardown).

describe('createCoalescedWriter', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeWriter(overrides = {}) {
    const flushes = []
    const flush = vi.fn(async (patch) => {
      flushes.push({ ...patch })
      return overrides.result !== undefined ? overrides.result : true
    })
    const writer = createCoalescedWriter({ debounceMs: 1000, maxWaitMs: 4000, flush, ...overrides })
    return { writer, flush, flushes }
  }

  it('requires a flush function', () => {
    expect(() => createCoalescedWriter({})).toThrow(TypeError)
  })

  it('coalesces a burst of writes into one flush with the merged patch', async () => {
    const { writer, flush, flushes } = makeWriter()
    const p1 = writer.write({ a: 1 })
    const p2 = writer.write({ b: 2 })
    const p3 = writer.write({ a: 3 }) // later write wins inside the batch

    expect(flush).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)

    expect(flush).toHaveBeenCalledTimes(1)
    expect(flushes[0]).toEqual({ a: 3, b: 2 })
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([true, true, true])
  })

  it('trailing debounce: each write pushes the flush out again', async () => {
    const { writer, flush } = makeWriter()
    writer.write({ a: 1 })
    await vi.advanceTimersByTimeAsync(900)
    writer.write({ b: 2 })
    await vi.advanceTimersByTimeAsync(900)
    expect(flush).not.toHaveBeenCalled() // 1800ms elapsed, but never 1000ms of quiet
    await vi.advanceTimersByTimeAsync(100)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('maxWait caps deferral under continuous editing', async () => {
    const { writer, flush, flushes } = makeWriter()
    // A write every 900ms keeps resetting the 1000ms debounce forever…
    for (let i = 0; i < 5; i++) {
      writer.write({ [`k${i}`]: i })
      await vi.advanceTimersByTimeAsync(900)
    }
    // …but the 4000ms cap forced the batch out mid-stream.
    expect(flush).toHaveBeenCalledTimes(1)
    expect(flushes[0]).toEqual({ k0: 0, k1: 1, k2: 2, k3: 3, k4: 4 })
  })

  it('a failed flush resolves EVERY coalesced caller with the shared result', async () => {
    const { writer } = makeWriter({ result: false })
    const p1 = writer.write({ a: 1 })
    const p2 = writer.write({ b: 2 })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(Promise.all([p1, p2])).resolves.toEqual([false, false])
  })

  it('a throwing flush rejects the batch waiters, and the chain survives it', async () => {
    const boom = new Error('boom')
    let fail = true
    const writer = createCoalescedWriter({
      debounceMs: 1000,
      maxWaitMs: 4000,
      flush: async () => { if (fail) throw boom; return true },
    })
    const p = writer.write({ a: 1 })
    p.catch(() => {}) // attach early so the rejection is never unhandled
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).rejects.toBe(boom)
    // Same writer: the next batch still flushes.
    fail = false
    const p2 = writer.write({ b: 2 })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p2).resolves.toBe(true)
  })

  it('serializes flushes: a batch opened mid-flight waits for the previous one', async () => {
    const order = []
    let releaseFirst
    const gate = new Promise(resolve => { releaseFirst = resolve })
    let call = 0
    const flush = vi.fn(async () => {
      const n = ++call
      order.push(`start${n}`)
      if (n === 1) await gate
      order.push(`end${n}`)
      return true
    })
    const writer = createCoalescedWriter({ debounceMs: 100, maxWaitMs: 4000, flush })

    const p1 = writer.write({ a: 1 })
    await vi.advanceTimersByTimeAsync(100) // batch 1 flushing, held open by the gate
    const p2 = writer.write({ b: 2 })      // batch 2 opens while 1 is in flight
    await vi.advanceTimersByTimeAsync(100)
    expect(order).toEqual(['start1'])      // batch 2 must NOT start yet
    releaseFirst()
    await Promise.all([p1, p2])
    expect(order).toEqual(['start1', 'end1', 'start2', 'end2'])
  })

  it('flushNow forces the pending batch out without waiting for the debounce', async () => {
    const { writer, flush } = makeWriter()
    const p = writer.write({ a: 1 })
    writer.flushNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(flush).toHaveBeenCalledTimes(1)
    await expect(p).resolves.toBe(true)
    // Timers were cleared — nothing double-flushes later.
    await vi.advanceTimersByTimeAsync(5000)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushNow with nothing pending is a no-op that still resolves', async () => {
    const { writer, flush } = makeWriter()
    await expect(writer.flushNow()).resolves.toBeUndefined()
    expect(flush).not.toHaveBeenCalled()
  })

  it('abandon drops the batch without flushing and settles waiters with the given value', async () => {
    const { writer, flush } = makeWriter()
    const p = writer.write({ a: 1 })
    expect(writer.hasPending()).toBe(true)
    writer.abandon(true)
    expect(writer.hasPending()).toBe(false)
    await expect(p).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(flush).not.toHaveBeenCalled()
  })

  it('a write after a flush opens a fresh, independent batch', async () => {
    const { writer, flush, flushes } = makeWriter()
    const p1 = writer.write({ a: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    const p2 = writer.write({ b: 2 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flushes).toEqual([{ a: 1 }, { b: 2 }])
    await expect(Promise.all([p1, p2])).resolves.toEqual([true, true])
  })

  it('dispose flushes what is pending', async () => {
    const { writer, flush, flushes } = makeWriter()
    writer.write({ a: 1 })
    await writer.dispose()
    expect(flush).toHaveBeenCalledTimes(1)
    expect(flushes[0]).toEqual({ a: 1 })
  })
})
