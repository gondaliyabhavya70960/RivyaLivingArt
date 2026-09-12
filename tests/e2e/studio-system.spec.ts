import { expect, test } from '@playwright/test'

import { DOC_KEYS } from '@/lib/cms/docs/allowlist'

/**
 * The three Phase 38 surfaces — verification 6, 7, 8 and 11. Anonymous: every route redirects to
 * the login. Traversal and a non-allowlisted key: 404 for a signed-in reader too. Signed in
 * (guarded by `STUDIO_STORAGE_STATE`): the environment page renders eight checks and its
 * reachability line, the documentation index lists ten documents and a document renders without
 * executing HTML, the logs page renders its filters and table.
 *
 * PHASE 46 ADDS TWO THINGS AND REBUILDS NOTHING (verification 4 and 5).
 *
 * The first is the documentation viewer's REFUSAL SET, asserted rather than assumed. Phase 38 built
 * the viewer to take an allowlist KEY, and this phase's job is to confirm that still holds now that
 * Phases 39–45 have written a great deal more prose: `.env*`, `docs/ops/SECURITY.md`, a file under
 * `supabase/migrations/`, an absolute path and a `..` traversal must each answer **404, never a
 * 500**. The distinction is the whole point — a 500 means the request reached something that tried
 * to read a path, and a 404 means it was refused before anything was read.
 *
 * The second is the `/studio` overview's "Outstanding owner verifications" card: that it renders,
 * that it shows a figure it could source or says in words why it could not, and that it does NOT
 * link into the documentation viewer — the backlog document is deliberately not an allowlisted key,
 * so such a link would 404, and widening the allowlist to make a card work is exactly the silent
 * scope creep this phase re-confirms the allowlist against.
 *
 * EVERY SIGNED-IN BLOCK SKIPS WITH A STATED REASON RATHER THAN FAILING. The local harness
 * (`scripts/db/local-rest.mjs`) is PostgREST alone with no auth server, so there is no storage
 * state to reuse and 156 Studio specs skip — a known, documented state (`docs/ops/TESTING.md` §13),
 * not a gap these specs should paper over by asserting something weaker that happens to pass
 * anonymously.
 */

const DOCS = '/studio/system/documentation'

/**
 * WHAT THE VIEWER MUST REFUSE, as the path segment a request would use, and why each is here.
 *
 * `%2F` RATHER THAN `/` IN THE TRAVERSAL AND ABSOLUTE CASES, DELIBERATELY. A URL parser resolves
 * dot segments before the request is sent — and the WHATWG algorithm treats `%2e` as a dot for
 * exactly that purpose — so a literal `../../../etc/passwd` never arrives as a parameter at all: it
 * arrives as a different path. Encoding the separator is the only way to put those characters
 * INSIDE one dynamic segment and therefore in front of the allowlist check, which is the thing
 * under test. `etc/passwd` unencoded is kept as the other half of that pair: it becomes two extra
 * segments, matches no route, and must 404 too.
 */
const REFUSED_DOC_TARGETS = [
  // `.env*`. Not one file but the family, by the shape a guess would take.
  '.env',
  '.env.local',
  '.env.example',
  // `docs/ops/SECURITY.md` — by the key it would have been given had anyone added it, and by path.
  'security',
  'docs%2Fops%2FSECURITY.md',
  // A migration. The filename is illustrative; no path under `supabase/migrations/` is servable.
  'supabase%2Fmigrations%2F0001_init.sql',
  // The specifications of record, which the viewer must never serve (Phase 46 scope, D7).
  'requirements',
  'docs%2Frequirements%2F00-SEED.md',
  // An absolute path, and two traversals.
  '%2Fetc%2Fpasswd',
  '..%2F..%2F..%2Fetc%2Fpasswd',
  '..%2F..%2F.env',
  'etc/passwd',
] as const

