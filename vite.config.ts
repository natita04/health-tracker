import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // One small app bundle (~500 kB, ~145 kB gzipped) is fine; don't warn about it.
  build: { chunkSizeWarningLimit: 800 },
})
