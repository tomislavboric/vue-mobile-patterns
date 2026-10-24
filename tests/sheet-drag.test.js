// @vitest-environment happy-dom
//
// Swipe-to-dismiss must work from ANYWHERE on the sheet, not just from the
// 40×4px grip at the top edge. The arbitration rules are pinned here:
//
//   - a downward drag past the threshold closes, from any point on the panel
//   - a short drag springs back and closes nothing
//   - a horizontal or upward first movement is handed back to the content
//   - a downward drag inside a list that is scrolled away from its top scrolls
//     that list — it never dismisses the sheet
//   - a drag that moved swallows the trailing click, so releasing over a row
//     doesn't also activate the row
//   - `enabled` and `canClose` gate the gesture
//   - a swipe that closes leaves through the surface's own leave transition:
//     at the moment `close` fires, the panel carries its drag offset and NO
//     inline transition (an inline `transition: none` outranks the leave
//     classes, and the leaving node is never patched again — the panel would
//     freeze where the finger left it and only fade)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import BottomSheet from '../src/components/BottomSheet.vue'
import { useSheetDrag } from '../src/composables/useSheetDrag.js'

const THRESHOLD = 70 // useSheetDrag default

// happy-dom has no TouchEvent constructor; the composable only reads
// `touches[].identifier/clientX/clientY`, so a plain Event carrying that shape
// exercises the exact code path a browser drives.
function fireTouch(el, type, { x = 0, y = 0, id = 1 } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const points = type === 'touchend' || type === 'touchcancel'
    ? []
    : [{ identifier: id, clientX: x, clientY: y }]
  Object.defineProperty(event, 'touches', { value: points })
  el.dispatchEvent(event)
  return event
}

// One full gesture: press at (fromX, fromY), drag through the points, release.
function swipe(el, { fromX = 100, fromY = 100, points = [] } = {}) {
  fireTouch(el, 'touchstart', { x: fromX, y: fromY })
  const events = points.map(([x, y]) => fireTouch(el, 'touchmove', { x, y }))
  fireTouch(el, 'touchend')
  return events
}

// Make an element look scrollable to the composable: happy-dom reports 0 for
// every layout metric, so scrollHeight/clientHeight have to be declared.
function makeScrollable(el, { scrollTop = 0 } = {}) {
  el.style.overflowY = 'auto'
  Object.defineProperty(el, 'scrollHeight', { value: 800, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 300, configurable: true })
  el.scrollTop = scrollTop
}

function mountSheet(props = {}) {
  return mount(BottomSheet, {
    props: { open: true, title: 'More', ...props },
    slots: { default: '<button class="row" type="button">Row</button>' },
    attachTo: document.body,
  })
}

