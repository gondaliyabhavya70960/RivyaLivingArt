import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { clearInquiryRateLimit } from '../support/inquiry-limiter'

/**
 * The conversion path, end to end: `/contact`, a product enquiry, and the rule that governs both.
 *
 * THE ASSERTION THAT MATTERS IS A NEGATIVE ONE. D1 and SEED §49 say an enquiry must be PERSISTED
 * before any WhatsApp redirect, and the failure that rule prevents is silent — a visitor handed to
 * WhatsApp, typing to a studio with no record of them, everybody believing an enquiry happened. So
 * the important test below forces the save to fail and asserts the browser NEVER navigates to
 * `wa.me`. A suite that only checked the happy path would pass on a build that redirected first.
 *
 * NO SELECTOR HERE IS WRITTEN AGAINST COPY. Every visible string comes from `global_content`, so a
 * test pinned to the words would fail the moment an editor changed them — which is the freedom D2
 * exists to give. The hooks are `data-inquiry-form`, `data-inquiry-state`, `data-inquiry-reference`
 * and `data-inquiry-continue`.
 *
 * THE BASELINE GUARD. Every CMS-backed route answers 404 until an editor publishes its sections, so
 * a test pinned to `/contact` would pass or fail on the contents of whichever database it ran
 * against. Each test establishes reachability first and skips with a reason — a red run means
 * something broke rather than something was never published.
 */

const CONTACT = '/contact'

/*
 * THE RATE LIMITER COUNTS THE WHOLE SUITE AS ONE VISITOR — Phase 42, found by the first run at
 * eight widths.
 *
 * Three tests here submit an enquiry, and each width project runs all three from the same address.
 * Phase 41's rule admits five in ten minutes and ten in an hour, so somewhere around the third
 * project the save starts coming back refused and the test reports a broken conversion path that is
 * in fact working exactly as designed. `inquiry-conversion.spec.ts` hit this first and answered it
 * the same way; the helper now lives in `tests/support/` so both use one copy.
 *
 * Resetting the counter rather than relaxing the limit is the whole point: the rule under test is
 * unchanged, and what the test stops asserting is only "no other test ran before me".
 */
test.beforeEach(async () => {
  await clearInquiryRateLimit()
})

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

async function formPresent(page: Page): Promise<boolean> {
  return (await page.locator('[data-inquiry-form]').count()) > 0
}

/** Fill the four fields every kind of enquiry asks for. Names, not labels: see the note above. */
async function fillBasics(page: Page): Promise<void> {
  await page.locator('[data-inquiry-form] input[name="name"]').fill('E2E Visitor')
  await page.locator('[data-inquiry-form] input[name="phone"]').fill('+91 98250 12345')
  await page.locator('[data-inquiry-form] input[name="city"]').fill('Surat')
  await page
    .locator('[data-inquiry-form] textarea[name="message"]')
    .fill('An end-to-end probe, sent by the test suite.')
}