test.describe('an anonymous visitor', () => {
  for (const path of [
    '/studio/system/environment',
    '/studio/system/documentation',
    '/studio/operations/logs',
    '/studio/operations/workflows',
    '/studio',
  ]) {
    test(`cannot reach ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/studio\/login/)
    })
  }

  /*
   * The refusal set, one layer earlier. Signed in these answer 404; anonymous they never reach the
   * allowlist at all, because the proxy sends them to the login first — and that is worth asserting
   * on its own, since it is the half of Phase 46 verification 5 this repository's harness CAN
   * execute. It also proves the encoded separators and dot segments below do not crash the router
   * on the way past: a malformed parameter that reached something which tried to USE it would not
   * arrive at the login page.
   *
   * THE ASSERTION IS THE DESTINATION, NOT THE STATUS CODE, for the same reason every other
   * anonymous test in this file asserts a URL: `page.goto` reports the status of the page it ends on
   * — the login page — and whether THAT renders depends on the environment reaching its database,
   * which is a different fact from the one under test.
   */
  test('is sent to the login by every path the viewer must refuse', async ({ page }) => {
    for (const target of REFUSED_DOC_TARGETS) {
      await page.goto(`${DOCS}/${target}`)
      await expect(page, `${DOCS}/${target} must land on the login`).toHaveURL(/\/studio\/login/)
    }
  })
})

for (const width of [1920, 1440, 1024, 430, 390]) {
  test.describe(`the system pages at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('the environment page reports reachability and never a value', async ({ page }) => {
      await page.goto('/studio/system/environment')
      await expect(page.locator('[data-env-reachability-note]')).toContainText('reachability only')
      await expect(page.locator('[data-env-check]')).toHaveCount(8)
      const html = await page.content()
      expect(html).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/u)
      expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u)
      expect(html).not.toMatch(/postgres(ql)?:\/\/[^\s/@'"]+:[^\s@'"]+@/u)
    })

    /*
     * THE INDEX AT EVERY WIDTH; THE REFUSALS ONCE. What changes with the viewport is the two-column
     * list of keys, so that is what is asserted here. Phase 46 moved the status-code assertions into
     * their own block below and made them exhaustive — they were three spot checks here, one of
     * which accepted a 200, and one of which named a key (`scraper`) the allowlist does not have and
     * so never ran its body at all.
     */
    test('the documentation browser lists its keys', async ({ page }) => {
      await page.goto('/studio/system/documentation')
      await expect(page.locator('[data-docs-allowlist-note]')).toBeVisible()
      const listed = page.locator('[data-doc-key]')
      if ((await listed.count()) > 0) await expect(listed).toHaveCount(DOC_KEYS.length)
    })

    test('the logs page renders its filters and table', async ({ page }) => {
      await page.goto('/studio/operations/logs?level=ERROR&channel=SCRAPER')
      await expect(page.getByLabel('Log filters')).toBeVisible()
      await expect(page.locator('select[name="level"]')).toHaveValue('ERROR')
      await expect(page.locator('select[name="channel"]')).toHaveValue('SCRAPER')
    })
  })
}

/*
 * OUTSIDE THE WIDTH LOOP, DELIBERATELY. Nothing below is about layout — a status code does not
 * change with the viewport, and neither does which permission a card sits behind. The eight width
 * PROJECTS in `playwright.config.ts` already run this file once each, so these assertions are made
 * eight times as it is; repeating them five more times per project would buy nothing and cost the
 * run. The same reasoning collapses the refusal set into one test per block rather than one test per
 * path: a failure still names the path it failed on, through the assertion message.
 */
test.describe('the documentation viewer boundary, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('lists exactly the ten allowlisted documents', async ({ page }) => {
    await page.goto(DOCS)
    await expect(page.locator('[data-docs-allowlist-note]')).toBeVisible()

    // FEAT §30 fixes the number at ten, and this asserts the SHIPPED allowlist is still that size
    // — the index below can only ever be a subset of it.
    expect(DOC_KEYS).toHaveLength(10)

    const listed = page.locator('[data-doc-key]')
    // The index is a build artefact (`npm run docs:index`) and gitignored, so a checkout that has
    // not run it renders the "no index" state. That is a missing build step, not a broken
    // allowlist, and it is said rather than asserted around.
    test.skip(
      (await listed.count()) === 0,
      'the redacted documentation index is not built in this environment (npm run docs:index)',
    )
    await expect(listed).toHaveCount(DOC_KEYS.length)
    for (const key of DOC_KEYS) {
      await expect(page.locator(`[data-doc-key="${key}"]`)).toHaveCount(1)
    }
  })

  test('renders each allowlisted document, sanitised', async ({ page }) => {
    let rendered = 0
    for (const key of DOC_KEYS) {
      const response = await page.goto(`${DOCS}/${key}`)
      const status = response?.status() ?? 0
      // 404 here means the key is not in the BUILT index — the loop iterates the allowlist itself,
      // so it cannot mean the key was refused. A 5xx is never acceptable for either reason.
      expect([200, 404], `${key} answered ${String(status)}`).toContain(status)
      if (status !== 200) continue
      rendered += 1
      await expect(page.locator(`[data-doc-title="${key}"]`)).toBeVisible()
      // Phase 38's guarantee: the Markdown is rendered, never executed.
      await expect(page.locator('[data-doc-body] script')).toHaveCount(0)
      const html = await page.content()
      expect(html, `${key} must carry no value-shaped string`).not.toMatch(
        /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u,
      )
      expect(html, `${key} must carry no connection string`).not.toMatch(
        /postgres(ql)?:\/\/[^\s/@'"]+:[^\s@'"]+@/u,
      )
    }
    test.skip(
      rendered === 0,
      'the redacted documentation index is not built in this environment (npm run docs:index)',
    )
    expect(rendered, 'every allowlisted key must be in the built index').toBe(DOC_KEYS.length)
  })

  test('refuses everything outside the allowlist with a 404, never a 500', async ({ page }) => {
    for (const target of REFUSED_DOC_TARGETS) {
      const response = await page.goto(`${DOCS}/${target}`)
      const status = response?.status() ?? 0
      // 404, exactly. A 500 would say the parameter reached something that tried to read it; a 200
      // would say the allowlist is not an allowlist.
      expect(status, `${DOCS}/${target} answered ${String(status)}`).toBe(404)
    }
  })
})

