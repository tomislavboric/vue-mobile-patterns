<template>
  <Teleport :to="teleportTo" :disabled="!teleportTo">
    <Transition name="vmp-sheet">
      <div v-if="open" class="vmp-sheet-overlay" @click.self="requestClose">
        <div
          ref="panelEl"
          class="vmp-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="title || undefined"
          tabindex="-1"
          :style="dragStyle"
        >
          <div class="vmp-sheet__grip-zone" aria-hidden="true" v-on="gripHandlers">
            <div class="vmp-sheet__grip" />
          </div>
          <div class="vmp-sheet__head">
            <h2 class="vmp-sheet__title"><slot name="title">{{ title }}</slot></h2>
            <button type="button" class="vmp-sheet__close" :aria-label="closeLabel" @click="close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="vmp-sheet__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
// A bottom sheet: overlay, rounded panel, grip, title row, slide-up transition
// and swipe-to-dismiss from anywhere on the panel (see useSheetDrag). The grip
// stays as the visual affordance and as the mouse drag handle.
//
// Slot content keeps the PARENT's scoped styles, so callers style their own
// rows; the shell itself is themed through CSS custom properties (--vmp-sheet-*).
import { nextTick, onUnmounted, watch } from 'vue'
import { useSheetDrag } from '../composables/useSheetDrag.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  closeLabel: { type: String, default: 'Close' },
  /** px of downward travel that dismisses the sheet */
  threshold: { type: Number, default: 70 },
  /**
   * Return false to keep the sheet open on swipe, overlay click and Escape
   * (e.g. a form with unsaved changes). The close button always closes.
   */
  canClose: { type: Function, default: null },
  /** Teleport target; pass null/'' to render in place */
  teleportTo: { type: [String, Object], default: 'body' },
})

const emit = defineEmits(['close', 'update:open'])

function close() {
  emit('update:open', false)
  emit('close')
}

function allowed() {
  return props.canClose ? props.canClose() !== false : true
}

function requestClose() {
  if (allowed()) close()
}

const { panelEl, dragStyle, gripHandlers } = useSheetDrag(() => props.open, close, {
  threshold: props.threshold,
  canClose: () => allowed(),
})

// Escape closes; focus moves into the sheet on open and back to whatever had it
// on close, so keyboard and screen-reader users land in (and return from) the
// dialog.
let returnFocusTo = null
function onKeydown(e) {
  if (e.key === 'Escape') requestClose()
}

watch(() => props.open, (isOpen) => {
  if (typeof document === 'undefined') return
  if (isOpen) {
    returnFocusTo = document.activeElement
    document.addEventListener('keydown', onKeydown)
    nextTick(() => panelEl.value?.focus?.({ preventScroll: true }))
  } else {
    document.removeEventListener('keydown', onKeydown)
    if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus({ preventScroll: true })
    returnFocusTo = null
  }
}, { immediate: true })

onUnmounted(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.vmp-sheet-overlay {
  position: fixed; inset: 0; z-index: var(--vmp-sheet-z, 1000);
  display: flex; align-items: flex-end; justify-content: center;
  background: var(--vmp-sheet-backdrop, rgba(15, 23, 42, 0.45));
}
.vmp-sheet {
  box-sizing: border-box;
  width: 100%; max-width: var(--vmp-sheet-max-width, 520px);
  max-height: var(--vmp-sheet-max-height, 80dvh);
  display: flex; flex-direction: column;
  background: var(--vmp-sheet-bg, #ffffff);
  color: var(--vmp-sheet-color, #0f172a);
  border: 1px solid var(--vmp-sheet-border, rgba(15, 23, 42, 0.08));
  border-bottom: none;
  border-radius: var(--vmp-sheet-radius, 20px) var(--vmp-sheet-radius, 20px) 0 0;
  box-shadow: var(--vmp-sheet-shadow, 0 -8px 40px rgba(15, 23, 42, 0.22));
  padding: 8px 12px calc(16px + env(safe-area-inset-bottom, 0px));
  outline: none;
}
.vmp-sheet__grip-zone {
  padding: 6px 0 10px;
  margin: 0 -12px; /* full sheet width for an easy grab target */
  flex: none;
  touch-action: none;
  cursor: grab;
}
.vmp-sheet__grip-zone:active { cursor: grabbing; }
.vmp-sheet__grip {
  width: 40px; height: 4px; margin: 0 auto;
  border-radius: 999px;
  background: var(--vmp-sheet-grip, rgba(15, 23, 42, 0.18));
}
.vmp-sheet__head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 0 8px 8px;
  flex: none;
}
.vmp-sheet__title {
  margin: 0;
  font-size: 16px; font-weight: 700; letter-spacing: -0.01em;
}
.vmp-sheet__close {
  display: flex;
  padding: 8px; margin: -8px -4px -8px 0;
  background: none; border: none; border-radius: 10px; cursor: pointer;
  color: var(--vmp-sheet-muted, #64748b);
  transition: background 0.15s;
}
.vmp-sheet__close:hover { background: var(--vmp-sheet-hover, rgba(15, 23, 42, 0.06)); }
.vmp-sheet__close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
/* The one scrolling box. The drag reads its scrollTop to decide whether a
   downward swipe scrolls the content or dismisses the sheet, so the scroll
   must live on a single, identifiable element — not on the panel itself. */
.vmp-sheet__body {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.vmp-sheet-enter-active, .vmp-sheet-leave-active { transition: opacity 0.25s ease; }
.vmp-sheet-enter-active .vmp-sheet, .vmp-sheet-leave-active .vmp-sheet {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.vmp-sheet-enter-from, .vmp-sheet-leave-to { opacity: 0; }
.vmp-sheet-enter-from .vmp-sheet, .vmp-sheet-leave-to .vmp-sheet { transform: translateY(100%); }

@media (prefers-reduced-motion: reduce) {
  .vmp-sheet-enter-active, .vmp-sheet-leave-active,
  .vmp-sheet-enter-active .vmp-sheet, .vmp-sheet-leave-active .vmp-sheet { transition: none; }
}
</style>
