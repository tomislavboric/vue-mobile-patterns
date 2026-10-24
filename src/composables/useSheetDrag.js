import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

/**
 * Swipe-to-dismiss for bottom sheets and mobile drawers — from ANYWHERE on the
 * panel, not just the grip.
 *
 * A drag that only lives on the grip leaves one spot a finger can grab: a
 * 40×4px handle at the top edge, with everything below it inert. Here a
 * downward drag started anywhere on the panel dismisses it, and the gesture
 * arbitrates against the panel's own scrolling instead of being kept away
 * from it:
 *
 *   - horizontal or upward first movement → handed back (list scroll, sliders)
 *   - downward, but the content under the finger is scrolled past its top →
 *     handed back (the list scrolls, as it must)
 *   - downward with that content already at its top → the panel takes the
 *     gesture, tracks the finger 1:1, and `preventDefault()`s the scroll
 *
 * Past the threshold the caller closes, and the panel leaves through the
 * surface's OWN leave transition, starting from where the finger let go — one
 * closing motion per surface, whether it was swiped, tapped shut or saved.
 * Otherwise it springs back. A drag that actually moved swallows the trailing
 * click, so releasing over a row never activates it.
 *
 * The offset is written to `translate`, not `transform`: the surface's
 * enter/leave classes animate `transform`, and the two compose instead of the
 * inline value overriding the class.
 *
 * Touch uses native listeners (`{ passive: false }`) rather than pointer
 * events, because only a non-passive `touchmove` can cancel a scroll the
 * browser is deciding about in the same frame. Mouse keeps a pointer-based
 * grip drag — a cursor has no scroll ambiguity to resolve.
 *
 * Usage — bind panelEl + dragStyle, and gripHandlers if the sheet shows a grip:
 *   const { panelEl, dragStyle, gripHandlers } = useSheetDrag(() => props.open, () => emit('close'))
 *   <div ref="panelEl" :style="dragStyle"> <div class="grip" v-on="gripHandlers" /> … </div>
 *
 * @param {() => boolean} isOpen  reactive getter for the sheet's open state
 * @param {() => void} close      called once a drag passes the threshold
 * @param {{ threshold?: number, enabled?: () => boolean, canClose?: () => boolean }} [opts]
 *   threshold — px of downward travel that commits to closing. Default 70.
 *   enabled   — gate the whole gesture (e.g. a drawer that is a sheet only on
 *               mobile). Default: always on.
 *   canClose  — consulted when the gesture commits; false leaves the drag to
 *               the scroller, so a dirty form can't be swiped away (apply the
 *               same rule to your overlay click).
 */
