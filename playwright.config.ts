import { defineConfig, devices } from '@playwright/test'

/**
 * The eight QA widths are fixed by requirement FEAT §45 and are not negotiable per-suite:
 * 1920, 1440, 1280 (desktop) · 1024, 768 (tablet) · 430, 390, 360 (mobile).
 * Every one is a real device class someone will open the site on.
 */
export const QA_WIDTHS = [1920, 1440, 1280, 1024, 768, 430, 390, 360] as const

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  // The design-system gallery is dev-only by design — it calls notFound() in production —
  // so the harness runs against `next dev`, not a production build.
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: QA_WIDTHS.map((width) => ({
    name: `w${width}`,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width, height: width < 500 ? 844 : 900 },
      isMobile: false,
    },
  })),
})
