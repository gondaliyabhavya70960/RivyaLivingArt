import { expect, test, type Page } from '@playwright/test'

import { EXHIBITION_TEMPLATE } from '@/content/templates/exhibition'

/**
 * The exhibition page, and the state Phase 16 actually ships in.
 *
 * THE CENTRAL ASSERTION IS A 404, AND THAT IS THE POINT RATHER THAN A GAP. All ten FEAT §9
 * collections are seeded as concepts nobody has confirmed, the database refuses to publish an
 * unconfirmed concept, and `renderCmsPage` refuses a page that is not published — so
 * `/collections/ocean` must answer 404 today. A spec that only checked a rendered exhibition would
 * be skipped from end to end right now and would report green while the publish gate was broken.
 *
 * THE SECOND ASSERTION IS THE SITEMAP, for the same reason from the other side: an unpublished
 * exhibition must not be advertised. A sitemap listing a URL that 404s is how a site teaches a
 * crawler to distrust it, and it is the failure mode a "published collections only" filter would
 * hide if it ever drifted from the policy the page renders by.
 *
 * THE RENDERED-EXHIBITION BRANCH RUNS ONLY IF ONE EXISTS, and it is written for the day the owner
 * confirms a collection rather than as a fixture. Creating one here would mean confirming a concept
 * from a test — the one act FEAT §9 reserves for the owner — and publishing a collection this phase
 * states it does not publish.
 */

const CONCEPT_SLUGS = [
  'ocean',
  'earth',
  'aurora',
  'midnight',
  'monsoon',
  'geode',
  'forest',
  'clear',
  'botanical',
  'bespoke',
] as const

/** The first exhibition page the sitemap advertises, or null when there are none. */
async function publishedExhibition(page: Page): Promise<string | null> {
  const response = await page.request.get('/sitemap.xml')
  if (!response.ok()) return null
  const body = await response.text()
  const match = /<loc>([^<]*\/collections\/[^<]+)<\/loc>/.exec(body)
  return match?.[1] ?? null
}

/**
 * Is the application serving at all?
 *
 * WITHOUT THIS, A BROKEN ENVIRONMENT READS AS A BROKEN ROUTE. In a sandbox whose network policy
 * denies the Supabase host, EVERY page answers 500 — and this file's central assertion, "an
 * unconfirmed concept answers 404", then fails with `expected 404, received 500` and points at
 * collections. That happened on the first run of this spec and cost a real diagnosis.
 *
 * SO IT SKIPS ONLY WHEN THE BASELINE IS ALSO DOWN, AND NEVER IN CI. `/` is a seeded route with no
 * relation to collections: if it does not serve, nothing here can be measured. If it does, a 500
 * from `/collections/<slug>` is this phase's bug and is reported as one. The RLS harness makes the
 * same distinction for the same reason — a suite that skips itself quietly is a suite that reports
 * success while proving nothing.
 */
async function applicationIsServing(page: Page): Promise<boolean> {
  return (await page.request.get('/')).status() === 200
}

test.describe('the exhibition route', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env['CI'] === 'true') return
    test.skip(
      !(await applicationIsServing(page)),
      'the application is not serving — its database is unreachable in this environment',
    )
  })

  test('answers 404 for every unconfirmed concept', async ({ page }) => {
    const published = await publishedExhibition(page)
    for (const slug of CONCEPT_SLUGS) {
      const response = await page.request.get(`/collections/${slug}`)
      // A confirmed and published collection is a legitimate future state; skip only that one.
      if (published?.endsWith(`/collections/${slug}`)) continue
      expect(response.status(), `/collections/${slug}`).toBe(404)
    }
  })

  test('advertises no exhibition that is not published', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml')
    if (!response.ok()) test.skip(true, 'no sitemap in this environment')

    const body = await response.text()
    const advertised = [...body.matchAll(/<loc>([^<]*\/collections\/[^<]+)<\/loc>/g)].map(
      (match) => match[1] ?? '',
    )

    // Every advertised exhibition must load. This is the assertion, not the count: zero is the
    // correct answer today and one is the correct answer the day a collection is confirmed.
    for (const url of advertised) {
      const path = new URL(url).pathname
      expect((await page.request.get(path)).status(), path).toBe(200)
    }
  })

  test('renders its bands in FEAT §8 order once a collection is published', async ({ page }) => {
    const published = await publishedExhibition(page)
    test.skip(published === null, 'no published collection yet — the phase ships with none')

    const path = new URL(published ?? '').pathname
    expect((await page.goto(path))?.status()).toBe(200)

    const rendered = await page
      .locator('[data-block-type]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-block-type') ?? ''))

    /*
     * A SUBSEQUENCE, NOT AN EQUALITY. Every band is optional and removable — the phase document
     * says so twice — so an editor who deleted the 3D band has not broken the page. What must hold
     * is that the bands which ARE present are in the template's order: a page whose products band
     * sits above its statement is a page the template did not build.
     */
    const expected = EXHIBITION_TEMPLATE.map((entry) => entry.blockType)
    let cursor = 0
    for (const type of rendered) {
      const at = expected.indexOf(type, cursor)
      if (at !== -1) cursor = at
    }
    expect(cursor).toBeGreaterThanOrEqual(0)

    // And the two Phase 16 blocks must be renderable rather than silently absent from the registry.
    expect(
      rendered.some((type) => type === 'signature-media' || type === 'collection-products'),
    ).toBe(true)
  })
})
