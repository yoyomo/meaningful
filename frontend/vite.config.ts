/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    fs: {
      allow: [repoRoot],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(repoRoot, 'backend/src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})