import { expect, test } from '@playwright/test'

/**
 * The Higgsfield tracker at `/studio/media/higgsfield`, end to end.
 *
 * WHAT THIS FILE PROVES, AND WHAT PROVES THE REST. The tracker is behind `requirePermission
 * ('media.read')`, so every assertion about its CONTENT needs a real Supabase session — and a
 * session cannot be forged, because `getUser()` validates it against the auth server, which is the
 * reason Phase 04 uses it rather than `getSession()`. The same wall `studio-access.spec.ts`
 * documents applies here.
 *
 * So the runnable half below covers the routing and permission seam: every tab and the drawer are
 * real URLs, and each is refused to an anonymous visitor with the whole address preserved in
 * `?next=` so the reader lands where they were going after signing in. That seam is genuinely this
 * file's to prove — no unit test can see it.
 *
 * The content half is `test.fixme`, written out in full rather than omitted, so the gap shows up
 * in the test report rather than only in a document. Its assertions are not unproven in the
 * meantime, and that is the point of the split:
 *
 *   - the three filter counts of verification step 7 (family `material-macro` → 39, page
 *     `process` → 79, type video → 26) are asserted against the real 250-asset manifest in
 *     `tests/unit/media-inventory.test.ts`;
 *   - verification step 8's seven gap pages are asserted in `tests/unit/media-gaps.test.ts`;
 *   - "no regenerate control" is enforced as a build gate by
 *     `scripts/media/assert-no-regeneration.ts` rule 4, over every file in `app/`, `components/`,
 *     `lib/` and `content/` — which is a stronger guarantee than a browser assertion, because it
 *     fails on the commit that adds the control rather than on the run that happens to look.
 *
 * What the fixmes would add is that the page is WIRED to all of that: that the filter form submits
 * the parameter the predicate reads, and that the Gaps tab renders the report it is handed.
 */

const TRACKER = '/studio/media/higgsfield'
const LOGIN = '/studio/login'
const TABS = ['inventory', 'families', 'gaps'] as const

test.describe('routing and the permission seam', () => {
  test('the tracker is refused to an anonymous visitor', async ({ page }) => {
    const response = await page.goto(TRACKER)

    expect(page.url()).toContain(LOGIN)
    expect(response?.status()).toBe(200)
  })

  for (const tab of TABS) {
    test(`the ${tab} tab is a real URL and is refused anonymously`, async ({ page }) => {
      // Each tab being its own address is what makes it linkable and testable, and is why the
      // tracker uses links rather than the RC-203 client widget. If a tab ever stopped carrying
      // its own URL this assertion is what would notice.
      await page.goto(`${TRACKER}?tab=${tab}`)

      const next = new URL(page.url()).searchParams.get('next')
      expect(next).toBe(`${TRACKER}?tab=${tab}`)
    })
  }

  test('a drawer link carries both the tab and the asset through the redirect', async ({
    page,
  }) => {
    // Somebody pastes a link to one asset into a message. After signing in they must land on that
    // asset, not on the default tab with the drawer shut.
    const deepLink = `${TRACKER}?tab=inventory&asset=WALL-ART-001`
    await page.goto(deepLink)

    expect(new URL(page.url()).searchParams.get('next')).toBe(deepLink)
  })

  test('an unknown tab does not 500', async ({ page }) => {
    // `?tab=` is user input. It falls back to Inventory rather than throwing — the page still
    // renders (as a redirect to login here), which is what this asserts.
    const response = await page.goto(`${TRACKER}?tab=nonsense`)

    expect(response?.status()).toBe(200)
    expect(page.url()).toContain(LOGIN)
  })
})

test.describe('the tracker itself', () => {
  // Every test below needs an authenticated session holding `media.read`. See the header.
  test.fixme('shows the concept banner on all three tabs', async ({ page }) => {
    for (const tab of TABS) {
      await page.goto(`${TRACKER}?tab=${tab}`)
      await expect(
        page.getByText('Concept media. Never presented as completed, delivered Rivya work.'),
      ).toBeVisible()
    }
  })

  test.fixme('filters the inventory to 39 rows for material-macro', async ({ page }) => {
    await page.goto(`${TRACKER}?tab=inventory&family=material-macro`)
    await expect(page.getByRole('row')).toHaveCount(39 + 1) // + the header row
  })

  test.fixme('filters the inventory to 79 rows for the process page', async ({ page }) => {
    await page.goto(`${TRACKER}?tab=inventory&page=process`)
    await expect(page.getByRole('row')).toHaveCount(79 + 1)
  })

  test.fixme('filters the inventory to 26 rows for videos', async ({ page }) => {
    await page.goto(`${TRACKER}?tab=inventory&type=video`)
    await expect(page.getByRole('row')).toHaveCount(26 + 1)
  })

  test.fixme('submitting the filter form keeps the reader on the tab they filtered from', async ({
    page,
  }) => {
    await page.goto(`${TRACKER}?tab=inventory`)
    await page.getByLabel('Type').selectOption('video')
    await page.getByRole('button', { name: 'Apply filters' }).click()

    const url = new URL(page.url())
    expect(url.searchParams.get('tab')).toBe('inventory')
    expect(url.searchParams.get('type')).toBe('video')
  })

  test.fixme('lists every gap page verification step 8 names', async ({ page }) => {
    await page.goto(`${TRACKER}?tab=gaps`)

    for (const route of [
      '/',
      '/collection',
      '/collection/furniture',
      '/collection/collectible-design',
      '/custom-commissions',
      '/contact',
      '/faq',
    ]) {
      await expect(page.getByRole('heading', { name: route, exact: true })).toBeVisible()
    }
  })

  test.fixme('opens the asset drawer and offers no regeneration control', async ({ page }) => {
    await page.goto(`${TRACKER}?tab=inventory&asset=WALL-ART-001`)

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('WALL-ART-001')).toBeVisible()
    // The absence is the assertion. `assert-no-regeneration.ts` rule 4 enforces it at build time;
    // this would confirm nothing reintroduced it through a shared component.
    await expect(drawer.getByRole('button', { name: /regenerate|generate/i })).toHaveCount(0)
  })

  test.fixme('closing the drawer returns to the tab it was opened from', async ({ page }) => {
    await page.goto(`${TRACKER}?tab=families&asset=WALL-ART-001`)
    await page.getByRole('button', { name: 'Close' }).click()

    const url = new URL(page.url())
    expect(url.searchParams.get('tab')).toBe('families')
    expect(url.searchParams.get('asset')).toBeNull()
  })
})
