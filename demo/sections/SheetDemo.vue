<template>
  <div class="sheet-demo">
    <div class="btn-row">
      <button type="button" class="btn btn--primary" @click="open = true">Open sheet</button>
      <button type="button" class="btn" @click="openForm">Open with a form</button>
    </div>
    <p class="hint">
      Swipe down anywhere on the panel. Scroll the list first — a swipe only dismisses once the list is back at
      its top. Swiping the chips sideways never closes it. With a mouse, drag the grip.
    </p>
    <p v-if="lastClosed" class="hint" aria-live="polite">Last closed: {{ lastClosed }}</p>

    <BottomSheet v-model:open="open" title="Activity" @close="lastClosed = 'activity sheet'">
      <div class="chips" aria-label="Filter">
        <button v-for="chip in chips" :key="chip" type="button" class="chip" :class="{ 'chip--on': chip === activeChip }"
          @click="activeChip = chip">{{ chip }}</button>
      </div>
      <ul class="feed">
        <li v-for="item in feed" :key="item.id" class="feed__item">
          <span class="feed__avatar" :style="{ background: item.color }">{{ item.initials }}</span>
          <span class="feed__text">
            <strong>{{ item.who }}</strong> {{ item.what }}
            <span class="feed__time">{{ item.when }}</span>
          </span>
        </li>
      </ul>
    </BottomSheet>

    <BottomSheet v-model:open="formOpen" title="Edit note" :can-close="() => !dirty" @close="lastClosed = 'note sheet'">
      <div class="form">
        <label class="form__label" for="demo-note">Note</label>
        <textarea id="demo-note" v-model="note" class="form__input" rows="4" />
        <p class="hint">
          <template v-if="dirty">Unsaved changes — swipe, backdrop and Escape are blocked until you save or discard.</template>
          <template v-else>Type something, then try to swipe the sheet away.</template>
        </p>
        <div class="btn-row">
          <button type="button" class="btn btn--primary" :disabled="!dirty" @click="save">Save</button>
          <button type="button" class="btn btn--ghost" :disabled="!dirty" @click="note = savedNote">Discard</button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BottomSheet } from 'vue-mobile-patterns'

const open = ref(false)
const formOpen = ref(false)
const lastClosed = ref('')

const chips = ['All', 'Mentions', 'Comments', 'Reviews', 'Deploys', 'Releases', 'Issues']
const activeChip = ref('All')

const people = [
  { who: 'Design', color: '#6366f1' },
  { who: 'Backend', color: '#0ea5e9' },
  { who: 'QA', color: '#14b8a6' },
  { who: 'Mobile', color: '#f59e0b' },
  { who: 'Docs', color: '#ec4899' },
]
const actions = [
  'commented on “Checkout redesign”',
  'approved pull request #482',
  'moved “Onboarding copy” to Done',
  'mentioned you in “Release notes”',
  'deployed v2.14 to staging',
  'opened issue “Safari date picker”',
  'reviewed “Image lazy loading”',
]
const feed = Array.from({ length: 36 }, (_, i) => {
  const person = people[i % people.length]
  return {
    id: i,
    who: person.who,
    color: person.color,
    initials: person.who.slice(0, 1),
    what: actions[(i * 3) % actions.length],
    when: i < 4 ? `${(i + 1) * 4} min ago` : `${Math.floor(i / 3) + 1} h ago`,
  }
})

const savedNote = ref('')
const note = ref('')
const dirty = computed(() => note.value !== savedNote.value)

function openForm() {
  note.value = savedNote.value
  formOpen.value = true
}

function save() {
  savedNote.value = note.value
}
</script>

<style scoped>
.sheet-demo { display: grid; gap: 12px; }

.chips {
  display: flex; gap: 8px;
  overflow-x: auto;
  padding: 2px 8px 12px;
  margin: 0 -4px;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar { display: none; }
.chip {
  flex: none;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  font-size: 13.5px; font-weight: 600;
  cursor: pointer;
}
.chip--on { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }

.feed { list-style: none; margin: 0; padding: 0 4px; }
.feed__item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 4px;
  border-top: 1px solid var(--border);
  font-size: 14px;
}
.feed__avatar {
  flex: none;
  display: grid; place-items: center;
  width: 32px; height: 32px; border-radius: 50%;
  color: #fff; font-size: 13px; font-weight: 700;
}
.feed__text { color: var(--text-2); }
.feed__text strong { color: var(--text); }
.feed__time { display: block; color: var(--text-3); font-size: 12.5px; }

.form { display: grid; gap: 10px; padding: 4px 8px 8px; }
.form__label { font-size: 13px; font-weight: 600; color: var(--text-2); }
.form__input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  resize: vertical;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
