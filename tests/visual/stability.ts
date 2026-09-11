import type { Page } from '@playwright/test'

/**
 * EVERYTHING THAT WOULD MAKE THE SAME PAGE PHOTOGRAPH DIFFERENTLY — Phase 42.
 *
 * A visual snapshot is only useful if the ONLY thing that can change it is the code under review.
 * Four things break that, and every one of them has produced a flaky suite somewhere:
 *
 *   MOTION. A transition caught mid-flight is a different image every run. Animations are disabled
 *           rather than waited out, because waiting is a guess and disabling is a fact.
 *   IMAGES. Answered locally by `tests/support/media-route.ts`, so the bytes never come from a CDN.
 *   TIME.   A page showing "2 days ago" changes every night. The fixture's clock is frozen, and
 *           anything the page computes from `Date.now()` is frozen here to match.
 *   CARETS. A focused input blinks. The blink is a 50/50 coin toss in any screenshot.
 *
 * A FIFTH, AND IT IS NOT ON THE PAGE AT ALL: the development server's own dev-tools indicator.
 * It floats over the bottom-left corner, it renders as a collapsed badge or an expanded one
 * depending on what it has to say and when it is asked, and it photographed both ways — which made
 * `/large-format` at 390px differ from its own baseline one run later with no code between them.
 * `settle()` hides it, and `npm run test:visual` now drives a PRODUCTION build where it does not
 * exist at all: a baseline of a dev server is a baseline of a page no visitor is ever served.
 */

/** The frozen instant, matching `tests/fixtures/ids.ts`. */
const FIXTURE_NOW = '2026-01-15T12:00:00.000Z'

export async function stabilise(page: Page): Promise<void> {
  /*
   * INJECTED BEFORE THE DOCUMENT RUNS, so a component that reads the clock during its first render
   * sees the frozen value. An `evaluate` after `goto` would be too late for exactly the render a
   * snapshot captures.
   */
  await page.addInitScript(`{
    const frozen = new Date(${JSON.stringify(FIXTURE_NOW)}).valueOf()
    const RealDate = Date
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length === 0 ? [frozen] : args))
      }
      static now() { return frozen }
    }
    Date.UTC = RealDate.UTC
    Date.parse = RealDate.parse
  }`)
}

/**
 * Wait for the page to stop moving.
 *
 * `networkidle` IS NOT USED AND THAT IS DELIBERATE: Playwright's own guidance is that it is
 * unreliable, and with the media route answering instantly there is no network to be idle about.
 * What matters is that fonts have loaded — text reflows when they swap, and a snapshot taken during
 * the swap is a different image every time — and that one frame has been painted since.
 */
export async function settle(page: Page): Promise<void> {
  /*
   * THE STYLESHEET GOES IN AFTER THE NAVIGATION, AND IT USED NOT TO — Phase 42.
   *
   * `addStyleTag` injects into the document that is open WHEN IT RUNS, and `stabilise()` runs
   * before `page.goto`: the tag landed in `about:blank` and was discarded by the very navigation
   * it was meant to stabilise. Every rule below was silently doing nothing, which is why the dev
   * server's overlay reached a committed baseline despite a rule that hides it. Injecting here —
   * after the navigation, before the shutter — is what makes them apply. It is also after
   * hydration, so nothing here can be mistaken for a server/client mismatch.
   */
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      /* A blinking caret is a coin toss in every screenshot. */
      * { caret-color: transparent !important; }
      /*
       * The dev server's own overlay is not part of the page. The visual suite runs against a
       * production build, where none of this exists; the rule stays for anyone pointing the visual
       * projects at a development server, and it is deliberately broad because the element has been
       * renamed more than once across Next versions and a selector that silently stops matching
       * puts a floating badge into a committed baseline.
       */
      nextjs-portal,
      [data-nextjs-dev-tools-button],
      [data-nextjs-toast],
      [data-next-badge-root],
      #__next-build-watcher,
      #__next-prerender-indicator { display: none !important; }
    `,
  })

  /*
   * EVERY LAZY IMAGE IS FORCED IN BEFORE THE SHUTTER OPENS.
   *
   * `fullPage: true` photographs the whole document, but the browser has only ever SCROLLED to the
   * top — so an image with `loading="lazy"` below the fold may or may not have decoded by the time
   * the shot is taken, and the page is a different height depending. That is precisely what made
   * `/large-format` at 390px pass on one run and fail on the next with no code between them: a
   * genuine flake, found by running the suite twice rather than once.
   *
   * Setting `loading="eager"` and waiting for `decode()` is deterministic, where scrolling the page
   * and hoping is not. `decode()` rejects for an image the media route answered with a 204 — the
   * video case — so each is caught and ignored: an image that will never load cannot change height
   * later either.
   */
  await page.evaluate(async () => {
    const images = Array.from(document.images)
    for (const image of images) image.loading = 'eager'
    await Promise.all(
      images.map(async (image) => {
        try {
          await image.decode()
        } catch {
          // Never going to load; it is not going to move either.
        }
      }),
    )
  })

  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.evaluate(
    async () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
}