export function useSheetDrag(isOpen, close, { threshold = 70, enabled = null, canClose = null } = {}) {
  const panelEl = ref(null)
  const dragY = ref(0)
  const dragging = ref(false)
  const settling = ref(false)
  const closing = ref(false)
  // px of travel before the gesture commits to drag-vs-scroll. Small enough to
  // feel immediate, large enough that a tap with a shaky thumb stays a tap.
  const SLOP = 8
  let startX = 0
  let startY = 0
  let originY = 0        // y where the drag engaged — measuring from here keeps the slop out of the offset
  let mode = null        // null = undecided, 'drag' = ours, 'reject' = the scroller's
  let touchId = null
  let scrollEl = null
  let moved = false
  let swallowClick = false
  let settleTimer = null

  const dragStyle = computed(() => {
    if (!dragging.value && !settling.value && !closing.value) return null
    const style = { translate: `0 ${dragY.value}px` }
    // Handed to the leave transition: the offset stays, the inline transition
    // goes — an inline `transition: none` would outrank the leave classes and
    // freeze the panel where the finger left it.
    if (closing.value) return style
    style.transition = dragging.value ? 'none' : 'translate 0.28s cubic-bezier(0.32, 0.72, 0, 1)'
    return style
  })

  function isEnabled() {
    return enabled ? !!enabled() : true
  }

  // The scrolling box under the finger, if any: the nearest element between
  // the touch target and the panel (inclusive) that actually overflows. Its
  // scrollTop decides whether a downward drag belongs to the list or the panel.
  function scrollableUnder(target) {
    let el = target instanceof Element ? target : null
    while (el && panelEl.value && (el === panelEl.value || panelEl.value.contains(el))) {
      const style = window.getComputedStyle(el)
      const scrolls = /(auto|scroll|overlay)/.test(style.overflowY)
      if (scrolls && el.scrollHeight > el.clientHeight) return el
      if (el === panelEl.value) break
      el = el.parentElement
    }
    return null
  }

  function engage(clientY) {
    mode = 'drag'
    dragging.value = true
    settling.value = false
    originY = clientY
    dragY.value = 0
  }

  function release() {
    if (!dragging.value) return
    dragging.value = false
    if (dragY.value > threshold) {
      // A leaving node is unmounted, never patched again — whatever inline
      // style it carries when `close()` flips the v-if is what it keeps for
      // the whole leave. So render the handed-over style first, close after.
      closing.value = true
      nextTick(() => { if (closing.value) close() })
    } else if (dragY.value > 0) {
      settling.value = true
      dragY.value = 0
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => { settling.value = false }, 300)
    }
  }

  // ── Touch: the whole panel ───────────────────
  function onTouchStart(e) {
    mode = null
    moved = false
    swallowClick = false
    scrollEl = null
    if (!isEnabled() || e.touches.length !== 1) { mode = 'reject'; return }
    const touch = e.touches[0]
    touchId = touch.identifier
    startX = touch.clientX
    startY = touch.clientY
    scrollEl = scrollableUnder(e.target)
  }

  function onTouchMove(e) {
    if (mode === 'reject') return
    const touch = Array.from(e.touches).find((x) => x.identifier === touchId)
    if (!touch) return
    if (mode === null) {
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      if (Math.abs(dx) > Math.abs(dy) || dy <= 0) { mode = 'reject'; return }
      if (scrollEl && scrollEl.scrollTop > 0) { mode = 'reject'; return }
      if (canClose && !canClose()) { mode = 'reject'; return }
      engage(touch.clientY)
    }
    if (mode !== 'drag') return
    // Non-passive: this is what stops the list/page scrolling behind the drag.
    if (e.cancelable) e.preventDefault()
    dragY.value = Math.max(0, touch.clientY - originY)
    if (dragY.value > 4) moved = true
  }

  function onTouchEnd() {
    if (mode === 'drag') {
      swallowClick = moved
      release()
    }
    mode = null
    touchId = null
    scrollEl = null
  }

  // A drag that moved must not also activate whatever sits under the finger.
  function onClickCapture(e) {
    if (!swallowClick) return
    swallowClick = false
    e.stopPropagation()
    e.preventDefault()
  }

  function attach(el) {
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('click', onClickCapture, true)
  }

  function detach(el) {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
    el.removeEventListener('click', onClickCapture, true)
  }

  // The panel usually sits inside a <Transition>, so the element is created
  // and destroyed with the open state — follow the ref rather than attaching
  // once on mount. `sync` so the listeners are live the moment the node exists:
  // a deferred flush leaves a one-tick window where the sheet is on screen but
  // not draggable.
  watch(panelEl, (el, prev) => {
    if (prev) detach(prev)
    if (el) attach(el)
  }, { flush: 'sync' })

  // ── Mouse / pen: the grip ────────────────────
  // Touch takes the full-surface path above; a pointerdown from a finger here
  // would double-drive the same drag.
  function onDown(e) {
    if (e.pointerType === 'touch' || !isEnabled()) return
    if (canClose && !canClose()) return
    engage(e.clientY)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onMove(e) {
    if (!dragging.value || mode !== 'drag') return
    dragY.value = Math.max(0, e.clientY - originY)
  }

  function onUp() {
    if (mode !== 'drag') return
    mode = null
    release()
  }

  watch(isOpen, () => {
    clearTimeout(settleTimer)
    dragging.value = false
    settling.value = false
    closing.value = false
    dragY.value = 0
    mode = null
    swallowClick = false
  })

  onUnmounted(() => {
    clearTimeout(settleTimer)
    if (panelEl.value) detach(panelEl.value)
  })

  return {
    panelEl,
    dragStyle,
    dragging,
    gripHandlers: {
      pointerdown: onDown,
      pointermove: onMove,
      pointerup: onUp,
      pointercancel: onUp,
    },
  }
}
