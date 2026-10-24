<template>
  <div class="page">
    <header class="hero">
      <p class="hero__eyebrow">Vue 3 · open source · MIT</p>
      <h1 class="hero__title">vue-mobile-patterns</h1>
      <p class="hero__lead">
        Four small interaction patterns that make a Vue app feel right on a phone —
        each one solving a problem that shows up the moment real people use it.
      </p>
      <div class="hero__actions">
        <a class="btn btn--primary" href="https://github.com/tomislavboric/vue-mobile-patterns">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
          View on GitHub
        </a>
        <a class="btn" href="#sheet">Try the demos</a>
      </div>
      <p class="hero__tip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
        Best on a phone, or in your browser's device mode — the gestures are touch gestures.
      </p>
    </header>

    <main class="sections">
      <DemoSection id="sheet" index="01" title="Bottom sheet that swipes away from anywhere">
        <template #problem>
          A grip-only drag gives the thumb a 40×4&nbsp;px target. Here a downward swipe works anywhere on the
          panel — and still lets scrollable content scroll, horizontal rows pan, and taps stay taps.
        </template>
        <SheetDemo />
        <template #code>{{ snippets.sheet }}</template>
      </DemoSection>

      <DemoSection id="reorder" index="02" title="Drag-to-reorder for mouse and touch">
        <template #problem>
          HTML5 drag &amp; drop never fires on touch screens. This composable uses native drag on desktop and
          hit-tests the finger against rows on touch, then hands you the new id order to persist.
        </template>
        <ReorderDemo @saved="onOrderSaved" />
        <template #code>{{ snippets.reorder }}</template>
      </DemoSection>

      <DemoSection id="toasts" index="03" title="A toast stack that refuses bursts">
        <template #problem>
          One failure reported from two layers, or a retry loop, stacks the same message five times on a small
          screen. The queue dedupes into a ×N counter, replaces keyed states in place, and caps the stack —
          evicting successes before errors.
        </template>
        <ToastDemo :toast="toast" />
        <template #code>{{ snippets.toasts }}</template>
      </DemoSection>

      <DemoSection id="autosave" index="04" title="Autosave: five taps, one write">
        <template #problem>
          Toggles that save on every change turn a few quick taps into a burst of network writes. The
          coalescer merges them into one write after a quiet period, with a hard cap so continuous editing still
          saves — and flushes when the tab is hidden.
        </template>
        <AutosaveDemo :toast="toast" />
        <template #code>{{ snippets.autosave }}</template>
      </DemoSection>
    </main>

    <footer class="footer">
      <p>
        Built by Tomislav Borić · MIT licensed ·
        <a href="https://github.com/tomislavboric/vue-mobile-patterns">Source &amp; docs</a>
      </p>
    </footer>

    <ToastStack :toasts="toast.toasts.value" @dismiss="toast.dismiss" />
  </div>
</template>

<script setup>
import { ToastStack, useToastQueue } from 'vue-mobile-patterns'
import DemoSection from './sections/DemoSection.vue'
import SheetDemo from './sections/SheetDemo.vue'
import ReorderDemo from './sections/ReorderDemo.vue'
import ToastDemo from './sections/ToastDemo.vue'
import AutosaveDemo from './sections/AutosaveDemo.vue'

// One queue for the whole page — that is what makes dedupe and the cap work
// across unrelated features.
const toast = useToastQueue()

function onOrderSaved() {
  toast.show('Order saved', 'success', { key: 'reorder' })
}

const snippets = {
  sheet: `<BottomSheet v-model:open="open" title="Activity">
  <ActivityList />
</BottomSheet>`,
  reorder: `const { dragIndex, dropIndex, onDragStart, onDragOver,
  onDrop, onDragEnd, onTouchStart, onTouchMove, onTouchEnd
} = useDragReorder({
  items: () => tasks.value,
  persist: (ids) => api.saveOrder(ids),
})`,
  toasts: `const { toasts, show, dismiss } = useToastQueue({ maxVisible: 3 })

show('Saved')                                // success
show('Server unreachable', 'error')          // ×N on repeat
show('Offline', 'warn', { key: 'network' })  // replaced in place

<ToastStack :toasts="toasts" @dismiss="dismiss" />`,
  autosave: `const writer = createCoalescedWriter({
  debounceMs: 800,
  maxWaitMs: 3000,
  flush: (patch) => api.updateSettings(patch),
})

// on every toggle:
await writer.write({ [key]: value })  // resolves with the batch result`,
}
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 16px calc(48px + env(safe-area-inset-bottom, 0px));
}

.hero { padding: 48px 0 32px; }
.hero__eyebrow {
  color: var(--accent);
  font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.hero__title {
  margin-top: 8px;
  font-family: var(--mono);
  font-size: clamp(28px, 7vw, 40px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.hero__lead {
  margin-top: 14px;
  max-width: 56ch;
  color: var(--text-2);
  font-size: 17px;
}
.hero__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.hero__actions .btn { text-decoration: none; }
.hero__tip {
  display: flex; align-items: center; gap: 8px;
  margin-top: 20px;
  color: var(--text-3); font-size: 13.5px;
}

.sections { display: grid; gap: 20px; }

.footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: 13.5px;
}

@media (min-width: 720px) {
  .hero { padding: 72px 0 40px; }
}
</style>
