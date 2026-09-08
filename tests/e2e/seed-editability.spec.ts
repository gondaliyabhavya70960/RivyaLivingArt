import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

/**
 * SEED §54's target, checked rather than asserted: every seeded row is editable at the Studio
 * location the inventory names.
 *
 * WHAT THIS FILE PROVES TODAY, AND WHAT IT CANNOT. The inventory is generated from the database
 * and names a Studio path per row; this file reads that file and checks the paths it claims. The
 * part that needs no session — that every claimed location is a real route, that none of them
 * 404s for an anonymous visitor but redirects to login instead — runs.
 *
 * The part that needs a session — opening `/studio/content/pages/home` as an editor and finding an
 * input holding the seeded heading — is `test.fixme`, for the same reason the rest of the suite's
 * authenticated cases are: there is no way to obtain a real session without a reachable Supabase
 * auth server, and a forged cookie is refused by `getUser()`, which is the point of using it. The
 * gap is visible in the test report rather than only in a document.
 *
 * What the fixmes would cover IS proved one layer down, differently: `tests/unit/seed-modules.test.ts`
 * asserts every record targets an allowed table and carries a `seed_key`, and the inventory
 * generator reads the rows back out of the database and finds them. What is unproved is the seam
 * between a browser and those rows.
 */

const INVENTORY = 'docs/content/INITIAL_CONTENT_INVENTORY.md'

/** Every distinct Studio location the inventory claims, minus the two deferred placeholders. */
function claimedLocations(): string[] {
  const md = readFileSync(INVENTORY, 'utf8')
  const paths = new Set<string>()
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    const location = cells[6]?.replace(/`/g, '') ?? ''
    if (location.startsWith('/studio/')) paths.add(location)
  }
  return [...paths].sort()
}

test.describe('the inventory names real Studio locations', () => {
  test('claims at least one location per Studio surface the seed writes', () => {
    const locations = claimedLocations()
    expect(locations.length).toBeGreaterThan(0)
    // The four standalone tables each have their own surface, plus the page editor.
    expect(locations).toContain('/studio/content/navigation')
    expect(locations).toContain('/studio/content/faqs')
    expect(locations).toContain('/studio/content/seo')
    expect(locations.some((l) => l.startsWith('/studio/content/pages/'))).toBe(true)
  })

  /**
   * A location that does not exist is the failure §54's target is really about: a row can be in
   * the database, and listed as editable, and have nowhere to edit it. An anonymous request to a
   * real Studio route redirects to login; a request to a route that does not exist 404s. The
   * difference is what this distinguishes.
   */
  test('every claimed location is a route that exists', async ({ page }) => {
    for (const location of claimedLocations()) {
      const response = await page.goto(location)
      expect(response?.status(), `${location} should not 404`).not.toBe(404)
      expect(page.url(), `${location} should be behind the login redirect`).toContain(
        '/studio/login',
      )
    }
  })
})

test.describe('a signed-in editor', () => {
  test.fixme('finds the seeded homepage hero heading in an editable control', async ({ page }) => {
    // Requires a real Supabase session. Would sign in as editor, open
    // /studio/content/pages/home, open the hero section and assert the heading input holds
    // "Objects shaped by flow." — the value content/seed/homepage.ts writes.
    await page.goto('/studio/content/pages/home')
  })

  test.fixme('can change a seeded heading and see it persist', async ({ page }) => {
    // Would edit the heading, save, reload, and assert the new value — then assert `owner_edited`
    // is set, which is what makes the next seed run leave it alone. The database half of that is
    // already proved in the Phase 09 verification run.
    await page.goto('/studio/content/pages/home')
  })

  test.fixme('cannot publish a section flagged for owner verification', async ({ page }) => {
    // Would open the About "scale" section and attempt APPROVED -> PUBLISHED, expecting the RV002
    // refusal naming owner_verification. Proved against the database directly in verification
    // step 8; what is unproved is that the refusal reaches the editor legibly.
    await page.goto('/studio/content/pages/about')
  })
})
