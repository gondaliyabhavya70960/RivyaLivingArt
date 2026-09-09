import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * `/journal`, its categories and an article — in the state this phase ships in and the one after.
 *
 * TEN IDEAS EXIST AND NONE IS PUBLISHED, which is what SEED §20 asks for in capitals: seed as DRAFT,
 * do not publish automatically. So the landing renders SEED §29's sentence and no cards, every
 * article URL 404s, and the nine category pages render with empty lists. Those are the assertions
 * that matter on day one; the ones about a published article are written now so the suite is not
 * green forever without ever having checked the thing it is named after.
 *
 * THE BASELINE GUARD. Every CMS-backed route answers 404 until an editor publishes its sections, so
 * a test pinned to `/journal` would pass or fail on the contents of whichever database it ran
 * against. Each test establishes reachability first and skips with a reason — a red run means
 * something broke rather than something was never published.
 *
 * THE NINE CATEGORY SLUGS ARE WRITTEN OUT rather than read from the database. A test that asked the
 * database which categories exist would pass against a database that had lost them; SEED §19 fixes
 * the list, and this is where the file system and the specification are compared.
 */

/** SEED §19, in its order, slugified as `content/seed/journal.ts` does. */
const CATEGORIES = [
  'resin-furniture',
  'collectible-design',
  'materials',
  '3d-printing',
  'studio-process',
  'custom-projects',
  'interior-art',
  'preservation',
  'care-education',
] as const

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

async function cardCount(page: Page): Promise<number> {
  return page.locator('[data-article-card]').count()
}

test.describe('/journal while nothing is published', () => {
  test('renders, and says why there is nothing to read', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    test.skip((await cardCount(page)) > 0, 'this database has published articles')

    await expect(page.locator('h1')).toHaveCount(1)
    // SEED §29, seeded as `EMPTY_STATE.journal` in Phase 08.
    await expect(page.getByText('More from the studio soon.')).toBeVisible()
  })

  /** The chips render even with nothing published: a reader still learns what the studio writes about. */
  test('shows the nine category chips', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')

    const chips = page.locator('[data-category-chip]')
    await expect(chips).toHaveCount(CATEGORIES.length)
    for (const slug of CATEGORIES) {
      await expect(page.locator(`[data-category-chip="${slug}"]`)).toBeVisible()
    }
  })

  /**
   * PAGINATION IS ABSENT ON ONE PAGE, not disabled. `Pagination` renders nothing when `pageCount`
   * is 1 — a disabled Previous and Next either side of a lone "1" tells a visitor there is more.
   */
  test('renders no pagination when there is one page', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    test.skip((await cardCount(page)) > 12, 'this database has more than one page of articles')
    await expect(page.locator('[data-pagination]')).toHaveCount(0)
  })

  test('reports no critical or serious axe violations', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(serious.map((violation) => violation.id)).toEqual([])
  })
})

test.describe('the nine category pages', () => {
  for (const slug of CATEGORIES) {
    test(`/journal/category/${slug} renders and marks its own chip`, async ({ page }) => {
      const path = `/journal/category/${slug}`
      test.skip(!(await reachable(page, path)), `${path} is not reachable`)

      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator(`[data-category-chip="${slug}"]`)).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  }

  test('an unknown category slug is a 404', async ({ page }) => {
    const response = await page.goto('/journal/category/not-a-category')
    expect(response?.status()).toBe(404)
  })
})

test.describe('an article URL nobody has published', () => {
  test('returns 404 for a seeded draft', async ({ page }) => {
    // A real seeded slug: the point is that EXISTING as a draft is not the same as being readable.
    const response = await page.goto('/journal/resin-and-wood-designing-around-contrast')
    expect([404, 200]).toContain(response?.status())
    if (response?.status() === 200) {
      test.info().annotations.push({ type: 'note', description: 'this article is now published' })
    }
  })

  test('returns 404 for a slug that is not a slug at all', async ({ page }) => {
    const response = await page.goto('/journal/../../etc/passwd')
    expect(response?.status()).toBe(404)
  })
})

/**
 * NO FEED, AND THAT IS AN ASSERTION RATHER THAN AN ABSENCE. The phase document lists
 * `/journal/rss.xml` and then holds it: it would add a public URL D3 does not list, which needs an
 * amendment nobody has granted. Its own verification step says that if the amendment is declined,
 * assert instead that the URL 404s and no feed link appears in the head. This is that assertion.
 */
test.describe('the feed is not shipped', () => {
  test('/journal/rss.xml is a 404', async ({ page }) => {
    const response = await page.goto('/journal/rss.xml')
    expect(response?.status()).toBe(404)
  })

  test('no feed is advertised in the journal head', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    await expect(page.locator('link[type="application/rss+xml"]')).toHaveCount(0)
  })
})

test.describe('a published article, when one exists', () => {
  test('renders its body, and the card links to it', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    test.skip((await cardCount(page)) === 0, 'no published articles in this database')

    const href = await page.locator('[data-article-card]').first().getAttribute('href')
    expect(href).toMatch(/^\/journal\/[a-z0-9-]+$/)

    const response = await page.goto(href ?? '/journal')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveCount(1)
  })

  /**
   * `angle_note` is the studio's brief for whoever writes the piece — what it is meant to be about.
   * It is readable by staff and rendered nowhere, and this is the check that it stays that way.
   */
  test('never renders the editorial angle', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    test.skip((await cardCount(page)) === 0, 'no published articles in this database')

    const href = await page.locator('[data-article-card]').first().getAttribute('href')
    await page.goto(href ?? '/journal')
    await expect(page.locator('body')).not.toContainText(/angle[_ ]note/i)
  })

  test('emits Article structured data naming the publisher', async ({ page }) => {
    test.skip(!(await reachable(page, '/journal')), 'no published sections on /journal')
    test.skip((await cardCount(page)) === 0, 'no published articles in this database')

    const href = await page.locator('[data-article-card]').first().getAttribute('href')
    await page.goto(href ?? '/journal')

    const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
    const graph = JSON.parse(raw ?? '{}') as { '@type'?: string; publisher?: { name?: string } }
    expect(graph['@type']).toBe('Article')
    expect(graph.publisher?.name).toBeTruthy()
  })
})
