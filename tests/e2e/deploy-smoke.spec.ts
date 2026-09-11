import { expect, test } from '@playwright/test'

/**
 * THE ENVIRONMENT PAGE PRINTS NO VALUES — Phase 44, run in Phase 42.
 *
 * `/studio/system/environment` reports whether each dependency is configured and reachable. Its
 * whole design rests on one rule: it collapses presence to a BOOLEAN and never renders a value, a
 * prefix, a suffix or a length (D8, SECURITY §5). `lib/ops/security-posture.ts` and
 * `lib/ops/env-checks/*` are unit-tested against that rule with sentinels.
 *
 * WHAT A UNIT TEST CANNOT SEE IS THE RENDERED PAGE. A check returns a boolean; a component beside it
 * could still print `process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8)` in a debug line somebody
 * added at 11pm, and every unit test would still pass. So this reads the DOM and looks for anything
 * SHAPED like a secret — a JWT, a long base64 run, a Cloudinary URL, an API key — rather than for
 * any particular value, because the value it would be looking for is one it must not know.
 *
 * IT SKIPS WITHOUT `STUDIO_STORAGE_STATE`, AND THAT IS A REAL GAP RATHER THAN A FORMALITY. There is
 * no environment in this repository that can produce one: the local harness is PostgREST alone,
 * with no auth server to sign in against. `docs/ops/TESTING.md` §13 records it. This spec is written
 * so that the day a fixture account exists, the assertion is already here.
 */

const SECRET_SHAPES: readonly [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, 'a JWT'],
  [/cloudinary:\/\/[0-9]+:/, 'a Cloudinary URL with credentials'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  // A long unbroken run of base64-ish characters is what a key looks like when it is pasted.
  [/[A-Za-z0-9+/]{48,}={0,2}/, 'a long opaque token'],
]

test.describe('the environment page', () => {
  test.skip(
    !process.env.STUDIO_STORAGE_STATE,
    'no authenticated storage state — see docs/ops/TESTING.md §13',
  )
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })
  test.skip(({ viewport }) => viewport?.width !== 1440, 'the rule does not vary by viewport')

  test('renders nothing shaped like a secret', async ({ page }) => {
    const response = await page.goto('/studio/system/environment')
    expect(response?.status()).toBe(200)

    const text = (await page.locator('body').innerText()) ?? ''
    for (const [shape, what] of SECRET_SHAPES) {
      expect(shape.test(text), `the page renders ${what}`).toBe(false)
    }

    /*
     * THE MARKUP TOO, NOT ONLY THE TEXT. A value in a `title`, a `data-` attribute or an
     * `aria-label` is invisible on screen and present in the response body, which is where anybody
     * looking for it would look.
     */
    const html = await page.content()
    for (const [shape, what] of SECRET_SHAPES) {
      expect(shape.test(html), `the markup carries ${what}`).toBe(false)
    }
  })

  test('says what is configured without saying what it is', async ({ page }) => {
    // Load-bearing: the assertions above pass on a blank page. This proves the page rendered.
    await page.goto('/studio/system/environment')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('[data-env-check]')).not.toHaveCount(0)
  })

  test('names the build without naming the machine that made it', async ({ page }) => {
    /*
     * `BuildPanel` reports the commit, the branch and when it was built. A path from the build
     * machine, a runner id or an internal hostname in that panel is a small leak and an easy one:
     * it tells anybody reading it how the deployment is put together.
     */
    await page.goto('/studio/system/environment')
    const panel = page.locator('[data-build-panel]')
    test.skip((await panel.count()) === 0, 'no build panel on this deployment')

    const text = await panel.innerText()
    expect(text, 'a filesystem path from the build machine').not.toMatch(/\/(home|Users|runner)\//)
    expect(text, 'an internal hostname').not.toMatch(/\.internal\b|\.local\b/)
  })
})
