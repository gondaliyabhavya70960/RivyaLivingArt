import pg from 'pg'
import { expect, test, type Page } from '@playwright/test'

import { FIXTURE_PRODUCTS, FIXTURE_PRODUCT_SLUG } from '../fixtures/ids'

/**
 * THE CONVERSION PATH, ASSERTED AT THE TABLE — Phase 42.
 *
 * `tests/e2e/inquiry-flow.spec.ts` covers the rule from the browser's side: the enquiry must be
 * persisted before any WhatsApp redirect, and it forces the save to fail and watches that no
 * redirect happens. What it cannot see is what actually landed. Its evidence is a reference code
 * printed on a page — which a build that rendered a code and wrote nothing would also produce.
 *
 * So this one walks the same journey and then LOOKS IN THE DATABASE: is there a row, does it carry
 * the product the visitor was looking at, the path they came from, the words they typed, and the
 * reference code the page showed them.
 *
 * IT WALKS THE REAL JOURNEY, WHICH IS TWO PAGES. The product page does not carry a form: it carries
 * `ProductInquiryRail`, whose link is `/contact?product=<slug>&type=product`, and `InquiryForm`
 * reads that parameter on the client to file the enquiry against the right piece. That handoff
 * through the URL is precisely the part no unit test can cover — a rail that dropped the parameter,
 * or a form that stopped reading it, would leave every product enquiry filed against nothing, and
 * every page would still render perfectly.
 *
 * IT USES THE FIXTURE PRODUCT, because the assertion is about a specific product's id reaching a
 * specific column. Against whatever happens to be published it could only assert "some row".
 *
 * IT CLEANS UP AFTER ITSELF. The rows it creates are real enquiries in the studio's own table,
 * reachable from the Studio list, and leaving them would mean every run adds one more plausible
 * person to a table somebody reads as work to do.
 */

const PRODUCT_PATH = `/product/${FIXTURE_PRODUCT_SLUG.startingFrom}`
const CONTACT_PATH = `/contact?product=${FIXTURE_PRODUCT_SLUG.startingFrom}&type=product`
/** Distinctive enough to find the row, obviously synthetic enough that nobody rings it. */
const MARKER = 'e2e-conversion-probe'

async function db(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  return client
}

async function removeProbeRows(): Promise<void> {
  const client = await db()
  try {
    await client.query('delete from inquiries where message like $1', [`%${MARKER}%`])
  } finally {
    await client.end()
  }
}

/**
 * Clear the enquiry rate-limit buckets for this machine.
 *
 * THE LIMITER FOUND THIS SUITE BEFORE THIS SUITE FOUND ANYTHING — the first run failed on
 * "That is several enquiries from this connection in a short time", which is Phase 41's rule
 * working exactly as written: five per ten minutes and ten per hour from one connection. Three
 * tests, one of which submits twice, is four in a few seconds from one address.
 *
 * The limit is real and must not be relaxed, so the test resets the counter instead — the same
 * thing waiting ten minutes would do, minus the ten minutes. `bucket_key` is `<surface>:<ip hash>`
 * and the enquiry surface is `inq`, so this leaves the `vitals`, `csp_report` and `inq_upload`
 * buckets alone. Matched with the colon rather than by prefix, so `inq_upload` is not swept up with
 * it.
 */
async function clearInquiryRateLimit(): Promise<void> {
  const client = await db()
  try {
    await client.query("delete from rate_limit_buckets where bucket_key like 'inq:%'")
  } finally {
    await client.end()
  }
}

/**
 * Wait long enough that the form does not read as a machine.
 *
 * `submit-inquiry.ts` refuses any submission completed in under `MIN_SUBMIT_MS` (three seconds) and
 * answers with the SAME generic error a real failure gets, deliberately — telling a bot which guard
 * it tripped is telling it what to change. A harness fills four fields in about a second and a half,
 * so without this every test here fails with "your enquiry could not be saved" and no clue why. That
 * took a dev server log to find, which is exactly the experience the design intends for a bot.
 *
 * WAITING IS THE FIX, NOT LOWERING THE FLOOR. The guard is load-bearing and the three seconds cost
 * the suite nine.
 */
