import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // Logic tests run in plain Node; component tests opt into a DOM per file
    // with `// @vitest-environment happy-dom`. The library must not touch
    // browser globals at module top level, and this keeps it honest.
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
