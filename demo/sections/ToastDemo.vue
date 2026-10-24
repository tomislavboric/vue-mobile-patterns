<template>
  <div class="toast-demo">
    <div class="grid">
      <button type="button" class="btn" @click="fire(() => toast.show('Changes saved', 'success'))">
        Save
      </button>
      <button type="button" class="btn" @click="fireBurst">
        Same error ×5
      </button>
      <button type="button" class="btn" @click="fireDifferent">
        6 at once
      </button>
      <button type="button" class="btn" @click="toggleConnection">
        {{ online ? 'Go offline' : 'Back online' }}
      </button>
    </div>

    <div class="stat-row">
      <span class="stat">show() calls <strong>{{ calls }}</strong></span>
      <span class="stat">on screen <strong>{{ toast.toasts.value.length }}</strong> / 3</span>
      <button type="button" class="btn btn--ghost btn--small" @click="toast.clear()">Clear</button>
    </div>

    <ul class="rules">
      <li><strong>Dedupe</strong> — the same kind + text bumps a ×N counter and restarts its timer.</li>
      <li><strong>Key</strong> — “offline / online” share a key, so the second replaces the first in place.</li>
      <li><strong>Cap</strong> — at most 3 visible; the oldest success leaves first, errors stay.</li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  // The page-wide queue from useToastQueue()
  toast: { type: Object, required: true },
})

const calls = ref(0)
const online = ref(true)

function fire(fn) {
  calls.value += 1
  fn()
}

// What a retry loop or two layers reporting the same failure look like.
function fireBurst() {
  for (let i = 0; i < 5; i++) fire(() => props.toast.show('Server unreachable — retrying', 'error'))
}

function fireDifferent() {
  const messages = [
    ['Photo uploaded', 'success'],
    ['Draft restored', 'info'],
    ['Payment failed', 'error'],
    ['Profile updated', 'success'],
    ['2 new comments', 'info'],
    ['Link copied', 'success'],
  ]
  for (const [text, kind] of messages) fire(() => props.toast.show(text, kind))
}

function toggleConnection() {
  online.value = !online.value
  fire(() => online.value
    ? props.toast.show('Back online', 'success', { key: 'network' })
    : props.toast.show('You are offline — changes will sync later', 'warn', { key: 'network' }))
}
</script>

<style scoped>
.toast-demo { display: grid; gap: 14px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.btn--small { min-height: 32px; padding: 4px 10px; font-size: 13px; }
.rules {
  margin: 0; padding: 0 0 0 18px;
  color: var(--text-2); font-size: 13.5px;
  display: grid; gap: 4px;
}
.rules strong { color: var(--text); }

@media (min-width: 560px) {
  .grid { grid-template-columns: repeat(4, auto); justify-content: start; }
}
</style>
