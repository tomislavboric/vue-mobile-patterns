<template>
  <Teleport :to="teleportTo" :disabled="!teleportTo">
    <div class="vmp-toasts" :class="`vmp-toasts--${position}`" aria-live="polite" aria-relevant="additions text">
      <TransitionGroup name="vmp-toast" tag="div" class="vmp-toasts__list">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="vmp-toast"
          :class="`vmp-toast--${toast.kind}`"
          :role="toast.kind === 'error' ? 'alert' : 'status'"
        >
          <svg class="vmp-toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-for="(d, i) in ICONS[toast.kind] || ICONS.info" :key="i" :d="d" />
          </svg>
          <span class="vmp-toast__text">{{ toast.text }}</span>
          <span v-if="toast.count > 1" class="vmp-toast__count" :aria-label="`${toast.count} times`">×{{ toast.count }}</span>
          <button type="button" class="vmp-toast__close" :aria-label="closeLabel" @click="$emit('dismiss', toast.id)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
// A minimal renderer for the toast queue (core/toastQueue.js). It holds no
// rules of its own — dedupe, cap and timers live in the queue — it only draws
// the snapshot it is given and reports dismiss clicks:
//
//   const { toasts, show, dismiss } = useToastQueue()
//   <ToastStack :toasts="toasts" @dismiss="dismiss" />
//
// Themed through CSS custom properties (--vmp-toast-*).
defineProps({
  /** snapshot from the queue: [{ id, text, kind, count }] */
  toasts: { type: Array, default: () => [] },
  /** 'bottom' (default, thumb-friendly on phones) or 'top' */
  position: { type: String, default: 'bottom', validator: (v) => ['bottom', 'top'].includes(v) },
  closeLabel: { type: String, default: 'Dismiss' },
  /** Teleport target; pass null/'' to render in place */
  teleportTo: { type: [String, Object], default: 'body' },
})

defineEmits(['dismiss'])

// Feather-style 24px stroke icons, inlined so the component has no icon dependency.
const ICONS = {
  success: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4', 'M12 8h.01'],
  warn: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', 'M12 9v4', 'M12 17h.01'],
  error: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M15 9l-6 6', 'M9 9l6 6'],
}
</script>

<style scoped>
.vmp-toasts {
  position: fixed; left: 0; right: 0; z-index: var(--vmp-toast-z, 1100);
  display: flex; justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}
.vmp-toasts--bottom { bottom: calc(var(--vmp-toast-offset, 16px) + env(safe-area-inset-bottom, 0px)); }
.vmp-toasts--top { top: calc(var(--vmp-toast-offset, 16px) + env(safe-area-inset-top, 0px)); }
.vmp-toasts__list {
  position: relative;
  display: flex; flex-direction: column; gap: 8px;
  width: 100%; max-width: var(--vmp-toast-max-width, 420px);
}
/* The newest toast always sits nearest the screen edge it docks to. */
.vmp-toasts--top .vmp-toasts__list { flex-direction: column-reverse; }

.vmp-toast {
  box-sizing: border-box;
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 10px 8px 10px 14px;
  border-radius: var(--vmp-toast-radius, 12px);
  background: var(--vmp-toast-bg, #0f172a);
  color: var(--vmp-toast-color, #f8fafc);
  box-shadow: var(--vmp-toast-shadow, 0 8px 24px rgba(15, 23, 42, 0.25));
  font-size: 14px; line-height: 1.35;
  pointer-events: auto;
}
.vmp-toast__icon { flex: none; }
.vmp-toast--success .vmp-toast__icon { color: var(--vmp-toast-success, #4ade80); }
.vmp-toast--info .vmp-toast__icon { color: var(--vmp-toast-info, #60a5fa); }
.vmp-toast--warn .vmp-toast__icon { color: var(--vmp-toast-warn, #fbbf24); }
.vmp-toast--error .vmp-toast__icon { color: var(--vmp-toast-error, #f87171); }
.vmp-toast__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.vmp-toast__count {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--vmp-toast-count-bg, rgba(248, 250, 252, 0.16));
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.vmp-toast__close {
  flex: none; display: flex;
  padding: 6px;
  background: none; border: none; border-radius: 8px; cursor: pointer;
  color: inherit; opacity: 0.7;
}
.vmp-toast__close:hover { opacity: 1; background: rgba(248, 250, 252, 0.1); }
.vmp-toast__close:focus-visible { outline: 2px solid currentColor; opacity: 1; }

.vmp-toast-enter-active, .vmp-toast-leave-active, .vmp-toast-move {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.vmp-toast-enter-from { opacity: 0; transform: translateY(12px) scale(0.98); }
.vmp-toasts--top .vmp-toast-enter-from { transform: translateY(-12px) scale(0.98); }
.vmp-toast-leave-to { opacity: 0; transform: scale(0.96); }
/* Leaving items are taken out of flow so the rest can glide into place. */
.vmp-toast-leave-active { position: absolute; left: 0; right: 0; }

@media (prefers-reduced-motion: reduce) {
  .vmp-toast-enter-active, .vmp-toast-leave-active, .vmp-toast-move { transition: none; }
}
</style>
