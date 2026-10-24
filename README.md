# vue-mobile-patterns

Small, tested Vue 3 building blocks for the interactions that go wrong first on a phone: a bottom sheet you can swipe away from anywhere, drag-to-reorder that works with a finger, a toast stack that won't flood the screen, and an autosave writer that turns a burst of taps into one request.

**[Live demo →](https://tomislavboric.github.io/vue-mobile-patterns/)** (open it on a phone, or use your browser's device mode)

| Pattern | What you import | Depends on Vue? |
| --- | --- | --- |
| [Swipe-to-dismiss bottom sheet](#1-bottom-sheet-with-swipe-to-dismiss-from-anywhere) | `BottomSheet`, `useSheetDrag` | yes |
| [Drag-to-reorder (mouse + touch)](#2-drag-to-reorder-for-mouse-and-touch) | `useDragReorder` | yes |
| [Toast stack with dedupe + cap](#3-a-toast-stack-that-refuses-bursts) | `createToastQueue`, `useToastQueue`, `ToastStack` | the core doesn't |
| [Coalesced autosave writer](#4-coalesced-autosave-writer) | `createCoalescedWriter` | no |

## Install

The package isn't on npm. Install it straight from GitHub:

```sh
npm install github:tomislavboric/vue-mobile-patterns
```

The package ships source: plain ES modules plus `.vue` single-file components. You need a bundler that compiles SFCs, such as Vite with `@vitejs/plugin-vue`. Its only peer dependency is `vue@^3.5`. The two framework-free modules can also be imported on their own:

```js
import { createToastQueue } from 'vue-mobile-patterns/core/toastQueue'
import { createCoalescedWriter } from 'vue-mobile-patterns/core/coalescedWriter'
```

---

## 1. Bottom sheet with swipe-to-dismiss from anywhere

**The problem.** Most sheets put the drag only on the grip, so a thumb has one 40×4 px target at the top edge and the rest of the panel ignores the gesture. If you make the whole panel draggable without any rules, it fights the content: scrolling a list closes the sheet, and swiping a horizontal row of chips moves the panel.

`useSheetDrag` lets a downward swipe start anywhere on the panel. When the gesture begins, it decides who should get it:

- if the first movement is horizontal or upward, the gesture goes to the content (scrolling, sliders, carousels)
- if the movement is downward but the scroll container under the finger isn't at its top, the list scrolls as usual
- if the movement is downward and the content is already at its top, the panel follows the finger 1:1 and calls `preventDefault()` on the scroll

Once the drag passes the threshold, the sheet closes. It leaves through its own leave transition, starting from where the finger let go, so you don't see a jump. A shorter drag springs back. If the finger actually moved during the drag, the click that follows is swallowed, so letting go over a row doesn't activate that row.

Implementation details:
- Touch uses non-passive native `touchmove` listeners, because only those can cancel a scroll in the same frame the browser decides on it.
- The offset is written to the CSS `translate` property rather than `transform`, so it combines with the enter/leave transition instead of overriding it.
- With a mouse, you drag the grip.

```vue
<script setup>
import { ref } from 'vue'
import { BottomSheet } from 'vue-mobile-patterns'

const open = ref(false)
</script>

<template>
  <button @click="open = true">Show activity</button>

  <BottomSheet v-model:open="open" title="Activity">
    <ActivityList />
  </BottomSheet>
</template>
```

### `<BottomSheet>` props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | `false` | Visibility. Supports `v-model:open`. |
| `title` | `string` | `''` | Heading text and the dialog's accessible name. A `#title` slot is also available. |
| `closeLabel` | `string` | `'Close'` | `aria-label` for the close button. Set it to translate the button's label. |
| `threshold` | `number` | `70` | Pixels of downward travel needed to dismiss. |
| `canClose` | `() => boolean` | `null` | Return `false` to keep the sheet open when the user swipes, clicks the backdrop or presses Escape (for example, a form with unsaved changes). The close button always closes. |
| `teleportTo` | `string \| Element \| null` | `'body'` | Where the sheet is teleported. Pass `null` to render it in place. |

The sheet emits `close` and `update:open`. Escape closes it. Focus moves into the sheet when it opens and goes back to the element that had it when the sheet closes.

### Theming

The shell uses CSS custom properties, and each one has a default:

```css
:root {
  --vmp-sheet-bg: #ffffff;
  --vmp-sheet-color: #0f172a;
  --vmp-sheet-border: rgba(15, 23, 42, 0.08);
  --vmp-sheet-radius: 20px;
  --vmp-sheet-shadow: 0 -8px 40px rgba(15, 23, 42, 0.22);
  --vmp-sheet-max-width: 520px;
  --vmp-sheet-max-height: 80dvh;
  --vmp-sheet-backdrop: rgba(15, 23, 42, 0.45);
  --vmp-sheet-grip: rgba(15, 23, 42, 0.18);
  --vmp-sheet-muted: #64748b;   /* close icon */
  --vmp-sheet-hover: rgba(15, 23, 42, 0.06);
  --vmp-sheet-z: 1000;
}
```

Slot content keeps your own scoped styles. The sheet body is the single element that scrolls, and the gesture reads its `scrollTop`.

### Using the composable directly

You can add the same gesture to your own drawer or panel:

```js
const { panelEl, dragStyle, gripHandlers, dragging } = useSheetDrag(
  () => props.open,        // reactive open state
  () => emit('close'),     // called once the threshold is passed
  {
    threshold: 70,
    enabled: () => isMobile.value,   // e.g. a drawer that is a sheet only on phones
    canClose: () => !form.dirty,     // refuse the swipe while a form is dirty
  },
)
```

```html
<div ref="panelEl" :style="dragStyle">
  <div class="grip" v-on="gripHandlers" />
  …
</div>
```

---

## 2. Drag-to-reorder for mouse and touch

**The problem.** HTML5 drag and drop does nothing on touch screens, so a reorderable list built on `draggable` can't be used on a phone. Touch events have a different problem: `touchmove` keeps firing on the element where the finger went down, even after the finger moves off it. Because of that, the event target can't tell you which row the finger is over.

`useDragReorder` uses native HTML5 drag for a mouse. For touch, it hit-tests the finger's position against rows tagged with `data-drag-index`. When the row is dropped, it calls your `persist` function with the complete list of ids in the new order. Your code decides what saving that order means: an API call, an optimistic update, or a local sort.

```vue
<script setup>
import { ref } from 'vue'
import { useDragReorder } from 'vue-mobile-patterns'

const tasks = ref([{ id: 'a', label: 'Write tests' }, { id: 'b', label: 'Ship it' }])

const {
  dragIndex, dropIndex,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onTouchStart, onTouchMove, onTouchEnd,
  move,
} = useDragReorder({
  items: tasks,                                   // array, ref or getter; rows need `.id`
  persist: async (orderedIds) => {
    const byId = new Map(tasks.value.map(t => [t.id, t]))
    tasks.value = orderedIds.map(id => byId.get(id))   // optimistic
    await api.saveOrder(orderedIds)
  },
})
</script>

<template>
  <ol>
    <li
      v-for="(task, index) in tasks"
      :key="task.id"
      :data-drag-index="index"
      :class="{ dragging: dragIndex === index, target: dropIndex === index && dragIndex !== index }"
      @dragover.prevent="onDragOver(index)"
      @drop.prevent="onDrop"
      @dragend="onDragEnd"
    >
      <button
        class="handle"
        draggable="true"
        aria-label="Move"
        @dragstart="onDragStart(index, $event)"
        @touchstart.prevent="onTouchStart(index)"
        @touchmove.prevent="onTouchMove($event)"
        @touchend="onTouchEnd"
        @keydown.up.prevent="move(index, index - 1)"
        @keydown.down.prevent="move(index, index + 1)"
      >⠿</button>
      {{ task.label }}
    </li>
  </ol>
</template>

<style>
.handle { touch-action: none; } /* the finger drags the row, not the page */
</style>
```

| Option / return | |
| --- | --- |
| `items` | The current ordered list, as an array, ref or getter. It's read when the row is dropped, not when you call the composable. |
| `persist(orderedIds)` | Can be async. Called with every id in the new order. It isn't called when a row is dropped back in its original spot. |
| `dragIndex`, `dropIndex` | Refs you can use for highlight classes. |
| `move(from, to)` | Reorders without dragging, for keyboard users or up/down buttons. A move that's out of range or doesn't change the order does nothing. |

---

## 3. A toast stack that refuses bursts

**The problem.** If every `show()` call adds a toast with its own timer, nothing stops the duplicates. When one failure is reported from two layers, a background sync fails on each retry, or a loop runs over N items, the same line ends up stacked N times on a small screen. This queue applies the limits itself, so individual call sites don't have to:

- **Dedupe.** When a toast with the same kind and text is already on screen, the queue doesn't add another one. It increases a ×N counter and restarts the timer.
- **Key.** `show(text, kind, { key })` replaces the visible toast that has the same key, and the most recent one wins. Use this for an ongoing state whose text changes, such as "Offline" → "Back online".
- **Cap.** At most `maxVisible` toasts are shown at once. When the cap is reached, the oldest non-error toast is removed first, so a success can never push a failure off the screen.
- **Durations.** Warnings and errors stay on screen longer (5 s) than confirmations (3.5 s), because they may contain a sentence the user needs to act on.

The rules live in `createToastQueue`, which is plain JavaScript with injectable timers. `useToastQueue` exposes it as Vue state, and `ToastStack` renders it.

```vue
<script setup>
import { ToastStack, useToastQueue } from 'vue-mobile-patterns'

// Create one queue for the whole app (e.g. in App.vue or a store) and share it.
const { toasts, show, dismiss } = useToastQueue({ maxVisible: 3 })

show('Saved')                                     // kind defaults to 'success'
show('Server unreachable', 'error')               // repeats become "×2", "×3"…
show('You are offline', 'warn', { key: 'net' })   // later show(…, { key: 'net' }) replaces it
show('Copied', 'info', 1500)                      // a bare number is the duration in ms
</script>

<template>
  <ToastStack :toasts="toasts" @dismiss="dismiss" />
</template>
```

### `createToastQueue(options)`

| Option | Default | |
| --- | --- | --- |
| `maxVisible` | `3` | Maximum number of toasts on screen at once. |
| `defaultDuration` | `3500` | Duration in ms for `success` and `info`. |
| `problemDuration` | `5000` | Duration in ms for `warn` and `error`. |
| `onChange(items)` | — | Called with a new snapshot after every change. |
| `setTimer` / `clearTimer` | `setTimeout` / `clearTimeout` | Inject your own timers for tests or other runtimes. |

The queue returns `{ show(text, kind?, opts?) → id, dismiss(id), clear(), items }`. The kinds are `success`, `info`, `warn` and `error`. An unknown kind is shown as `info`.

### `<ToastStack>` props

| Prop | Default | |
| --- | --- | --- |
| `toasts` | `[]` | The snapshot to render. |
| `position` | `'bottom'` | `'bottom'` or `'top'`. The newest toast is closest to that edge. |
| `closeLabel` | `'Dismiss'` | `aria-label` for each close button. |
| `teleportTo` | `'body'` | `null` renders the stack in place. |

The stack is an `aria-live="polite"` region. Errors use `role="alert"`, and all other toasts use `role="status"`. You can theme it with `--vmp-toast-bg`, `--vmp-toast-color`, `--vmp-toast-radius`, `--vmp-toast-shadow`, `--vmp-toast-max-width`, `--vmp-toast-offset`, `--vmp-toast-z`, `--vmp-toast-count-bg` and `--vmp-toast-{success,info,warn,error}` (the icon colours).

---

## 4. Coalesced autosave writer

**The problem.** If a settings toggle saves on every `@change`, five quick taps send five full network writes back to back. A plain debounce reduces that to one write, but it creates two new problems. It can delay saving indefinitely while the user keeps editing. And it loses the last change if the user hides the tab before the timer fires.

`createCoalescedWriter` merges a burst of `write(patch)` calls into **one** `flush(mergedPatch)` call after `debounceMs` without new writes. It also has a `maxWaitMs` cap, so a batch never waits longer than that.

- Every `write()` returns a promise that settles with the result of the batch it ended up in. All callers in that batch get **the same** result, so a per-call "Saved" message is accurate: it only appears once the batch has actually been saved.
- Flushes run one at a time. A batch that opens while a flush is in progress waits for that flush to finish, so writes reach the backend in order and never race each other.
- When the tab is hidden (`visibilitychange`) or the page unloads (`pagehide`), the pending batch is flushed immediately. The listeners are attached lazily, so the module is safe to use with SSR and Node.

```js
import { createCoalescedWriter } from 'vue-mobile-patterns'

const writer = createCoalescedWriter({
  debounceMs: 1000,
  maxWaitMs: 4000,
  flush: async (patch) => {
    const res = await fetch('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) })
    return res.ok
  },
})

async function onToggle(key, value) {
  const ok = await writer.write({ [key]: value })   // later keys win inside a batch
  if (!ok) showError()
}
```

| Option | Default | |
| --- | --- | --- |
| `flush(patch)` | required | Saves one merged patch. Whatever it returns or throws is passed to every waiting caller. |
| `debounceMs` | `1000` | How long writes must stop before the batch is flushed. |
| `maxWaitMs` | `4000` | Maximum time a batch can stay open. |
| `flushOnHide` | `true` | Flush when the page is hidden or unloaded. |

| Method | |
| --- | --- |
| `write(patch)` | Adds `patch` to the pending batch. Returns a promise for the batch result. |
| `flushNow()` | Flushes the pending batch immediately (for example, from an explicit "Save" button). The returned promise resolves once every flush so far has finished, and it never rejects. |
| `abandon(result)` | Discards the pending batch without flushing and settles its callers with `result`. Use it when the batch's target no longer exists, such as after sign-out or an account switch. |
| `hasPending()` | Returns `true` if a batch is open. |
| `dispose()` | Flushes what's pending and removes the page lifecycle listeners. Call it when the owner of the writer is torn down. |

---

## Development

```sh
npm install
npm test            # vitest: logic in Node, components in happy-dom
npm run demo        # dev server for the demo page
npm run demo:build  # static build into demo-dist/
```

Requires Node 22.

Origin: extracted from Camppy, a camp operations PWA, where they run in production.

## License

[MIT](LICENSE) © 2026 Tomislav Borić
