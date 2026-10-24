<template>
  <div class="reorder-demo">
    <ol class="list" aria-label="Release checklist">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="row"
        :class="{
          'row--dragging': dragIndex === index,
          'row--target': dropIndex === index && dragIndex !== index,
          'row--below': dropIndex === index && dragIndex !== null && dragIndex < index,
        }"
        :data-drag-index="index"
        @dragover.prevent="onDragOver(index)"
        @drop.prevent="onDrop"
        @dragend="onDragEnd"
      >
        <button
          type="button"
          class="row__handle"
          draggable="true"
          :aria-label="`Move “${item.label}”. Use arrow up and down keys.`"
          @dragstart="onDragStart(index, $event)"
          @touchstart.prevent="onTouchStart(index)"
          @touchmove.prevent="onTouchMove($event)"
          @touchend="onTouchEnd"
          @keydown.up.prevent="moveWithKeys(index, -1)"
          @keydown.down.prevent="moveWithKeys(index, 1)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>
        <span class="row__pos">{{ index + 1 }}</span>
        <span class="row__label">{{ item.label }}</span>
      </li>
    </ol>

    <div class="status">
      <span class="pill" :class="saving ? 'pill--busy' : 'pill--ok'">{{ saving ? 'Saving…' : 'Order saved' }}</span>
      <span class="hint">persist() called {{ persistCalls }}×</span>
    </div>
    <p class="hint">
      Drag a row by its handle — mouse or finger. Keyboard: focus a handle and press ↑ / ↓.
      Saving is simulated with 400&nbsp;ms latency.
    </p>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { useDragReorder } from 'vue-mobile-patterns'

const emit = defineEmits(['saved'])

const items = ref([
  { id: 'tests', label: 'Run the test suite' },
  { id: 'changelog', label: 'Update the changelog' },
  { id: 'version', label: 'Bump the version' },
  { id: 'tag', label: 'Tag the release' },
  { id: 'deploy', label: 'Deploy to production' },
  { id: 'announce', label: 'Announce the release' },
])

const saving = ref(false)
const persistCalls = ref(0)

// Optimistic: the new order is shown immediately, then "saved".
async function persist(orderedIds) {
  const byId = new Map(items.value.map(item => [item.id, item]))
  items.value = orderedIds.map(id => byId.get(id))
  persistCalls.value += 1
  saving.value = true
  await new Promise(resolve => setTimeout(resolve, 400))
  saving.value = false
  emit('saved', orderedIds)
}

const {
  dragIndex, dropIndex,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onTouchStart, onTouchMove, onTouchEnd,
  move,
} = useDragReorder({ items, persist })

async function moveWithKeys(index, delta) {
  const to = index + delta
  if (to < 0 || to >= items.value.length) return
  const pending = move(index, to)
  // Keep focus on the handle of the row that moved.
  await nextTick()
  document.querySelectorAll('.row__handle')[to]?.focus()
  await pending
}
</script>

<style scoped>
.reorder-demo { display: grid; gap: 12px; }

.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }

.row {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  min-height: 52px;
  padding: 6px 14px 6px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  transition: opacity 0.15s, border-color 0.15s;
  user-select: none;
  -webkit-user-select: none;
}
.row--dragging { opacity: 0.45; }
.row--target { border-color: var(--accent); }
/* Drop indicator: a bar on the edge the dragged row will land next to. */
.row--target::before {
  content: "";
  position: absolute; left: 10px; right: 10px; top: -5px;
  height: 3px; border-radius: 3px;
  background: var(--accent);
}
.row--below::before { top: auto; bottom: -5px; }

.row__handle {
  flex: none;
  display: grid; place-items: center;
  width: 40px; height: 40px;
  border: none; border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  cursor: grab;
  touch-action: none; /* the finger drags the row, not the page */
}
.row__handle:hover { background: var(--surface-2); color: var(--text-2); }
.row__handle:active { cursor: grabbing; }
.row__pos {
  flex: none; width: 18px;
  color: var(--text-3);
  font-family: var(--mono); font-size: 12.5px;
  text-align: right;
}
.row__label { font-size: 14.5px; font-weight: 500; }

.status { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
</style>