let wrapper = null

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('BottomSheet — swipe anywhere on the panel', () => {
  it('closes on a long downward drag started on a row, not the grip', async () => {
    wrapper = mountSheet()
    const row = document.querySelector('.row')
    expect(row).toBeTruthy()

    swipe(row, { fromY: 200, points: [[100, 220], [100, 260], [100, 200 + THRESHOLD + 30]] })
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('springs back — no close — when the drag stays under the threshold', async () => {
    wrapper = mountSheet()
    const row = document.querySelector('.row')

    swipe(row, { fromY: 200, points: [[100, 215], [100, 240]] })
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('respects a custom threshold', async () => {
    wrapper = mountSheet({ threshold: 200 })
    const row = document.querySelector('.row')

    swipe(row, { fromY: 200, points: [[100, 230], [100, 400]] }) // 170px < 200
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('hands a horizontal gesture back to the content', async () => {
    wrapper = mountSheet()
    const row = document.querySelector('.row')

    const moves = swipe(row, { fromY: 200, points: [[160, 210], [260, 220]] })
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
    // Not ours → the browser keeps its default (a horizontal pan / text select).
    expect(moves.every((e) => !e.defaultPrevented)).toBe(true)
  })

  it('ignores an upward drag', async () => {
    wrapper = mountSheet()
    const row = document.querySelector('.row')

    swipe(row, { fromY: 300, points: [[100, 280], [100, 180]] })
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('lets a scrolled list scroll instead of dismissing', async () => {
    wrapper = mountSheet()
    const body = document.querySelector('.vmp-sheet__body')
    makeScrollable(body, { scrollTop: 120 })
    const row = document.querySelector('.row')

    const moves = swipe(row, { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
    // The scroll must not be cancelled — that's the whole point of handing back.
    expect(moves.every((e) => !e.defaultPrevented)).toBe(true)
  })

  it('dismisses when the same list sits at its top', async () => {
    wrapper = mountSheet()
    const body = document.querySelector('.vmp-sheet__body')
    makeScrollable(body, { scrollTop: 0 })
    const row = document.querySelector('.row')

    const moves = swipe(row, { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    // Ours → the list must not scroll underneath the drag.
    expect(moves.some((e) => e.defaultPrevented)).toBe(true)
  })

  it('swallows the click that follows a real drag', async () => {
    wrapper = mountSheet()
    const row = document.querySelector('.row')
    let clicks = 0
    row.addEventListener('click', () => { clicks += 1 })

    swipe(row, { fromY: 200, points: [[100, 220], [100, 250]] })
    row.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
    expect(clicks).toBe(0)

    // …and only that one: the next tap is a tap again.
    row.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
    expect(clicks).toBe(1)
  })

  it('leaves a plain tap alone', async () => {
    wrapper = mountSheet()
    const row = document.querySelector('.row')
    let clicks = 0
    row.addEventListener('click', () => { clicks += 1 })

    fireTouch(row, 'touchstart', { x: 100, y: 200 })
    fireTouch(row, 'touchmove', { x: 101, y: 202 })
    fireTouch(row, 'touchend')
    row.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(clicks).toBe(1)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('canClose=false refuses the swipe and leaves the gesture to the content', async () => {
    wrapper = mountSheet({ canClose: () => false })
    const row = document.querySelector('.row')

    const moves = swipe(row, { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(moves.every((e) => !e.defaultPrevented)).toBe(true)
  })

  it('canClose=false also blocks the overlay click and Escape, not the close button', async () => {
    wrapper = mountSheet({ canClose: () => false })
    document.querySelector('.vmp-sheet-overlay').dispatchEvent(new Event('click', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeUndefined()

    document.querySelector('.vmp-sheet__close').click()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes on overlay click and on Escape', async () => {
    wrapper = mountSheet()
    document.querySelector('.vmp-sheet-overlay').dispatchEvent(new Event('click', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('a click inside the panel does not count as an overlay click', async () => {
    wrapper = mountSheet()
    document.querySelector('.row').click()
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('swipe-close hands the panel to the leave transition', () => {
  it('drag offset stays, inline transition is gone when close fires', async () => {
    let seen = null
    wrapper = mount(BottomSheet, {
      props: {
        open: true,
        title: 'More',
        onClose: () => {
          const { translate, transition, transform } = document.querySelector('.vmp-sheet').style
          seen = { translate, transition, transform }
        },
      },
      slots: { default: '<button class="row" type="button">Row</button>' },
      attachTo: document.body,
    })
    const row = document.querySelector('.row')

    swipe(row, { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    // Engaged at y=230, released at y=400 → 170px below rest.
    // `transform` belongs to the enter/leave classes; the drag must not claim it.
    expect(seen).toEqual({ translate: '0 170px', transition: '', transform: '' })
  })
})

// The composable on its own, the way a custom drawer would use it.
function mountHarness({ enabled, canClose } = {}) {
  const closes = []
  const Harness = defineComponent({
    setup() {
      const { panelEl, dragStyle } = useSheetDrag(() => true, () => closes.push(1), { enabled, canClose })
      return () => h('div', { ref: panelEl, class: 'panel', style: dragStyle.value }, [
        h('div', { class: 'field' }, 'Content'),
      ])
    },
  })
  wrapper = mount(Harness, { attachTo: document.body })
  return closes
}

describe('useSheetDrag — options', () => {
  it('closes a custom panel on a downward swipe over its content', async () => {
    const closes = mountHarness()
    swipe(document.querySelector('.field'), { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()
    expect(closes).toHaveLength(1)
  })

  it('enabled=false turns the gesture off (e.g. a drawer that is a side panel on desktop)', async () => {
    const closes = mountHarness({ enabled: () => false })
    swipe(document.querySelector('.field'), { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()
    expect(closes).toHaveLength(0)
  })

  it('canClose=false refuses the swipe (e.g. unsaved changes)', async () => {
    const closes = mountHarness({ canClose: () => false })
    swipe(document.querySelector('.field'), { fromY: 200, points: [[100, 230], [100, 400]] })
    await nextTick()
    expect(closes).toHaveLength(0)
  })
})
