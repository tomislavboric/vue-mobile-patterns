<template>
  <section class="demo" :aria-labelledby="`${id}-title`" :id="id">
    <header class="demo__head">
      <span class="demo__index">{{ index }}</span>
      <h2 :id="`${id}-title`" class="demo__title">{{ title }}</h2>
    </header>
    <p class="demo__problem"><slot name="problem" /></p>
    <div class="demo__stage">
      <slot />
    </div>
    <details class="demo__code">
      <summary>Usage</summary>
      <pre><code><slot name="code" /></code></pre>
    </details>
  </section>
</template>

<script setup>
defineProps({
  id: { type: String, required: true },
  index: { type: String, required: true },
  title: { type: String, required: true },
})
</script>

<style scoped>
.demo {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px 16px 16px;
  scroll-margin-top: 16px;
}
.demo__head { display: flex; align-items: baseline; gap: 10px; }
.demo__index {
  flex: none;
  color: var(--accent);
  font-family: var(--mono); font-size: 13px; font-weight: 700;
}
.demo__title { font-size: 18px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; }
.demo__problem { margin-top: 8px; color: var(--text-2); font-size: 14.5px; }
.demo__stage {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-2);
}
.demo__code { margin-top: 12px; }
.demo__code summary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 2px;
  color: var(--text-2); font-size: 13.5px; font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.demo__code summary::-webkit-details-marker { display: none; }
.demo__code summary::before { content: "›"; display: inline-block; transition: transform 0.15s; font-size: 16px; }
.demo__code[open] summary::before { transform: rotate(90deg); }
.demo__code pre {
  margin: 8px 0 0;
  padding: 14px;
  overflow-x: auto;
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--code-text);
  font-size: 12.5px; line-height: 1.6;
}

@media (min-width: 720px) {
  .demo { padding: 28px 28px 20px; }
  .demo__title { font-size: 20px; }
  .demo__stage { padding: 20px; }
}
</style>
