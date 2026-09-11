import { defineConfig, devices } from '@playwright/test'

/**
 * The eight QA widths are fixed by requirement FEAT §45 and are not negotiable per-suite:
 * 1920, 1440, 1280 (desktop) · 1024, 768 (tablet) · 430, 390, 360 (mobile).
 * Every one is a real device class someone will open the site on.
 */
export const QA_WIDTHS = [1920, 1440, 1280, 1024, 768, 430, 390, 360] as const

/**
 * THE TIERS — Phase 42.
 *
 * `e2e` is behaviour and `visual` is appearance, and they fail for different reasons and want
 * different responses. A behavioural failure is a bug; a visual one is usually a deliberate change
 * that needs a new baseline. Splitting them means a reviewer reads the right one first, and means
 * the visual suite can be re-baselined without re-running everything.
 *
 * `flaky` IS A THIRD PROJECT AND IT IS EMPTY. `tests/flaky.json` is where a quarantined test is
 * named; nothing is quarantined today. It exists so that quarantining is a visible act with a date
 * and a reason attached, rather than a retry count quietly raised in this file.
 */
const TIERS = {
  e2e: 'tests/e2e/**/*.spec.ts',
  visual: 'tests/visual/**/*.visual.spec.ts',
} as const

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  /*
   * THE SNAPSHOT PATH IS PLAYWRIGHT'S DEFAULT, DELIBERATELY. It already encodes the project name
   * and the platform in the filename — which is the property that matters, since a baseline belongs
   * to the width it was taken at and the machine that rasterised its fonts — and the sixteen
   * `design-system` baselines committed in Phase 10 are stored under it. A tidier template here
   * would orphan every one of them and regenerate them silently on the next run, which is the one
   * thing a snapshot suite must never do.
   */
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
  /**
   * TWO SERVERS, AND WHICH ONE RUNS IS THE DIFFERENCE BETWEEN TWO KINDS OF TRUTH — Phase 42.
   *
   * The harness ran `next dev` because `/design-system` calls `notFound()` in production: the
   * gallery is a development surface and there is no way to photograph it from a build. That was
   * right and it hid something. `tests/e2e/perf-headers.spec.ts` asserts the CACHING CONTRACT —
   * `immutable` on a hashed asset, ISR on a CMS page — and `next dev` answers every request with
   * `no-cache, must-revalidate`. Those four tests could never pass, and nobody knew, because CI had
   * never run Playwright at all until this phase added the workflow.
   *
   * So `E2E_PRODUCTION=1` switches the harness to a real build. `.github/workflows/e2e.yml` sets it;
   * a developer running `npx playwright test` locally still gets the dev server and the gallery.
   * `design-system.spec.ts` skips under the flag, naming the route as dev-only — which is the honest
   * statement, not a workaround: a gallery that does not exist in production cannot be asserted
   * against one.
   *
   * THE READINESS URL MOVES WITH IT. Playwright polls until it gets a 2xx, and `/design-system`
   * 404s on a production build — so polling it there would make a perfectly good server look
   * permanently unready and kill the run on a timeout that says nothing about the cause.
   */
  webServer: {
    command: process.env.E2E_PRODUCTION === '1' ? 'npx next start -p 3000' : 'npm run dev',
    url:
      process.env.E2E_PRODUCTION === '1'
        ? 'http://127.0.0.1:3000/collection'
        : 'http://127.0.0.1:3000/design-system',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: QA_WIDTHS.flatMap((width) => [
    {
      name: `w${width}`,
      testMatch: TIERS.e2e,
      use: widthUse(width),
    },
    /*
     * THE VISUAL PROJECT RUNS AT THREE WIDTHS, NOT EIGHT. A baseline costs a committed PNG and a
     * reviewer's attention on every diff, and 1280 photographs the same layout as 1440 — the
     * breakpoints are what matter, so one width per breakpoint band is what earns its keep.
     */
    ...(width === 1440 || width === 768 || width === 390
      ? [
          {
            name: `visual-w${width}`,
            testMatch: TIERS.visual,
            use: widthUse(width),
          },
        ]
      : []),
  ]),
})

/** The browser configuration for one QA width. Shared by the behavioural and visual projects. */
function widthUse(width: number) {
  return {
    ...devices['Desktop Chrome'],
    viewport: { width, height: width < 500 ? 844 : 900 },
    isMobile: false,
    /**
     * The three mobile widths emulate touch; the five larger ones do not.
     *
     * Without this a 360px project still reports `(pointer: fine)`, so it is a narrow
     * desktop rather than a phone — `pointer-coarse:` rules never apply, `pointer-fine:`
     * rules wrongly do, and the 44px touch-target rule in FEAT §48 cannot be verified at
     * the very widths it exists for. `hasTouch` makes Chromium report a coarse pointer.
     *
     * `isMobile` stays false deliberately: it also enables mobile viewport meta emulation,
     * which changes layout scaling and would make these baselines measure something other
     * than the CSS.
     */
    hasTouch: width < 500,
    // This image ships Chromium at /opt/pw-browsers and sets
    // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so the bundled build number will not match what
    // a given @playwright/test expects. Point at the installed binary rather than
    // running `playwright install`, which the environment does not permit.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  }
}
