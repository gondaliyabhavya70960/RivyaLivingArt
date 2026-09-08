import { expect, test } from '@playwright/test'

/**
 * Studio access control, end to end.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE, stated up front because the gap matters.
 *
 * Everything here exercises the UNAUTHENTICATED paths: the `proxy.ts` redirect, the login page
 * itself, and the sign-out route's method and origin guards. None of it needs Supabase, because
 * the proxy treats an unreachable auth server exactly as it treats a request with no session —
 * it redirects.
 *
 * The AUTHENTICATED half of Phase 04 verification step 6 — "signing in as `viewer` shows the page
 * with write controls absent and a direct POST to the update action returns 403; signing in as
 * `merchandiser` succeeds" — is NOT here, and cannot be until a Supabase project is reachable.
 * There is no way to obtain a real session without the auth server: a forged cookie is refused by
 * `getUser()`, which is the whole point of using it rather than `getSession()`. Those cases are
 * marked `test.fixme` below rather than omitted, so the gap is visible in the test report instead
 * of only in a document.
 *
 * The per-role authorisation those cases would cover IS proved, at the layer beneath: 62 RLS tests
 * in tests/unit/rls exercise the full six-role matrix against a real PostgreSQL. What is missing is
 * the seam between a browser session and that layer, not the layer.
 */

const STUDIO_PATH = '/studio/catalog/products'
const LOGIN_PATH = '/studio/login'

test.describe('an anonymous visitor', () => {
  test('is redirected from a Studio page to the login page', async ({ page }) => {
    const response = await page.goto(STUDIO_PATH)

    expect(page.url()).toContain(LOGIN_PATH)
    expect(response?.status()).toBe(200)
  })

  test('carries the path they wanted through as ?next=', async ({ page }) => {
    await page.goto(STUDIO_PATH)

    const next = new URL(page.url()).searchParams.get('next')
    expect(next).toBe(STUDIO_PATH)
  })

  test('keeps the query string of the page they wanted', async ({ page }) => {
    await page.goto(`${STUDIO_PATH}?status=DRAFT`)

    const next = new URL(page.url()).searchParams.get('next')
    expect(next).toBe(`${STUDIO_PATH}?status=DRAFT`)
  })

  test('reaches the login page itself without being redirected', async ({ page }) => {
    // The matcher excludes it deliberately: matching the login page would redirect it to itself.
    await page.goto(LOGIN_PATH)
    expect(new URL(page.url()).pathname).toBe(LOGIN_PATH)
  })

  test('is redirected from every Studio section, not only the one that was tested', async ({
    page,
  }) => {
    // A matcher that covered one branch of /studio and not another would be invisible until
    // somebody reached the uncovered one while signed out.
    for (const path of [
      '/studio',
      '/studio/media/all',
      '/studio/inquiries/all',
      '/studio/system/users',
      '/studio/operations/audit',
    ]) {
      await page.goto(path)
      expect(new URL(page.url()).pathname, `${path} did not redirect`).toBe(LOGIN_PATH)
    }
  })
})

test.describe('the login page', () => {
  test('renders resolved copy, never a raw string key', async ({ page }) => {
    // The house rule is that no copy literal appears in the JSX. The failure that rule invites is
    // a lookup that misses and renders its own key, which looks like a typo rather than a bug.
    await page.goto(LOGIN_PATH)
    const body = (await page.textContent('body')) ?? ''

    expect(body).not.toMatch(/studio\.login\./)
    expect(body.trim().length).toBeGreaterThan(0)
  })

  test('offers an email and a password field, and a way to submit', async ({ page }) => {
    await page.goto(LOGIN_PATH)

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"], input[type="submit"]')).toBeVisible()
  })

  test('works without JavaScript', async ({ browser }) => {
    // The form posts to a Server Action. If it ever needs client JS to submit, a staff member on a
    // failed bundle cannot sign in to fix anything.
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(LOGIN_PATH)

    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await context.close()
  })

  test('does not become an open redirect', async ({ page }) => {
    // resolveNextPath is attacked directly in lib/auth/next-path.test.ts — 36 cases. This checks
    // that the page actually CALLS it, which a unit test cannot: a guard nothing invokes is not a
    // guard.
    //
    // The assertion is on the hidden `next` field the form will submit, NOT on the absence of the
    // hostile string from the document. The first draft asserted the latter and failed: Next
    // serialises the request URL into its RSC flight payload, so `evil.example` appears in the
    // page whatever the app does with it. That is the framework echoing the request, not the
    // application trusting it — and a test that cannot tell those apart would have to be silenced
    // rather than believed.
    for (const hostile of [
      'https://evil.example/x',
      '//evil.example/x',
      '/studio/../admin',
      '/studio/login',
      '\\\\evil.example\\x',
    ]) {
      await page.goto(`${LOGIN_PATH}?next=${encodeURIComponent(hostile)}`)

      const submitted = await page.getAttribute('input[name="next"]', 'value')
      expect(submitted, `${hostile} was carried into the form`).toBe('/studio')
    }
  })

  test('carries a legitimate next through to the form untouched', async ({ page }) => {
    // The other half: a guard that rejects everything is also broken, and looks identical to a
    // working one if only the hostile cases are tested.
    await page.goto(`${LOGIN_PATH}?next=${encodeURIComponent('/studio/catalog/products')}`)

    expect(await page.getAttribute('input[name="next"]', 'value')).toBe('/studio/catalog/products')
  })
})

test.describe('the sign-out route', () => {
  test('refuses GET, so it cannot be fired by an <img> tag', async ({ request }) => {
    const response = await request.get('/api/auth/sign-out', { maxRedirects: 0 })

    expect(response.status()).toBe(405)
    expect(response.headers()['allow']).toContain('POST')
  })

  test('refuses a cross-origin POST', async ({ request }) => {
    const response = await request.post('/api/auth/sign-out', {
      headers: { origin: 'https://evil.example' },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(403)
  })

  test('refuses a POST with no Origin at all', async ({ request }) => {
    // Every browser sends Origin on a cross-site POST, so its absence is not a browser.
    const response = await request.post('/api/auth/sign-out', { maxRedirects: 0 })
    expect(response.status()).toBe(403)
  })
})

/**
 * The authenticated half of verification step 6.
 *
 * `fixme` rather than deleted: these are the cases that remain unproved, and a test report naming
 * them is harder to forget than a paragraph in a phase document. Remove the annotations once a
 * Supabase project is reachable and a fixture can create the two accounts.
 */
test.describe('a signed-in staff member', () => {
  test.fixme(
    true,
    'needs a reachable Supabase project — no real session can be obtained without the auth server',
  )

  test('viewer sees the catalogue page but no write controls', async () => {})
  test('viewer POSTing directly to an update action is refused', async () => {})
  test('merchandiser can reach the catalogue page and write', async () => {})
  test('a suspended account is treated as signed out', async () => {})
})
