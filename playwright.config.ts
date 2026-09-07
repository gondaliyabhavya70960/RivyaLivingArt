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
  //
  // The readiness URL is the gallery, NOT the origin root. Playwright treats only 2xx/3xx
  // as ready, and `/` legitimately 404s until Phase 10 adds a home page — polling it makes
  // the server look permanently unready and the run dies on a 120s timeout that says
  // nothing about the cause.
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000/design-system',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: QA_WIDTHS.map((width) => ({
    name: `w${width}`,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width, height: width < 500 ? 844 : 900 },
      isMobile: false,
      // This image ships Chromium at /opt/pw-browsers and sets
      // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so the bundled build number will not match what
      // a given @playwright/test expects. Point at the installed binary rather than
      // running `playwright install`, which the environment does not permit.
      launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
        : {},
    },
  })),
})
