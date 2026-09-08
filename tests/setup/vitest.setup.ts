import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

// This setup file runs for EVERY suite, including ones that opt into the node environment with
// `// @vitest-environment node` — the RLS suite does, because it talks to PostgreSQL and has no
// use for a DOM. So everything below is guarded: touching `window` unconditionally made the whole
// RLS suite fail to load with "window is not defined", which reports as zero tests rather than as
// a failure anyone would read as security coverage going missing.
const hasDom = typeof window !== 'undefined'

// jsdom implements neither matchMedia nor ResizeObserver; several primitives read both.
// Default to "no preference" so the animated branch is the one under test unless a test
// explicitly opts into reduced motion.
if (hasDom && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

if (hasDom && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
