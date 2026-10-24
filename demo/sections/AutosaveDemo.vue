<template>
  <div class="autosave-demo">
    <div class="settings" role="group" aria-label="Notification settings">
      <label v-for="setting in SETTINGS" :key="setting.key" class="toggle">
        <span class="toggle__text">
          <span class="toggle__label">{{ setting.label }}</span>
          <span class="toggle__desc">{{ setting.desc }}</span>
        </span>
        <input
          type="checkbox"
          class="toggle__input"
          :checked="values[setting.key]"
          @change="onToggle(setting.key, $event.target.checked)"
        />
        <span class="toggle__switch" aria-hidden="true" />
      </label>
    </div>

    <div class="status">
      <span class="pill" :class="statusClass">{{ statusText }}</span>
      <button type="button" class="btn btn--ghost btn--small" :disabled="!pending" @click="writer.flushNow()">
        Save now
      </button>
    </div>

    <div class="stat-row">
      <span class="stat">toggle changes <strong>{{ changes }}</strong></span>
      <span class="stat">network writes <strong>{{ log.length }}</strong></span>
    </div>

    <div class="log">
      <p class="log__title">Write log</p>
      <p v-if="!log.length" class="hint">Flip a few toggles quickly. Writes appear here after {{ DEBOUNCE }} ms of quiet.</p>
      <ol v-else class="log__list">
        <li v-for="entry in log" :key="entry.n" class="log__entry">
          <span class="log__n">#{{ entry.n }}</span>
          <span class="log__body">
            <code>{{ entry.patch }}</code>
            <span class="log__meta">{{ entry.merged }} change{{ entry.merged === 1 ? '' : 's' }} merged · {{ entry.reason }}</span>
          </span>
        </li>
      </ol>
    </div>
    <p class="hint">
      Debounce {{ DEBOUNCE }} ms, hard cap {{ MAX_WAIT }} ms — keep toggling and a write still goes out every
      {{ MAX_WAIT / 1000 }} s. Hiding the tab flushes immediately.
    </p>
  </div>
</template>

<script setup>
import { computed, onScopeDispose, reactive, ref } from 'vue'
import { createCoalescedWriter } from 'vue-mobile-patterns'

const props = defineProps({
  toast: { type: Object, required: true },
})

const DEBOUNCE = 800
const MAX_WAIT = 3000

const SETTINGS = [
  { key: 'push', label: 'Push notifications', desc: 'Alerts on this device' },
  { key: 'email', label: 'Email digest', desc: 'A daily summary' },
  { key: 'mentions', label: 'Mentions only', desc: 'Skip everything else' },
  { key: 'sounds', label: 'Sounds', desc: 'Play a sound on arrival' },
  { key: 'weekly', label: 'Weekly report', desc: 'Every Monday morning' },
]

const values = reactive({ push: true, email: false, mentions: false, sounds: true, weekly: false })
const changes = ref(0)
const log = ref([])
const pending = ref(false)
const saving = ref(false)

let changesInBatch = 0
let batchOpenedAt = 0
let lastWriteAt = 0

const writer = createCoalescedWriter({
  debounceMs: DEBOUNCE,
  maxWaitMs: MAX_WAIT,
  // Stands in for the network call: one request per merged patch.
  async flush(patch) {
    const now = Date.now()
    const reason = now - batchOpenedAt >= MAX_WAIT - 20 ? 'max-wait cap'
      : now - lastWriteAt < DEBOUNCE - 20 ? 'flushed early' : `after ${DEBOUNCE} ms quiet`
    const merged = changesInBatch
    changesInBatch = 0
    pending.value = false
    saving.value = true
    await new Promise(resolve => setTimeout(resolve, 350))
    saving.value = false
    log.value = [{ n: log.value.length + 1, patch: JSON.stringify(patch).replace(/,/g, ', ').replace(/":/g, '": '), merged, reason }, ...log.value].slice(0, 6)
    // One toast per real write, not per tap.
    props.toast.show('Settings saved', 'success', { key: 'autosave' })
    return true
  },
})

function onToggle(key, checked) {
  values[key] = checked
  changes.value += 1
  if (!pending.value) batchOpenedAt = Date.now()
  lastWriteAt = Date.now()
  changesInBatch += 1
  pending.value = true
  writer.write({ [key]: checked })
}

const statusText = computed(() => {
  if (saving.value) return 'Saving…'
  if (pending.value) return 'Unsaved changes'
  return log.value.length ? 'All changes saved' : 'Up to date'
})
const statusClass = computed(() => (saving.value ? 'pill--busy' : pending.value ? 'pill--warn' : 'pill--ok'))

onScopeDispose(() => writer.dispose())
</script>

<style scoped>
.autosave-demo { display: grid; gap: 14px; }

.settings {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}
.toggle {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  min-height: 60px;
  padding: 10px 14px;
  cursor: pointer;
}
.toggle + .toggle { border-top: 1px solid var(--border); }
.toggle__text { flex: 1; display: grid; }
.toggle__label { font-size: 14.5px; font-weight: 600; }
.toggle__desc { color: var(--text-3); font-size: 13px; }
.toggle__input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.toggle__switch {
  flex: none;
  position: relative;
  width: 44px; height: 26px;
  border-radius: 999px;
  background: var(--border);
  transition: background 0.2s;
}
.toggle__switch::after {
  content: "";
  position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.toggle__input:checked + .toggle__switch { background: var(--accent); }
.toggle__input:checked + .toggle__switch::after { transform: translateX(18px); }
.toggle__input:focus-visible + .toggle__switch { outline: 2px solid var(--accent); outline-offset: 2px; }

.status { display: flex; align-items: center; gap: 10px; }
.btn--small { min-height: 32px; padding: 4px 10px; font-size: 13px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }

.log {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--code-bg);
  color: var(--code-text);
}
.log__title {
  margin-bottom: 6px;
  color: #94a3b8;
  font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
}
.log .hint { color: #94a3b8; }
.log__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.log__entry { display: flex; gap: 10px; font-size: 13px; }
.log__n { flex: none; color: #a5b4fc; font-family: var(--mono); }
.log__body { display: grid; min-width: 0; }
.log__body code { overflow-wrap: break-word; font-size: 12.5px; }
.log__meta { color: #94a3b8; font-size: 12px; }

@media (prefers-reduced-motion: reduce) {
  .toggle__switch, .toggle__switch::after { transition: none; }
}
</style>
