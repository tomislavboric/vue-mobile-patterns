import { ref, toValue } from 'vue'

// ── Drag-to-reorder for a vertical list (mouse + touch) ──────────────────────
// The "grab a handle, drop the row somewhere else, persist the new order"
// pattern, for lists where row order IS the meaning (priorities, rules that
// run top to bottom, a menu). The composable only computes the new order; the
// caller decides what persisting it means.
//
//   items   — the CURRENT ordered array (array, ref or getter); each row needs `.id`.
//   persist(orderedIds) — may be async; receives the full id list in the new order.
//
// Desktop uses native HTML5 drag (draggable handle + row dragover). HTML5 drag
// doesn't fire on touch, so touch devices use touch* events on the handle:
// touchmove stays captured to the element the finger went down on even as it
// moves off it, so the finger position is hit-tested against rows tagged
// `data-drag-index` to find the drop target. Bind :data-drag-index="index" on
// each row for touch to work, and give the handle `touch-action: none` so the
// page doesn't scroll under the finger.
//
// Returns { dragIndex, dropIndex } (for row highlight classes), the handlers to
// bind — mouse: onDragStart(index, event), onDragOver(index), onDrop,
// onDragEnd; touch: onTouchStart(index), onTouchMove(event), onTouchEnd — and
// move(from, to) for keyboard or button-driven reordering.
export function useDragReorder({ items, persist }) {
  if (typeof persist !== 'function') throw new TypeError('useDragReorder: `persist` must be a function')

  const dragIndex = ref(null)
  const dropIndex = ref(null)

  function reset() {
    dragIndex.value = null
    dropIndex.value = null
  }

  // Move the id at `from` to slot `to` and persist the full new order.
  // Out-of-range or no-op moves persist nothing.
  async function move(from, to) {
    const ids = (toValue(items) || []).map(item => item.id)
    if (!Number.isInteger(from) || !Number.isInteger(to)) return
    if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    await persist(ids)
  }

  function commit() {
    const from = dragIndex.value
    const to = dropIndex.value
    reset()
    if (from === null || to === null) return Promise.resolve()
    return move(from, to)
  }

  // ── Mouse (native HTML5 drag) ──────────────────────────────────────────────
  function onDragStart(index, event) {
    dragIndex.value = index
    dropIndex.value = index
    // Firefox won't start a drag without data; the payload itself is unused.
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    }
  }

  function onDragOver(index) {
    if (dragIndex.value === null) return
    dropIndex.value = index
  }

  function onDrop() {
    return commit()
  }

  function onDragEnd() {
    reset()
  }

  // ── Touch ──────────────────────────────────────────────────────────────────
  function rowIndexFromPoint(clientX, clientY) {
    if (typeof document === 'undefined') return null
    const row = document.elementFromPoint(clientX, clientY)?.closest('[data-drag-index]')
    if (!row) return null
    const idx = Number(row.getAttribute('data-drag-index'))
    return Number.isInteger(idx) ? idx : null
  }

  function onTouchStart(index) {
    dragIndex.value = index
    dropIndex.value = index
  }

  function onTouchMove(event) {
    if (dragIndex.value === null) return
    const touch = event.touches?.[0]
    if (!touch) return
    const idx = rowIndexFromPoint(touch.clientX, touch.clientY)
    if (idx !== null) dropIndex.value = idx
  }

  function onTouchEnd() {
    return commit()
  }

  return {
    dragIndex, dropIndex,
    onDragStart, onDragOver, onDrop, onDragEnd,
    onTouchStart, onTouchMove, onTouchEnd,
    move,
  }
}
