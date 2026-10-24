// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { useDragReorder } from '../src/composables/useDragReorder.js'

const rows = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

function setup(items = rows()) {
  const persist = vi.fn(async () => {})
  const api = useDragReorder({ items: () => items, persist })
  return { api, persist }
}

describe('useDragReorder — mouse (HTML5 drag)', () => {
  it('moves a row down and persists the full new order', async () => {
    const { api, persist } = setup()
    api.onDragStart(0)
    api.onDragOver(2)
    await api.onDrop()
    expect(persist).toHaveBeenCalledWith(['b', 'c', 'a', 'd'])
  })

  it('moves a row up', async () => {
    const { api, persist } = setup()
    api.onDragStart(3)
    api.onDragOver(1)
    await api.onDrop()
    expect(persist).toHaveBeenCalledWith(['a', 'd', 'b', 'c'])
  })

  it('tracks dragIndex / dropIndex for highlight classes and resets after the drop', async () => {
    const { api } = setup()
    api.onDragStart(1)
    expect(api.dragIndex.value).toBe(1)
    expect(api.dropIndex.value).toBe(1)
    api.onDragOver(3)
    expect(api.dropIndex.value).toBe(3)
    await api.onDrop()
    expect(api.dragIndex.value).toBeNull()
    expect(api.dropIndex.value).toBeNull()
  })

  it('dropping a row on itself persists nothing', async () => {
    const { api, persist } = setup()
    api.onDragStart(2)
    api.onDragOver(2)
    await api.onDrop()
    expect(persist).not.toHaveBeenCalled()
  })

  it('ignores dragover when no drag of ours is in progress (e.g. a file dragged in)', async () => {
    const { api, persist } = setup()
    api.onDragOver(2)
    expect(api.dropIndex.value).toBeNull()
    await api.onDrop()
    expect(persist).not.toHaveBeenCalled()
  })

  it('a cancelled drag (dragend without drop) resets and persists nothing', () => {
    const { api, persist } = setup()
    api.onDragStart(0)
    api.onDragOver(3)
    api.onDragEnd()
    expect(api.dragIndex.value).toBeNull()
    expect(persist).not.toHaveBeenCalled()
  })

  it('primes dataTransfer so Firefox starts the drag', () => {
    const { api } = setup()
    const dataTransfer = { effectAllowed: null, setData: vi.fn() }
    api.onDragStart(1, { dataTransfer })
    expect(dataTransfer.effectAllowed).toBe('move')
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '1')
  })

  it('reads the items at drop time, not at setup time', async () => {
    const items = ref(rows())
    const persist = vi.fn()
    const api = useDragReorder({ items, persist })
    items.value = [{ id: 'x' }, { id: 'y' }]
    api.onDragStart(1)
    api.onDragOver(0)
    await api.onDrop()
    expect(persist).toHaveBeenCalledWith(['y', 'x'])
  })

  it('does not mutate the source array', async () => {
    const source = rows()
    const { api } = setup(source)
    api.onDragStart(0)
    api.onDragOver(3)
    await api.onDrop()
    expect(source.map(r => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('surfaces a failing persist to the caller', async () => {
    const persist = vi.fn(async () => { throw new Error('offline') })
    const api = useDragReorder({ items: rows, persist })
    api.onDragStart(0)
    api.onDragOver(1)
    await expect(api.onDrop()).rejects.toThrow('offline')
    expect(api.dragIndex.value).toBeNull()
  })

  it('requires a persist function', () => {
    expect(() => useDragReorder({ items: rows })).toThrow(TypeError)
  })
})

describe('useDragReorder — move(from, to)', () => {
  it('reorders without a drag (keyboard / up-down buttons)', async () => {
    const { api, persist } = setup()
    await api.move(1, 0)
    expect(persist).toHaveBeenCalledWith(['b', 'a', 'c', 'd'])
  })

  it('ignores out-of-range and no-op moves', async () => {
    const { api, persist } = setup()
    await api.move(0, -1)
    await api.move(3, 4)
    await api.move(2, 2)
    await api.move(null, 1)
    expect(persist).not.toHaveBeenCalled()
  })
})

// Touch: the finger position is hit-tested against [data-drag-index] rows.
describe('useDragReorder — touch', () => {
  let wrapper = null
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function mountList() {
    const persist = vi.fn()
    let api
    const List = defineComponent({
      setup() {
        api = useDragReorder({ items: rows, persist })
        return () => h('ul', rows().map((row, index) =>
          h('li', { 'data-drag-index': index, class: `row-${row.id}` }, [h('span', { class: 'label' }, row.id)]),
        ))
      },
    })
    wrapper = mount(List, { attachTo: document.body })
    return { api, persist }
  }

  it('hit-tests the finger against rows and drops on the row under it', async () => {
    const { api, persist } = mountList()
    // happy-dom has no layout, so "the element at this point" is stubbed:
    // the finger is over the label inside row c (index 2).
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.querySelector('.row-c .label'))

    api.onTouchStart(0)
    api.onTouchMove({ touches: [{ clientX: 10, clientY: 120 }] })
    expect(api.dropIndex.value).toBe(2)
    await api.onTouchEnd()
    expect(persist).toHaveBeenCalledWith(['b', 'c', 'a', 'd'])
  })

  it('keeps the last valid target when the finger leaves the list', async () => {
    const { api, persist } = mountList()
    const spy = vi.spyOn(document, 'elementFromPoint')

    api.onTouchStart(3)
    spy.mockReturnValue(document.querySelector('.row-b'))
    api.onTouchMove({ touches: [{ clientX: 10, clientY: 40 }] })
    spy.mockReturnValue(document.body) // finger over something that isn't a row
    api.onTouchMove({ touches: [{ clientX: 10, clientY: 900 }] })
    expect(api.dropIndex.value).toBe(1)
    await api.onTouchEnd()
    expect(persist).toHaveBeenCalledWith(['a', 'd', 'b', 'c'])
  })

  it('a tap on the handle (no move) persists nothing', async () => {
    const { api, persist } = mountList()
    api.onTouchStart(1)
    await api.onTouchEnd()
    expect(persist).not.toHaveBeenCalled()
  })

  it('touchmove without an active drag is ignored', () => {
    const { api } = mountList()
    const spy = vi.spyOn(document, 'elementFromPoint')
    api.onTouchMove({ touches: [{ clientX: 0, clientY: 0 }] })
    expect(spy).not.toHaveBeenCalled()
    expect(api.dropIndex.value).toBeNull()
  })
})