test.describe('/contact', () => {
  test('renders and carries the enquiry form', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('[data-inquiry-form]')).toHaveCount(1)
  })

  test('has no accessibility violations', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  /**
   * The honeypot must be invisible to sight AND to assistive technology. A hidden field a screen
   * reader announces is a field somebody will fill in, and filling it silently discards their
   * enquiry — which is the worst outcome this file can think of for an accessibility defect.
   */
  test('hides the honeypot from everybody', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')
    test.skip(!(await formPresent(page)), 'the contact form is not on this page')

    const honeypot = page.locator('[data-inquiry-form] input[name="website"]')
    await expect(honeypot).toHaveCount(1)

    /*
     * NOT `toBeVisible()`, AND THE REASON IS THE TECHNIQUE — corrected in Phase 42, the first time
     * this spec ran anywhere.
     *
     * The field is wrapped in `VisuallyHidden`, which CLIPS it to a single pixel and deliberately
     * leaves it in the layout. `display: none` would be simpler and would defeat the honeypot: a
     * script that skips hidden inputs is the common case, and the whole point is that a bot filling
     * every field it finds fills this one. Playwright reports a clipped element as visible, because
     * it is — it has a box and it is not `visibility: hidden` — so `not.toBeVisible()` failed on a
     * correct page and would have been "fixed" by switching to the mechanism that breaks the trap.
     *
     * What "hidden from everybody" actually means here is asserted instead: a single clipped pixel,
     * out of the tab order, and absent from the accessibility tree.
     */
    const hidden = await honeypot.evaluate((node) => {
      const element = node as HTMLElement
      // The clip lives on the `VisuallyHidden` wrapper, not on the input.
      const wrapper = element.closest('[aria-hidden="true"]')?.parentElement ?? element
      const style = window.getComputedStyle(wrapper)
      return {
        clipped: style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)',
        painted: style.display !== 'none' && style.visibility !== 'hidden',
      }
    })
    expect(hidden.clipped, 'the honeypot is not clipped — a visitor can see it').toBe(true)
    expect(hidden.painted, 'the honeypot is display:none, which a bot can detect and skip').toBe(
      true,
    )
    await expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(
      await honeypot.evaluate((node) => node.closest('[aria-hidden="true"]') !== null),
      'the honeypot is in the accessibility tree — a screen reader would announce it',
    ).toBe(true)
  })

  test('offers no price, cart or checkout anywhere on the page', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')

    // D1: the conversion ends in an enquiry. `tests/unit/no-pricing.test.ts` closes the same door at
    // the schema; this closes it at the rendered page, where a CMS string could reopen it.
    const body = (await page.locator('body').innerText()).toLowerCase()
    for (const forbidden of ['add to cart', 'checkout', 'pay now', 'place order']) {
      expect(body, `"${forbidden}" appeared on ${CONTACT}`).not.toContain(forbidden)
    }
  })

  test('saves the enquiry and offers the handoff, in that order', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')
    test.skip(!(await formPresent(page)), 'the contact form is not on this page')

    await fillBasics(page)

    /*
     * THREE AND A HALF SECONDS BEFORE SUBMITTING, because `submit-inquiry.ts` refuses anything
     * completed in under three and answers with the same generic error a real failure gets —
     * telling a bot which guard it tripped is telling it what to change. A harness fills four
     * fields in about a second, so without this the enquiry is refused as automated and the test
     * fails with no clue why. Waiting is the fix; lowering the floor would remove the guard.
     */
    await page.waitForTimeout(3_500)

    /*
     * THE AUTO-FORWARD IS BLOCKED SO THE SUCCESS STATE CAN BE READ. Aborting the `wa.me` navigation
     * is not avoiding the behaviour under test — the assertion IS that the link exists and carries
     * the reference code, and a test that let the browser leave would have nothing left to assert.
     */
    await page.route('https://wa.me/**', (route) => route.abort())

    await page.locator('[data-inquiry-form] button[type="submit"]').click()

    const sent = page.locator('[data-inquiry-state="sent"]')
    await expect(sent).toBeVisible({ timeout: 15_000 })

    const reference = await page
      .locator('[data-inquiry-reference]')
      .getAttribute('data-inquiry-reference')
    expect(reference).toMatch(/^RIV-\d{4}-\d{6,}$/)

    const link = page.locator('[data-inquiry-continue]')
    if ((await link.count()) === 0) {
      // No number resolved in this environment. The enquiry is still saved and the code is still
      // shown, which is the outcome that matters — see `whatsapp_state = 'UNAVAILABLE'`.
      return
    }

    const href = (await link.getAttribute('href')) ?? ''
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
    expect(decodeURIComponent(href)).toContain(reference ?? '')
  })

  /**
   * THE ONE THAT MUST NEVER BE DELETED. With the write forced to fail, the visitor stays where they
   * are, sees the SEED §49 save-error state, and no request to `wa.me` is made. If this test ever
   * has to be weakened, the thing to change is the code.
   */
  test('never navigates to WhatsApp when the save fails', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')
    test.skip(!(await formPresent(page)), 'the contact form is not on this page')

    let attemptedHandoff = false
    await page.route('https://wa.me/**', (route) => {
      attemptedHandoff = true
      return route.abort()
    })

    // The Server Action is a POST to the page's own URL. Failing it is the closest a browser test
    // can get to "the database refused", and it exercises the same branch: no `ok: true`, no URL.
    await page.route(CONTACT, async (route) => {
      if (route.request().method() === 'POST') return route.abort()
      return route.fallback()
    })

    const before = page.url()
    await fillBasics(page)
    await page.locator('[data-inquiry-form] button[type="submit"]').click()

    // Give any redirect the time it would need to happen.
    await page.waitForTimeout(2_000)

    expect(attemptedHandoff, 'the page tried to reach wa.me after a failed save').toBe(false)
    expect(page.url()).toBe(before)
    await expect(page.locator('[data-inquiry-state="sent"]')).toHaveCount(0)
  })
})

test.describe('an enquiry about a piece', () => {
  /**
   * Phase 15's rail links to `/contact?product=<slug>&type=product`, and the form reads it after
   * mount. There is no dialog and no second island: amendment A20.
   */
  test('files against the product named in the URL', async ({ page }) => {
    test.skip(!(await reachable(page, CONTACT)), 'no published sections on /contact')
    test.skip(!(await formPresent(page)), 'the contact form is not on this page')

    const cards = page.locator('[data-product-card] a')
    await page.goto('/collection')
    const first = await cards.first().getAttribute('href')
    test.skip(first === null, 'this database has no published products')

    const slug = (first ?? '').split('/').pop() ?? ''
    await page.goto(`${CONTACT}?product=${slug}&type=product`)

    // The type picker goes when a product is named: the visitor has already answered that question
    // by following the link.
    await expect(page.locator('[data-inquiry-form] select[name="enquiry_type"]')).toHaveCount(0)
  })
})

/**
 * The Studio half. The inbox is behind the same gate as every other Studio route, and an anonymous
 * visitor must reach the login page rather than the customer list.
 *
 * The AUTHENTICATED cases are not here for the reason `studio-access.spec.ts` sets out at length:
 * there is no way to obtain a real session without a reachable auth server. The per-role
 * authorisation is proved beneath, by `tests/unit/rls/phase20.test.ts` against a real PostgreSQL —
 * including the assertion that the researcher, who does not hold `inquiries.read`, sees nothing.
 */
test.describe('the enquiry inbox', () => {
  for (const path of ['/studio/inquiries/all', '/studio/inquiries/commission']) {
    test(`sends an anonymous visitor from ${path} to the login page`, async ({ page }) => {
      const response = await page.goto(path)

      expect(page.url()).toContain('/studio/login')
      expect(response?.status()).toBe(200)
      expect(new URL(page.url()).searchParams.get('next')).toBe(path)
    })
  }

  test('refuses the export to an anonymous caller', async ({ request }) => {
    const response = await request.get('/api/studio/inquiries/export')
    expect([401, 403]).toContain(response.status())
  })
})
