import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(import.meta.dirname) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'components/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
    ],
    css: false,
  },
})