test.describe('the /studio overview, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('shows outstanding owner verifications, sourced or explained', async ({ page }) => {
    await page.goto('/studio')
    // ESTABLISH THAT THE PAGE RENDERED BEFORE DECIDING ANYTHING FROM THE CARD'S ABSENCE. Without
    // this, an overview that failed to render would look exactly like an overview whose signed-in
    // role is not allowed the card, and the skip below would swallow a real failure.
    await expect(page.locator('h1')).toBeVisible()

    const card = page.locator('[data-outstanding-verifications]')

    // The card is behind `content.verify` — owner and admin — because those are the only roles that
    // can clear a row. Phase 46 verification 4 opens `/studio` AS OWNER; a storage state for any
    // other role legitimately does not show the card, and that is said rather than failed on.
    test.skip(
      (await card.count()) === 0,
      'the configured storage state is not an owner or admin session; the card is behind content.verify',
    )
    await expect(card).toBeVisible()

    // EXACTLY ONE OF THE TWO STATES. A figure the card could source, or a named reason why it could
    // not — never both, and never neither, because the absence of both is how a zero gets back in.
    const total = card.locator('[data-outstanding-verifications-total]')
    const unreadable = card.locator('[data-outstanding-verifications-unreadable]')
    expect((await total.count()) + (await unreadable.count())).toBe(1)
    if ((await unreadable.count()) === 1) {
      await expect(unreadable).not.toBeEmpty()
    } else {
      await expect(total).toHaveAttribute('data-outstanding-verifications-total', /^\d+$/u)
    }

    // Where it is allowed to point. The backlog document is not an allowlisted viewer key, so a
    // link into the viewer would 404 — and the fix is never to widen the allowlist.
    await expect(card.locator('a[href^="/studio/system/documentation"]')).toHaveCount(0)
    const hrefs = await card
      .locator('a')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href, 'every destination on the card is a Studio screen').toMatch(/^\/studio\//u)
    }

    // And it says where the written list is, since the Studio does not serve it.
    await expect(card.locator('[data-outstanding-verifications-backlog]')).toContainText(
      'INITIAL_CONTENT_INVENTORY.md',
    )
  })
})