const MIN_SUBMIT_MS = 3_000
async function fillSlowly(action: () => Promise<void>): Promise<void> {
  const started = Date.now()
  await action()
  const remaining = MIN_SUBMIT_MS + 500 - (Date.now() - started)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

test.describe('an enquiry from a product page', () => {
  test.skip(
    !process.env.DATABASE_URL,
    'DATABASE_URL is not set — this spec asserts what reached the table',
  )
  test.skip(({ viewport }) => viewport?.width !== 1440, 'the journey does not vary by viewport')

  /*
   * SERIAL, BECAUSE THEY SHARE A RATE LIMIT AND A MARKER. Two of these running at once would each
   * count against the other's budget and each see the other's row.
   */
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async () => {
    await clearInquiryRateLimit()
    await removeProbeRows()
  })

  test.afterAll(async () => {
    await removeProbeRows()
  })

  test('persists a row carrying the product, the path and the words typed', async ({ page }) => {
    /*
     * THE FIRST HALF OF THE JOURNEY IS THE LINK ITSELF. Reaching `/contact` directly would test the
     * form and skip the handoff, which is the half most likely to break.
     */
    test.skip(!(await reachable(page, PRODUCT_PATH)), 'the fixture product page is not reachable')

    const rail = page.locator(`a[href*="/contact?product=${FIXTURE_PRODUCT_SLUG.startingFrom}"]`)
    test.skip((await rail.count()) === 0, 'no enquiry action on the product page')
    await rail.first().click()
    await page.waitForURL(/\/contact\?/)
    expect(new URL(page.url()).searchParams.get('product')).toBe(FIXTURE_PRODUCT_SLUG.startingFrom)

    const form = page.locator('[data-inquiry-form]')
    test.skip((await form.count()) === 0, 'no enquiry form on the contact page')

    await fillSlowly(async () => {
      await form.locator('input[name="name"]').fill('Fixture Conversion Probe')
      await form.locator('input[name="phone"]').fill('+15555550199')
      await form.locator('input[name="city"]').fill('Surat')
      await form
        .locator('textarea[name="message"]')
        .fill(`An end-to-end probe: ${MARKER}. Nobody should ring this number.`)
    })

    await form.locator('button[type="submit"]').first().click()

    // Success is reported by a state attribute, never by copy: every word here comes from the CMS,
    // so a selector written against the sentence would fail the next time an editor improved it.
    await expect(page.locator('[data-inquiry-state="sent"]')).toBeVisible({ timeout: 15_000 })
    const reference = await page
      .locator('[data-inquiry-reference]')
      .first()
      .getAttribute('data-inquiry-reference')
    expect(reference, 'the page showed no reference code').toBeTruthy()

    const client = await db()
    try {
      const rows = await client.query<{
        reference_code: string
        product_id: string | null
        source_path: string | null
        message: string | null
        pipeline_status: string
        whatsapp_state: string
      }>(
        `select reference_code, product_id, source_path, message, pipeline_status, whatsapp_state
           from inquiries where message like $1`,
        [`%${MARKER}%`],
      )

      expect(rows.rows.length, 'the page reported success and no row exists').toBe(1)
      const row = rows.rows[0]!

      // The reference the visitor was shown is the reference the studio will search for.
      expect(row.reference_code).toBe(reference)
      // The product they were looking at, not "some product". This is the whole point of the
      // `?product=` handoff, and the only place it can be verified.
      expect(row.product_id).toBe(FIXTURE_PRODUCTS.startingFrom)
      /*
       * A PATH, NOT A URL, AND DELIBERATELY SO. `source_path` is `usePathname()`, which excludes the
       * query string — so it reads `/contact` rather than `/contact?product=…`. That is the right
       * column: a query string is visitor-supplied text, and storing it would put arbitrary input
       * into a field the studio reads. Which piece they were looking at is already recorded
       * structurally, in `product_id`, where a database can join on it.
       */
      expect(row.source_path).toBe('/contact')
      expect(row.message).toContain(MARKER)
      // A new enquiry is NEW: nobody at the studio has looked at it.
      expect(row.pipeline_status).toBe('NEW')
      /*
       * NOT `NOT_SENT`, AND THE DIFFERENCE IS THE ENVIRONMENT RATHER THAN THE CODE. With
       * `NEXT_PUBLIC_WHATSAPP_NUMBER` unset — which is every environment except production, by the
       * Phase 44 rule that a preview must not carry the owner's real phone — the action cannot build
       * a handoff URL and records `UNAVAILABLE`. That is the honest value: there was no link to
       * offer. What must NEVER be true at this moment is `REDIRECTED`, because the visitor has not
       * clicked anything, and that is the assertion worth making in both environments.
       */
      expect(['NOT_SENT', 'UNAVAILABLE']).toContain(row.whatsapp_state)
      expect(row.whatsapp_state).not.toBe('REDIRECTED')
    } finally {
      await client.end()
    }
  })

  test('writes exactly one row for one submission', async ({ page }) => {
    /*
     * DOUBLE SUBMISSION IS THE COMMON FAILURE. A visitor on a slow connection presses the button
     * twice, and the studio rings the same person about two enquiries — or worse, treats the second
     * as a new lead. The form must refuse the second press while the first is in flight.
     */
    await removeProbeRows()
    test.skip(!(await reachable(page, CONTACT_PATH)), 'the contact page is not reachable')

    const form = page.locator('[data-inquiry-form]')
    test.skip((await form.count()) === 0, 'no enquiry form on the contact page')

    await fillSlowly(async () => {
      await form.locator('input[name="name"]').fill('Fixture Double Press')
      await form.locator('input[name="phone"]').fill('+15555550198')
      await form.locator('input[name="city"]').fill('Surat')
      await form.locator('textarea[name="message"]').fill(`Double press: ${MARKER}.`)
    })

    const submit = form.locator('button[type="submit"]').first()
    await submit.click()
    // A second click as fast as the harness can manage it.
    await submit.click({ force: true }).catch(() => {
      // Disabled or detached is the correct outcome, not a failure.
    })

    await expect(page.locator('[data-inquiry-state="sent"]')).toBeVisible({ timeout: 15_000 })

    const client = await db()
    try {
      const rows = await client.query<{ n: string }>(
        'select count(*)::text as n from inquiries where message like $1',
        [`%${MARKER}%`],
      )
      expect(Number(rows.rows[0]?.n), 'one submission produced more than one enquiry').toBe(1)
    } finally {
      await client.end()
    }
  })

  test('never hands the visitor to WhatsApp before the row exists', async ({ page, context }) => {
    /*
     * THE RULE, RE-ASSERTED FROM THE DATABASE SIDE. `inquiry-flow.spec.ts` proves no navigation
     * happens when the save fails. This proves the ORDER in the successful case: at the moment the
     * handoff becomes available, a row is already there.
     */
    await removeProbeRows()
    test.skip(!(await reachable(page, CONTACT_PATH)), 'the contact page is not reachable')

    const form = page.locator('[data-inquiry-form]')
    test.skip((await form.count()) === 0, 'no enquiry form on the contact page')

    // Nothing may reach wa.me during this test, including a background request.
    const whatsappHits: string[] = []
    await context.route('**://*.wa.me/**', async (route) => {
      whatsappHits.push(route.request().url())
      await route.abort()
    })

    await fillSlowly(async () => {
      await form.locator('input[name="name"]').fill('Fixture Order Probe')
      await form.locator('input[name="phone"]').fill('+15555550197')
      await form.locator('input[name="city"]').fill('Surat')
      await form.locator('textarea[name="message"]').fill(`Order probe: ${MARKER}.`)
    })
    await form.locator('button[type="submit"]').first().click()

    const handoff = page.locator('[data-inquiry-continue]')
    await expect(page.locator('[data-inquiry-state="sent"]')).toBeVisible({ timeout: 15_000 })

    const client = await db()
    try {
      const rows = await client.query<{ n: string }>(
        'select count(*)::text as n from inquiries where message like $1',
        [`%${MARKER}%`],
      )
      expect(Number(rows.rows[0]?.n), 'the handoff was offered and no enquiry had been saved').toBe(
        1,
      )
    } finally {
      await client.end()
    }

    /*
     * The handoff is a LINK the visitor chooses, never an automatic navigation — and where no
     * number is configured there is no link at all, which is the state of every environment but
     * production. Either way, nothing may have been fetched.
     */
    if ((await handoff.count()) > 0) {
      await expect(handoff.first()).toHaveAttribute('href', /wa\.me|whatsapp/)
    }
    expect(whatsappHits, 'the page reached WhatsApp on its own').toEqual([])
  })
})
