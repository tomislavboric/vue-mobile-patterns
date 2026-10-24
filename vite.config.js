import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The demo lives in ./demo and imports the library straight from ./src.
export default defineConfig({
  root: fileURLToPath(new URL('./demo', import.meta.url)),
  base: '/vue-mobile-patterns/',
  plugins: [vue()],
  resolve: {
    alias: { 'vue-mobile-patterns': fileURLToPath(new URL('./src/index.js', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('./demo-dist', import.meta.url)),
    emptyOutDir: true,
  },
})
