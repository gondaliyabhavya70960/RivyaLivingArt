import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { largeFormatSeed } from '@/content/seed/large-format'

/**
 * `/large-format`, and the two ways this page can lie.
 *
 * IT CAN CLAIM A CAPABILITY. Three of the six groupings are marked by SEED §12 — Conference &
 * Commercial Tables and Architectural & Statement Pieces outright, Sculptural Seating conditionally
 * on production nobody has confirmed — so the launch composition is three cards, not six, and the
 * three withheld keys must appear nowhere in the DOM.
 *
 * IT CAN OFFER A DOOR THAT DOES NOT OPEN. Both calls to action point at `/custom-commissions`,
 * which Phase 19 builds: the route file exists, the `pages` row exists, every section on it is
 * DRAFT. `resolveInternalTarget` drops a link whose destination is not live, so the assertion here
 * is that every anchor INSIDE the page body resolves — the chrome's navigation is Phase 10's
 * surface and is deliberately out of scope.
 */

const PATH = '/large-format'

const ENTRIES = (() => {
  const list = largeFormatSeed.records.find(
    (record) => record.fields['block_type'] === 'category-list',
  )
  const payload = (list?.fields['payload'] ?? {}) as {
    entries?: readonly Record<string, unknown>[]
  }
  return payload.entries ?? []
})()

const WITHHELD = ENTRIES.filter(
  (entry) => entry['owner_verification'] === 'OWNER_VERIFICATION_REQUIRED',
).map((entry) => String(entry['key']))

async function published(page: Page): Promise<boolean> {
  const response = await page.goto(PATH)
  return response?.status() === 200
}

test.describe('/large-format', () => {
  test('renders its published sections in seeded order', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /large-format in this database')

    const seeded = largeFormatSeed.records.map((record) => String(record.fields['block_type']))
    const rendered = await page
      .locator('[data-block-type]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-block-type') ?? ''))

    let cursor = -1
    for (const blockType of rendered) {
      const next = seeded.indexOf(blockType, cursor + 1)
      expect(next, `${blockType} is out of seeded order`).toBeGreaterThan(cursor)
      cursor = next
    }
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('withholds the unconfirmed groupings and renders the rest', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /large-format in this database')

    expect(WITHHELD.length, 'SEED §12 marks three of the six').toBe(3)

    const rendered = await page
      .locator('[data-entry-key]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entry-key') ?? ''))

    for (const key of WITHHELD) expect(rendered).not.toContain(key)
    // The confirmed three still render: withholding an entry must not take its list with it.
    expect(rendered).toEqual(
      ENTRIES.map((entry) => String(entry['key'])).filter((key) => !WITHHELD.includes(key)),
    )
  })

  test('keeps the customization statement off the page until it is verified', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /large-format in this database')

    // Withheld one level up from the groupings: the whole section is the claim, so the publish
    // trigger refuses the row and the renderer refuses it again.
    await expect(page.locator('[data-block-type="customization-note"]')).toHaveCount(0)
  })

  test('renders no anchor in its body that does not resolve', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /large-format in this database')

    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))

    for (const href of hrefs) {
      expect(href, 'an empty or inert href inside the page body').not.toBe('')
      expect(href).not.toBe('#')
      if (!href.startsWith('/')) continue
      const response = await page.request.get(href)
      expect(response.status(), `${href} is linked from the body and does not resolve`).toBe(200)
    }
  })

  test('names no price, dimension, weight or seat count', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /large-format in this database')

    const text = (await page.locator('main').innerText()).toLowerCase()
    const forbidden = /[₹$€]|\d+\s?(mm|cm|m|in|ft|kg)\b|seats?\b|client|award/
    expect(forbidden.exec(text)?.[0] ?? null, `forbidden copy on ${PATH}`).toBeNull()
  })

  test('reports no critical or serious axe violation', async ({ page }) => {
    test.skip(!(await published(page)), 'no published sections on /large-format in this database')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(
      blocking.map((v) => `${v.id} (${v.impact}) — ${v.nodes[0]?.target.join(' ')}`),
      'critical/serious axe violations',
    ).toEqual([])
  })
})
